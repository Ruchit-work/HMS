'use client'

import { useState, useMemo } from 'react'
import { RevealModal } from '@/components/ui/overlays/RevealModal'

const DENOMINATIONS = ['500', '200', '100', '50', '20', '10', '5', '2', '1'] as const

export type NotesRecord = Record<string, number>

export interface CashTenderModalProps {
  isOpen: boolean
  onClose: () => void
  /** Bill total in ₹ */
  billAmount: number
  /** Called with tender notes, change notes, and change amount when user confirms */
  onConfirm: (tenderNotes: NotesRecord, changeNotes: NotesRecord, changeGiven: number) => void
}

function toNotesRecord(counts: Record<string, string>): NotesRecord {
  const out: NotesRecord = {}
  DENOMINATIONS.forEach((d) => {
    const n = Math.max(0, Math.floor(Number(counts[d]) || 0))
    if (n > 0) out[d] = n
  })
  return out
}

export function CashTenderModal({ isOpen, onClose, billAmount, onConfirm }: CashTenderModalProps) {
  const [tenderCounts, setTenderCounts] = useState<Record<string, string>>({
    '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '',
  })
  const [changeCounts, setChangeCounts] = useState<Record<string, string>>({
    '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '',
  })

  const tenderTotal = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => sum + (Number(tenderCounts[d]) || 0) * Number(d), 0)
  }, [tenderCounts])

  const changeTotal = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => sum + (Number(changeCounts[d]) || 0) * Number(d), 0)
  }, [changeCounts])

  const changeToReturn = tenderTotal - billAmount
  const changeMatches = changeToReturn >= 0 && Math.abs(changeTotal - changeToReturn) < 0.01
  const canConfirm = tenderTotal >= billAmount && changeToReturn >= 0 && changeMatches

  const handleConfirm = () => {
    if (!canConfirm) return
    const tenderNotes = toNotesRecord(tenderCounts)
    const changeNotes = toNotesRecord(changeCounts)
    onConfirm(tenderNotes, changeNotes, changeToReturn)
    setTenderCounts({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
    setChangeCounts({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
    onClose()
  }

  const handleClose = () => {
    setTenderCounts({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
    setChangeCounts({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
    onClose()
  }

  return (
    <RevealModal isOpen={isOpen} onClose={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 sm:px-8 pt-6 pb-5 rounded-t-2xl shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Cash received</h2>
              <p className="text-sm text-slate-500 mt-1">Enter notes received and change given. Counter updates automatically.</p>
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
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-500">Bill amount</p>
            <p className="text-2xl font-bold text-slate-900">₹{billAmount.toFixed(2)}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Amount received from customer</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DENOMINATIONS.map((d) => (
                <label key={d} className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-500">₹{d}</span>
                  <input
                    type="number"
                    min={0}
                    value={tenderCounts[d] ?? ''}
                    onChange={(e) => setTenderCounts((prev) => ({ ...prev, [d]: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
              ))}
            </div>
            <p className="text-sm font-medium text-slate-700 mt-2">Total received: ₹{tenderTotal.toFixed(2)}</p>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-sm font-medium text-slate-600">Change to return</p>
            <p className="text-xl font-bold text-emerald-800">₹{changeToReturn >= 0 ? changeToReturn.toFixed(2) : '0.00'}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Change given (notes/coins given out)</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DENOMINATIONS.map((d) => (
                <label key={d} className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-500">₹{d}</span>
                  <input
                    type="number"
                    min={0}
                    value={changeCounts[d] ?? ''}
                    onChange={(e) => setChangeCounts((prev) => ({ ...prev, [d]: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
              ))}
            </div>
            <p className="text-sm font-medium text-slate-700 mt-2">
              Change entered: ₹{changeTotal.toFixed(2)}
              {changeToReturn >= 0 && (
                <span className={changeMatches ? ' text-emerald-600 ml-1' : ' text-rose-600 ml-1'}>
                  {changeMatches ? ' ✓' : ` (should be ₹${changeToReturn.toFixed(2)})`}
                </span>
              )}
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
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              Confirm & complete sale
            </button>
          </div>
        </div>
      </div>
    </RevealModal>
  )
}
