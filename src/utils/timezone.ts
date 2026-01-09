/**
 * Timezone Utility Functions
 * Ensures consistent timezone handling across the application
 * Default timezone: Asia/Kolkata (IST - Indian Standard Time)
 */

// Default timezone for the application (India)
export const DEFAULT_TIMEZONE = "Asia/Kolkata"

/**
 * Gets the current date in the application's timezone
 */
export function getCurrentDateInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
  const now = new Date()
  return new Date(now.toLocaleString("en-US", { timeZone: timezone }))
}

/**
 * Formats a date string to a Date object in the application's timezone
 * Handles date-only strings (YYYY-MM-DD) by assuming midnight in the local timezone
 */
export function parseDateInTimezone(
  dateString: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  if (!dateString) {
    throw new Error("Date string is required")
  }

  // If date string includes time, parse it directly
  if (dateString.includes("T") || dateString.includes(" ")) {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date string: ${dateString}`)
    }
    return date
  }

  // For date-only strings (YYYY-MM-DD), create date at midnight in the specified timezone
  // This ensures the date represents the correct day in the local timezone
  const [year, month, day] = dateString.split("-").map(Number)
  if (!year || !month || !day) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`)
  }

  // Create date in UTC first, then convert to local timezone
  // This handles the date correctly regardless of server timezone
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  
  // Convert to the target timezone
  const localDate = new Date(
    utcDate.toLocaleString("en-US", { timeZone: timezone })
  )

  return localDate
}

/**
 * Formats a date to a string in YYYY-MM-DD format in the application's timezone
 */
export function formatDateForStorage(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const year = date.toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
  })
  const month = date.toLocaleString("en-US", {
    timeZone: timezone,
    month: "2-digit",
  })
  const day = date.toLocaleString("en-US", {
    timeZone: timezone,
    day: "2-digit",
  })

  return `${year}-${month}-${day}`
}

/**
 * Formats a date for display in the application's locale and timezone
 */
export function formatDateForDisplay(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(dateObj.getTime())) {
    return "Invalid Date"
  }

  return dateObj.toLocaleDateString("en-IN", {
    timeZone: timezone,
    ...options,
  })
}

/**
 * Formats a time for display in the application's locale and timezone
 */
export function formatTimeForDisplay(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(dateObj.getTime())) {
    return "Invalid Time"
  }

  return dateObj.toLocaleTimeString("en-IN", {
    timeZone: timezone,
    ...options,
  })
}

/**
 * Formats a date and time for display in the application's locale and timezone
 */
export function formatDateTimeForDisplay(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(dateObj.getTime())) {
    return "Invalid Date/Time"
  }

  return dateObj.toLocaleString("en-IN", {
    timeZone: timezone,
    ...options,
  })
}

/**
 * Gets today's date string in YYYY-MM-DD format in the application's timezone
 */
export function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  const today = getCurrentDateInTimezone(timezone)
  return formatDateForStorage(today, timezone)
}

/**
 * Combines date and time strings into a Date object in the application's timezone
 * Useful for appointment date/time handling
 */
export function combineDateAndTime(
  dateString: string,
  timeString: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  if (!dateString || !timeString) {
    throw new Error("Both date and time strings are required")
  }

  // Parse date
  const date = parseDateInTimezone(dateString, timezone)

  // Parse time (HH:MM format)
  const [hours, minutes] = timeString.split(":").map(Number)
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`)
  }

  // Set time on the date
  date.setHours(hours, minutes, 0, 0)

  return date
}

/**
 * Formats appointment date and time for display
 * Used consistently across the app for appointments and recheckups
 */
export function formatAppointmentDateTime(
  dateString: string,
  timeString: string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  try {
    const dateTime = combineDateAndTime(dateString, timeString, timezone)

    const dateDisplay = formatDateForDisplay(dateTime, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }, timezone)

    const timeDisplay = formatTimeForDisplay(dateTime, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }, timezone)

    return `${dateDisplay} at ${timeDisplay}`
  } catch {
    // Fallback if parsing fails
    return timeString ? `${dateString} at ${timeString}` : dateString
  }
}

/**
 * Formats date for PDF generation (ensures consistent timezone)
 */
export function formatDateForPDF(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(dateObj.getTime())) {
    return "Not provided"
  }

  // Use en-IN locale for Indian date format in PDFs
  return dateObj.toLocaleDateString("en-IN", {
    timeZone: timezone,
    ...options,
  })
}

/**
 * Formats date/time for PDF generation (ensures consistent timezone)
 */
export function formatDateTimeForPDF(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date

  if (Number.isNaN(dateObj.getTime())) {
    return "Not provided"
  }

  // Use en-IN locale for Indian date/time format in PDFs
  return dateObj.toLocaleString("en-IN", {
    timeZone: timezone,
    ...options,
  })
}

