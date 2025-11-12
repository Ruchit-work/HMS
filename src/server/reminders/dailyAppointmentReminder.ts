import admin from "firebase-admin"
import { sendWhatsAppNotification } from "@/server/whatsapp"
import { ensureFirebaseAdmin } from "@/server/services/firebaseAdmin"

interface ReminderOptions {
  timezone?: string
  now?: Date
  dryRun?: boolean
  debug?: boolean
}

const DEFAULT_TIMEZONE = "Asia/Kolkata"

// Helper function to normalize dates to YYYY-MM-DD format for comparison
function normalizeDate(dateValue: any, timeZone: string = "Asia/Kolkata"): string | null {
  if (!dateValue) return null
  
  try {
    // If it's already in YYYY-MM-DD format, return as is
    if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue
    }
    
    // Try to parse the date value
    let date: Date
    
    if (typeof dateValue === "string") {
      // Try parsing the date string (handles formats like "Nov 12, 2025", "2025-11-12", ISO strings, etc.)
      const parsed = Date.parse(dateValue)
      if (!isNaN(parsed)) {
        date = new Date(parsed)
      } else {
        // If Date.parse fails, try creating a Date object directly
        date = new Date(dateValue)
        if (isNaN(date.getTime())) {
          console.warn(`[Reminder] Unable to parse date: ${dateValue}`)
          return null
        }
      }
    } else if (dateValue instanceof Date) {
      date = dateValue
      if (isNaN(date.getTime())) {
        console.warn(`[Reminder] Invalid Date object`)
        return null
      }
    } else {
      console.warn(`[Reminder] Invalid date type: ${typeof dateValue}, value: ${dateValue}`)
      return null
    }
    
    // Convert to YYYY-MM-DD format in the specified timezone
    // Use en-CA locale which produces YYYY-MM-DD format
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date)
    
    return formatted
  } catch (error) {
    console.warn(`[Reminder] Error normalizing date ${dateValue}:`, error)
    return null
  }
}

// Helper function to check if two dates are the same day
function isSameDay(date1: string | null, date2: string | null, timeZone: string = "Asia/Kolkata"): boolean {
  if (!date1 || !date2) return false
  
  const normalized1 = normalizeDate(date1, timeZone)
  const normalized2 = normalizeDate(date2, timeZone)
  
  return normalized1 === normalized2 && normalized1 !== null
}

export const sendDailyAppointmentReminders = async (options: ReminderOptions = {}) => {
  const now = options.now ? new Date(options.now) : new Date()
  const timeZone = options.timezone ?? DEFAULT_TIMEZONE
  const dryRun = Boolean(options.dryRun)
  const debug = Boolean(options.debug)

  await ensureFirebaseAdmin()
  const firestore = admin.firestore()

  // Get today's date in YYYY-MM-DD format for comparison
  const todayDateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

  console.log(`[Reminder] Looking for appointments on ${todayDateKey} (timezone: ${timeZone})`)
  
  // Fetch all confirmed/resrescheduled appointments (we'll filter by date in memory)
  // This allows us to handle different date formats
  const snapshot = await firestore
    .collection("appointments")
    .where("status", "in", ["confirmed", "resrescheduled"])
    .get()

  console.log(`[Reminder] Found ${snapshot.size} appointments with status confirmed/resrescheduled`)
  
  // Filter appointments by date in memory (handles different date formats)
  const todayAppointments = snapshot.docs.filter((doc) => {
    const data = doc.data()
    const appointmentDate = data.appointmentDate
    
    if (debug) {
      console.log(`[Reminder DEBUG] Checking appointment ${doc.id}: storedDate="${appointmentDate}", normalizedDate="${normalizeDate(appointmentDate, timeZone)}", today="${todayDateKey}"`)
    }
    
    return isSameDay(appointmentDate, todayDateKey, timeZone)
  })

  console.log(`[Reminder] Found ${todayAppointments.length} appointments for today (${todayDateKey}) after date filtering`)
  
  // Debug: Show all appointments for today regardless of status
  if (debug) {
    const allTodaySnapshot = await firestore
      .collection("appointments")
      .get()
    
    const allToday = allTodaySnapshot.docs.filter((doc) => {
      const data = doc.data()
      return isSameDay(data.appointmentDate, todayDateKey, timeZone)
    })
    
    console.log(`[Reminder DEBUG] Found ${allToday.length} total appointments for ${todayDateKey} (all statuses)`)
    allToday.forEach((doc) => {
      const data = doc.data()
      console.log(`[Reminder DEBUG] Appointment ${doc.id}: storedDate="${data.appointmentDate}", normalizedDate="${normalizeDate(data.appointmentDate, timeZone)}", status=${data.status}, patientPhone=${data.patientPhone || data.patientPhoneNumber || data.patientContact || "MISSING"}, reminderSentAt=${data.reminderSentAt || "NOT SET"}`)
    })
  }

  if (todayAppointments.length === 0) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, dryRun, dateKey: todayDateKey, timeZone, found: 0 }
  }

  let processed = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const document of todayAppointments) {
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

  const summary = {
    processed, 
    sent, 
    skipped,
    failed,
    dryRun, 
    dateKey: todayDateKey, 
    timeZone, 
    found: todayAppointments.length,
    totalChecked: snapshot.size,
  }

  console.log(`[Reminder] Summary: ${JSON.stringify(summary)}`)

  return summary
}


