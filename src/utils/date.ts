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
    return new Date(dateString).toLocaleDateString('en-US', {
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
    return new Date(dateString).toLocaleString('en-US', {
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
  
  const isoString = `${date}T${time || "00:00"}`
  const dt = new Date(isoString)
  
  // If date is invalid, return a fallback
  if (Number.isNaN(dt.getTime())) {
    return time ? `${date} at ${time}` : date
  }

  // Format date in Indian locale (en-IN) for consistency with appointment display
  const formattedDate = dt.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  // If no time provided, return only the date
  if (!time) return formattedDate

  // Format time in Indian locale (en-IN) for 12-hour format with AM/PM
  const formattedTime = dt.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return `${formattedDate} at ${formattedTime}`
}

