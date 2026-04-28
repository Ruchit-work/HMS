import React from 'react'
import Pagination from '@/components/ui/navigation/Pagination'
import type { PharmacyCashSession } from '@/types/pharmacy'

type DailyShiftRow = {
  id: string
  counterInfo: string
  salesTotal: number
  expenseTotal: number
  profit: number
}

type DailySummaryDayRow = {
  dateStr: string
  shiftCount: number
  shifts: DailyShiftRow[]
  salesTotal: number
  expenseTotal: number
  profit: number
}

export function CashExpensesDailyContent(props: {
  dailySummarySearch: string
  setDailySummarySearch: (v: string) => void
  dailySummaryDateFrom: string
  setDailySummaryDateFrom: (v: string) => void
  dailySummaryDateTo: string
  setDailySummaryDateTo: (v: string) => void
  dailySummarySalesSort: 'default' | 'highest' | 'lowest'
  setDailySummarySalesSort: (v: 'default' | 'highest' | 'lowest') => void
  filteredDailySummaryRows: DailySummaryDayRow[]
  paginatedDailySummaryRows: DailySummaryDayRow[]
  expandedDailySummaryDates: Set<string>
  setExpandedDailySummaryDates: React.Dispatch<React.SetStateAction<Set<string>>>
  dailySummaryPage: number
  dailySummaryTotalPages: number
  dailySummaryPageSize: number
  goToDailySummaryPage: (v: number) => void
  setDailySummaryPageSize: (v: number) => void
  shiftReportsSearch: string
  setShiftReportsSearch: (v: string) => void
  shiftReportsDateFrom: string
  setShiftReportsDateFrom: (v: string) => void
  shiftReportsDateTo: string
  setShiftReportsDateTo: (v: string) => void
  closedShiftSessions: PharmacyCashSession[]
  filteredShiftReports: PharmacyCashSession[]
  paginatedShiftReports: PharmacyCashSession[]
  shiftReportsPage: number
  shiftReportsTotalPages: number
  shiftReportsPageSize: number
  goToShiftReportsPage: (v: number) => void
  setShiftReportsPageSize: (v: number) => void
  setViewShiftReportSession: (s: PharmacyCashSession | null) => void
}) {
  const {
    dailySummarySearch,
    setDailySummarySearch,
    dailySummaryDateFrom,
    setDailySummaryDateFrom,
    dailySummaryDateTo,
    setDailySummaryDateTo,
    dailySummarySalesSort,
    setDailySummarySalesSort,
    filteredDailySummaryRows,
    paginatedDailySummaryRows,
    expandedDailySummaryDates,
    setExpandedDailySummaryDates,
    dailySummaryPage,
    dailySummaryTotalPages,
    dailySummaryPageSize,
    goToDailySummaryPage,
    setDailySummaryPageSize,
    shiftReportsSearch,
    setShiftReportsSearch,
    shiftReportsDateFrom,
    setShiftReportsDateFrom,
    shiftReportsDateTo,
    setShiftReportsDateTo,
    closedShiftSessions,
    filteredShiftReports,
    paginatedShiftReports,
    shiftReportsPage,
    shiftReportsTotalPages,
    shiftReportsPageSize,
    goToShiftReportsPage,
    setShiftReportsPageSize,
    setViewShiftReportSession,
  } = props

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Daily Summary – Counter & Profit by Day</h3>
          <p className="text-sm text-slate-500 mb-4">Single-shift days show one row. Days with multiple counters/shifts show a summary row—click it to expand and see each shift.</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input type="text" placeholder="Search by date or counter..." value={dailySummarySearch} onChange={(e) => setDailySummarySearch(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">From</label>
              <input type="date" value={dailySummaryDateFrom} onChange={(e) => setDailySummaryDateFrom(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">To</label>
              <input type="date" value={dailySummaryDateTo} onChange={(e) => setDailySummaryDateTo(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
              <span className="px-2 text-xs font-medium text-slate-500">Sales:</span>
              <button type="button" onClick={() => setDailySummarySalesSort(dailySummarySalesSort === 'highest' ? 'default' : 'highest')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${dailySummarySalesSort === 'highest' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Highest first</button>
              <button type="button" onClick={() => setDailySummarySalesSort(dailySummarySalesSort === 'lowest' ? 'default' : 'lowest')} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${dailySummarySalesSort === 'lowest' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Lowest first</button>
            </div>
            {(dailySummarySearch || dailySummaryDateFrom || dailySummaryDateTo || dailySummarySalesSort !== 'default') && (
              <button type="button" onClick={() => { setDailySummarySearch(''); setDailySummaryDateFrom(''); setDailySummaryDateTo(''); setDailySummarySalesSort('default') }} className="text-xs font-medium text-slate-500 hover:text-slate-700 underline underline-offset-1">
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Counters / Shifts</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Sales</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Expenses</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredDailySummaryRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">No days match your filters.</td>
                </tr>
              ) : (
                paginatedDailySummaryRows.map((day, idx) => {
                  const isMultiShift = day.shiftCount > 1
                  const isExpanded = expandedDailySummaryDates.has(day.dateStr)
                  const toggleExpand = () => {
                    if (!isMultiShift) return
                    setExpandedDailySummaryDates((prev) => {
                      const next = new Set(prev)
                      if (next.has(day.dateStr)) next.delete(day.dateStr)
                      else next.add(day.dateStr)
                      return next
                    })
                  }
                  const rowClass = `${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} transition-colors hover:bg-slate-50/80 ${isMultiShift ? 'cursor-pointer select-none' : ''}`
                  return (
                    <React.Fragment key={day.dateStr}>
                      <tr onClick={isMultiShift ? toggleExpand : undefined} className={rowClass}>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{day.dateStr}</td>
                        <td className="px-4 py-3 text-slate-600">{day.shiftCount === 0 ? '—' : day.shiftCount === 1 ? day.shifts[0].counterInfo : `${day.shiftCount} shifts`}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-slate-800">₹{(day.shiftCount === 1 ? day.shifts[0].salesTotal : day.salesTotal).toFixed(2)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium text-slate-800">₹{(day.shiftCount === 1 ? day.shifts[0].expenseTotal : day.expenseTotal).toFixed(2)}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold ${(day.shiftCount === 1 ? day.shifts[0].profit : day.profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>₹{(day.shiftCount === 1 ? day.shifts[0].profit : day.profit).toFixed(2)}</td>
                      </tr>
                      {isMultiShift && isExpanded && (
                        <tr key={`${day.dateStr}-expanded`} className="bg-slate-50/50">
                          <td colSpan={5} className="px-0 py-0 align-top">
                            <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                              <p className="text-xs font-medium text-slate-500 mb-2">Shifts on {day.dateStr}</p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="text-left py-2 pr-4 font-medium">Counter / Shift</th>
                                    <th className="text-right py-2 font-medium">Sales</th>
                                    <th className="text-right py-2 font-medium">Expenses</th>
                                    <th className="text-right py-2 font-medium">Profit</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {day.shifts.map((shift) => (
                                    <tr key={shift.id} className="hover:bg-white/50">
                                      <td className="py-2 pr-4 text-slate-700">{shift.counterInfo}</td>
                                      <td className="py-2 text-right tabular-nums text-slate-800">₹{shift.salesTotal.toFixed(2)}</td>
                                      <td className="py-2 text-right tabular-nums text-slate-800">₹{shift.expenseTotal.toFixed(2)}</td>
                                      <td className={`py-2 text-right tabular-nums font-medium ${shift.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>₹{shift.profit.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={dailySummaryPage}
          totalPages={dailySummaryTotalPages}
          pageSize={dailySummaryPageSize}
          totalItems={filteredDailySummaryRows.length}
          onPageChange={goToDailySummaryPage}
          onPageSizeChange={setDailySummaryPageSize}
          itemLabel="days"
          className="border-t border-slate-200"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Shift Reports</h3>
          <p className="text-sm text-slate-500 mt-0.5 mb-4">Closed shifts with cashier, times and amounts.</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input type="text" placeholder="Search by cashier or date..." value={shiftReportsSearch} onChange={(e) => setShiftReportsSearch(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">From</label>
              <input type="date" value={shiftReportsDateFrom} onChange={(e) => setShiftReportsDateFrom(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">To</label>
              <input type="date" value={shiftReportsDateTo} onChange={(e) => setShiftReportsDateTo(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            {(shiftReportsSearch || shiftReportsDateFrom || shiftReportsDateTo) && (
              <button type="button" onClick={() => { setShiftReportsSearch(''); setShiftReportsDateFrom(''); setShiftReportsDateTo('') }} className="text-xs font-medium text-slate-500 hover:text-slate-700 underline underline-offset-1">
                Clear filters
              </button>
            )}
          </div>
        </div>
        {filteredShiftReports.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 px-5 text-center">{closedShiftSessions.length === 0 ? 'No closed shifts yet. Close a shift to see it here.' : 'No shifts match your filters.'}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Cashier</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Opened At</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Closed At</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Opening Cash</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Closing Cash</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Profit</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedShiftReports.map((s) => {
                    const opened = typeof s.openedAt === 'string' ? s.openedAt : s.openedAt?.toDate?.()?.toISOString?.()
                    const closed = s.closedAt && (typeof s.closedAt === 'string' ? s.closedAt : s.closedAt?.toDate?.()?.toISOString?.())
                    const cash = Number(s.cashSales ?? 0)
                    const upi = Number(s.upiSales ?? 0)
                    const card = Number(s.cardSales ?? 0)
                    const refunds = Number(s.refunds ?? 0)
                    const cashExp = Number(s.cashExpenses ?? 0)
                    const totalCollection = cash + upi + card - refunds
                    const profit = totalCollection - cashExp
                    return (
                      <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800">{s.openedByName ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{opened ? new Date(opened).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{closed ? new Date(closed).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">₹{Number(s.openingCashTotal ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">₹{Number(s.closingCashTotal ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">₹{profit.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setViewShiftReportSession(s)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">View report</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={shiftReportsPage}
              totalPages={shiftReportsTotalPages}
              pageSize={shiftReportsPageSize}
              totalItems={filteredShiftReports.length}
              onPageChange={goToShiftReportsPage}
              onPageSizeChange={setShiftReportsPageSize}
              itemLabel="shifts"
              className="border-t border-slate-200"
            />
          </>
        )}
      </div>
    </div>
  )
}
