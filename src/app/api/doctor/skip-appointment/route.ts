import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendMissedAppointmentWhatsApp } from "@/server/missedAppointmentNotify"
import { getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { applyRateLimit } from "@/utils/shared/rateLimit"

function getSlotDocId(doctorId: string, date: string, time: string): string {
  return `${doctorId}_${date}_${time.replace(/[:\s]/g, "-")}`
}

/**
 * POST /api/doctor/skip-appointment
 * Doctor marks patient as no-show and sends missed_appointment WhatsApp.
 */
export async function POST(request: Request) {
  const rateLimitResult = await applyRateLimit(request, "BOOKING")
  if (rateLimitResult instanceof Response) return rateLimitResult

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user?.role !== "doctor") {
    return NextResponse.json({ error: "Access denied. Doctors only." }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("doctor skip-appointment API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const appointmentId =
      typeof body?.appointmentId === "string" ? body.appointmentId.trim() : ""
    const hospitalId =
      typeof body?.hospitalId === "string" ? body.hospitalId.trim() : ""

    if (!appointmentId || !hospitalId) {
      return NextResponse.json(
        { error: "appointmentId and hospitalId are required" },
        { status: 400 }
      )
    }

    const firestore = admin.firestore()
    const appointmentRef = firestore
      .collection(getHospitalCollectionPath(hospitalId, "appointments"))
      .doc(appointmentId)
    const appointmentSnap = await appointmentRef.get()

    if (!appointmentSnap.exists) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
    }

    const appointment = appointmentSnap.data()!
    const currentStatus = appointment.status || ""

    if (currentStatus === "completed") {
      return NextResponse.json(
        { error: "Cannot skip a completed appointment" },
        { status: 400 }
      )
    }
    if (currentStatus === "cancelled") {
      return NextResponse.json(
        { error: "Cannot skip a cancelled appointment" },
        { status: 400 }
      )
    }
    if (currentStatus === "no_show" || currentStatus === "not_attended") {
      return NextResponse.json(
        { error: "Appointment is already marked as missed" },
        { status: 400 }
      )
    }
    if (currentStatus !== "confirmed") {
      return NextResponse.json(
        { error: "Only confirmed appointments can be skipped" },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()
    await appointmentRef.update({
      status: "no_show",
      noShowAt: nowIso,
      skippedByDoctor: auth.user?.uid || "unknown",
      doctorNotes: "Patient did not come (skipped by doctor).",
      updatedAt: nowIso,
    })

    const doctorId = appointment.doctorId as string | undefined
    const appointmentDate = appointment.appointmentDate as string | undefined
    const appointmentTime = appointment.appointmentTime as string | undefined
    if (doctorId && appointmentDate && appointmentTime) {
      try {
        await firestore
          .collection("appointmentSlots")
          .doc(getSlotDocId(doctorId, appointmentDate, appointmentTime))
          .delete()
      } catch {
        // slot may already be released
      }
    }

    const patientPhone =
      (appointment.patientPhone as string) ||
      (appointment.patientPhoneNumber as string) ||
      ""
    let whatsappSent = false
    let whatsappError: string | undefined

    if (patientPhone.trim()) {
      const whatsappResult = await sendMissedAppointmentWhatsApp({
        to: patientPhone,
        patientName: (appointment.patientName as string) || "Patient",
        doctorName: (appointment.doctorName as string) || "Doctor",
        appointmentDate: appointmentDate || "",
        appointmentTime: appointmentTime || "",
      })
      whatsappSent = whatsappResult.success
      whatsappError = whatsappResult.error

      if (whatsappResult.success) {
        try {
          await firestore.collection("not_attended_messages").add({
            appointmentId,
            patientId: appointment.patientId || appointment.patientUid || "",
            patientPhone,
            patientName: appointment.patientName || "Patient",
            doctorName: appointment.doctorName || "Doctor",
            appointmentDate: appointmentDate || "",
            appointmentTime: appointmentTime || "",
            sentAt: nowIso,
            status: "sent",
            messageId: whatsappResult.sid,
            hospitalId,
            source: "doctor_skip",
          })
        } catch {
          // non-blocking
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Appointment skipped",
      status: "no_show",
      whatsappSent,
      whatsappError,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to skip appointment"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
