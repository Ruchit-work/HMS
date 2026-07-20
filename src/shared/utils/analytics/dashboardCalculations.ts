/**
 * Dashboard calculation utilities
 * Centralized functions for calculating statistics, trends, and analytics
 */

export interface TrendPoint {
  label: string
  fullLabel: string
  count: number
}

/** YYYY-MM-DD in the browser's local timezone (avoids UTC shift on date-only strings). */
export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Normalize Firestore appointment dates (string YYYY-MM-DD, ISO, or Timestamp) to YYYY-MM-DD.
 */
export function toLocalDateKey(value: unknown): string | null {
  if (value == null || value === "") return null

  if (typeof value === "object" && value !== null && typeof (value as { toDate?: () => Date }).toDate === "function") {
    try {
      const d = (value as { toDate: () => Date }).toDate()
      if (Number.isNaN(d.getTime())) return null
      return formatLocalYmd(d)
    } catch {
      return null
    }
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return formatLocalYmd(value)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
    const d = new Date(trimmed)
    if (Number.isNaN(d.getTime())) return null
    return formatLocalYmd(d)
  }

  return null
}

export function isSameLocalDay(value: unknown, day: Date = new Date()): boolean {
  return toLocalDateKey(value) === formatLocalYmd(day)
}

export type PaidAppointmentLike = {
  status?: string
  appointmentDate?: string
  paidAt?: string | null
  paymentStatus?: string
  paymentAmount?: number
  totalConsultationFee?: number
  consultationFee?: number
}

/** Amount actually collected / billable — mirrors billing-records logic. */
export function getPaidAmount(apt: PaidAppointmentLike): number {
  const paid = Number(apt.paymentAmount ?? 0)
  if (Number.isFinite(paid) && paid > 0) return paid
  const fee = Number(apt.totalConsultationFee ?? apt.consultationFee ?? 0)
  return Number.isFinite(fee) && fee > 0 ? fee : 0
}

export function isPaidAppointment(apt: PaidAppointmentLike): boolean {
  const status = String(apt.paymentStatus || "").toLowerCase()
  // Refunded money is not collected revenue even though paidAt stays set.
  if (status === "refunded") return false
  // keep_payment cancellations leave paymentStatus="paid" — that money remains
  // hospital revenue. Only exclude when payment was actually refunded.
  // (refund_requested is NOT excluded: money stays collected until the admin
  // approves the refund, which flips paymentStatus to "refunded".)
  if (status === "paid") return true
  if (apt.paidAt) return true
  // Note: appointment completion is NOT proof of payment — unpaid recheckups
  // complete without collection, so never infer payment from status alone.
  return false
}

/** Prefer paidAt day for revenue attribution; fall back to appointmentDate. */
export function revenueDateKey(apt: PaidAppointmentLike): string | null {
  return toLocalDateKey(apt.paidAt) || toLocalDateKey(apt.appointmentDate)
}

/**
 * Parse appointment dates into Date objects (local calendar day at midnight).
 */
export function parseAppointmentDates(appointments: Array<{ appointmentDate?: string }>): Date[] {
  return appointments
    .map((apt) => {
      const key = toLocalDateKey(apt.appointmentDate)
      if (!key) return null
      const [y, m, d] = key.split("-").map(Number)
      const dt = new Date(y, m - 1, d)
      dt.setHours(0, 0, 0, 0)
      return dt
    })
    .filter((value): value is Date => Boolean(value))
}

/**
 * Calculate weekly trend
 */
export function calculateWeeklyTrend(parsedAppointments: Date[]): { trends: TrendPoint[]; total: number } {
  const trends: TrendPoint[] = []
  let total = 0
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  
  const startOfWeek = new Date(now)
  const dayOfWeek = startOfWeek.getDay()
  const distanceToMonday = (dayOfWeek + 6) % 7
  startOfWeek.setDate(startOfWeek.getDate() - distanceToMonday)

  for (let offset = 0; offset < 7; offset++) {
    const currentDay = new Date(startOfWeek)
    currentDay.setDate(startOfWeek.getDate() + offset)
    const nextDay = new Date(currentDay)
    nextDay.setDate(currentDay.getDate() + 1)
    const label = currentDay.toLocaleDateString("en-US", { weekday: "short" })
    const fullLabel = currentDay.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    const count = parsedAppointments.filter((dt) => dt >= currentDay && dt < nextDay).length
    total += count
    trends.push({ label, fullLabel, count })
  }
  
  return { trends, total }
}

/**
 * Calculate monthly trend
 */
