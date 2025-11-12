import { NextResponse } from "next/server"
import { sendDailyAppointmentReminders } from "@/server/reminders/dailyAppointmentReminder"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const dryRun = url.searchParams.get("dryRun") === "1"
    const debug = url.searchParams.get("debug") === "1"
    const timezoneParam = url.searchParams.get("tz") || undefined

    console.log(`[API] Appointment reminder job triggered - dryRun: ${dryRun}, debug: ${debug}, timezone: ${timezoneParam || "default"}`)

    const result = await sendDailyAppointmentReminders({
      dryRun,
      timezone: timezoneParam,
      debug,
    })

    console.log(`[API] Appointment reminder job completed - ${JSON.stringify(result)}`)

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[API] Appointment reminder job failed", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    const stack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      { 
        success: false, 
        error: message,
        stack: process.env.NODE_ENV === "development" ? stack : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}


