import React from 'react'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import { RefundCashModal } from '@/components/pharmacy/RefundCashModal'
import type { RefundNotesRecord } from '@/components/pharmacy/RefundCashModal'
import type {
  BranchMedicineStock,
  PharmacyCashSession,
  PharmacyCashierProfile,
  PharmacyCounter,
  PharmacyExpense,
  PharmacyExpenseCategory,
  PharmacySale,
} from '@/types/pharmacy'
import type { CloseShiftPreview, PeriodSummaries } from '../cashExpenseSummaries'
import { CASH_DENOMS } from '../constants'

type BranchOption = { id: string; name: string }
type CashExpensePeriod = 'today' | 'week' | 'month' | 'year'
type LastClosedSummary = {
  openingCashTotal: number
  closingCashTotal: number
  profit: number
}
type ExpenseForm = { date: string; amount: string; paymentMethod: string; note: string }
type ExpenseFilters = { dateFrom: string; dateTo: string; categoryId: string; paymentMethod: string }
type PendingExpensePayload = { amount: number; date: string; note: string; paymentMethod: string } | null

export function CashExpensesShiftContent(props: {
  cashExpensePeriod: CashExpensePeriod
  periodSummaries: PeriodSummaries
  cashSessionsLoading: boolean
  activeCashSession: PharmacyCashSession | null
  sessionSales: PharmacySale[]
  recentSalesToday: PharmacySale[]
  cashClosingNotes: Record<string, string>
  setCashClosingNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>
  closeShiftPreview: CloseShiftPreview
  closeCounterButtonClicked: boolean
  closeCounterSectionRef: React.RefObject<HTMLDivElement | null>
  openCounterSectionRef: React.RefObject<HTMLDivElement | null>
  highlightCloseCounter: boolean
  highlightOpenCounter: boolean
  lastClosedSummary: LastClosedSummary | null
  recentCashSessions: PharmacyCashSession[]
  cashiers: PharmacyCashierProfile[]
  counters: PharmacyCounter[]
  selectedCashierId: string
  setSelectedCashierId: React.Dispatch<React.SetStateAction<string>>
  selectedCounterId: string
  setSelectedCounterId: React.Dispatch<React.SetStateAction<string>>
  cashOpeningNotes: Record<string, string>
  setCashOpeningNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>
  openedByName: string
  branchFilter: string
  activeHospitalId: string | null
  expenseForm: ExpenseForm
  setExpenseForm: React.Dispatch<React.SetStateAction<ExpenseForm>>
  pendingExpensePayload: PendingExpensePayload
  showExpenseCashModal: boolean
  setShowExpenseCashModal: React.Dispatch<React.SetStateAction<boolean>>
  setPendingExpensePayload: React.Dispatch<React.SetStateAction<PendingExpensePayload>>
  expenses: PharmacyExpense[]
  expenseCategories: PharmacyExpenseCategory[]
  expenseFilters: ExpenseFilters
  setExpenseFilters: React.Dispatch<React.SetStateAction<ExpenseFilters>>
  branches: BranchOption[]
  onCloseShiftClick: () => void
  onStartNewShift: () => void
  onLoadPreviousCounter: () => void
  onOpenCounter: () => Promise<void>
  onSaveExpense: () => Promise<void>
  onConfirmExpenseCash: (notes: RefundNotesRecord) => Promise<void>
  onApplyExpenseFilters: () => Promise<void>
}) {
  const {
    cashExpensePeriod,
    periodSummaries,
    cashSessionsLoading,
    activeCashSession,
    sessionSales,
    recentSalesToday,
    cashClosingNotes,
    setCashClosingNotes,
    closeShiftPreview,
    closeCounterButtonClicked,
    closeCounterSectionRef,
    openCounterSectionRef,
    highlightCloseCounter,
    highlightOpenCounter,
    lastClosedSummary,
    recentCashSessions,
    cashiers,
    counters,
    selectedCashierId,
    setSelectedCashierId,
    selectedCounterId,
    setSelectedCounterId,
    cashOpeningNotes,
    setCashOpeningNotes,
    expenseForm,
    setExpenseForm,
    pendingExpensePayload,
    showExpenseCashModal,
    setShowExpenseCashModal,
    setPendingExpensePayload,
    expenses,
    expenseCategories,
    expenseFilters,
    setExpenseFilters,
    branches,
    onCloseShiftClick,
    onStartNewShift,
    onLoadPreviousCounter,
    onOpenCounter,
    onSaveExpense,
    onConfirmExpenseCash,
    onApplyExpenseFilters,
  } = props

  return (
    <>
      {(() => {
        const p = periodSummaries[cashExpensePeriod]
        const periodLabel = cashExpensePeriod === 'today' ? 'Today' : cashExpensePeriod === 'week' ? 'This Week' : cashExpensePeriod === 'month' ? 'This Month' : 'This Year'
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-900 tabular-nums">₹{p.salesTotal.toFixed(2)}</p>
                <p className="text-xs font-medium text-slate-500">Total Sales {periodLabel}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 002 2zm-6-4h.01M17 17h.01" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-slate-900 tabular-nums">₹{p.expenseTotal.toFixed(2)}</p>
                <p className="text-xs font-medium text-slate-500">Expenses {periodLabel}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${p.net >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-lg font-bold tabular-nums ${p.net >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>₹{p.net.toFixed(2)}</p>
                <p className="text-xs font-medium text-slate-500">Net Profit {periodLabel}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${activeCashSession ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900">{activeCashSession ? 'Open' : 'Closed'}</p>
                <p className="text-xs font-medium text-slate-500">Shift Status</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-slate-900 tabular-nums">{p.count}</p>
                <p className="text-xs font-medium text-slate-500">Invoices {periodLabel}</p>
              </div>
            </div>
          </div>
        )
      })()}

      {cashExpensePeriod === 'today' ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {cashSessionsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner inline />
            </div>
          ) : activeCashSession ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-800">Active Shift Info</h4>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-slate-500">Cashier</dt>
                    <dd className="font-medium text-slate-900">{activeCashSession.openedByName ?? '—'}</dd>
                    <dt className="text-slate-500">Opening time</dt>
                    <dd className="font-medium text-slate-900">{typeof activeCashSession.openedAt === 'string' ? new Date(activeCashSession.openedAt).toLocaleTimeString('en-IN') : '—'}</dd>
                    <dt className="text-slate-500">Opening cash</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">₹{activeCashSession.openingCashTotal.toFixed(2)}</dd>
                    <dt className="text-slate-500">Cash sales</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">₹{(Number(activeCashSession.cashSales) ?? sessionSales.filter((s) => s.paymentMode === 'cash').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)).toFixed(2)}</dd>
                    <dt className="text-slate-500">UPI sales</dt>
                    <dd className="font-medium tabular-nums text-slate-900">₹{sessionSales.filter((s) => s.paymentMode === 'upi').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0).toFixed(2)}</dd>
                    <dt className="text-slate-500">Card sales</dt>
                    <dd className="font-medium tabular-nums text-slate-900">₹{sessionSales.filter((s) => s.paymentMode === 'card').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0).toFixed(2)}</dd>
                    <dt className="text-slate-500">Cash expenses</dt>
                    <dd className="font-medium tabular-nums text-amber-700">₹{Number(activeCashSession?.cashExpenses ?? 0).toFixed(2)}</dd>
                    <dt className="text-slate-500">Total sales (profit)</dt>
                    <dd className="font-semibold tabular-nums text-emerald-700" title="Revenue − Cash expenses">
                      ₹{((Number(activeCashSession.cashSales) ?? sessionSales.filter((s) => s.paymentMode === 'cash').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)) + sessionSales.filter((s) => s.paymentMode === 'upi').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0) + sessionSales.filter((s) => s.paymentMode === 'card').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0) - Number(activeCashSession?.cashExpenses ?? 0)).toFixed(2)}
                    </dd>
                  </dl>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">Shift open</span>
                </div>
                {(() => {
                  const openingCash = Number(activeCashSession?.openingCashTotal ?? 0)
                  const cashSalesSession = Number(activeCashSession?.cashSales ?? 0) || sessionSales.filter((s) => s.paymentMode === 'cash').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
                  const cashRefundsSession = sessionSales.filter((s) => s.paymentMode === 'cash').reduce((sum, s) => sum + Number(s.refundedAmount ?? 0), 0)
                  const changeGiven = Number(activeCashSession?.changeGiven ?? 0)
                  const cashExpenses = Number(activeCashSession?.cashExpenses ?? 0)
                  const expectedCashInDrawer = openingCash + cashSalesSession - cashRefundsSession - changeGiven - cashExpenses
                  const upiSession = sessionSales.filter((s) => s.paymentMode === 'upi').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
                  const cardSession = sessionSales.filter((s) => s.paymentMode === 'card').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
                  const totalSalesAllPayments = cashSalesSession + upiSession + cardSession
                  const countedCash = CASH_DENOMS.reduce((sum, d) => sum + Math.max(0, Number(cashClosingNotes[d] || 0)) * Number(d), 0)
                  const cashDifference = countedCash - expectedCashInDrawer
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">Live Cash Drawer Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">Opening cash</span><span className="font-semibold tabular-nums text-slate-900">₹{openingCash.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Cash sales</span><span className="font-semibold tabular-nums text-slate-900">₹{cashSalesSession.toFixed(2)}</span></div>
                        {cashExpenses > 0 && <div className="flex justify-between"><span className="text-slate-500">Cash expenses</span><span className="font-medium tabular-nums text-amber-700">−₹{cashExpenses.toFixed(2)}</span></div>}
                        <div className="flex justify-between"><span className="text-slate-500">Current cash in drawer (expected)</span><span className="font-semibold tabular-nums text-slate-900">₹{expectedCashInDrawer.toFixed(2)}</span></div>
                        <div className="border-t border-slate-100 pt-2 mt-2">
                          <div className="flex justify-between"><span className="text-slate-500">Total sales (all payments)</span><span className="font-semibold tabular-nums text-emerald-700">₹{totalSalesAllPayments.toFixed(2)}</span></div>
                          <div className="flex justify-between text-xs text-slate-500 mt-1"><span>Cash ₹{cashSalesSession.toFixed(2)} · UPI ₹{upiSession.toFixed(2)} · Card ₹{cardSession.toFixed(2)}</span></div>
                        </div>
                        {countedCash > 0 && (
                          <>
                            <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-500">Actual counted cash</span><span className="font-semibold tabular-nums text-slate-900">₹{countedCash.toFixed(2)}</span></div>
                            <div className="flex justify-between items-center pt-1">
                              <span className="text-slate-600 font-medium">Cash difference (shortage / excess)</span>
                              <span className={`font-semibold tabular-nums ${cashDifference === 0 ? 'text-slate-700' : cashDifference > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {cashDifference === 0 ? 'Balanced' : cashDifference > 0 ? `+₹${cashDifference.toFixed(2)} excess` : `−₹${Math.abs(cashDifference).toFixed(2)} shortage`}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 px-4 py-3 border-b border-slate-200">Recent Sales Today</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Invoice</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-600">Customer</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-600">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSalesToday.length === 0 ? (
                          <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">No sales today yet</td></tr>
                        ) : (
                          recentSalesToday.slice(0, 5).map((s) => (
                            <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-medium text-slate-800">{s.invoiceNumber || s.id}</td>
                              <td className="px-3 py-2 text-slate-600">{s.patientName || 'Walk-in'}</td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums">₹{Number(s.netAmount ?? s.totalAmount ?? 0).toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div ref={closeCounterSectionRef} className={`rounded-xl border-2 transition-all duration-300 ${highlightCloseCounter ? 'border-rose-400 ring-2 ring-rose-200 ring-offset-2 bg-rose-50/30' : 'border-slate-200 bg-slate-50/30'} p-5 space-y-4`}>
                <h4 className="text-sm font-semibold text-slate-800">Close Counter Panel</h4>
                <p className="text-xs text-slate-500">Enter physical cash count by denomination.</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {CASH_DENOMS.map((den) => (
                    <label key={den} className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">₹{den}</span>
                      <input type="number" min={0} value={cashClosingNotes[den] ?? ''} onChange={(e) => setCashClosingNotes((prev) => ({ ...prev, [den]: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-right tabular-nums focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                    </label>
                  ))}
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Opening cash</span><span className="font-semibold tabular-nums">₹{closeShiftPreview.openingCash.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cash sales</span><span className="font-semibold tabular-nums">₹{closeShiftPreview.cashSales.toFixed(2)}</span></div>
                  {closeShiftPreview.cashExpenses > 0 && <div className="flex justify-between"><span className="text-slate-500">Cash expenses</span><span className="font-medium tabular-nums text-amber-700">−₹{closeShiftPreview.cashExpenses.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span className="text-slate-500">Expected cash in drawer</span><span className="font-semibold tabular-nums">₹{closeShiftPreview.expectedCash.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-500">Actual cash (counted)</span><span className="font-semibold tabular-nums">₹{closeShiftPreview.actualCash.toFixed(2)}</span></div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-600 font-medium">Cash difference (shortage / excess)</span>
                    <span className={`font-semibold tabular-nums ${closeShiftPreview.difference === 0 ? 'text-slate-700' : closeShiftPreview.difference > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {closeShiftPreview.difference === 0 ? 'Balanced' : closeShiftPreview.difference > 0 ? `+₹${closeShiftPreview.difference.toFixed(2)}` : `−₹${Math.abs(closeShiftPreview.difference).toFixed(2)}`}
                    </span>
                  </div>
                </div>
                <div className={`rounded-lg border p-3 ${closeShiftPreview.difference === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Close Shift Variance</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-slate-500">Expected</p><p className="font-semibold tabular-nums text-slate-900">₹{closeShiftPreview.expectedCash.toFixed(2)}</p></div>
                    <div><p className="text-slate-500">Counted</p><p className="font-semibold tabular-nums text-slate-900">₹{closeShiftPreview.actualCash.toFixed(2)}</p></div>
                    <div><p className="text-slate-500">Difference</p><p className={`font-semibold tabular-nums ${closeShiftPreview.difference === 0 ? 'text-emerald-700' : closeShiftPreview.difference > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{closeShiftPreview.difference === 0 ? '₹0.00' : closeShiftPreview.difference > 0 ? `+₹${closeShiftPreview.difference.toFixed(2)}` : `−₹${Math.abs(closeShiftPreview.difference).toFixed(2)}`}</p></div>
                  </div>
                </div>
                <button type="button" className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 active:scale-[0.98] active:shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 transition-all duration-150 ease-out ${closeCounterButtonClicked ? 'ring-2 ring-rose-300 ring-offset-2 ring-offset-white' : ''}`} onClick={onCloseShiftClick}>
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Close Shift & Generate Report
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              {lastClosedSummary && (
                <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-emerald-900">Shift closed</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-emerald-700 block text-xs">Opening amount</span><span className="font-semibold text-emerald-900 tabular-nums">₹{lastClosedSummary.openingCashTotal.toFixed(2)}</span></div>
                    <div><span className="text-emerald-700 block text-xs">Closing amount</span><span className="font-semibold text-emerald-900 tabular-nums">₹{lastClosedSummary.closingCashTotal.toFixed(2)}</span></div>
                    <div><span className="text-emerald-700 block text-xs">Profit (shift)</span><span className="font-semibold text-emerald-900 tabular-nums">₹{lastClosedSummary.profit.toFixed(2)}</span></div>
                    <div className="flex items-end">
                      <button type="button" onClick={onStartNewShift} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                        Start new shift
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-700">Enter opening cash below and open counter to start the next shift.</p>
                </div>
              )}
              <div ref={openCounterSectionRef} className={`rounded-xl border transition-all duration-300 ${highlightOpenCounter ? 'border-emerald-400 ring-2 ring-emerald-300 ring-offset-2 bg-emerald-50/30' : 'border-slate-200'} p-4`}>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Open counter (Start shift)</h4>
                <p className="text-xs text-slate-500 mb-3">Enter opening cash breakdown at the start of the day. System will use this for reconciliation at close.</p>
                {recentCashSessions.filter((s) => s.status !== 'open').length > 0 && (
                  <div className="mb-3">
                    <button type="button" onClick={onLoadPreviousCounter} className="text-xs font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-1">Load previous counter</button>
                    <span className="text-[11px] text-slate-500 ml-2">(Use last closed shift’s cash as opening — ₹{Number(recentCashSessions.find((s) => s.status !== 'open')?.closingCashTotal ?? 0).toFixed(2)})</span>
                  </div>
                )}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 max-w-xl">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600 block mb-1">Cashier</span>
                    <div className="flex items-center gap-2">
                      <select value={selectedCashierId} onChange={(e) => setSelectedCashierId(e.target.value)} className="w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                        <option value="">Select cashier</option>
                        {cashiers.map((c) => {
                          const inUse = recentCashSessions.some((s) => s.status === 'open' && s.cashierProfileId === c.id)
                          return <option key={c.id} value={c.id} disabled={inUse}>{c.name}{c.phone ? ` (${c.phone})` : ''}{inUse ? ' — in shift' : ''}</option>
                        })}
                      </select>
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600 block mb-1">Counter</span>
                    <div className="flex items-center gap-2">
                      <select value={selectedCounterId} onChange={(e) => setSelectedCounterId(e.target.value)} className="w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900">
                        <option value="">Select counter</option>
                        {counters.map((c) => {
                          const inUse = recentCashSessions.some((s) => s.status === 'open' && s.counterId === c.id)
                          return <option key={c.id} value={c.id} disabled={inUse}>{c.name}{inUse ? ' — in use' : ''}</option>
                        })}
                      </select>
                    </div>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                    {CASH_DENOMS.map((den) => (
                      <label key={den} className="flex flex-col gap-1">
                        <span className="text-slate-600">₹{den}</span>
                        <input type="number" min={0} value={cashOpeningNotes[den] ?? ''} onChange={(e) => setCashOpeningNotes((prev) => ({ ...prev, [den]: e.target.value }))} className="w-full rounded border border-slate-300 px-2 py-1 text-right text-[11px]" />
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span>Opening cash total</span>
                    <span className="font-semibold text-slate-900">₹{CASH_DENOMS.reduce((sum, den) => sum + Math.max(0, Number(cashOpeningNotes[den] || 0)) * Number(den), 0).toFixed(2)}</span>
                  </div>
                  <button type="button" className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700" onClick={onOpenCounter}>Open counter</button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600 space-y-2">
                <h4 className="text-sm font-semibold text-slate-800 mb-1">How this works</h4>
                <p>1. At the start of your shift, enter the physical cash in the drawer and open the counter.</p>
                <p>2. During the day, the system tracks cash sales and refunds.</p>
                <p>3. At the end, count cash again, enter the breakdown and close the counter to see any short / extra.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Combined Sales {cashExpensePeriod === 'week' ? 'This Week' : cashExpensePeriod === 'month' ? 'This Month' : 'This Year'}</h3>
            <p className="text-sm text-slate-500 mt-0.5">All counters combined · {periodSummaries[cashExpensePeriod].start} to {periodSummaries[cashExpensePeriod].end} · {periodSummaries[cashExpensePeriod].count} invoice(s)</p>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Payment</th>
                </tr>
              </thead>
              <tbody>
                {periodSummaries[cashExpensePeriod].sales.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No sales in this period.</td></tr>
                ) : (
                  [...periodSummaries[cashExpensePeriod].sales].sort((a, b) => {
                    const da = typeof a.dispensedAt === 'string' ? new Date(a.dispensedAt).getTime() : (a.dispensedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
                    const db = typeof b.dispensedAt === 'string' ? new Date(b.dispensedAt).getTime() : (b.dispensedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
                    return db - da
                  }).map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-700">{typeof s.dispensedAt === 'string' ? s.dispensedAt.slice(0, 10) : (s.dispensedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '—'}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{s.invoiceNumber || s.id}</td>
                      <td className="px-4 py-2 text-slate-600">{s.patientName || 'Walk-in'}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">₹{Number(s.netAmount ?? s.totalAmount ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-slate-600 capitalize">{s.paymentMode || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
          <h3 className="text-base font-semibold text-slate-900">Add Expense</h3>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-slate-600 font-medium">Date</span>
              <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-600 font-medium">Note <span className="text-rose-500">*</span></span>
              <textarea rows={2} value={expenseForm.note} onChange={(e) => setExpenseForm((prev) => ({ ...prev, note: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="e.g. Buying new stand" required />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-600 font-medium">Amount (₹)</span>
              <input type="number" min={0} step={0.01} value={expenseForm.amount} onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-600 font-medium">Payment Method</span>
              <select value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm((prev) => ({ ...prev, paymentMethod: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <button type="button" className="w-full inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700" onClick={onSaveExpense}>Save expense</button>
          {pendingExpensePayload && (
            <RefundCashModal
              isOpen={showExpenseCashModal}
              onClose={() => { setShowExpenseCashModal(false); setPendingExpensePayload(null) }}
              refundAmount={pendingExpensePayload.amount}
              onConfirm={onConfirmExpenseCash}
            />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">Expense History</h3>
            <p className="text-sm text-slate-500 mt-0.5">{expenses.length} record(s) · Total ₹{expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2)}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input type="date" value={expenseFilters.dateFrom} onChange={(e) => setExpenseFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" />
              <input type="date" value={expenseFilters.dateTo} onChange={(e) => setExpenseFilters((prev) => ({ ...prev, dateTo: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs" />
              <select value={expenseFilters.categoryId} onChange={(e) => setExpenseFilters((prev) => ({ ...prev, categoryId: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
                <option value="all">All categories</option>
                {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={expenseFilters.paymentMethod} onChange={(e) => setExpenseFilters((prev) => ({ ...prev, paymentMethod: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
                <option value="all">All payments</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="bank">Bank</option>
              </select>
              <button type="button" onClick={onApplyExpenseFilters} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">Apply</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Note</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Payment Method</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Branch</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No expenses in the selected range.</td></tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-700">{typeof e.date === 'string' ? e.date.slice(0, 10) : (e.date as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? ''}</td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-800" title={e.description ?? e.categoryName ?? ''}>{e.description || e.categoryName || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900">₹{Number(e.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{e.paymentMethod}</td>
                      <td className="px-4 py-3 text-slate-600">{branches.find((b) => b.id === e.branchId)?.name || e.branchId}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
