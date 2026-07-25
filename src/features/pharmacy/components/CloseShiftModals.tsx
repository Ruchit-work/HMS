'use client'

import React from 'react'
import { Button, RevealModal } from '@/shared/components'

export const CLOSE_SHIFT_VARIANCE_REASONS = [
  { value: 'cash_shortage', label: 'Cash Shortage' },
  { value: 'extra_cash', label: 'Extra Cash' },
  { value: 'customer_change', label: 'Customer Change' },
  { value: 'pending_expense', label: 'Pending Expense' },
  { value: 'pending_refund', label: 'Pending Refund' },
  { value: 'counting_error', label: 'Counting Error' },
  { value: 'other', label: 'Other' },
] as const

/** Absolute difference at or above this amount is treated as significant (red). */
export const SIGNIFICANT_VARIANCE_THRESHOLD = 50

export type CloseShiftSuccessSummary = {
  shiftId: string
  salesTotal: number
  expenses: number
  expectedCash: number
  countedCash: number
  difference: number
  openingCashTotal: number
  closingCashTotal: number
  cashSales: number
  upiSales: number
  cardSales: number
  refunds: number
  cashExpenses: number
  profit: number
  closedAt?: string
  closedByName?: string
  varianceReason?: string
  handoverNote?: string
}

function formatMoney(n: number): string {
  return `₹${n.toFixed(2)}`
}

function formatDifference(diff: number): string {
  if (diff === 0) return '₹0.00'
  return diff > 0 ? `+₹${diff.toFixed(2)}` : `−₹${Math.abs(diff).toFixed(2)}`
}

function differenceTone(diff: number): 'balanced' | 'small' | 'significant' {
  if (Math.abs(diff) < 0.01) return 'balanced'
  if (Math.abs(diff) < SIGNIFICANT_VARIANCE_THRESHOLD) return 'small'
  return 'significant'
}

const TONE_STYLES = {
  balanced: {
    card: 'bg-emerald-50 ring-emerald-100',
    value: 'text-emerald-700',
    label: 'text-emerald-600',
  },
  small: {
    card: 'bg-amber-50 ring-amber-100',
    value: 'text-amber-700',
    label: 'text-amber-600',
  },
  significant: {
    card: 'bg-rose-50 ring-rose-100',
    value: 'text-rose-700',
    label: 'text-rose-600',
  },
} as const

function SummaryMiniCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'balanced' | 'small' | 'significant'
}) {
  if (tone === 'neutral') {
    return (
      <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-100 px-4 py-3.5">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-bold tracking-tight tabular-nums text-slate-900 truncate">{value}</p>
      </div>
    )
  }
  const styles = TONE_STYLES[tone]
  return (
    <div className={`rounded-2xl ring-1 px-4 py-3.5 ${styles.card}`}>
      <p className={`text-xs font-medium ${styles.label}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight tabular-nums truncate ${styles.value}`}>{value}</p>
    </div>
  )
}

