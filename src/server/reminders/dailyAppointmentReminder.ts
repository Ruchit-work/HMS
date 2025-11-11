import admin from "firebase-admin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { ensureFirebaseAdmin } from "@/server/services/firebaseAdmin"

interface ReminderOptions {
  timezone?: string
  now?: Date
  dryRun?: boolean
}

const DEFAULT_TIMEZONE = "Asia/Kolkata"

export const sendDailyAppointmentReminders = async (options: ReminderOptions = {}) => {
  const now = options.now ? new Date(options.now) : new Date()
  const timeZone = options.timezone ?? DEFAULT_TIMEZONE
  const dryRun = Boolean(options.dryRun)

  await ensureFirebaseAdmin()
  const firestore = admin.firestore()

  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

  const snapshot = await firestore
    .collection("appointments")
    .where("status", "in", ["confirmed", "resrescheduled", "rescheduled"])
    .where("appointmentDate", "==", dateKey)
    .get()

  if (snapshot.empty) {
    return { processed: 0, sent: 0, dryRun }
  }

  let processed = 0
  let sent = 0

  for (const document of snapshot.docs) {
    processed += 1
    const appointmentData = document.data() as Record<string, any>

    if (appointmentData.reminderSentAt) {
      continue
    }

    const appointmentTime = appointmentData.appointmentTime ?? ""
    const appointmentDate = appointmentData.appointmentDate
    const doctorName = appointmentData.doctorName ?? "our doctor"
    const patientName = appointmentData.patientName ?? ""

    const timeLabel = appointmentTime ? ` at ${appointmentTime}` : ""
    const reminderMessage = `Reminder: Your appointment with ${doctorName} is today${timeLabel}. Please arrive a few minutes early.`

    if (!dryRun) {
      await sendWhatsAppNotification({
        to: appointmentData.patientPhone,
        fallbackRecipients: [
          appointmentData.patientPhoneNumber,
          appointmentData.patientContact,
        ],
        message: reminderMessage,
      })

      await document.ref.update({
        reminderSentAt: new Date().toISOString(),
        reminderMeta: {
          sentAt: new Date().toISOString(),
          timeZone,
        },
      })
    }

    sent += 1
  }

  return { processed, sent, dryRun }
}


