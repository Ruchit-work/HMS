'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'

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
  /** Disables inputs and confirm while payment is processing */
  disabled?: boolean
  isProcessing?: boolean
  /** Change to reset amount field (e.g. new checkout session id) */
  resetKey?: string | number
}

export function CashPaymentPanel({
  billAmount,
  onConfirm,
  confirmLabel,
  onCancel,
  mode: _mode = 'sale',
  disabled = false,
  isProcessing = false,
  resetKey,
}: CashPaymentPanelProps) {
  const [amountReceivedInput, setAmountReceivedInput] = useState('')
  const [confirmLocked, setConfirmLocked] = useState(false)
  const amountReceived = Math.max(0, Number(amountReceivedInput) || 0)

  useEffect(() => {
    setAmountReceivedInput('')
    setConfirmLocked(false)
  }, [billAmount, resetKey])

  const changeToReturn = useMemo(() => {
    const diff = amountReceived - billAmount
    return diff > 0 ? diff : 0
  }, [amountReceived, billAmount])

  const blocked = disabled || isProcessing || confirmLocked
  const canConfirm = amountReceived >= billAmount && billAmount > 0 && !blocked
  const isSufficient = amountReceived >= billAmount && billAmount > 0

  const handleClearAll = () => {
    if (blocked) return
    setAmountReceivedInput('')
  }

  const handleConfirm = () => {
    if (!canConfirm || blocked) return
    setConfirmLocked(true)
    onConfirm(amountReceived, changeToReturn)
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
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={blocked}>
            Cancel
          </Button>
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
          disabled={blocked}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
        />
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleClearAll}
            disabled={blocked}
            className="text-[11px] font-medium text-slate-500 hover:text-rose-600 disabled:opacity-50 disabled:pointer-events-none"
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
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleConfirm}
          disabled={!canConfirm}
          loading={isProcessing || confirmLocked}
          loadingText="Processing payment…"
        >
          {confirmLabel || 'Confirm & complete sale'}
        </Button>
        <Button type="button" variant="outline" size="md" className="w-full" onClick={handleClearAll} disabled={blocked}>
          Reset amounts
        </Button>
      </div>
    </div>
  )
}
