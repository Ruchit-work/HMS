import { sendBhashMissedAppointmentTemplateIfConfigured } from "@/server/bhashUtilityTemplates"
import { sendWhatsAppNotification } from "@/server/whatsapp"

export function buildMissedAppointmentMessage(options: {
  patientName: string
  doctorName: string
  appointmentDate: string
  appointmentTime: string
}): string {
  const patientName = options.patientName || "Patient"
  const doctorName = options.doctorName || "Doctor"
  let formattedDate = options.appointmentDate
  let formattedTime = options.appointmentTime

  if (options.appointmentDate) {
    try {
      formattedDate = new Date(options.appointmentDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch {
      // keep original
    }
  }

  if (options.appointmentTime) {
    try {
      const [hours, minutes] = options.appointmentTime.split(":")
      const hour = parseInt(hours, 10)
      const min = minutes || "00"
      const ampm = hour >= 12 ? "PM" : "AM"
      const hour12 = hour % 12 || 12
      formattedTime = `${hour12}:${min} ${ampm}`
    } catch {
      // keep original
    }
  }

  return (
    `Appointment Missed\n\n` +
    `Hello ${patientName},\n\n` +
    `We noticed that you missed your appointment.\n\n` +
    `Doctor: ${doctorName}\n` +
    `Date: ${formattedDate}\n` +
    `Time: ${formattedTime}\n\n` +
    `Please reply to this message or call us to reschedule.\n\n` +
    `Thank you for choosing Harmony Medical Services.`
  )
}

export async function sendMissedAppointmentWhatsApp(options: {
  to: string
  patientName: string
  doctorName: string
  appointmentDate: string
  appointmentTime: string
}): Promise<{ success: boolean; sid?: string; error?: string }> {
  const messageText = buildMissedAppointmentMessage(options)

  const sentViaBhashTemplate = await sendBhashMissedAppointmentTemplateIfConfigured({
    to: options.to,
    patientName: options.patientName,
    doctorName: options.doctorName,
    appointmentDate: options.appointmentDate,
    appointmentTime: options.appointmentTime,
  })

  if (sentViaBhashTemplate) {
    return { success: true, sid: "bhash-template" }
  }

  return sendWhatsAppNotification({
    to: options.to,
    message: messageText,
  })
}
