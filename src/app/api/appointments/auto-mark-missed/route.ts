import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendMissedAppointmentWhatsApp } from "@/server/missedAppointmentNotify"
import { getAllActiveHospitals, getHospitalCollectionPath } from "@/shared/utils/firebase/serverHospitalQueries"

const ACTIVE_STATUSES = new Set(["confirmed", "waiting", "in_consultation"])

function isCronTriggerRequest(request: Request): boolean {
  if (request.headers.get("x-vercel-cron") !== null) return true
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7).trim() === cronSecret) {
    return true
  }
  const secretHeader = request.headers.get("x-cron-secret")
  if (secretHeader === cronSecret) return true
  return false
}

/** Today as YYYY-MM-DD in India timezone. */
function getIstDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

/**
 * True when the appointment slot day has ended (IST) or the slot + grace window passed today.
 */
function shouldAutoMarkMissed(
  appointmentDate: string,
  appointmentTime: string,
  graceHours = 2
): boolean {
  const todayIst = getIstDateString()
  if (!appointmentDate) return false
  if (appointmentDate < todayIst) return true
  if (appointmentDate > todayIst) return false
  if (!appointmentTime) return false

  const [hours, minutes] = appointmentTime.split(":").map(Number)
  if (isNaN(hours)) return false

  const slotStart = new Date(
    `${appointmentDate}T${String(hours).padStart(2, "0")}:${String(minutes || 0).padStart(2, "0")}:00+05:30`
  )
  const cutoffMs = slotStart.getTime() + graceHours * 60 * 60 * 1000
  return Date.now() >= cutoffMs
}

/**
 * GET /api/appointments/auto-mark-missed
 * Daily cron: mark uncompleted past appointments as not_attended + WhatsApp.
 */
export async function GET(request: Request) {
  const isCronTrigger = isCronTriggerRequest(request)

  if (!isCronTrigger) {
    const { authenticateRequest, createAuthErrorResponse } = await import("@/shared/utils/firebase/apiAuth")
    const auth = await authenticateRequest(request, "admin")
    if (!auth.success) {
      return createAuthErrorResponse(auth)
    }
  }

  try {
    const initResult = initFirebaseAdmin("auto-mark-missed API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const db = admin.firestore()
    const now = new Date()
    const nowIso = now.toISOString()
    const hospitals = await getAllActiveHospitals()

    let totalMarked = 0
    let totalWhatsAppSent = 0
    let totalSkipped = 0
    let totalErrors = 0
    const results: Array<{
      hospitalId: string
      hospitalName: string
      marked: number
      whatsappSent: number
      errors: number
    }> = []

    for (const hospital of hospitals) {
      let hospitalMarked = 0
      let hospitalWhatsAppSent = 0
      let hospitalErrors = 0

      try {
        const appointmentsRef = db.collection(
          getHospitalCollectionPath(hospital.id, "appointments")
        )

        const openAppointments = await appointmentsRef
          .where("status", "in", [...ACTIVE_STATUSES])
          .get()

        for (const aptDoc of openAppointments.docs) {
          try {
            const apt = aptDoc.data()
            const appointmentId = aptDoc.id
            const appointmentDate = String(apt.appointmentDate || "")
            const appointmentTime = String(apt.appointmentTime || "")

            if (!shouldAutoMarkMissed(appointmentDate, appointmentTime)) {
              totalSkipped++
              continue
            }

            if (apt.autoMissedAt || apt.notAttendedAt) {
              totalSkipped++
              continue
            }

            const patientPhone = apt.patientPhone || apt.patientPhoneNumber || ""
            const patientName = apt.patientName || "Patient"
            const doctorName = apt.doctorName || "Doctor"

            await aptDoc.ref.update({
              status: "not_attended",
              notAttendedAt: nowIso,
              autoMissedAt: nowIso,
              autoMissedBy: "cron",
              markedNotAttendedBy: "auto_cron",
              updatedAt: nowIso,
            })
            hospitalMarked++
            totalMarked++

            if (!patientPhone || String(patientPhone).trim() === "") {
              continue
            }

            const missedMessageDocId = `${hospital.id}_${appointmentId}`
            const missedMessageRef = db.collection("not_attended_messages").doc(missedMessageDocId)
            try {
              await missedMessageRef.create({
                appointmentId,
                patientId: apt.patientId || apt.patientUid || "",
                patientPhone,
                patientName,
                doctorName,
                appointmentDate,
                appointmentTime,
                sentAt: nowIso,
                status: "processing",
                hospitalId: hospital.id,
                source: "auto_cron",
              })
            } catch {
              continue
            }

            const whatsappResult = await sendMissedAppointmentWhatsApp({
              to: patientPhone,
              patientName,
              doctorName,
              appointmentDate,
              appointmentTime,
            })

            if (whatsappResult.success) {
              hospitalWhatsAppSent++
              totalWhatsAppSent++
              await missedMessageRef.set(
                { status: "sent", messageId: whatsappResult.sid },
                { merge: true }
              )
            } else {
              await missedMessageRef.set(
                { status: "failed", error: whatsappResult.error || "send failed" },
                { merge: true }
              )
            }
          } catch {
            hospitalErrors++
            totalErrors++
          }
        }

        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          marked: hospitalMarked,
          whatsappSent: hospitalWhatsAppSent,
          errors: hospitalErrors,
        })
      } catch {
        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          marked: 0,
          whatsappSent: 0,
          errors: 1,
        })
        totalErrors++
      }
    }

    try {
      await db.collection("cron_logs").add({
        job: "auto_mark_missed",
        executedAt: nowIso,
        triggeredBy: isCronTrigger ? "cron" : "manual",
        success: totalErrors === 0,
        summary: {
          totalMarked,
          totalWhatsAppSent,
          totalSkipped,
          totalErrors,
        },
        results,
      })
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "Auto missed-appointment check completed",
      istDate: getIstDateString(now),
      summary: {
        totalMarked,
        totalWhatsAppSent,
        totalSkipped,
        totalErrors,
        hospitalsProcessed: hospitals.length,
      },
      results,
      timestamp: nowIso,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to auto-mark missed appointments"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"
