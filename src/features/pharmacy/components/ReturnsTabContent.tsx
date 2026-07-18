import React from 'react'
import { Button, Pagination, RevealModal, TabSkeleton } from '@/shared/components'
import { RefundCashModal } from '@/features/pharmacy/ui/RefundCashModal'
import { ActionEmptyState } from '@/features/pharmacy/components/RealWorldUiBlocks'
import { RETURN_REASON_OPTIONS } from '@/features/pharmacy/constants'
import type { PharmacyCashSession, PharmacySale } from '@/types/pharmacy'
import type { OverviewDateRange } from '@/features/pharmacy/utils/overviewDerived'

type PaymentModeSummary = Record<string, { count: number; amount: number }>
type ReturnReasonType = '' | 'damaged' | 'wrong_medicine' | 'doctor_changed' | 'patient_request' | 'expired' | 'other'
type PendingReturnPayload = {
  saleId: string
  lines: { medicineId: string; quantity: number }[]
  lineSummaries: Array<{ medicineName: string; quantity: number; unitPrice: number; amount: number }>
  refundAmount: number
  note: string
}

export type ReturnsTabContentProps = {
  cashSessionsLoading: boolean
  activeCashSession: PharmacyCashSession | null
  onGoToCashExpenses: () => void
  overviewDateRange: OverviewDateRange
  setOverviewDateRange: (value: OverviewDateRange) => void
  periodSalesTotal: number
  periodRefundTotal: number
  periodSalesCount: number
  paymentModeSummary: PaymentModeSummary
  salesTrendData: Array<{ date: string; value: number }>
  topSellingMedicines: Array<{ name: string; count: number }>
  returnsInnerTab: 'by_sale' | 'by_return'
  setReturnsInnerTab: (value: 'by_sale' | 'by_return') => void
  totalRefundForFilteredSales: number
  filteredReturnSales: PharmacySale[]
  returnsDate: string
  setReturnsDate: (value: string) => void
  returnsPaymentFilter: string
  setReturnsPaymentFilter: (value: string) => void
  returnsMinAmount: string
  setReturnsMinAmount: (value: string) => void
  returnsMaxAmount: string
  setReturnsMaxAmount: (value: string) => void
  returnsSearch: string
  setReturnsSearch: (value: string) => void
  loading: boolean
  paginatedReturnSales: PharmacySale[]
  selectedReturnSale: PharmacySale | null
  setSelectedReturnSale: (sale: PharmacySale | null) => void
  returnQuantities: Record<string, string>
  setReturnQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>
  returnReasonType: ReturnReasonType
  setReturnReasonType: (value: ReturnReasonType) => void
  returnReasonDetails: string
  setReturnReasonDetails: (value: string) => void
  returnSupervisorName: string
  setReturnSupervisorName: (value: string) => void
  returnSubmitting: boolean
  getSaleReturnedMap: (sale: PharmacySale) => Record<string, number>
  setError: (message: string | null) => void
  setPendingReturnPayload: (payload: PendingReturnPayload | null) => void
  setRefundPaymentMode: (mode: 'cash' | 'upi' | 'card' | 'other') => void
  setShowRefundPaymentModal: (open: boolean) => void
  returnsPage: number
  returnsTotalPages: number
  returnsPageSize: number
  goToReturnsPage: (page: number) => void
  setReturnsPageSize: (size: number) => void
  showRefundPaymentModal: boolean
  pendingReturnPayload: PendingReturnPayload | null
  refundPaymentMode: 'cash' | 'upi' | 'card' | 'other'
  showRefundCashModal: boolean
  setShowRefundCashModal: (open: boolean) => void
  submitReturn: (mode: 'cash' | 'upi' | 'card' | 'other', notes?: Record<string, number>) => void
  returnEvents: Array<{
    id: string
    createdAt: Date | null
    patientName: string
    invoice: string
    phone: string
    paymentMode: string | null
    amount: number
    lines: Array<{ medicineId: string; medicineName: string; quantity: number; unitPrice: number }>
  }>
}

