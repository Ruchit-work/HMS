export const DEFAULT_TIMEZONE = "Asia/Kolkata"
const LOCALE_EN_IN = "en-IN"
const LOCALE_EN_US = "en-US"

const asDate = (value: Date | string): Date => (typeof value === "string" ? new Date(value) : value)
const isInvalidDate = (value: Date): boolean => Number.isNaN(value.getTime())
const formatDate = (date: Date, timezone: string, options?: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString(LOCALE_EN_IN, { timeZone: timezone, ...options })
const formatTime = (date: Date, timezone: string, options?: Intl.DateTimeFormatOptions) =>
  date.toLocaleTimeString(LOCALE_EN_IN, { timeZone: timezone, ...options })
const formatDateTime = (date: Date, timezone: string, options?: Intl.DateTimeFormatOptions) =>
  date.toLocaleString(LOCALE_EN_IN, { timeZone: timezone, ...options })
const formatOrFallback = (
  value: Date | string,
  timezone: string,
  fallback: string,
  formatter: (date: Date, timezone: string, options?: Intl.DateTimeFormatOptions) => string,
  options?: Intl.DateTimeFormatOptions
) => {
  const dateObj = asDate(value)
  return isInvalidDate(dateObj) ? fallback : formatter(dateObj, timezone, options)
}

export function getCurrentDateInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
  const now = new Date()
  return new Date(now.toLocaleString(LOCALE_EN_US, { timeZone: timezone }))
}

export function parseDateInTimezone(
  dateString: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  if (!dateString) {
    throw new Error("Date string is required")
  }

  if (dateString.includes("T") || dateString.includes(" ")) {
    const date = new Date(dateString)
    if (isInvalidDate(date)) {
      throw new Error(`Invalid date string: ${dateString}`)
    }
    return date
  }

  const [year, month, day] = dateString.split("-").map(Number)
  if (!year || !month || !day) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`)
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  return new Date(utcDate.toLocaleString(LOCALE_EN_US, { timeZone: timezone }))
}

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

export function formatDateForDisplay(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatOrFallback(date, timezone, "Invalid Date", formatDate, options)
}

export function formatTimeForDisplay(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatOrFallback(date, timezone, "Invalid Time", formatTime, options)
}

export function formatDateTimeForDisplay(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatOrFallback(date, timezone, "Invalid Date/Time", formatDateTime, options)
}

export function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  const today = getCurrentDateInTimezone(timezone)
  return formatDateForStorage(today, timezone)
}

export function combineDateAndTime(
  dateString: string,
  timeString: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  if (!dateString || !timeString) {
    throw new Error("Both date and time strings are required")
  }

  const date = parseDateInTimezone(dateString, timezone)

  const [hours, minutes] = timeString.split(":").map(Number)
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`)
  }

  date.setHours(hours, minutes, 0, 0)

  return date
}

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
    return timeString ? `${dateString} at ${timeString}` : dateString
  }
}

export function formatDateForPDF(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatOrFallback(date, timezone, "Not provided", formatDate, options)
}

export function formatDateTimeForPDF(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  timezone: string = DEFAULT_TIMEZONE
): string {
  return formatOrFallback(date, timezone, "Not provided", formatDateTime, options)
}

