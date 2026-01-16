
function normalizeBlockedDate(blockedDate: any): string {
  if (!blockedDate) return ""

  // String format: "2024-01-15" or "2024-01-15T10:30:00Z"
  if (typeof blockedDate === "string") {
    return blockedDate.slice(0, 10)
  }

  // Object with date property: { date: "2024-01-15" }
  if (typeof blockedDate === "object" && typeof blockedDate.date === "string") {
    return String(blockedDate.date).slice(0, 10)
  }

  // Firestore Timestamp: { toDate: () => Date }
  if (blockedDate?.toDate && typeof blockedDate.toDate === "function") {
    const dt = blockedDate.toDate() as Date
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, "0")
    const d = String(dt.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  // Object with seconds (Unix timestamp): { seconds: 1705276800 }
  if (blockedDate?.seconds && typeof blockedDate.seconds === "number") {
    const dt = new Date(blockedDate.seconds * 1000)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, "0")
    const d = String(dt.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  return ""
}


export function normalizeBlockedDates(blockedDates: any[]): string[] {
  if (!Array.isArray(blockedDates)) {
    return []
  }

  return blockedDates
    .map((b: any) => normalizeBlockedDate(b))
    .filter(Boolean)
}

export function isDateBlocked(date: string, blockedDates: any[]): boolean {
  if (!date || !blockedDates || !Array.isArray(blockedDates) || blockedDates.length === 0) {
    return false
  }
  
  // Ensure date is in YYYY-MM-DD format (take first 10 characters)
  const normalizedDate = date.slice(0, 10)
  if (!normalizedDate || normalizedDate.length !== 10) {
    return false
  }
  
  const normalizedBlockedDates = normalizeBlockedDates(blockedDates)
  const isBlocked = normalizedBlockedDates.includes(normalizedDate)
  
  return isBlocked
}

