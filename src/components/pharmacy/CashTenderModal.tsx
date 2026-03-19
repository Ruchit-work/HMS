'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const DENOMINATIONS = ['500', '200', '100', '50', '20', '10', '5', '2', '1'] as const

export type NotesRecord = Record<string, number>

export interface CashPaymentPanelProps {
  /** Bill total in ₹ */
  billAmount: number
  /** Called with tender notes, change notes, and change amount when user confirms */
  onConfirm: (tenderNotes: NotesRecord, changeNotes: NotesRecord, changeGiven: number) => void
  /** Optional label for primary action */
  confirmLabel?: string
  /** Optional callback when cashier cancels / clears context */
  onCancel?: () => void
  /** Optional mode to allow reuse for refunds / edits later */
  mode?: 'sale' | 'refund' | 'adjustment'
  /** Optional: available notes/coins at counter, used for return suggestions */
  availableNotes?: NotesRecord
}

function toNotesRecord(counts: Record<string, number>): NotesRecord {
  const out: NotesRecord = {}
  DENOMINATIONS.forEach((d) => {
    const n = Math.max(0, Math.floor(counts[d] || 0))
    if (n > 0) out[d] = n
  })
  return out
}

function makeChangeGreedy(amount: number, available?: NotesRecord): { notes: NotesRecord; total: number } {
  const notes: NotesRecord = {}
  let remaining = Math.max(0, Math.floor(amount))
  let givenTotal = 0

  for (const d of DENOMINATIONS) {
    const value = Number(d)
    if (value <= 0) continue
    const maxByAmount = Math.floor(remaining / value)
    const availForDenom = available?.[d] ?? Number.POSITIVE_INFINITY
    const use = Math.min(maxByAmount, availForDenom)
    if (use > 0) {
      notes[d] = use
      remaining -= use * value
      givenTotal += use * value
    }
  }

  return { notes, total: givenTotal }
}

