import { formatDateForDisplay, formatDateTimeForDisplay, formatAppointmentDateTime as formatAppointmentDateTimeTZ } from "@/utils/shared/timezone"

export function calculateAge(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null

  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age >= 0 ? age : null
}

export const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  try {
    // Use timezone utility for consistent Indian locale formatting
    return formatDateForDisplay(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Invalid Date'
  }
}

export const formatDateTime = (dateString: string) => {
  if (!dateString) return 'N/A'
  try {
    // Use timezone utility for consistent Indian locale formatting
    return formatDateTimeForDisplay(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Invalid Date'
  }
}

export function formatAppointmentDateTime(date: string, time: string): string {
  if (!date) return "the scheduled time"
  
  try {
    // Use timezone utility for consistent formatting
    return formatAppointmentDateTimeTZ(date, time)
  } catch {
    // Fallback if parsing fails
    return time ? `${date} at ${time}` : date
  }
}

