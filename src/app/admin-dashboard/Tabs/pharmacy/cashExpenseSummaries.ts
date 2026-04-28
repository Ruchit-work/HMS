import type { PharmacyCashSession, PharmacyExpense, PharmacySale } from '@/types/pharmacy'
import { getExpenseDateStr, getSaleDateStr, toTimestampMs } from './dateUtils'

export type DailySummarySalesSort = 'default' | 'highest' | 'lowest'

export type DailySummaryShiftRow = {
  id: string
  dateStr: string
  counterInfo: string
  salesTotal: number
  expenseTotal: number
  profit: number
}

export type DailySummaryDayRow = {
  dateStr: string
  salesTotal: number
  expenseTotal: number
  profit: number
  shiftCount: number
  shifts: DailySummaryShiftRow[]
}

export type PeriodSummary = {
  salesTotal: number
  refundsTotal: number
  expenseTotal: number
  net: number
  count: number
  sales: PharmacySale[]
  start: string
  end: string
}

export type PeriodSummaries = {
  today: PeriodSummary
  week: PeriodSummary
  month: PeriodSummary
  year: PeriodSummary
}

export type CloseShiftPreview = {
  openingCash: number
  cashSales: number
  cashRefunds: number
  changeGiven: number
  cashExpenses: number
  expectedCash: number
  actualCash: number
  difference: number
}

export const computeDailySummary = (
  sales: PharmacySale[],
  expenses: PharmacyExpense[],
  branchFilter: string
) => {
  const todayStr = new Date().toISOString().slice(0, 10)
  const baseSales = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  const todaySalesTotal = baseSales.reduce((sum, s) => {
    const saleDateStr = getSaleDateStr(s)
    if (saleDateStr !== todayStr) return sum
    return sum + Number(s.netAmount ?? s.totalAmount ?? 0)
  }, 0)
  const todayExpenseTotal = expenses.reduce((sum, e) => {
    const dateStr = getExpenseDateStr(e)
    if (dateStr !== todayStr) return sum
    return sum + Number(e.amount ?? 0)
  }, 0)
  return { todayStr, todaySalesTotal, todayExpenseTotal, net: todaySalesTotal - todayExpenseTotal }
}

export const computeRecentSalesToday = (filteredSales: PharmacySale[]): PharmacySale[] => {
  const todayStr = new Date().toISOString().slice(0, 10)
  return filteredSales
    .filter((s) => getSaleDateStr(s) === todayStr)
    .sort((a, b) => toTimestampMs(b.dispensedAt) - toTimestampMs(a.dispensedAt))
}

export const computeSessionSales = (
  filteredSales: PharmacySale[],
  openedAt?: PharmacyCashSession['openedAt'] | null
): PharmacySale[] => {
  if (!openedAt) return []
  const openedAtMs = toTimestampMs(openedAt)
  const nowMs = Date.now()
  return filteredSales.filter((s) => {
    const t = toTimestampMs(s.dispensedAt)
    return t >= openedAtMs && t <= nowMs
  })
}

export const computeCloseShiftPreview = ({
  activeCashSession,
  sessionSales,
  cashClosingNotes,
  cashDenoms,
}: {
  activeCashSession: PharmacyCashSession | null
  sessionSales: PharmacySale[]
  cashClosingNotes: Record<string, string>
  cashDenoms: readonly string[]
}): CloseShiftPreview => {
  const openingCash = Number(activeCashSession?.openingCashTotal ?? 0)
  const cashSales = Number(activeCashSession?.cashSales ?? 0) || sessionSales
    .filter((s) => s.paymentMode === 'cash')
    .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
  const cashRefunds = sessionSales
    .filter((s) => s.paymentMode === 'cash')
    .reduce((sum, s) => sum + Number(s.refundedAmount ?? 0), 0)
  const changeGiven = Number(activeCashSession?.changeGiven ?? 0)
  const cashExpenses = Number(activeCashSession?.cashExpenses ?? 0)
  const expectedCash = openingCash + cashSales - cashRefunds - changeGiven - cashExpenses
  const actualCash = cashDenoms.reduce(
    (sum, den) => sum + Math.max(0, Number(cashClosingNotes[den] || 0)) * Number(den),
    0
  )
  const difference = actualCash - expectedCash
  return { openingCash, cashSales, cashRefunds, changeGiven, cashExpenses, expectedCash, actualCash, difference }
}

