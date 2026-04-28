import React from 'react'

export type EmptyStateAction = {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

export function ActionEmptyState({
  title,
  hint,
  actions,
}: {
  title: string
  hint?: string
  actions?: EmptyStateAction[]
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {actions && actions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {actions.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              type="button"
              onClick={action.onClick}
              className={
                action.variant === 'primary'
                  ? 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700'
                  : 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50'
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function getPurchaseOrderStatusMeta(status: string | undefined) {
  const normalized = (status || '').toLowerCase()
  if (normalized === 'received') return { label: 'Delivered', badgeClass: 'bg-emerald-100 text-emerald-800' }
  if (normalized === 'partial') return { label: 'Partial', badgeClass: 'bg-blue-100 text-blue-800' }
  if (normalized === 'cancelled') return { label: 'Cancelled', badgeClass: 'bg-slate-100 text-slate-700' }
  if (normalized === 'draft') return { label: 'Draft', badgeClass: 'bg-slate-200 text-slate-700' }
  return { label: 'Sent', badgeClass: 'bg-amber-100 text-amber-800' }
}

export function getTransferStatusMeta(status: string | undefined) {
  const normalized = (status || '').toLowerCase()
  if (normalized === 'completed' || normalized === 'received') {
    return { label: 'Completed', badgeClass: 'bg-emerald-100 text-emerald-800' }
  }
  if (normalized === 'cancelled' || normalized === 'failed') {
    return { label: 'Cancelled', badgeClass: 'bg-slate-100 text-slate-700' }
  }
  return { label: 'In progress', badgeClass: 'bg-amber-100 text-amber-800' }
}

export function QueueFiltersBar({
  queueSearch,
  onQueueSearchChange,
  queueSort,
  onQueueSortChange,
  showUrgentOnly,
  onShowUrgentOnlyChange,
  onClear,
  showClear,
}: {
  queueSearch: string
  onQueueSearchChange: (value: string) => void
  queueSort: 'oldest' | 'newest'
  onQueueSortChange: (value: 'oldest' | 'newest') => void
  showUrgentOnly: boolean
  onShowUrgentOnlyChange: (value: boolean) => void
  onClear: () => void
  showClear: boolean
}) {
  return (
    <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={queueSearch}
          onChange={(e) => onQueueSearchChange(e.target.value)}
          placeholder="Search patient, doctor or branch"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
        />
        <select
          value={queueSort}
          onChange={(e) => onQueueSortChange(e.target.value as 'oldest' | 'newest')}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700"
        >
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={showUrgentOnly}
            onChange={(e) => onShowUrgentOnlyChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          />
          Urgent only (&gt;=30 min)
        </label>
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export function BillingRiskStrip({
  duplicateLineCount,
  nearExpiryLineCount,
  stockRiskLineCount,
  billingInfo,
  onDismissBillingInfo,
}: {
  duplicateLineCount: number
  nearExpiryLineCount: number
  stockRiskLineCount: number
  billingInfo: string | null
  onDismissBillingInfo: () => void
}) {
  const hasRisks = duplicateLineCount > 0 || nearExpiryLineCount > 0 || stockRiskLineCount > 0
  return (
    <>
      {hasRisks && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Dispense safety checks</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {duplicateLineCount > 0 && (
              <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                Duplicate lines: {duplicateLineCount}
              </span>
            )}
            {nearExpiryLineCount > 0 && (
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                Near-expiry lines: {nearExpiryLineCount}
              </span>
            )}
            {stockRiskLineCount > 0 && (
              <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                Stock risk lines: {stockRiskLineCount}
              </span>
            )}
          </div>
        </div>
      )}
      {billingInfo && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-800">{billingInfo}</p>
          <button
            type="button"
            onClick={onDismissBillingInfo}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  )
}

export function DaysCoverBadge({ daysCover }: { daysCover: number | null }) {
  if (daysCover == null) return <span title="Insufficient recent sales data">—</span>
  return (
    <span className={`font-medium ${daysCover <= 7 ? 'text-rose-700' : daysCover <= 21 ? 'text-amber-700' : 'text-emerald-700'}`}>
      {daysCover}d
    </span>
  )
}

type CloseChecklistState = {
  countedCash: boolean
  reviewedRefundsAndExpenses: boolean
  varianceAcknowledged: boolean
}

export function ShiftCloseChecklist({
  difference,
  expectedCash,
  actualCash,
  closedByName,
  onClosedByNameChange,
  closeVarianceReason,
  onCloseVarianceReasonChange,
  closeHandoverNote,
  onCloseHandoverNoteChange,
  closeChecklist,
  onCloseChecklistChange,
}: {
  difference: number
  expectedCash: number
  actualCash: number
  closedByName: string
  onClosedByNameChange: (value: string) => void
  closeVarianceReason: string
  onCloseVarianceReasonChange: (value: string) => void
  closeHandoverNote: string
  onCloseHandoverNoteChange: (value: string) => void
  closeChecklist: CloseChecklistState
  onCloseChecklistChange: (value: CloseChecklistState) => void
}) {
  return (
    <>
      <div className={`rounded-xl border p-3 ${difference === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Variance check before close</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-slate-500">Expected</p>
            <p className="font-semibold tabular-nums text-slate-900">₹{expectedCash.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-500">Counted</p>
            <p className="font-semibold tabular-nums text-slate-900">₹{actualCash.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-500">Difference</p>
            <p className={`font-semibold tabular-nums ${difference === 0 ? 'text-emerald-700' : difference > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {difference === 0 ? '₹0.00' : difference > 0 ? `+₹${difference.toFixed(2)}` : `−₹${Math.abs(difference).toFixed(2)}`}
            </p>
          </div>
        </div>
        {difference !== 0 && (
          <p className="mt-2 text-xs text-rose-700">Non-zero variance detected. Please record and acknowledge before closing.</p>
        )}
      </div>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1.5">Closed by (person name)</span>
        <input
          type="text"
          value={closedByName}
          onChange={(e) => onClosedByNameChange(e.target.value)}
          placeholder="e.g. Counter 1 – Raj"
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
        />
      </label>
      {difference !== 0 && (
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1.5">Variance reason <span className="text-rose-600">*</span></span>
          <select
            value={closeVarianceReason}
            onChange={(e) => onCloseVarianceReasonChange(e.target.value)}
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
          >
            <option value="">Select reason</option>
            <option value="counting_error">Counting error corrected later</option>
            <option value="unbilled_adjustment">Unbilled adjustment / manual cash movement</option>
            <option value="pending_refund">Pending refund reconciliation</option>
            <option value="other">Other</option>
          </select>
        </label>
      )}
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1.5">Handover note <span className="text-rose-600">*</span></span>
        <textarea
          value={closeHandoverNote}
          onChange={(e) => onCloseHandoverNoteChange(e.target.value)}
          placeholder="Shift notes for next cashier (issues, pending items, mismatch explanation)"
          rows={3}
          className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
        />
      </label>
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <label className="flex items-start gap-2 text-slate-700">
          <input
            type="checkbox"
            checked={closeChecklist.countedCash}
            onChange={(e) => onCloseChecklistChange({ ...closeChecklist, countedCash: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          />
          <span>I have counted physical cash in the drawer.</span>
        </label>
        <label className="flex items-start gap-2 text-slate-700">
          <input
            type="checkbox"
            checked={closeChecklist.reviewedRefundsAndExpenses}
            onChange={(e) => onCloseChecklistChange({ ...closeChecklist, reviewedRefundsAndExpenses: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
          />
          <span>I reviewed refunds, cash expenses, and change given totals.</span>
        </label>
        {difference !== 0 && (
          <label className="flex items-start gap-2 text-rose-800">
            <input
              type="checkbox"
              checked={closeChecklist.varianceAcknowledged}
              onChange={(e) => onCloseChecklistChange({ ...closeChecklist, varianceAcknowledged: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
            />
            <span>I acknowledge this cash variance has been noted for handover/audit.</span>
          </label>
        )}
      </div>
    </>
  )
}
