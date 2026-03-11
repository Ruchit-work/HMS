'use client'

import { useState, useMemo } from 'react'
import { RevealModal } from '@/components/ui/overlays/RevealModal'

const DENOMINATIONS = ['500', '200', '100', '50', '20', '10', '5', '2', '1'] as const

export type RefundNotesRecord = Record<string, number>

export interface RefundCashModalProps {
  isOpen: boolean
  onClose: () => void
  /** Refund amount in ₹ - notes total must match this */
  refundAmount: number
  onConfirm: (notes: RefundNotesRecord) => void
}

function toNotesRecord(counts: Record<string, string>): RefundNotesRecord {
  const out: RefundNotesRecord = {}
  DENOMINATIONS.forEach((d) => {
    const n = Math.max(0, Math.floor(Number(counts[d]) || 0))
    if (n > 0) out[d] = n
  })
  return out
}

export function RefundCashModal({
  isOpen,
  onClose,
  refundAmount,
  onConfirm,
}: RefundCashModalProps) {
  const [counts, setCounts] = useState<Record<string, string>>({
    '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '',
  })

  const total = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => sum + (Number(counts[d]) || 0) * Number(d), 0)
  }, [counts])

  const matches = Math.abs(total - refundAmount) < 0.01
  const canConfirm = refundAmount > 0 && matches

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(toNotesRecord(counts))
    setCounts({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
    onClose()
  }

  const handleClose = () => {
    setCounts({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
    onClose()
  }

  return (
    <RevealModal isOpen={isOpen} onClose={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 sm:px-8 pt-6 pb-5 rounded-t-2xl shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Cash refund</h2>
              <p className="text-sm text-slate-500 mt-1">Enter notes/coins given to customer. Counter will be updated.</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
            <p className="text-sm font-medium text-rose-700">Refund amount</p>
            <p className="text-2xl font-bold text-rose-900">₹{refundAmount.toFixed(2)}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Notes/coins given to customer</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DENOMINATIONS.map((d) => (
                <label key={d} className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-500">₹{d}</span>
                  <input
                    type="number"
                    min={0}
                    value={counts[d] ?? ''}
                    onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
              ))}
            </div>
            <p className="text-sm font-medium text-slate-700 mt-2">
              Total entered: ₹{total.toFixed(2)}
              <span className={matches ? ' text-emerald-600 ml-1' : ' text-rose-600 ml-1'}>
                {matches ? ' ✓' : ` (must be ₹${refundAmount.toFixed(2)})`}
              </span>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              Confirm refund
            </button>
          </div>
        </div>
      </div>
    </RevealModal>
  )
}
