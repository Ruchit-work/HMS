/**
 * Test endpoint for auto-campaigns
 * This endpoint helps test the system with specific dates
 */

import { NextResponse } from "next/server"
import { getHealthAwarenessDaysForDate } from "@/server/healthAwarenessDays"

/**
 * GET /api/auto-campaigns/test
 * Query params:
 * - date: ISO date string (e.g., "2024-09-29") or "today" or "tomorrow"
 * Returns: List of health awareness days for the specified date
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const dateParam = url.searchParams.get("date") || "today"

    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000
    let testDate: Date

    if (dateParam === "today") {
      // Get today's date - getHealthAwarenessDaysForDate will convert to IST internally
      testDate = new Date()
    } else if (dateParam === "tomorrow") {
      // Get tomorrow's date - getHealthAwarenessDaysForDate will convert to IST internally
      const now = new Date()
      testDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    } else {
      // Try to parse as ISO date string
      testDate = new Date(dateParam)
      if (isNaN(testDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format. Use ISO date string (e.g., '2024-09-29'), 'today', or 'tomorrow'" },
          { status: 400 }
        )
      }
    }

    const healthDays = getHealthAwarenessDaysForDate(testDate)

    // Format date in IST for display
    const utcTime = testDate.getTime() + (testDate.getTimezoneOffset() * 60 * 1000)
    const istTime = new Date(utcTime + istOffset)
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(istTime.getUTCDate()).padStart(2, '0')
    const year = istTime.getUTCFullYear()
    const dateString = `${year}-${month}-${day}`

    return NextResponse.json({
      success: true,
      date: dateString,
      dateFormatted: new Date(utcTime + istOffset).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      timeZone: "Asia/Kolkata (IST)",
      healthDaysFound: healthDays.length,
      healthDays: healthDays.map((day) => ({
        name: day.name,
        date: day.date,
        description: day.description,
        keywords: day.keywords,
        targetAudience: day.targetAudience,
        priority: day.priority,
        specialization: day.specialization,
      })),
    })
  } catch (error: any) {
    console.error("auto-campaigns test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to test auto-campaigns",
      },
      { status: 500 }
    )
  }
}

