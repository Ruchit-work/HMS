/**
 * Dashboard calculation utilities
 * Centralized functions for calculating statistics, trends, and analytics
 */

export interface TrendPoint {
  label: string
  fullLabel: string
  count: number
}

/**
 * Parse appointment dates into Date objects
 */
export function parseAppointmentDates(appointments: Array<{ appointmentDate?: string }>): Date[] {
  return appointments
    .map((apt) => {
      if (!apt.appointmentDate) return null
      const dt = new Date(apt.appointmentDate)
      if (Number.isNaN(dt.getTime())) return null
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
 * Calculate revenue for a time period
 */
export function calculateRevenue(
  appointments: Array<{ status: string; appointmentDate: string; paymentAmount?: number }>,
  days: number
): number {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  return appointments
    .filter(apt => apt.status === "completed" && new Date(apt.appointmentDate) >= cutoffDate)
    .reduce((sum, apt) => sum + (apt.paymentAmount || 0), 0)
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

