/**
 * Blocked Dates Normalization Utility
 * 
 * This utility normalizes blocked dates from various formats (string, object, Firestore Timestamp)
 * to a consistent YYYY-MM-DD format for comparison.
 * 
 * @example
 * // Normalize blocked dates array
 * const blockedDates = ["2024-01-15", { date: "2024-01-20" }, { toDate: () => new Date("2024-01-25") }]
 * const normalized = normalizeBlockedDates(blockedDates)
 * // Returns: ["2024-01-15", "2024-01-20", "2024-01-25"]
 */

/**
 * Normalizes a single blocked date value to YYYY-MM-DD format
 * @param blockedDate - Can be a string, object with `date` property, Firestore Timestamp (with `toDate()`), or object with `seconds`
 * @returns Normalized date string in YYYY-MM-DD format, or empty string if invalid
 */
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

/**
 * Normalizes an array of blocked dates to YYYY-MM-DD format
 * @param blockedDates - Array of blocked dates in various formats
 * @returns Array of normalized date strings in YYYY-MM-DD format (empty strings filtered out)
 */
export function normalizeBlockedDates(blockedDates: any[]): string[] {
  if (!Array.isArray(blockedDates)) {
    return []
  }

  return blockedDates
    .map((b: any) => normalizeBlockedDate(b))
    .filter(Boolean)
}

/**
 * Checks if a date is blocked
 * @param date - Date string in YYYY-MM-DD format
 * @param blockedDates - Array of blocked dates in various formats
 * @returns true if the date is blocked, false otherwise
 */
export function isDateBlocked(date: string, blockedDates: any[]): boolean {
  if (!date) return false
  
  const normalized = normalizeBlockedDates(blockedDates)
  return normalized.includes(date)
}

