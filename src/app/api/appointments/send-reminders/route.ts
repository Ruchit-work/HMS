import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { getAllActiveHospitals, getHospitalCollectionPath } from "@/utils/firebase/serverHospitalQueries"

export async function GET(request: Request) {
  const isCronTrigger = request.headers.get("x-vercel-cron") !== null
  
  // Allow cron or admin access
  if (!isCronTrigger) {
    const { authenticateRequest, createAuthErrorResponse } = await import("@/utils/firebase/apiAuth")
    const auth = await authenticateRequest(request, "admin")
    if (!auth.success) {
      return createAuthErrorResponse(auth)
    }
  }

  try {
    const initResult = initFirebaseAdmin("appointment-reminders API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const db = admin.firestore()
    const now = new Date()
    
    // Reminders should go ~24 hours before the appointment.
    // Hobby cron can be up to ~1h late; with hourly runs, use a wider ±90m window to avoid misses.
    const windowStart = new Date(now.getTime() - 90 * 60 * 1000) // 90 minutes ago
    const windowEnd = new Date(now.getTime() + 90 * 60 * 1000) // 90 minutes from now

    // Get all active hospitals
    const hospitals = await getAllActiveHospitals()
    let totalRemindersSent = 0
    let totalRemindersSkipped = 0
    let totalErrors = 0
    const results: Array<{
      hospitalId: string
      hospitalName: string
      remindersSent: number
      errors: number
    }> = []

    for (const hospital of hospitals) {
      let hospitalRemindersSent = 0
      let hospitalErrors = 0

      try {
        const appointmentsRef = db.collection(getHospitalCollectionPath(hospital.id, "appointments"))
        
        // Get all confirmed appointments
        const confirmedAppointments = await appointmentsRef
          .where("status", "==", "confirmed")
          .get()
        for (const aptDoc of confirmedAppointments.docs) {
          try {
            const apt = aptDoc.data()
            const appointmentId = aptDoc.id

            // Skip if no appointment date/time
            if (!apt.appointmentDate || !apt.appointmentTime) {
              continue
            }

            // Parse appointment date and time
            const appointmentDateStr = String(apt.appointmentDate)
            const appointmentTimeStr = String(apt.appointmentTime)
            
            // Create appointment datetime
            const appointmentDateTime = new Date(`${appointmentDateStr}T${appointmentTimeStr}`)
            
            // Compute the intended reminder time: 24 hours before the appointment
            const reminderTime = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000)
            
            // Send only when the reminder time is within our check window
            if (reminderTime < windowStart || reminderTime > windowEnd) {
              continue // Not the right time to send the reminder
            }
            
            // Ensure the appointment itself is in the future
            if (appointmentDateTime <= now) {
              continue // Don't remind for past appointments
            }

            // Check if reminder has already been sent
            const reminderCheck = await db
              .collection("appointment_reminders")
              .where("appointmentId", "==", appointmentId)
              .where("reminderType", "==", "24_hour")
              .limit(1)
              .get()

            if (!reminderCheck.empty) {
              totalRemindersSkipped++
              continue
            }

            // Get patient details
            const patientPhone = apt.patientPhone || apt.patientPhoneNumber || ""
            const patientName = apt.patientName || "Patient"
            const doctorName = apt.doctorName || "Doctor"
            const patientId = apt.patientId || apt.patientUid || ""

            if (!patientPhone || patientPhone.trim() === "") {
              continue
            }

            // Format date nicely
            let formattedDate = appointmentDateStr
            try {
              const dateObj = new Date(appointmentDateStr)
              formattedDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            } catch {
              // Keep original if parsing fails
            }

            // Format time nicely
            let formattedTime = appointmentTimeStr
            try {
              const [hours, minutes] = appointmentTimeStr.split(':')
              const hour = parseInt(hours)
              const min = minutes || '00'
              const ampm = hour >= 12 ? 'PM' : 'AM'
              const hour12 = hour % 12 || 12
              formattedTime = `${hour12}:${min} ${ampm}`
            } catch {
              // Keep original if parsing fails
            }

            // Build reminder message
            const messageText = `📅 *Appointment Reminder*\n\n` +
              `Hello ${patientName},\n\n` +
              `This is a friendly reminder about your upcoming appointment:\n\n` +
              `📋 *Appointment Details:*\n` +
              `• 👨‍⚕️ Doctor: ${doctorName}\n` +
              `• 📅 Date: ${formattedDate}\n` +
              `• 🕒 Time: ${formattedTime}\n\n` +
              `⏰ Your appointment is scheduled for tomorrow (24 hours from now).\n\n` +
              `Please make sure to:\n` +
              `✅ Arrive 10-15 minutes early\n` +
              `✅ Bring any previous medical reports or prescriptions\n` +
              `✅ Carry a valid ID proof\n\n` +
              `If you need to reschedule or cancel, please reply to this message or call us as soon as possible.\n\n` +
              `We look forward to seeing you!\n\n` +
              `Thank you for choosing Harmony Medical Services! 🏥`

            // Send WhatsApp reminder
            const whatsappResult = await sendWhatsAppNotification({
              to: patientPhone,
              message: messageText,
            })

            if (whatsappResult.success) {
              // Mark reminder as sent
              await db.collection("appointment_reminders").add({
                appointmentId,
                patientId,
                patientPhone,
                patientName,
                doctorName,
                appointmentDate: appointmentDateStr,
                appointmentTime: appointmentTimeStr,
                reminderType: "24_hour",
                message: messageText,
                sentAt: now.toISOString(),
                status: "sent",
                messageId: whatsappResult.sid,
                hospitalId: hospital.id,
              })

              hospitalRemindersSent++
              totalRemindersSent++
            } else {
              hospitalErrors++
              totalErrors++
              // Still record the attempt (with failed status)
              await db.collection("appointment_reminders").add({
                appointmentId,
                patientId,
                patientPhone,
                patientName,
                doctorName,
                appointmentDate: appointmentDateStr,
                appointmentTime: appointmentTimeStr,
                reminderType: "24_hour",
                message: messageText,
                sentAt: now.toISOString(),
                status: "failed",
                error: whatsappResult.error,
                hospitalId: hospital.id,
              })
            }
          } catch {
            hospitalErrors++
            totalErrors++
          }
        }

        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          remindersSent: hospitalRemindersSent,
          errors: hospitalErrors,
        })
      } catch {
        results.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          remindersSent: 0,
          errors: 1,
        })
      }
    }
    return NextResponse.json({
      success: true,
      message: "Appointment reminder check completed",
      summary: {
        totalRemindersSent,
        totalRemindersSkipped,
        totalErrors,
        hospitalsProcessed: hospitals.length,
      },
      results,
      timestamp: now.toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to process appointment reminders",
      },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"