export function ReturnsTabContent(props: ReturnsTabContentProps): React.JSX.Element {
  const {
    cashSessionsLoading,
    activeCashSession,
    onGoToCashExpenses,
    overviewDateRange,
    setOverviewDateRange,
    periodSalesTotal,
    periodRefundTotal,
    periodSalesCount,
    paymentModeSummary,
    salesTrendData,
    topSellingMedicines,
    returnsInnerTab,
    setReturnsInnerTab,
    totalRefundForFilteredSales,
    filteredReturnSales,
    returnsDate,
    setReturnsDate,
    returnsPaymentFilter,
    setReturnsPaymentFilter,
    returnsMinAmount,
    setReturnsMinAmount,
    returnsMaxAmount,
    setReturnsMaxAmount,
    returnsSearch,
    setReturnsSearch,
    loading,
    paginatedReturnSales,
    selectedReturnSale,
    setSelectedReturnSale,
    returnQuantities,
    setReturnQuantities,
    returnReasonType,
    setReturnReasonType,
    returnReasonDetails,
    setReturnReasonDetails,
    returnSupervisorName,
    setReturnSupervisorName,
    returnSubmitting,
    getSaleReturnedMap,
    setError,
    setPendingReturnPayload,
    setRefundPaymentMode,
    setShowRefundPaymentModal,
    returnsPage,
    returnsTotalPages,
    returnsPageSize,
    goToReturnsPage,
    setReturnsPageSize,
    showRefundPaymentModal,
    pendingReturnPayload,
    refundPaymentMode,
    showRefundCashModal,
    setShowRefundCashModal,
    submitReturn,
    returnEvents,
  } = props

  return (
<div className="space-y-6">
  {!cashSessionsLoading && !activeCashSession && (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
      <span className="font-medium">Start a cash session to process returns.</span>
      <span>Go to{' '}
        <button
          type="button"
          onClick={onGoToCashExpenses}
          className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
        >
          Cash & expenses
        </button>
        {' '}and click <strong>Start shift</strong>.</span>
    </div>
  )}
  {/* Selling data – same as Overview */}
  <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] p-4 sm:p-5">
    <h3 className="text-lg font-semibold text-slate-800 mb-3">Selling data</h3>
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {(['today', '7d', '30d', '6m', 'year', 'all'] as OverviewDateRange[]).map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => setOverviewDateRange(range)}
          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${overviewDateRange === range ? 'bg-[#0891b2] text-white border-[#0891b2]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
        >
          {range === 'today' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '6m' ? '6m' : range === 'year' ? 'Year' : 'All'}
        </button>
      ))}
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500">Sales</p>
        <p className="text-xl font-bold text-slate-900">₹{periodSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
        <p className="text-[10px] text-emerald-600">Revenue</p>
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500">Sales returns</p>
        <p className="text-xl font-bold text-rose-600">₹{periodRefundTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
        <p className="text-[10px] text-rose-500">Refunded</p>
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500">Bills</p>
        <p className="text-xl font-bold text-slate-900">{periodSalesCount}</p>
        <p className="text-[10px] text-slate-500">In period</p>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Payments by mode</h4>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left py-1.5 font-medium text-slate-700">Mode</th>
              <th className="text-right py-1.5 font-medium text-slate-700">Bills</th>
              <th className="text-right py-1.5 font-medium text-slate-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {['cash', 'upi', 'card', 'credit', 'other', 'unknown'].map((mode) => {
              const row = paymentModeSummary[mode]
              if (!row) return null
              const label = mode === 'cash' ? 'Cash' : mode === 'upi' ? 'UPI' : mode === 'card' ? 'Card' : mode === 'credit' ? 'Credit' : mode === 'other' ? 'Other' : 'Not set'
              return (
                <tr key={mode} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 text-slate-800">{label}</td>
                  <td className="py-1.5 text-right text-slate-700">{row.count}</td>
                  <td className="py-1.5 text-right font-medium text-slate-900">₹{row.amount.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Sales trend</h4>
        <div className="h-32 w-full">
          {salesTrendData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 text-slate-500 text-xs">No data</div>
          ) : (
            <svg viewBox="0 0 400 120" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="salesTrendGradReturnsTab" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0891b2" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity={0} />
                </linearGradient>
              </defs>
              {(() => {
                const maxVal = Math.max(...salesTrendData.map((d) => d.value), 1)
                const pts = salesTrendData.map((d, i) => {
                  const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                  const y = 100 - (d.value / maxVal) * 80
                  return `${x},${y}`
                }).join(' ')
                const areaPoints = `${pts} 390,100 10,100`
                return (
                  <>
                    <polyline fill="url(#salesTrendGradReturnsTab)" points={areaPoints} />
                    <polyline fill="none" stroke="#0891b2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                  </>
                )
              })()}
            </svg>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
          {salesTrendData.filter((_, i) => (overviewDateRange === '30d' ? i % 5 === 0 : true)).slice(0, 8).map((d, i) => (
            <span key={i}>{d.date}</span>
          ))}
        </div>
      </div>
    </div>
    {topSellingMedicines.length > 0 && (
      <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Top selling medicines</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {topSellingMedicines.map((m, i) => (
            <span key={i} className="text-slate-700"><span className="font-medium text-slate-900">{m.name}</span> <span className="text-slate-500">×{m.count}</span></span>
          ))}
        </div>
      </div>
    )}
  </div>

  <div>
    <h3 className="font-semibold text-slate-800 mb-2">Sales returns</h3>
    <p className="text-sm text-slate-500 mb-4">
      Click a sale to expand return details below that row, enter quantities to return, and the system will update stock and net sale amount automatically.
    </p>
  </div>

  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold text-slate-800">Sales returns</h4>
            {returnsInnerTab === 'by_return' && (
              <div className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 border border-rose-100">
                Total refunded: ₹{totalRefundForFilteredSales.toFixed(2)}
              </div>
            )}
          </div>
          <span className="text-xs text-slate-500">
            {filteredReturnSales.length} sale(s) with returns in current filters
          </span>
          <div className="mt-1 inline-flex rounded-full bg-slate-50 p-1 text-[11px] font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setReturnsInnerTab('by_sale')}
              className={`px-3 py-1.5 rounded-full transition ${returnsInnerTab === 'by_sale' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              By sale
            </button>
            <button
              type="button"
              onClick={() => setReturnsInnerTab('by_return')}
              className={`px-3 py-1.5 rounded-full transition ${returnsInnerTab === 'by_return' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              Return events
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={returnsDate}
            onChange={(e) => setReturnsDate(e.target.value)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
          />
          <select
            value={returnsPaymentFilter}
            onChange={(e) => setReturnsPaymentFilter(e.target.value)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
          >
            <option value="all">All payments</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="credit">Credit</option>
            <option value="other">Other / Insurance</option>
          </select>
          <input
            type="number"
            inputMode="decimal"
            value={returnsMinAmount}
            onChange={(e) => setReturnsMinAmount(e.target.value)}
            placeholder="Min amount"
            className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
          />
          <input
            type="number"
            inputMode="decimal"
            value={returnsMaxAmount}
            onChange={(e) => setReturnsMaxAmount(e.target.value)}
            placeholder="Max amount"
            className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
          />
          <input
            type="text"
            value={returnsSearch}
            onChange={(e) => setReturnsSearch(e.target.value)}
            placeholder="Search by invoice, name, phone, medicine…"
            className="w-full sm:w-56 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
          />
          {(returnsDate || returnsSearch || returnsPaymentFilter !== 'all' || returnsMinAmount || returnsMaxAmount) && (
            <button
              type="button"
              onClick={() => {
                setReturnsDate('')
                setReturnsSearch('')
                setReturnsPaymentFilter('all')
                setReturnsMinAmount('')
                setReturnsMaxAmount('')
              }}
              className="text-[11px] text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <TabSkeleton variant="table" />
      ) : returnsInnerTab === 'by_sale' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3">Invoice #</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Patient / Customer</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-right p-3">Net after returns</th>
                <th className="text-right p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReturnSales.map((s) => {
                const dateRaw = s.dispensedAt
                const dateStr = !dateRaw
                  ? '—'
                  : typeof dateRaw === 'string'
                  ? dateRaw.slice(0, 10)
                  : (dateRaw as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '—'
                const name = s.patientName || '—'
                const total = s.totalAmount ?? 0
                const refunded = s.refundedAmount ?? 0
                const net = s.netAmount ?? Math.max(0, total - refunded)
                const isSelected = selectedReturnSale?.id === s.id
                const returnedMap = getSaleReturnedMap(s)
                const saleLines = s.lines || []
                const estimatedRefund = isSelected
                  ? saleLines.reduce((sum, l) => {
                      const raw = returnQuantities[l.medicineId] || ''
                      const qty = Math.floor(Number(raw) || 0)
                      const unit = Number(l.unitPrice) || 0
                      return sum + (qty > 0 ? qty * unit : 0)
                    }, 0)
                  : 0
                return (
                  <React.Fragment key={s.id}>
                    <tr
                      className={`border-t border-slate-200 cursor-pointer hover:bg-slate-50 ${
                        isSelected ? 'bg-cyan-50/40' : ''
                      }`}
                      onClick={() => {
                        if (selectedReturnSale?.id === s.id) {
                          setSelectedReturnSale(null)
                          setReturnQuantities({})
                          setReturnReasonType('')
                          setReturnReasonDetails('')
                          setReturnSupervisorName('')
                        } else {
                          setSelectedReturnSale(s)
                          setReturnQuantities({})
                          setReturnReasonType('')
                          setReturnReasonDetails('')
                          setReturnSupervisorName('')
                        }
                      }}
                    >
                      <td className="p-3 font-mono text-xs">{s.invoiceNumber ?? '—'}</td>
                      <td className="p-3">{dateStr}</td>
                      <td className="p-3">{name}</td>
                      <td className="p-3 text-right">₹{total}</td>
                      <td className="p-3 text-right">₹{net}</td>
                      <td className="p-3 text-right text-[11px] text-slate-500">
                        Click row to enter return
                      </td>
                    </tr>
                    <tr
                      className={`border-t border-slate-200 bg-[#EEF3FF] transition-all duration-200 ease-out ${
                        isSelected ? 'animate-[fadeExpand_0.18s_ease-out] opacity-100' : 'hidden opacity-0'
                      }`}
                    >
                      <td colSpan={6} className="p-3">
                        <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-3 sm:p-4">
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault()
                              if (!activeCashSession) {
                                setError('Please start a cash session first to process returns (Cash & expenses → Start shift).')
                                return
                              }
                              if (!returnReasonType) {
                                setError('Select a return reason before processing the return.')
                                return
                              }
                              if (returnReasonType === 'other' && returnReasonDetails.trim().length < 3) {
                                setError('Please add a short note for "Other reason".')
                                return
                              }
                              const lines = saleLines
                              const retMap = getSaleReturnedMap(s)
                              const payloadLines = lines
                                .map((l) => {
                                  const raw = returnQuantities[l.medicineId] || ''
                                  const qty = Math.floor(Number(raw) || 0)
                                  if (qty <= 0) return null
                                  const sold = Number(l.quantity) || 0
                                  const alreadyReturned = Number(retMap[l.medicineId] || 0)
                                  const maxReturn = Math.max(0, sold - alreadyReturned)
                                  const clampedQty = Math.min(qty, maxReturn)
                                  return clampedQty > 0 ? { medicineId: l.medicineId, quantity: clampedQty } : null
                                })
                                .filter(Boolean) as { medicineId: string; quantity: number }[]
                              if (payloadLines.length === 0) {
                                setError('Enter at least one quantity to return.')
                                return
                              }
                              const refundAmount = payloadLines.reduce((sum, pl) => {
                                const line = saleLines.find((l) => l.medicineId === pl.medicineId)
                                return sum + (line ? pl.quantity * (Number(line.unitPrice) || 0) : 0)
                              }, 0)
                              if (refundAmount >= 2000 && !returnSupervisorName.trim()) {
                                setError('Supervisor name is required for high-value returns (>= ₹2000).')
                                return
                              }
                              const lineSummaries = payloadLines.map((pl) => {
                                const line = saleLines.find((l) => l.medicineId === pl.medicineId)
                                const unitPrice = Number(line?.unitPrice) || 0
                                return {
                                  medicineName: line?.medicineName || pl.medicineId,
                                  quantity: pl.quantity,
                                  unitPrice,
                                  amount: pl.quantity * unitPrice,
                                }
                              })
                              const baseReasonLabel = RETURN_REASON_OPTIONS.find((opt) => opt.value === returnReasonType)?.label || 'Other reason'
                              const reasonNoteBase = returnReasonType === 'other'
                                ? `Other reason: ${returnReasonDetails.trim()}`
                                : returnReasonDetails.trim()
                                  ? `${baseReasonLabel} - ${returnReasonDetails.trim()}`
                                  : baseReasonLabel
                              const reasonNote = returnSupervisorName.trim()
                                ? `${reasonNoteBase} | Supervisor: ${returnSupervisorName.trim()}`
                                : reasonNoteBase
                              setError(null)
                              setPendingReturnPayload({
                                saleId: s.id,
                                lines: payloadLines,
                                lineSummaries,
                                refundAmount,
                                note: reasonNote,
                              })
                              setRefundPaymentMode('cash')
                              setShowRefundPaymentModal(true)
                            }}
                            className="space-y-3"
                          >
                            <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                              <div>
                                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                                  Return reason <span className="text-rose-600">*</span>
                                </label>
                                <select
                                  value={returnReasonType}
                                  onChange={(e) => setReturnReasonType(e.target.value as '' | 'damaged' | 'wrong_medicine' | 'doctor_changed' | 'patient_request' | 'expired' | 'other')}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                  required
                                >
                                  <option value="">Select reason</option>
                                  {RETURN_REASON_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                                  Notes {returnReasonType === 'other' ? <span className="text-rose-600">*</span> : '(optional)'}
                                </label>
                                <input
                                  type="text"
                                  value={returnReasonDetails}
                                  onChange={(e) => setReturnReasonDetails(e.target.value)}
                                  placeholder={returnReasonType === 'other' ? 'Describe reason' : 'Add context for audit trail'}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                                  Supervisor (required if refund &gt;= ₹2000)
                                </label>
                                <input
                                  type="text"
                                  value={returnSupervisorName}
                                  onChange={(e) => setReturnSupervisorName(e.target.value)}
                                  placeholder="Name / ID"
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-slate-600">
                              Invoice&nbsp;
                              <span className="font-mono">{s.invoiceNumber ?? s.id}</span>
                            </div>
                            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                              <table className="w-full text-[11px]">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                  <tr>
                                    <th className="text-left px-2 py-1.5">Medicine</th>
                                    <th className="text-right px-2 py-1.5">Returnable</th>
                                    <th className="text-right px-2 py-1.5">Unit price</th>
                                    <th className="text-right px-2 py-1.5">Return qty</th>
                                    <th className="text-right px-2 py-1.5">Line refund</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {saleLines.map((l) => {
                                    const key = l.medicineId
                                    const raw = returnQuantities[key] || ''
                                    const qty = Math.floor(Number(raw) || 0)
                                    const unit = Number(l.unitPrice) || 0
                                    const sold = Number(l.quantity) || 0
                                    const alreadyReturned = Number(returnedMap[l.medicineId] || 0)
                                    const remaining = Math.max(0, sold - alreadyReturned)
                                    const lineRefund = qty > 0 ? qty * unit : 0
                                    return (
                                      <tr key={key} className="border-t border-slate-200">
                                        <td className="px-2 py-1.5 font-medium text-slate-900">
                                          {l.medicineName}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-slate-700">
                                          {alreadyReturned > 0 && (
                                            <span className="text-[10px] text-slate-400 mr-1">
                                              (sold {sold}, returned {alreadyReturned})
                                            </span>
                                          )}
                                          {remaining}
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-slate-700">
                                          ₹{unit.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                          <input
                                            type="number"
                                            min={0}
                                            max={remaining}
                                            value={returnQuantities[key] ?? ''}
                                            disabled={remaining === 0}
                                            onChange={(e) => {
                                              const v = e.target.value
                                              if (v === '') {
                                                setReturnQuantities((prev) => ({ ...prev, [key]: '' }))
                                                return
                                              }
                                              const num = Math.floor(Number(v)) || 0
                                              const clamped = Math.min(Math.max(0, num), remaining)
                                              setReturnQuantities((prev) => ({ ...prev, [key]: String(clamped) }))
                                            }}
                                            onBlur={(e) => {
                                              const v = e.target.value
                                              if (v === '') return
                                              const num = Math.floor(Number(v)) || 0
                                              const clamped = Math.min(Math.max(0, num), remaining)
                                              setReturnQuantities((prev) => ({ ...prev, [key]: clamped > 0 ? String(clamped) : '' }))
                                            }}
                                            className={`w-16 rounded-full border px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] ${
                                              remaining === 0 ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300'
                                            }`}
                                          />
                                          <div className="mt-0.5 text-[10px] text-slate-500">max {remaining}</div>
                                        </td>
                                        <td className="px-2 py-1.5 text-right text-slate-700">
                                          ₹{lineRefund.toFixed(2)}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-700">
                              <span>
                                Refund amount:&nbsp;
                                <span className="font-semibold text-rose-600">
                                  ₹{estimatedRefund.toFixed(2)}
                                </span>
                              </span>
                              <Button
                                type="submit"
                                variant="danger"
                                size="sm"
                                loading={returnSubmitting}
                                loadingText="Processing…"
                                disabled={!activeCashSession}
                                title={!activeCashSession ? 'Start a cash session first (Cash & expenses → Start shift)' : ''}
                              >
                                Process return & update stock
                              </Button>
                            </div>
                          </form>
                        </div>
                        </td>
                      </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Patient / Customer</th>
                <th className="text-left p-3">Invoice #</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Payment</th>
                <th className="text-right p-3">Refund amount</th>
              </tr>
            </thead>
            <tbody>
              {returnEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6">
                    <ActionEmptyState
                      title="No returns recorded yet."
                      hint="Return events will appear here after processing from the By Sale tab."
                      actions={[
                        { label: 'Go to By Sale', onClick: () => setReturnsInnerTab('by_sale'), variant: 'secondary' },
                      ]}
                    />
                  </td>
                </tr>
              ) : (
                returnEvents.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200 align-top">
                    <td className="p-3">
                      {r.createdAt ? r.createdAt.toISOString().slice(0, 10) : '—'}
                    </td>
                    <td className="p-3">
                      <div className="text-slate-900 font-medium">{r.patientName}</div>
                    </td>
                    <td className="p-3 font-mono text-xs">{r.invoice}</td>
                    <td className="p-3 text-slate-700">{r.phone || '—'}</td>
                    <td className="p-3 text-slate-700">
                      {r.paymentMode
                        ? r.paymentMode.charAt(0).toUpperCase() + r.paymentMode.slice(1)
                        : '—'}
                    </td>
                    <td className="p-3 text-right text-rose-600 font-semibold">
                      ₹{r.amount.toFixed(2)}
                      <div className="mt-1 text-[10px] text-slate-500">
                        {r.lines.map((l) => (
                          <div key={l.medicineId}>
                            {l.medicineName} × {l.quantity} @ ₹{l.unitPrice.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {filteredReturnSales.length > 0 && (
        <Pagination
          currentPage={returnsPage}
          totalPages={returnsTotalPages}
          pageSize={returnsPageSize}
          totalItems={filteredReturnSales.length}
          onPageChange={goToReturnsPage}
          onPageSizeChange={setReturnsPageSize}
          itemLabel="sales"
          className="border-t border-slate-200"
        />
      )}

      {showRefundPaymentModal && pendingReturnPayload && (
        <RevealModal
          isOpen
          onClose={() => {
            setShowRefundPaymentModal(false)
            setPendingReturnPayload(null)
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
            <div className="border-b border-slate-200 px-6 pt-6 pb-4">
              <h2 className="text-xl font-bold text-slate-800">Refund payment</h2>
              <p className="text-sm text-slate-500 mt-1">How are you giving the refund to the customer?</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
                <p className="text-sm font-medium text-rose-700">Refund amount</p>
                <p className="text-2xl font-bold text-rose-900">₹{pendingReturnPayload.refundAmount.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Return summary</p>
                <p className="mt-1 text-sm text-slate-700">{pendingReturnPayload.note}</p>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold text-slate-600">Medicine</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-600">Qty</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-slate-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingReturnPayload.lineSummaries.map((line, idx) => (
                        <tr key={`${line.medicineName}-${idx}`} className="border-t border-slate-100">
                          <td className="px-2 py-1.5 text-slate-700">{line.medicineName}</td>
                          <td className="px-2 py-1.5 text-right text-slate-600">{line.quantity}</td>
                          <td className="px-2 py-1.5 text-right font-medium text-slate-800">₹{line.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Payment method</p>
                <div className="flex flex-wrap gap-2">
                  {(['cash', 'upi', 'card', 'other'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRefundPaymentMode(m)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${
                        refundPaymentMode === m
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRefundPaymentModal(false)
                    setPendingReturnPayload(null)
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (refundPaymentMode === 'cash') {
                      setShowRefundCashModal(true)
                    } else {
                      submitReturn(refundPaymentMode)
                    }
                  }}
                  disabled={returnSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                >
                  {refundPaymentMode === 'cash' ? 'Enter notes…' : 'Confirm refund'}
                </button>
              </div>
            </div>
          </div>
        </RevealModal>
      )}

      {pendingReturnPayload && (
        <RefundCashModal
          isOpen={showRefundCashModal}
          onClose={() => setShowRefundCashModal(false)}
          refundAmount={pendingReturnPayload.refundAmount}
          onConfirm={(notes) => {
            submitReturn('cash', notes)
          }}
        />
      )}
    </div>
</div>
  )
}