export function buildShiftCloseReportHtml(summary: CloseShiftSuccessSummary, hospitalName?: string): string {
  const diffLabel =
    summary.difference === 0
      ? 'Balanced'
      : summary.difference > 0
        ? `Extra ${formatMoney(summary.difference)}`
        : `Short ${formatMoney(Math.abs(summary.difference))}`
  const reasonLabel =
    CLOSE_SHIFT_VARIANCE_REASONS.find((r) => r.value === summary.varianceReason)?.label ||
    (summary.varianceReason ? summary.varianceReason.replace(/_/g, ' ') : '—')
  const closedAt = summary.closedAt
    ? new Date(summary.closedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Shift Close Report – ${summary.shiftId}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
    .value { font-size: 20px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    td:last-child { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>Shift Closed Successfully</h1>
  <p class="muted">${hospitalName ? `${hospitalName} · ` : ''}Shift ID ${summary.shiftId} · Closed ${closedAt}${summary.closedByName ? ` · By ${summary.closedByName}` : ''}</p>
  <div class="grid">
    <div class="card"><div class="label">Today's Sales</div><div class="value">${formatMoney(summary.salesTotal)}</div></div>
    <div class="card"><div class="label">Expenses</div><div class="value">${formatMoney(summary.expenses)}</div></div>
    <div class="card"><div class="label">Expected Cash</div><div class="value">${formatMoney(summary.expectedCash)}</div></div>
    <div class="card"><div class="label">Counted Cash</div><div class="value">${formatMoney(summary.countedCash)}</div></div>
  </div>
  <div class="card" style="margin-bottom: 20px;">
    <div class="label">Difference</div>
    <div class="value">${diffLabel}</div>
  </div>
  <table>
    <tr><td>Opening cash</td><td>${formatMoney(summary.openingCashTotal)}</td></tr>
    <tr><td>Cash sales</td><td>${formatMoney(summary.cashSales)}</td></tr>
    <tr><td>UPI sales</td><td>${formatMoney(summary.upiSales)}</td></tr>
    <tr><td>Card sales</td><td>${formatMoney(summary.cardSales)}</td></tr>
    <tr><td>Refunds</td><td>−${formatMoney(summary.refunds)}</td></tr>
    <tr><td>Cash expenses</td><td>−${formatMoney(summary.cashExpenses)}</td></tr>
    <tr><td>Profit</td><td>${formatMoney(summary.profit)}</td></tr>
    ${summary.difference !== 0 ? `<tr><td>Variance reason</td><td>${reasonLabel}</td></tr>` : ''}
  </table>
  ${summary.handoverNote ? `<p style="margin-top:20px;font-size:13px;color:#475569"><strong>Notes:</strong> ${summary.handoverNote.replace(/</g, '&lt;')}</p>` : ''}
</body>
</html>`
}

export function downloadShiftCloseReport(summary: CloseShiftSuccessSummary, hospitalName?: string) {
  const html = buildShiftCloseReportHtml(summary, hospitalName)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `shift-report-${summary.shiftId}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function printShiftCloseReport(summary: CloseShiftSuccessSummary, hospitalName?: string) {
  const html = buildShiftCloseReportHtml(summary, hospitalName)
  const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.onload = () => {
    w.print()
  }
  // Fallback if onload already fired
  setTimeout(() => {
    try {
      w.print()
    } catch {
      /* ignore */
    }
  }, 400)
}

export function CloseShiftConfirmModal({
  isOpen,
  onClose,
  salesTotal,
  expectedCash,
  countedCash,
  difference,
  varianceReason,
  onVarianceReasonChange,
  notes,
  onNotesChange,
  confirmed,
  onConfirmedChange,
  loading,
  onConfirmClose,
}: {
  isOpen: boolean
  onClose: () => void
  salesTotal: number
  expectedCash: number
  countedCash: number
  difference: number
  varianceReason: string
  onVarianceReasonChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  confirmed: boolean
  onConfirmedChange: (value: boolean) => void
  loading: boolean
  onConfirmClose: () => void
}) {
  const hasVariance = Math.abs(difference) >= 0.01
  const tone = differenceTone(difference)

  return (
    <RevealModal
      isOpen={isOpen}
      contentClassName="!max-w-lg max-h-[min(90dvh,760px)]"
      onClose={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto max-h-[min(90dvh,760px)] flex flex-col overflow-hidden border border-slate-200/80">
        <div className="shrink-0 px-6 sm:px-7 pt-6 pb-4">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Close Shift</h2>
          <p className="text-sm text-slate-500 mt-1">Review today&apos;s cash and finish your shift.</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-7 pb-2 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <SummaryMiniCard label="Today's Sales" value={formatMoney(salesTotal)} />
            <SummaryMiniCard label="Expected Cash" value={formatMoney(expectedCash)} />
            <SummaryMiniCard label="Counted Cash" value={formatMoney(countedCash)} />
            <SummaryMiniCard label="Difference" value={formatDifference(difference)} tone={tone} />
          </div>

          {hasVariance && (
            <div className="space-y-3">
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1.5">
                  Variance <span className="text-rose-500">*</span>
                </span>
                <select
                  value={varianceReason}
                  onChange={(e) => onVarianceReasonChange(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select reason</option>
                  {CLOSE_SHIFT_VARIANCE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1.5">
                  Notes <span className="text-slate-400 font-normal">(optional)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  placeholder="Add a short note about this variance…"
                  rows={2}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </label>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-xl bg-slate-50 ring-1 ring-slate-100 px-4 py-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => onConfirmedChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-800">I confirm the counted cash is correct.</span>
          </label>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-6 sm:px-7 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={loading}
            loadingText="Closing…"
            onClick={onConfirmClose}
            disabled={!confirmed}
          >
            Close Shift
          </Button>
        </div>
      </div>
    </RevealModal>
  )
}

export function CloseShiftSuccessModal({
  isOpen,
  summary,
  hospitalName,
  onDone,
}: {
  isOpen: boolean
  summary: CloseShiftSuccessSummary
  hospitalName?: string
  onDone: () => void
}) {
  const tone = differenceTone(summary.difference)

  return (
    <RevealModal isOpen={isOpen} contentClassName="!max-w-lg max-h-[min(90dvh,760px)]" onClose={onDone}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto max-h-[min(90dvh,760px)] flex flex-col overflow-hidden border border-slate-200/80">
        <div className="shrink-0 px-6 sm:px-7 pt-7 pb-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Shift Closed Successfully</h2>
          <p className="text-sm text-slate-500 mt-1">
            Shift ID <span className="font-medium text-slate-700 tabular-nums">{summary.shiftId}</span>
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-7 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <SummaryMiniCard label="Today's Sales" value={formatMoney(summary.salesTotal)} />
            <SummaryMiniCard label="Expenses" value={formatMoney(summary.expenses)} />
            <SummaryMiniCard label="Expected Cash" value={formatMoney(summary.expectedCash)} />
            <SummaryMiniCard label="Counted Cash" value={formatMoney(summary.countedCash)} />
            <div className="col-span-2">
              <SummaryMiniCard label="Difference" value={formatDifference(summary.difference)} tone={tone} />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-6 sm:px-7 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={() => downloadShiftCloseReport(summary, hospitalName)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200"
          >
            Download Report
          </button>
          <button
            type="button"
            onClick={() => printShiftCloseReport(summary, hospitalName)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200"
          >
            Print Report
          </button>
          <Button type="button" variant="primary" size="md" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </RevealModal>
  )
}
