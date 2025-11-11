import { NextResponse } from "next/server"
import { sendDailyAppointmentReminders } from "@/server/reminders/dailyAppointmentReminder"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const dryRun = url.searchParams.get("dryRun") === "1"
    const timezoneParam = url.searchParams.get("tz") || undefined

    const result = await sendDailyAppointmentReminders({
      dryRun,
      timezone: timezoneParam,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("appointment reminder job failed", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}