export const computePeriodSummaries = (
  filteredSales: PharmacySale[],
  expenses: PharmacyExpense[]
): PeriodSummaries => {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const startOfWeek = new Date(now)
  const day = startOfWeek.getDay()
  const diff = day === 0 ? 6 : day - 1
  startOfWeek.setDate(startOfWeek.getDate() - diff)
  const weekStartStr = startOfWeek.toISOString().slice(0, 10)
  const monthStartStr = todayStr.slice(0, 7) + '-01'
  const yearStartStr = todayStr.slice(0, 4) + '-01-01'

  const salesInPeriod = (start: string, end: string) =>
    filteredSales.filter((s) => {
      const d = getSaleDateStr(s)
      return d >= start && d <= end
    })
  const expensesInPeriod = (start: string, end: string) =>
    expenses.filter((e) => {
      const d = getExpenseDateStr(e)
      return d >= start && d <= end
    })

  const build = (start: string, end: string): PeriodSummary => {
    const periodSales = salesInPeriod(start, end)
    const periodExpenses = expensesInPeriod(start, end)
    const salesTotal = periodSales.reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
    const refundsTotal = periodSales.reduce((sum, s) => sum + Number(s.refundedAmount || 0), 0)
    const expenseTotal = periodExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
    return {
      salesTotal,
      refundsTotal,
      expenseTotal,
      net: salesTotal - expenseTotal,
      count: periodSales.length,
      sales: periodSales,
      start,
      end,
    }
  }

  return {
    today: build(todayStr, todayStr),
    week: build(weekStartStr, todayStr),
    month: build(monthStartStr, todayStr),
    year: build(yearStartStr, todayStr),
  }
}