export function CashPaymentPanel({
  billAmount,
  onConfirm,
  confirmLabel,
  onCancel,
  mode = 'sale',
  availableNotes,
}: CashPaymentPanelProps) {
  const [counts, setCounts] = useState<Record<string, number>>(() => ({
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    '2': 0,
    '1': 0,
  }))
  const [lastClickAt, setLastClickAt] = useState<number>(0)
  const [lastSnapshot, setLastSnapshot] = useState<{ counts: Record<string, number> } | null>(null)
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [changeCounts, setChangeCounts] = useState<Record<string, number>>(() => ({
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    '2': 0,
    '1': 0,
  }))
  const [showAdjustReturn, setShowAdjustReturn] = useState(false)

  const tenderTotal = useMemo(() => {
    return DENOMINATIONS.reduce((sum, d) => sum + (counts[d] || 0) * Number(d), 0)
  }, [counts])

  const changeToReturn = useMemo(() => {
    const diff = tenderTotal - billAmount
    return diff > 0 ? diff : 0
  }, [tenderTotal, billAmount])

  const suggestedReturn = useMemo(() => makeChangeGreedy(changeToReturn, availableNotes), [changeToReturn, availableNotes])
  const exactChangePossible = useMemo(
    () => Math.abs(suggestedReturn.total - changeToReturn) < 0.01,
    [suggestedReturn.total, changeToReturn],
  )

  const canConfirm = tenderTotal >= billAmount && billAmount > 0
  const isSufficient = tenderTotal >= billAmount && billAmount > 0

  // When change amount changes, pre-fill editable changeCounts with suggested notes
  useEffect(() => {
    const suggested = suggestedReturn.notes
    setChangeCounts((prev) => {
      const next: Record<string, number> = { ...prev }
      DENOMINATIONS.forEach((d) => {
        next[d] = suggested[d] || 0
      })
      return next
    })
  }, [suggestedReturn])

  const captureSnapshot = () => {
    setLastSnapshot({ counts: { ...counts } })
  }

  const handleBump = (denom: string, delta: 1 | -1) => {
    captureSnapshot()
    const now = Date.now()
    if (now - lastClickAt < 150) return
    setLastClickAt(now)
    setCounts((prev) => {
      const next = { ...prev }
      const current = next[denom] || 0
      const updated = current + delta
      next[denom] = updated < 0 ? 0 : updated
      return next
    })
  }

  const startRepeat = (denom: string, delta: 1 | -1) => {
    captureSnapshot()
    handleBump(denom, delta)
    if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current)
    if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current)
    repeatTimerRef.current = setTimeout(() => {
      repeatIntervalRef.current = setInterval(() => {
        setCounts((prev) => {
          const next = { ...prev }
          const current = next[denom] || 0
          const updated = current + delta
          next[denom] = updated < 0 ? 0 : updated
          return next
        })
      }, 120)
    }, 300)
  }

  const stopRepeat = () => {
    if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current)
    if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current)
    repeatTimerRef.current = null
    repeatIntervalRef.current = null
  }

  const handleClearAll = () => {
    captureSnapshot()
    setCounts({
      '500': 0,
      '200': 0,
      '100': 0,
      '50': 0,
      '20': 0,
      '10': 0,
      '5': 0,
      '2': 0,
      '1': 0,
    })
    setChangeCounts({
      '500': 0,
      '200': 0,
      '100': 0,
      '50': 0,
      '20': 0,
      '10': 0,
      '5': 0,
      '2': 0,
      '1': 0,
    })
  }

  const handleUndo = () => {
    if (!lastSnapshot) return
    setCounts(lastSnapshot.counts)
    setLastSnapshot(null)
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    const tenderNotes = toNotesRecord(counts)
    const changeNotes = toNotesRecord(changeCounts)
    onConfirm(tenderNotes, changeNotes, changeToReturn)
    handleClearAll()
  }

  return (
    <div className="flex flex-col gap-4 bg-white border border-slate-200 rounded-xl px-4 py-4 sm:px-5 sm:py-5 w-full">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm sm:text-base font-semibold text-slate-700">Cash received</h2>
          <p className="text-[11px] sm:text-xs text-slate-500">
            Count cash quickly with denominations and live change.
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
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!lastSnapshot}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed"
          >
            Undo last change
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[11px] font-medium text-slate-500 hover:text-rose-600"
          >
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
          {DENOMINATIONS.map((d) => (
            <div key={d} className="flex flex-col gap-1 rounded-md bg-white border border-slate-200 p-1">
              <span className="text-[10px] text-slate-500 font-medium">₹{d}</span>
              <div className="flex items-stretch rounded-full border border-slate-300 bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onMouseDown={() => startRepeat(d, -1)}
                  onMouseUp={stopRepeat}
                  onMouseLeave={stopRepeat}
                  onTouchStart={() => startRepeat(d, -1)}
                  onTouchEnd={stopRepeat}
                  className="flex-1 h-7 flex items-center justify-center text-[11px] font-semibold text-slate-500 hover:bg-slate-100 active:scale-[0.96] transition transform border-r border-slate-300"
                >
                  −
                </button>
                <div className="flex-1 h-7 flex items-center justify-center text-[11px] font-semibold tabular-nums text-slate-900 bg-white">
                  {counts[d] || 0}
                </div>
                <button
                  type="button"
                  onMouseDown={() => startRepeat(d, 1)}
                  onMouseUp={stopRepeat}
                  onMouseLeave={stopRepeat}
                  onTouchStart={() => startRepeat(d, 1)}
                  onTouchEnd={stopRepeat}
                  className="flex-1 h-7 flex items-center justify-center text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-[0.96] transition transform border-l border-slate-300"
                >
                  +
                </button>
              </div>
            </div>
          ))}
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
            ₹{tenderTotal.toFixed(2)}
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
      </div>

      <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Suggested return notes
          </p>
          <button
            type="button"
            onClick={() => setShowAdjustReturn((v) => !v)}
            disabled={changeToReturn <= 0}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {showAdjustReturn ? 'Hide adjust return ▲' : 'Adjust return ▼'}
          </button>
        </div>
        {changeToReturn <= 0 ? (
          <p className="text-xs text-slate-500">No change to return.</p>
        ) : (
          <>
            {!exactChangePossible && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                Exact change not possible with available denominations. Suggested closest return: ₹
                {suggestedReturn.total.toFixed(2)}.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(suggestedReturn.notes).map(([denom, count]) => (
                <div
                  key={denom}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1"
                >
                  <span className="text-xs font-medium text-emerald-800">₹{denom}</span>
                  <span className="text-[11px] text-emerald-700">× {count}</span>
                </div>
              ))}
            </div>
            {showAdjustReturn && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                {DENOMINATIONS.map((d) => (
                  <div key={d} className="flex flex-col gap-1 rounded-md bg-white border border-slate-200 p-1">
                    <span className="text-[10px] text-slate-500 font-medium">₹{d}</span>
                    {availableNotes && availableNotes[d] === 0 && (
                      <span className="text-[10px] text-rose-500">Out of stock</span>
                    )}
                    <div className="flex items-stretch rounded-full border border-slate-300 bg-slate-50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() =>
                          setChangeCounts((prev) => ({
                            ...prev,
                            [d]: Math.max(0, (prev[d] || 0) - 1),
                          }))
                        }
                        className="flex-1 h-7 flex items-center justify-center text-[11px] font-semibold text-slate-500 hover:bg-slate-100 active:scale-[0.96] transition transform border-r border-slate-300"
                      >
                        −
                      </button>
                      <div className="flex-1 h-7 flex items-center justify-center text-[11px] font-semibold tabular-nums text-slate-900 bg-white">
                        {changeCounts[d] || 0}
                      </div>
                      <button
                        type="button"
                        disabled={availableNotes ? changeCounts[d] >= (availableNotes[d] || 0) : false}
                        onClick={() =>
                          setChangeCounts((prev) => ({
                            ...prev,
                            [d]: Math.max(0, (prev[d] || 0) + 1),
                          }))
                        }
                        className="flex-1 h-7 flex items-center justify-center text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-[0.96] transition transform border-l border-slate-300 disabled:text-slate-300 disabled:hover:bg-slate-50 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
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
