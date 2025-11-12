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

  console.log(`[Reminder] Looking for appointments on ${dateKey} (timezone: ${timeZone})`)
  
  const snapshot = await firestore
    .collection("appointments")
    .where("status", "in", ["confirmed", "resrescheduled"])
    .where("appointmentDate", "==", dateKey)
    .get()

  console.log(`[Reminder] Found ${snapshot.size} appointments matching criteria`)

  if (snapshot.empty) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, dryRun, dateKey, timeZone, found: 0 }
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const document of snapshot.docs) {
    const appointmentData = document.data() as Record<string, any>
    const appointmentId = document.id

    if (appointmentData.reminderSentAt) {
      console.log(`[Reminder] Skipping appointment ${appointmentId} - reminder already sent at ${appointmentData.reminderSentAt}`)
      skipped += 1
      continue
    }

    const appointmentTime = appointmentData.appointmentTime ?? ""
    const appointmentDate = appointmentData.appointmentDate
    const doctorName = appointmentData.doctorName ?? "our doctor"
    const patientName = appointmentData.patientName ?? ""
    const patientPhone = appointmentData.patientPhone || appointmentData.patientPhoneNumber || appointmentData.patientContact

    if (!patientPhone) {
      console.warn(`[Reminder] Skipping appointment ${appointmentId} - no phone number for patient ${patientName}`)
      skipped += 1
      continue
    }

    processed += 1
    const timeLabel = appointmentTime ? ` at ${appointmentTime}` : ""
    const reminderMessage = `Reminder: Your appointment with ${doctorName} is today${timeLabel}. Please arrive a few minutes early.`

    console.log(`[Reminder] Processing appointment ${appointmentId} for ${patientName} (${patientPhone})`)

    if (!dryRun) {
      const result = await sendWhatsAppNotification({
        to: appointmentData.patientPhone,
        fallbackRecipients: [
          appointmentData.patientPhoneNumber,
          appointmentData.patientContact,
        ],
        message: reminderMessage,
      })

      if (result.success) {
        await document.ref.update({
          reminderSentAt: new Date().toISOString(),
          reminderMeta: {
            sentAt: new Date().toISOString(),
            timeZone,
          },
        })
        console.log(`[Reminder] Successfully sent reminder to ${patientName} (${patientPhone})`)
        sent += 1
      } else {
        console.error(`[Reminder] Failed to send reminder to ${patientName} (${patientPhone}): ${result.error}`)
        failed += 1
      }
    } else {
      console.log(`[Reminder] DRY RUN - Would send to ${patientName} (${patientPhone})`)
      sent += 1
    }
  }

  return { 
    processed, 
    sent, 
    skipped,
    failed,
    dryRun, 
    dateKey, 
    timeZone, 
    found: snapshot.size 
  }
}


