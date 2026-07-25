import React, { useState } from 'react'
import { Button, RevealModal } from '@/shared/components'
import { TabSkeleton } from '@/shared/components'
import { RefundCashModal } from '@/features/pharmacy/ui/RefundCashModal'
import type { RefundNotesRecord } from '@/features/pharmacy/ui/RefundCashModal'
import type {
  PharmacyCashSession,
  PharmacyCashierProfile,
  PharmacyCounter,
  PharmacyExpense,
  PharmacyExpenseCategory,
  PharmacySale,
} from '@/types/pharmacy'
import type { CloseShiftPreview, PeriodSummaries } from '@/features/pharmacy/utils/cashExpenseSummaries'
import { CASH_DENOMS } from '@/features/pharmacy/constants'

type BranchOption = { id: string; name: string }
type LastClosedSummary = {
  openingCashTotal: number
  closingCashTotal: number
  profit: number
}
type ExpenseForm = { date: string; amount: string; paymentMethod: string; note: string; categoryId?: string }
type ExpenseFilters = { dateFrom: string; dateTo: string; categoryId: string; paymentMethod: string }
type PendingExpensePayload = { amount: number; date: string; note: string; paymentMethod: string } | null
type SaveExpenseResult = 'posted' | 'pending_cash' | 'error'

const sumNotes = (notes: Record<string, string>): number =>
  CASH_DENOMS.reduce((sum, d) => sum + Math.max(0, Number(notes[d] || 0)) * Number(d), 0)

