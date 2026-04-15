'use client'

import { useMemo, useState } from 'react'

export type NotesRecord = Record<string, number>

export interface CashPaymentPanelProps {
  /** Bill total in ₹ */
  billAmount: number
  /** Called with amount received and change amount when user confirms */
  onConfirm: (amountReceived: number, changeGiven: number) => void
  /** Optional label for primary action */
  confirmLabel?: string
  /** Optional callback when cashier cancels / clears context */
  onCancel?: () => void
  /** Optional mode to allow reuse for refunds / edits later */
  mode?: 'sale' | 'refund' | 'adjustment'
  /** Kept for backwards compatibility; no longer used in UI */
  availableNotes?: NotesRecord
}

export function CashPaymentPanel({
  billAmount,
  onConfirm,
  confirmLabel,
  onCancel,
  mode: _mode = 'sale',
}: CashPaymentPanelProps) {
  const [amountReceivedInput, setAmountReceivedInput] = useState('')
  const amountReceived = Math.max(0, Number(amountReceivedInput) || 0)

  const changeToReturn = useMemo(() => {
    const diff = amountReceived - billAmount
    return diff > 0 ? diff : 0
  }, [amountReceived, billAmount])

  const canConfirm = amountReceived >= billAmount && billAmount > 0
  const isSufficient = amountReceived >= billAmount && billAmount > 0

  const handleClearAll = () => {
    setAmountReceivedInput('')
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(amountReceived, changeToReturn)
    handleClearAll()
  }

  return (
    <div className="flex flex-col gap-4 bg-white border border-slate-200 rounded-xl px-4 py-4 sm:px-5 sm:py-5 w-full">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-700">Cash received</h2>
          <p className="text-[11px] sm:text-xs text-slate-500">
            Enter the amount received and return change.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 sm:px-3.5 sm:py-3">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Bill amount</p>
        <p className="text-lg font-semibold text-slate-800 leading-tight">₹{billAmount.toFixed(2)}</p>
      </div>

      <div className="space-y-3 rounded-lg bg-white border border-slate-200 px-3 py-3 sm:px-3.5 sm:py-3">
        <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wide">
          Amount received from customer
        </label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={amountReceivedInput}
          onChange={(e) => setAmountReceivedInput(e.target.value)}
          placeholder="Enter received amount"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
        />
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] font-medium text-slate-500 hover:text-rose-600"
          >
            Reset amount
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-lg bg-sky-50 text-sky-900 px-3 py-2 sm:px-3.5 sm:py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-sky-600 uppercase tracking-wide">
            Total received
          </span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              isSufficient ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            ₹{amountReceived.toFixed(2)}
          </span>
        </div>

        <div
          className={`mt-1.5 rounded-md px-3 py-1.5 flex flex-col gap-0.5 border ${
            isSufficient ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
            Change to return
          </span>
          <span className="text-xl font-semibold tabular-nums text-slate-900">
            ₹{changeToReturn.toFixed(2)}
          </span>
        </div>
        {!isSufficient && (
          <p className="text-[11px] text-rose-600">
            Received amount must be at least the bill total.
          </p>
        )}
      </div>

      <div className="mt-auto pt-1 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          {confirmLabel || 'Confirm & complete sale'}
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-transform"
        >
          Reset amounts
        </button>
      </div>
    </div>
  )
}

/**
 * Backwards-compat alias – kept so existing imports don't break if still used elsewhere.
 * The new design is panel-based and no longer uses a modal internally.
 */
export const CashTenderModal = CashPaymentPanel