export const computeDailySummaryRows = ({
  sales,
  expenses,
  branchFilter,
  recentCashSessions,
}: {
  sales: PharmacySale[]
  expenses: PharmacyExpense[]
  branchFilter: string
  recentCashSessions: PharmacyCashSession[]
}): DailySummaryShiftRow[] => {
  const baseSales = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  const baseExpenses = branchFilter === 'all' ? expenses : expenses.filter((e) => e.branchId === branchFilter)
  const toTimeStr = (v: unknown): string => {
    if (!v) return '—'
    const iso = typeof v === 'string' ? v : (v as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  const rows: DailySummaryShiftRow[] = []

  const closedSessions = recentCashSessions.filter((s) => s.status !== 'open' && s.closedAt)
  closedSessions.forEach((s) => {
    const closed = s.closedAt && (typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.())
    if (!closed) return
    const dateStr = closed.slice(0, 10)
    const openTime = toTimeStr(s.openedAt)
    const closeTime = toTimeStr(s.closedAt)
    const cashier = s.openedByName || s.closedByName || 'Cashier'
    const counterInfo = `${cashier} – ${openTime}–${closeTime}`
    const cash = Number(s.cashSales ?? 0)
    const upi = Number(s.upiSales ?? 0)
    const card = Number(s.cardSales ?? 0)
    const refunds = Number(s.refunds ?? 0)
    const cashExp = Number(s.cashExpenses ?? 0)
    const salesTotal = cash + upi + card - refunds
    const expenseTotal = cashExp
    const profit = salesTotal - expenseTotal
    rows.push({ id: s.id, dateStr, counterInfo, salesTotal, expenseTotal, profit })
  })

  const datesWithShifts = new Set(rows.map((r) => r.dateStr))
  const dateSet = new Set<string>()
  baseSales.forEach((s) => {
    const d = getSaleDateStr(s)
    if (d) dateSet.add(d)
  })
  baseExpenses.forEach((e) => {
    const d = getExpenseDateStr(e)
    if (d) dateSet.add(d)
  })
  dateSet.forEach((dateStr) => {
    if (datesWithShifts.has(dateStr)) return
    const daySales = baseSales.filter((s) => getSaleDateStr(s) === dateStr)
    const salesTotal = daySales.reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
    const dayExpenses = baseExpenses.filter((e) => getExpenseDateStr(e) === dateStr)
    const expenseTotal = dayExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
    const profit = salesTotal - expenseTotal
    rows.push({ id: `day-${dateStr}`, dateStr, counterInfo: '—', salesTotal, expenseTotal, profit })
  })

  rows.sort((a, b) => {
    if (a.dateStr !== b.dateStr) return b.dateStr.localeCompare(a.dateStr)
    if (a.id.startsWith('day-') && !b.id.startsWith('day-')) return 1
    if (!a.id.startsWith('day-') && b.id.startsWith('day-')) return -1
    return 0
  })
  return rows.slice(0, 200)
}

export const computeDailySummaryDayRows = (dailySummaryRows: DailySummaryShiftRow[]): DailySummaryDayRow[] => {
  const byDate = new Map<string, DailySummaryShiftRow[]>()
  dailySummaryRows.forEach((r) => {
    const list = byDate.get(r.dateStr) ?? []
    list.push(r)
    byDate.set(r.dateStr, list)
  })
  const days: DailySummaryDayRow[] = []
  byDate.forEach((shifts, dateStr) => {
    const salesTotal = shifts.reduce((s, r) => s + r.salesTotal, 0)
    const expenseTotal = shifts.reduce((s, r) => s + r.expenseTotal, 0)
    const profit = shifts.reduce((s, r) => s + r.profit, 0)
    days.push({ dateStr, salesTotal, expenseTotal, profit, shiftCount: shifts.length, shifts })
  })
  days.sort((a, b) => b.dateStr.localeCompare(a.dateStr))
  return days
}

export const filterDailySummaryDayRows = ({
  rows,
  search,
  dateFrom,
  dateTo,
  salesSort,
}: {
  rows: DailySummaryDayRow[]
  search: string
  dateFrom: string
  dateTo: string
  salesSort: DailySummarySalesSort
}): DailySummaryDayRow[] => {
  let nextRows = [...rows]
  const normalizedSearch = search.trim().toLowerCase()
  if (normalizedSearch) {
    nextRows = nextRows.filter(
      (d) => d.dateStr.includes(normalizedSearch) || d.shifts.some((s) => s.counterInfo.toLowerCase().includes(normalizedSearch))
    )
  }
  if (dateFrom) nextRows = nextRows.filter((d) => d.dateStr >= dateFrom)
  if (dateTo) nextRows = nextRows.filter((d) => d.dateStr <= dateTo)
  if (salesSort === 'highest') nextRows = [...nextRows].sort((a, b) => b.salesTotal - a.salesTotal)
  else if (salesSort === 'lowest') nextRows = [...nextRows].sort((a, b) => a.salesTotal - b.salesTotal)
  return nextRows
}

export const filterShiftReports = ({
  closedShiftSessions,
  search,
  dateFrom,
  dateTo,
}: {
  closedShiftSessions: PharmacyCashSession[]
  search: string
  dateFrom: string
  dateTo: string
}): PharmacyCashSession[] => {
  let list = [...closedShiftSessions]
  const normalizedSearch = search.trim().toLowerCase()
  if (normalizedSearch) {
    list = list.filter((s) => {
      const cashier = (s.openedByName ?? s.closedByName ?? '').toLowerCase()
      const opened = typeof s.openedAt === 'string' ? s.openedAt : (s.openedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
      const closed = s.closedAt && (typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.())
      const dateStr = closed ? closed.slice(0, 10) : ''
      return cashier.includes(normalizedSearch) || opened.includes(normalizedSearch) || (closed && closed.toLowerCase().includes(normalizedSearch)) || dateStr.includes(normalizedSearch)
    })
  }
  if (dateFrom) {
    list = list.filter((s) => {
      const closed = s.closedAt && (typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.())
      return Boolean(closed && closed.slice(0, 10) >= dateFrom)
    })
  }
  if (dateTo) {
    list = list.filter((s) => {
      const closed = s.closedAt && (typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.())
      return Boolean(closed && closed.slice(0, 10) <= dateTo)
    })
  }
  return list
}