export function calculateMonthlyTrend(parsedAppointments: Date[]): { trends: TrendPoint[]; total: number } {
  const trends: TrendPoint[] = []
  let total = 0
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const bucketRanges: Array<[number, number]> = [
    [1, 5], [6, 10], [11, 15], [16, 20], [21, 25], [26, daysInMonth]
  ]

  bucketRanges.forEach(([startDay, endDay]) => {
    if (startDay > daysInMonth) return
    const adjustedEndDay = Math.min(endDay, daysInMonth)
    const bucketLabel = `${startDay}-${adjustedEndDay}`
    const startDate = new Date(currentYear, currentMonth, startDay)
    const endDate = new Date(currentYear, currentMonth, adjustedEndDay + 1)
    const count = parsedAppointments.filter((dt) => dt >= startDate && dt < endDate).length
    total += count
    trends.push({
      label: bucketLabel,
      fullLabel: `${bucketLabel} ${startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      count
    })
  })
  
  return { trends, total }
}

/**
 * Calculate yearly trend
 */
export function calculateYearlyTrend(parsedAppointments: Date[]): { trends: TrendPoint[]; total: number } {
  const trends: TrendPoint[] = []
  let total = 0
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const currentYear = now.getFullYear()

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(currentYear, month, 1)
    const endDate = new Date(currentYear, month + 1, 1)
    const count = parsedAppointments.filter((dt) => dt >= startDate && dt < endDate).length
    total += count
    trends.push({
      label: startDate.toLocaleDateString("en-US", { month: "short" }),
      fullLabel: startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      count
    })
  }
  
  return { trends, total }
}

/**
 * Calculate all trends
 */
export function calculateAllTrends(appointments: Array<{ appointmentDate?: string }>) {
  const parsed = parseAppointmentDates(appointments)
  const weekly = calculateWeeklyTrend(parsed)
  const monthly = calculateMonthlyTrend(parsed)
  const yearly = calculateYearlyTrend(parsed)
  
  return {
    weekly: weekly.trends,
    monthly: monthly.trends,
    yearly: yearly.trends,
    totals: {
      weekly: weekly.total,
      monthly: monthly.total,
      yearly: yearly.total
    }
  }
}

/**
 * Calculate revenue for a time period (paid appointments; amount from payment or consultation fee).
 */
export function calculateRevenue(
  appointments: Array<PaidAppointmentLike>,
  days: number
): number {
  let cutoffKey: string | null = null
  if (Number.isFinite(days)) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    cutoffKey = formatLocalYmd(cutoff)
  }
  return appointments
    .filter((apt) => {
      if (!isPaidAppointment(apt)) return false
      const key = revenueDateKey(apt)
      if (!key) return false
      return cutoffKey == null ? true : key >= cutoffKey
    })
    .reduce((sum, apt) => sum + getPaidAmount(apt), 0)
}

export interface RevenueTrendPoint {
  label: string
  fullLabel: string
  revenue: number
}

/**
 * Revenue trend: weekly (last 7 days), monthly (last 6 buckets), yearly (12 months)
 */
export function calculateRevenueTrend(
  appointments: Array<PaidAppointmentLike>
): {
  weekly: RevenueTrendPoint[]
  monthly: RevenueTrendPoint[]
  yearly: RevenueTrendPoint[]
} {
  const paid = appointments.filter((apt) => isPaidAppointment(apt) && getPaidAmount(apt) > 0)

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Weekly: last 7 days
  const weekly: RevenueTrendPoint[] = []
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date(now)
    d.setDate(d.getDate() - offset)
    const key = formatLocalYmd(d)
    const revenue = paid
      .filter((apt) => revenueDateKey(apt) === key)
      .reduce((s, apt) => s + getPaidAmount(apt), 0)
    weekly.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      fullLabel: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      revenue
    })
  }

  // Monthly: current month in 5-day buckets
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const bucketRanges: Array<[number, number]> = [
    [1, 5],
    [6, 10],
    [11, 15],
    [16, 20],
    [21, 25],
    [26, daysInMonth]
  ]
  const monthly: RevenueTrendPoint[] = bucketRanges.map(([startDay, endDay]) => {
    const adjustedEndDay = Math.min(endDay, daysInMonth)
    const startKey = formatLocalYmd(new Date(currentYear, currentMonth, startDay))
    const endKey = formatLocalYmd(new Date(currentYear, currentMonth, adjustedEndDay))
    const startDate = new Date(currentYear, currentMonth, startDay)
    const revenue = paid
      .filter((apt) => {
        const key = revenueDateKey(apt)
        return key != null && key >= startKey && key <= endKey
      })
      .reduce((s, apt) => s + getPaidAmount(apt), 0)
    return {
      label: `${startDay}-${adjustedEndDay}`,
      fullLabel: `${startDay}-${adjustedEndDay} ${startDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      revenue
    }
  })

  // Yearly: 12 months
  const yearly: RevenueTrendPoint[] = []
  for (let month = 0; month < 12; month++) {
    const startDate = new Date(currentYear, month, 1)
    const prefix = `${currentYear}-${String(month + 1).padStart(2, "0")}`
    const revenue = paid
      .filter((apt) => (revenueDateKey(apt) || "").startsWith(prefix))
      .reduce((s, apt) => s + getPaidAmount(apt), 0)
    yearly.push({
      label: startDate.toLocaleDateString("en-US", { month: "short" }),
      fullLabel: startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      revenue
    })
  }

  return { weekly, monthly, yearly }
}

/**
 * Top departments by appointment count (using doctorSpecialization)
 */
export function calculateTopDepartments(
  appointments: Array<{ doctorSpecialization?: string }>
): Array<{ department: string; count: number }> {
  const counts: Record<string, number> = {}
  appointments.forEach((apt) => {
    const dept = (apt.doctorSpecialization || "General").trim() || "General"
    counts[dept] = (counts[dept] || 0) + 1
  })
  return Object.entries(counts)
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

/**
 * Extract medicine names from prescription text
 */
export function extractMedicines(medicineText: string | undefined): string[] {
  if (!medicineText || medicineText.trim() === '') return []
  
  const medicines: string[] = []
  const lines = medicineText.split('\n').filter(line => line.trim())
  const skipPatterns = ['prescription', 'advice', 'diet', 'follow', 'next', 'visit']
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim()
    if (skipPatterns.some(p => lowerLine.includes(p)) ||
        (lowerLine.includes('days') && !/[a-zA-Z]/.test(lowerLine.replace(/\d+\s*days?/gi, ''))) ||
        (lowerLine.startsWith('•') && (lowerLine.includes('times') || lowerLine.includes('daily')))) {
      continue
    }
    
    let medicineName = ''
    const emojiMatch = line.match(/\*[1-9]️⃣\s+(.+?)\*/)
    if (emojiMatch?.[1]) {
      medicineName = emojiMatch[1]
    } else {
      const numberMatch = line.match(/^\d+[.)]\s*(.+?)(?:\s*[-–—]|$)/)
      if (numberMatch?.[1]) {
        medicineName = numberMatch[1]
      } else if (/^[A-Z][a-z]+/.test(line.trim())) {
        medicineName = line.trim()
      }
    }
    
    if (medicineName) {
      const cleanName = medicineName
        .replace(/\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|microgram|gram|milligram|capsule|tablet|tab|cap|drops?|syrup|injection|amp|vial)/gi, '')
        .replace(/\b(?:daily|once|twice|thrice|three times|four times|\d+\s*times|after|before|with|meals?|food|empty stomach|morning|evening|night|bedtime)\b/gi, '')
        .replace(/\b(?:for|duration|continue|take)\s+\d+\s*(?:days?|weeks?|months?|hours?)\b/gi, '')
        .replace(/\b(?:after|before|with|meals?|food|empty stomach|morning|evening|night|bedtime|times|per day|as directed|as needed)\b/gi, '')
        .replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '')
        .replace(/\s*[-–—]\s*/g, ' ').replace(/\s*:\s*/g, ' ').replace(/\s+/g, ' ').trim()
      
      const words = cleanName.split(/\s+/).filter(word => {
        const lowerWord = word.toLowerCase()
        return !['take', 'give', 'use', 'apply', 'drink', 'eat', 'with', 'after', 'before'].includes(lowerWord) &&
               word.length > 1 && /[a-zA-Z]/.test(word)
      })
      
      if (words.length > 0) {
        const name = words.slice(0, 3).join(' ').trim()
        if (name && name.length > 2 && name.length < 50) {
          medicines.push(name)
        }
      }
    }
  }
  
  return medicines
}

