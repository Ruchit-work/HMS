/**
 * Shared billing collection analytics helpers.
 * Same period math as Reception Billing → Admin Billing parity.
 */

export type CollectionPeriod = "today" | "weekly" | "monthly" | "yearly"

export type BillingCollectionRecord = {
  id: string
  type?: "admission" | "appointment" | string
  status?: string
  totalAmount?: number
  paidAt?: string | null
  generatedAt?: string
  paymentMethod?: string | null
  settlementMode?: string | null
  patientName?: string | null
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export function isInDateRange(dateStr: string | null | undefined, start: Date, end: Date) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  return d >= start && d <= end
}

export function getCollectionPeriodRanges(period: CollectionPeriod) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  switch (period) {
    case "today": {
      const yesterday = new Date(todayStart)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        current: { start: todayStart, end: todayEnd },
        previous: { start: startOfDay(yesterday), end: endOfDay(yesterday) },
        previousLabel: "yesterday",
        periodLabel: "Today",
      }
    }
    case "weekly": {
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
      const prevWeekEnd = new Date(weekStart)
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 1)
      const prevWeekStart = new Date(prevWeekEnd)
      prevWeekStart.setDate(prevWeekStart.getDate() - 6)
      return {
        current: { start: weekStart, end: todayEnd },
        previous: { start: startOfDay(prevWeekStart), end: endOfDay(prevWeekEnd) },
        previousLabel: "last week",
        periodLabel: "This Week",
      }
    }
    case "monthly": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const prevMonthEnd = new Date(monthStart)
      prevMonthEnd.setDate(0)
      const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1)
      return {
        current: { start: monthStart, end: todayEnd },
        previous: { start: startOfDay(prevMonthStart), end: endOfDay(prevMonthEnd) },
        previousLabel: "last month",
        periodLabel: "This Month",
      }
    }
    case "yearly": {
      const yearStart = new Date(now.getFullYear(), 0, 1)
      const prevYearStart = new Date(now.getFullYear() - 1, 0, 1)
      const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
      return {
        current: { start: yearStart, end: todayEnd },
        previous: { start: prevYearStart, end: prevYearEnd },
        previousLabel: "last year",
        periodLabel: "This Year",
      }
    }
  }
}

export function sumPeriodMetrics(records: BillingCollectionRecord[], start: Date, end: Date) {
  const paid = records.filter((r) => r.status === "paid" && isInDateRange(r.paidAt, start, end))
  const cash = paid.filter((r) => r.paymentMethod === "cash" || r.settlementMode === "cash")
  const upi = paid.filter((r) => r.paymentMethod === "upi" || r.settlementMode === "upi")
  const card = paid.filter((r) => r.paymentMethod === "card" || r.settlementMode === "card")
  const generatedInPeriod = records.filter((r) => isInDateRange(r.generatedAt, start, end))
  const pending = generatedInPeriod.filter((r) => r.status !== "paid" && r.status !== "void" && r.status !== "cancelled")

  const collectionAmount = paid.reduce((sum, r) => sum + (r.totalAmount || 0), 0)

  return {
    collectionAmount,
    cashAmount: cash.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    upiAmount: upi.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    cardAmount: card.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    paidCount: paid.length,
    invoicesCount: generatedInPeriod.length,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    avgBillSize: paid.length > 0 ? Math.round(collectionAmount / paid.length) : 0,
  }
}

export function computeCollectionTrend(current: number, previous: number) {
  if (current === 0 && previous === 0) {
    return { direction: "flat" as const, percent: 0, text: "No change", increased: false }
  }
  if (previous === 0) {
    return { direction: "up" as const, percent: 100, text: "+100%", increased: true }
  }

  const percent = Math.round(((current - previous) / previous) * 100)
  if (percent > 0) {
    return { direction: "up" as const, percent, text: `+${percent}%`, increased: true }
  }
  if (percent < 0) {
    return { direction: "down" as const, percent, text: `${percent}%`, increased: false }
  }
  return { direction: "flat" as const, percent: 0, text: "No change", increased: false }
}

export function formatBillingCurrency(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`
}