const saleTime = (v: PharmacySale['dispensedAt']): string => {
  const iso = typeof v === 'string' ? v : (v as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const expDateStr = (v: PharmacyExpense['date']): string =>
  typeof v === 'string' ? v.slice(0, 10) : (v as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? ''

function SummaryCard({
  label,
  value,
  tone = 'slate',
  icon,
}: {
  label: string
  value: string
  tone?: 'emerald' | 'rose' | 'sky' | 'slate'
  icon: React.ReactNode
}) {
  const toneMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    sky: 'bg-sky-50 text-sky-600',
    slate: 'bg-slate-100 text-slate-500',
  }
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 flex items-center gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneMap[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums truncate">{value}</p>
      </div>
    </div>
  )
}

/** POS-style Cash Counter: today summary, current shift, close shift, recent sales, expenses. */
export function CashExpensesShiftContent(props: {
  cashSessionsLoading: boolean
  activeCashSession: PharmacyCashSession | null
  sessionSales: PharmacySale[]
  recentSalesToday: PharmacySale[]
  periodSummaries: PeriodSummaries
  cashClosingNotes: Record<string, string>
  setCashClosingNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>
  closeShiftPreview: CloseShiftPreview
  detailedCashCounting: boolean
  countedCashSimple: string
  setCountedCashSimple: React.Dispatch<React.SetStateAction<string>>
  closeShiftLoading?: boolean
  closeCounterButtonClicked: boolean
  closeCounterSectionRef: React.RefObject<HTMLDivElement | null>
  openCounterSectionRef: React.RefObject<HTMLDivElement | null>
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
  openingCashSimple: string
  setOpeningCashSimple: React.Dispatch<React.SetStateAction<string>>
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
  onSaveExpense: () => Promise<SaveExpenseResult>
  onConfirmExpenseCash: (notes: RefundNotesRecord) => Promise<void>
  onApplyExpenseFilters: () => Promise<void>
  onViewAllSales: () => void
  openCounterLoading?: boolean
  saveExpenseLoading?: boolean
}) {
  const {
    cashSessionsLoading,
    activeCashSession,
    sessionSales,
    recentSalesToday,
    periodSummaries,
    cashClosingNotes,
    setCashClosingNotes,
    closeShiftPreview,
    detailedCashCounting,
    countedCashSimple,
    setCountedCashSimple,
    closeShiftLoading = false,
    closeCounterButtonClicked,
    closeCounterSectionRef,
    openCounterSectionRef,
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
    openingCashSimple,
    setOpeningCashSimple,
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
    onViewAllSales,
    openCounterLoading = false,
    saveExpenseLoading = false,
  } = props

  const [showDetails, setShowDetails] = useState(false)
  const [showDenomPopup, setShowDenomPopup] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [viewExpense, setViewExpense] = useState<PharmacyExpense | null>(null)

  const today = periodSummaries.today
  const cashInDrawer = activeCashSession ? closeShiftPreview.expectedCash : 0

  const cashSalesSession = Number(activeCashSession?.cashSales ?? 0) || sessionSales.filter((s) => s.paymentMode === 'cash').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
  const upiSession = sessionSales.filter((s) => s.paymentMode === 'upi').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
  const cardSession = sessionSales.filter((s) => s.paymentMode === 'card').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
  const cashExpensesSession = Number(activeCashSession?.cashExpenses ?? 0)
  const totalSalesSession = cashSalesSession + upiSession + cardSession

  const countedCash = detailedCashCounting ? sumNotes(cashClosingNotes) : Math.max(0, Number(countedCashSimple) || 0)
  const difference = closeShiftPreview.difference

  const openedAtStr = typeof activeCashSession?.openedAt === 'string'
    ? new Date(activeCashSession.openedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const handleSaveExpense = async () => {
    const result = await onSaveExpense()
    if (result === 'posted' || result === 'pending_cash') setShowAddExpense(false)
  }

  const activeFilterCount = [
    expenseFilters.dateFrom,
    expenseFilters.dateTo,
    expenseFilters.categoryId && expenseFilters.categoryId !== 'all' ? expenseFilters.categoryId : '',
    expenseFilters.paymentMethod && expenseFilters.paymentMethod !== 'all' ? expenseFilters.paymentMethod : '',
  ].filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* 1. Today's Summary — 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Today's Sales"
          tone="emerald"
          value={`₹${today.salesTotal.toFixed(2)}`}
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m9-5a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <SummaryCard
          label="Today's Expenses"
          tone="rose"
          value={`₹${today.expenseTotal.toFixed(2)}`}
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2h-2a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>}
        />
        <SummaryCard
          label="Cash in Drawer"
          tone="sky"
          value={`₹${cashInDrawer.toFixed(2)}`}
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        />
        <SummaryCard
          label="Current Shift"
          tone={activeCashSession ? 'emerald' : 'slate'}
          value={activeCashSession ? 'Open' : 'Closed'}
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {cashSessionsLoading ? (
        <div className="flex justify-center py-12 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <TabSkeleton variant="table" />
        </div>
      ) : activeCashSession ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2. Current Shift (compact) */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Current Shift</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Open
              </span>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Cashier</dt><dd className="font-medium text-slate-900">{activeCashSession.openedByName ?? activeCashSession.cashierName ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Started</dt><dd className="font-medium text-slate-900">{openedAtStr}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Opening Cash</dt><dd className="font-semibold tabular-nums text-slate-900">₹{Number(activeCashSession.openingCashTotal ?? 0).toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd className="font-medium text-emerald-700">Active</dd></div>
            </dl>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              View Shift Details
            </button>
          </div>

          {/* 4. Close Shift (simple) */}
          <div ref={closeCounterSectionRef} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Close Shift</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Expected Cash</span>
                <span className="text-lg font-semibold tabular-nums text-slate-900">₹{closeShiftPreview.expectedCash.toFixed(2)}</span>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">Counted Cash</label>
                {detailedCashCounting ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-lg font-semibold tabular-nums text-slate-900">₹{countedCash.toFixed(2)}</div>
                    <button type="button" onClick={() => setShowDenomPopup(true)} className="shrink-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Count by denomination
                    </button>
                  </div>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={countedCashSimple}
                    onChange={(e) => setCountedCashSimple(e.target.value)}
                    placeholder="Enter counted cash"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-lg font-semibold tabular-nums text-right text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="text-sm font-medium text-slate-600">Difference</span>
                <span className={`text-sm font-semibold tabular-nums ${difference === 0 ? 'text-slate-700' : difference > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {difference === 0 ? 'Balanced' : difference > 0 ? `+₹${difference.toFixed(2)} excess` : `−₹${Math.abs(difference).toFixed(2)} short`}
                </span>
              </div>
              <Button
                type="button"
                variant="danger"
                size="lg"
                className={`w-full ${closeCounterButtonClicked ? 'ring-2 ring-rose-300 ring-offset-2' : ''}`}
                loading={closeShiftLoading}
                loadingText="Closing…"
                onClick={onCloseShiftClick}
              >
                Close Shift
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {lastClosedSummary && (
            <div className="lg:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-emerald-900">Shift closed</h4>
                  <p className="mt-1 text-sm text-emerald-800">
                    Opening ₹{lastClosedSummary.openingCashTotal.toFixed(2)} · Closing ₹{lastClosedSummary.closingCashTotal.toFixed(2)} · Profit ₹{lastClosedSummary.profit.toFixed(2)}
                  </p>
                </div>
                <Button type="button" variant="primary" size="sm" onClick={onStartNewShift}>Start new shift</Button>
              </div>
            </div>
          )}
          <div ref={openCounterSectionRef} className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition-all duration-300 ${highlightOpenCounter ? 'ring-2 ring-emerald-300' : 'ring-slate-100'}`}>
            <h3 className="text-base font-semibold text-slate-900">Open Counter (Start Shift)</h3>
            <p className="mt-1 text-xs text-slate-500">Select cashier &amp; counter and enter the opening cash to start a new shift.</p>
            {recentCashSessions.filter((s) => s.status !== 'open').length > 0 && (
              <button type="button" onClick={onLoadPreviousCounter} className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-1">
                Load previous counter (₹{Number(recentCashSessions.find((s) => s.status !== 'open')?.closingCashTotal ?? 0).toFixed(2)})
              </button>
            )}
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 block mb-1">Cashier</span>
                <select value={selectedCashierId} onChange={(e) => setSelectedCashierId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="">Select cashier</option>
                  {cashiers.map((c) => {
                    const inUse = recentCashSessions.some((s) => s.status === 'open' && s.cashierProfileId === c.id)
                    return <option key={c.id} value={c.id} disabled={inUse}>{c.name}{c.phone ? ` (${c.phone})` : ''}{inUse ? ' — in shift' : ''}</option>
                  })}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 block mb-1">Counter</span>
                <select value={selectedCounterId} onChange={(e) => setSelectedCounterId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="">Select counter</option>
                  {counters.map((c) => {
                    const inUse = recentCashSessions.some((s) => s.status === 'open' && s.counterId === c.id)
                    return <option key={c.id} value={c.id} disabled={inUse}>{c.name}{inUse ? ' — in use' : ''}</option>
                  })}
                </select>
              </label>
              {detailedCashCounting ? (
                <div>
                  <span className="text-xs font-medium text-slate-600 block mb-1">Opening cash by denomination</span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {CASH_DENOMS.map((den) => (
                      <label key={den} className="flex flex-col gap-1">
                        <span className="text-[11px] text-slate-500">₹{den}</span>
                        <input type="number" min={0} value={cashOpeningNotes[den] ?? ''} onChange={(e) => setCashOpeningNotes((prev) => ({ ...prev, [den]: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-right text-xs tabular-nums" />
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Opening cash total</span>
                    <span className="font-semibold tabular-nums text-slate-900">₹{sumNotes(cashOpeningNotes).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 block mb-1">Opening cash</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={openingCashSimple}
                    onChange={(e) => setOpeningCashSimple(e.target.value)}
                    placeholder="Enter opening cash in drawer"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-right tabular-nums text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </label>
              )}
              <Button type="button" variant="primary" size="md" className="w-full" loading={openCounterLoading} loadingText="Opening…" onClick={onOpenCounter}>
                Open Counter
              </Button>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100 text-xs text-slate-600 space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">How this works</h4>
            <p>1. Start your shift by entering the opening cash and opening the counter.</p>
            <p>2. The system tracks cash, UPI and card sales during the day.</p>
            <p>3. At the end, count the cash and close the shift to record any short / excess.</p>
          </div>
        </div>
      )}

      {/* 7. Recent Sales */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Recent Sales</h3>
          <button type="button" onClick={onViewAllSales} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">View All Sales</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Invoice</th>
                <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Payment</th>
                <th className="text-left px-4 py-2.5 font-medium">Time</th>
                <th className="text-right px-5 py-2.5 font-medium">View</th>
              </tr>
            </thead>
            <tbody>
              {recentSalesToday.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No sales today yet.</td></tr>
              ) : (
                recentSalesToday.slice(0, 10).map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-5 py-2.5 font-medium text-slate-800">{s.invoiceNumber || s.id}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.patientName || 'Walk-in'}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900">₹{Number(s.netAmount ?? s.totalAmount ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-2.5 capitalize text-slate-600">{s.paymentMode || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 tabular-nums">{saleTime(s.dispensedAt)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button type="button" onClick={onViewAllSales} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5 & 6. Expenses */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Expenses</h3>
            <p className="text-xs text-slate-500 mt-0.5">{expenses.length} record(s) · Total ₹{expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" /></svg>
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
              {showFilters && (
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
                  <div className="space-y-3 text-sm">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600 block mb-1">From</span>
                      <input type="date" value={expenseFilters.dateFrom} onChange={(e) => setExpenseFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600 block mb-1">To</span>
                      <input type="date" value={expenseFilters.dateTo} onChange={(e) => setExpenseFilters((prev) => ({ ...prev, dateTo: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600 block mb-1">Category</span>
                      <select value={expenseFilters.categoryId} onChange={(e) => setExpenseFilters((prev) => ({ ...prev, categoryId: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                        <option value="all">All categories</option>
                        {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600 block mb-1">Payment</span>
                      <select value={expenseFilters.paymentMethod} onChange={(e) => setExpenseFilters((prev) => ({ ...prev, paymentMethod: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                        <option value="all">All payments</option>
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                        <option value="bank">Bank</option>
                      </select>
                    </label>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setExpenseFilters({ dateFrom: '', dateTo: '', categoryId: 'all', paymentMethod: 'all' })}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => { void onApplyExpenseFilters(); setShowFilters(false) }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Button type="button" variant="primary" size="md" onClick={() => setShowAddExpense(true)}>+ Add Expense</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Expense</th>
                <th className="text-left px-4 py-2.5 font-medium">Category</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Payment</th>
                <th className="text-left px-4 py-2.5 font-medium">Created By</th>
                <th className="text-right px-5 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">No expenses in the selected range.</td></tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-5 py-2.5 text-slate-700">{expDateStr(e.date)}</td>
                    <td className="px-4 py-2.5 max-w-xs truncate text-slate-800" title={e.description ?? e.categoryName ?? ''}>{e.description || e.categoryName || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{e.categoryName || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-slate-900">₹{Number(e.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-2.5 capitalize text-slate-600">{e.paymentMethod}</td>
                    <td className="px-4 py-2.5 text-slate-600 truncate max-w-[10rem]" title={e.addedBy ?? ''}>{e.addedBy || '—'}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button type="button" onClick={() => setViewExpense(e)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Shift Details modal */}
      {showDetails && activeCashSession && (
        <RevealModal isOpen onClose={() => setShowDetails(false)} zIndex={100} contentClassName="w-full max-w-lg mx-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-200/80">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Shift details</h2>
                <p className="text-sm text-slate-500 mt-0.5">{activeCashSession.openedByName ?? activeCashSession.cashierName ?? 'Cashier'} · started {openedAtStr}</p>
              </div>
              <button type="button" onClick={() => setShowDetails(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Counter</span><span className="font-medium text-slate-900">{activeCashSession.counterName ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Opening cash</span><span className="font-semibold tabular-nums text-slate-900">₹{Number(activeCashSession.openingCashTotal ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cash sales</span><span className="font-medium tabular-nums text-slate-900">₹{cashSalesSession.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">UPI sales</span><span className="font-medium tabular-nums text-slate-900">₹{upiSession.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Card sales</span><span className="font-medium tabular-nums text-slate-900">₹{cardSession.toFixed(2)}</span></div>
              {cashExpensesSession > 0 && <div className="flex justify-between"><span className="text-slate-500">Cash expenses</span><span className="font-medium tabular-nums text-amber-700">−₹{cashExpensesSession.toFixed(2)}</span></div>}
              <div className="flex justify-between border-t border-slate-100 pt-2 mt-1"><span className="text-slate-500">Expected cash in drawer</span><span className="font-semibold tabular-nums text-slate-900">₹{closeShiftPreview.expectedCash.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total sales (all payments)</span><span className="font-semibold tabular-nums text-emerald-700">₹{totalSalesSession.toFixed(2)}</span></div>
            </div>
          </div>
        </RevealModal>
      )}

      {/* Detailed cash counting popup */}
      {showDenomPopup && (
        <RevealModal isOpen onClose={() => setShowDenomPopup(false)} zIndex={100} contentClassName="w-full max-w-md mx-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-200/80">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">Count cash by denomination</h2>
              <button type="button" onClick={() => setShowDenomPopup(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-3">
                {CASH_DENOMS.map((den) => (
                  <label key={den} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">₹{den}</span>
                    <input type="number" min={0} value={cashClosingNotes[den] ?? ''} onChange={(e) => setCashClosingNotes((prev) => ({ ...prev, [den]: e.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-right tabular-nums focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                  </label>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-500">Counted total</span>
                <span className="text-lg font-semibold tabular-nums text-slate-900">₹{sumNotes(cashClosingNotes).toFixed(2)}</span>
              </div>
              <Button type="button" variant="primary" size="md" className="w-full mt-4" onClick={() => setShowDenomPopup(false)}>Done</Button>
            </div>
          </div>
        </RevealModal>
      )}

      {/* Add Expense modal */}
      {showAddExpense && (
        <RevealModal isOpen onClose={() => setShowAddExpense(false)} zIndex={100} contentClassName="w-full max-w-md mx-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-200/80">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">Add Expense</h2>
              <button type="button" onClick={() => setShowAddExpense(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 font-medium">Expense Name <span className="text-rose-500">*</span></span>
                <input type="text" value={expenseForm.note} onChange={(e) => setExpenseForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="e.g. Buying new stand" className="rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </label>
              {expenseCategories.length > 0 && (
                <label className="flex flex-col gap-1">
                  <span className="text-slate-600 font-medium">Category</span>
                  <select value={expenseForm.categoryId ?? ''} onChange={(e) => setExpenseForm((prev) => ({ ...prev, categoryId: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    <option value="">Uncategorized</option>
                    {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-slate-600 font-medium">Amount (₹) <span className="text-rose-500">*</span></span>
                  <input type="number" min={0} step={0.01} value={expenseForm.amount} onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-slate-600 font-medium">Payment Method</span>
                  <select value={expenseForm.paymentMethod} onChange={(e) => setExpenseForm((prev) => ({ ...prev, paymentMethod: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank</option>
                    <option value="other">Other</option>
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-slate-600 font-medium">Date</span>
                <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </label>
              <p className="text-xs text-slate-400">Cash expenses require an open shift and a note/coin breakdown from the drawer.</p>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAddExpense(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
                <Button type="button" variant="primary" size="md" loading={saveExpenseLoading} loadingText="Saving…" onClick={handleSaveExpense}>Save</Button>
              </div>
            </div>
          </div>
        </RevealModal>
      )}

      {/* Cash-expense denomination modal (for cash payment method) */}
      {pendingExpensePayload && (
        <RefundCashModal
          isOpen={showExpenseCashModal}
          onClose={() => { setShowExpenseCashModal(false); setPendingExpensePayload(null) }}
          refundAmount={pendingExpensePayload.amount}
          onConfirm={onConfirmExpenseCash}
        />
      )}

      {/* View expense detail popup */}
      {viewExpense && (
        <RevealModal isOpen onClose={() => setViewExpense(null)} zIndex={100} contentClassName="w-full max-w-sm mx-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-200/80">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-bold text-slate-800">Expense</h2>
              <button type="button" onClick={() => setViewExpense(null)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium text-slate-900">{expDateStr(viewExpense.date)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Expense</span><span className="font-medium text-slate-900 text-right">{viewExpense.description || viewExpense.categoryName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="font-medium text-slate-900">{viewExpense.categoryName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-semibold tabular-nums text-slate-900">₹{Number(viewExpense.amount || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment</span><span className="font-medium capitalize text-slate-900">{viewExpense.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Branch</span><span className="font-medium text-slate-900">{branches.find((b) => b.id === viewExpense.branchId)?.name || viewExpense.branchId}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Created By</span><span className="font-medium text-slate-900 text-right break-all">{viewExpense.addedBy || '—'}</span></div>
            </div>
          </div>
        </RevealModal>
      )}
    </div>
  )
}