/**
 * Calculate common conditions from appointments
 */
export function calculateCommonConditions(
  appointments: Array<{ chiefComplaint?: string }>
): Array<{ condition: string; count: number }> {
  const conditionCounts: { [key: string]: number } = {}
  const conditions = [
    'fever', 'cough', 'headache', 'pain', 'cold', 'flu', 'diabetes', 'hypertension',
    'asthma', 'depression', 'anxiety', 'back pain', 'chest pain', 'stomach pain',
    'skin problem', 'allergy', 'infection', 'blood pressure', 'heart', 'lung',
    'kidney', 'liver', 'eye', 'ear', 'nose', 'throat', 'dental', 'mental health'
  ]
  
  appointments.forEach(apt => {
    const complaint = apt.chiefComplaint?.toLowerCase() || ''
    conditions.forEach(condition => {
      if (complaint.includes(condition)) {
        conditionCounts[condition] = (conditionCounts[condition] || 0) + 1
      }
    })
  })
  
  return Object.entries(conditionCounts)
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

/**
 * Calculate most prescribed medicines
 */
export function calculateMostPrescribedMedicines(
  appointments: Array<{ medicine?: string; status: string }>
): Array<{ medicineName: string; prescriptionCount: number; percentage: number }> {
  const medicineCounts: Record<string, number> = {}
  let totalPrescriptions = 0
  
  appointments.forEach(apt => {
    if (apt.medicine && apt.status === 'completed') {
      const medicines = extractMedicines(apt.medicine)
      medicines.forEach(medicine => {
        const normalizedName = medicine
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
        medicineCounts[normalizedName] = (medicineCounts[normalizedName] || 0) + 1
        totalPrescriptions++
      })
    }
  })
  
  return Object.entries(medicineCounts)
    .map(([medicineName, prescriptionCount]) => ({
      medicineName,
      prescriptionCount,
      percentage: totalPrescriptions > 0 ? (prescriptionCount / totalPrescriptions) * 100 : 0
    }))
    .sort((a, b) => b.prescriptionCount - a.prescriptionCount)
    .slice(0, 10)
}

