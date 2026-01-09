

import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/apiAuth"
import { getAllActiveHospitals, getHospitalCollectionPath } from "@/utils/serverHospitalQueries"


export async function GET(request: Request) {
  // Authenticate request - requires admin role
  const auth = await authenticateRequest(request, "admin")
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  try {
    const initResult = initFirebaseAdmin("appointment-reminders-status API")
    if (!initResult.ok) {
      return NextResponse.json(
        { error: "Server not configured for admin" },
        { status: 500 }
      )
    }

    const db = admin.firestore()

    // Get reminder execution logs (last 10)
    let reminderLogs: any[] = []
    try {
      const reminderLogsRef = db.collection("appointment_reminders")
        .orderBy("sentAt", "desc")
        .limit(10)
      const reminderLogsSnapshot = await reminderLogsRef.get()
      reminderLogs = reminderLogsSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          sentAt: data.sentAt,
          appointmentId: data.appointmentId,
          patientName: data.patientName,
          doctorName: data.doctorName,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          status: data.status || "sent",
          error: data.error,
          hospitalId: data.hospitalId,
        }
      })
    } catch {
      // Continue without logs if query fails (e.g., missing index)
    }

    // Get last execution (most recent reminder sent)
    const lastExecution = reminderLogs.length > 0 ? reminderLogs[0] : null

    // Calculate next cron execution
    // CRON SCHEDULE: "0 6 * * *" (6:00 AM UTC = 11:30 AM IST)
    const now = new Date()
    const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000))
    
    // Calculate target time: 6:00 AM UTC = 11:30 AM IST
    const nextCronUTC = new Date(utcNow)
    nextCronUTC.setUTCHours(6, 0, 0, 0) // Set to 6:00 AM UTC
    
    // If today's 6:00 AM UTC has already passed, set for tomorrow
    if (nextCronUTC.getTime() <= utcNow.getTime()) {
      nextCronUTC.setUTCDate(nextCronUTC.getUTCDate() + 1)
    }

    // Get statistics
    const nowForStats = new Date()
    const windowStart = new Date(nowForStats.getTime() - 90 * 60 * 1000) // 90 minutes ago
    const windowEnd = new Date(nowForStats.getTime() + 90 * 60 * 1000) // 90 minutes from now

    let appointmentsInWindow = 0
    let remindersAlreadySent = 0
    let appointmentsWithoutPhone = 0
    let upcomingAppointments = 0

    try {
      const hospitals = await getAllActiveHospitals()
      
      for (const hospital of hospitals) {
        try {
          const appointmentsRef = db.collection(getHospitalCollectionPath(hospital.id, "appointments"))
          const confirmedAppointments = await appointmentsRef
            .where("status", "==", "confirmed")
            .get()

          for (const aptDoc of confirmedAppointments.docs) {
            const apt = aptDoc.data()
            
            if (!apt.appointmentDate || !apt.appointmentTime) {
              continue
            }

            const appointmentDateStr = String(apt.appointmentDate)
            const appointmentTimeStr = String(apt.appointmentTime)
            const appointmentDateTime = new Date(`${appointmentDateStr}T${appointmentTimeStr}`)
            const reminderTime = new Date(appointmentDateTime.getTime() - 24 * 60 * 60 * 1000)

            // Count upcoming appointments
            if (appointmentDateTime > nowForStats) {
              upcomingAppointments++
            }

            // Count appointments in reminder window
            if (reminderTime >= windowStart && reminderTime <= windowEnd && appointmentDateTime > nowForStats) {
              appointmentsInWindow++

              // Check if reminder already sent
              const reminderCheck = await db
                .collection("appointment_reminders")
                .where("appointmentId", "==", aptDoc.id)
                .where("reminderType", "==", "24_hour")
                .limit(1)
                .get()

              if (!reminderCheck.empty) {
                remindersAlreadySent++
              }

              const patientPhone = apt.patientPhone || apt.patientPhoneNumber || ""
              if (!patientPhone || patientPhone.trim() === "") {
                appointmentsWithoutPhone++
              }
            }
          }
        } catch {
        }
      }
    } catch {
    }

    // Get recent reminders (last 7 days)
    let recentReminders: any[] = []
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const recentRemindersRef = db.collection("appointment_reminders")
        .where("sentAt", ">=", sevenDaysAgo.toISOString())
        .orderBy("sentAt", "desc")
        .limit(20)
      const recentRemindersSnapshot = await recentRemindersRef.get()
      recentReminders = recentRemindersSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          sentAt: data.sentAt,
          patientName: data.patientName,
          doctorName: data.doctorName,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          status: data.status || "sent",
        }
      })
    } catch {
    }

    // Check if cron is configured
    const cronConfigured = true // Assume configured if endpoint exists

    return NextResponse.json({
      success: true,
      cron: {
        configured: cronConfigured,
        schedule: "0 6 * * *", // Daily at 6:00 AM UTC
        scheduleUTC: "0 6 * * *", // Actual cron schedule (UTC) - 6:00 AM UTC = 11:30 AM IST
        scheduleDisplay: "11:30 AM IST (6:00 AM UTC)", // Human-readable display
        nextExecution: nextCronUTC.toISOString(),
        nextExecutionFormatted: new Date(nextCronUTC).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        }),
      },
      lastExecution: lastExecution,
      executionHistory: reminderLogs,
      recentReminders: recentReminders,
      statistics: {
        upcomingAppointments,
        appointmentsInWindow,
        remindersAlreadySent,
        appointmentsWithoutPhone,
        remindersSentLast7Days: recentReminders.filter(r => r.status === "sent").length,
        remindersFailedLast7Days: recentReminders.filter(r => r.status === "failed").length,
      },
      status: lastExecution
        ? lastExecution.status === "sent"
          ? "healthy"
          : "error"
        : "unknown",
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to check reminder status",
      },
      { status: 500 }
    )
  }
}

