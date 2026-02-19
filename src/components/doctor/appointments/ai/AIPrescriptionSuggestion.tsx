"use client"

import { useState } from "react"
import { parseAiPrescription } from "@/utils/appointments/prescriptionParsers"

interface AIPrescriptionSuggestionProps {
  isLoading: boolean
  isVisible: boolean
  aiPrescriptionText: string | undefined
  removedIndices: number[]
  existingMedicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  onAddAll: (medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>) => void
  onAddSingle: (medicine: { name: string; dosage: string; frequency: string; duration: string }, originalIndex: number) => void
  onRemove: (originalIndex: number) => void
  onRemoveAll: (indices: number[]) => void
  onRegenerate: () => void
}

export default function AIPrescriptionSuggestion({
  isLoading,
  isVisible,
  aiPrescriptionText,
  removedIndices,
  existingMedicines,
  onAddAll,
  onAddSingle,
  onRemove,
  onRemoveAll,
  onRegenerate,
}: AIPrescriptionSuggestionProps) {
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div className="mb-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-slate-500" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium text-slate-700">Generating suggestions...</span>
        </div>
      </div>
    )
  }

  if (!isVisible || !aiPrescriptionText) {
    if (isVisible) {
      return (
        <div className="mb-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-sm text-slate-600">Prescription suggestions are being prepared. Please wait.</p>
        </div>
      )
    }
    return null
  }

  const parsedMedicines = parseAiPrescription(aiPrescriptionText)
  const visibleMedicines = parsedMedicines.filter((_, idx) => !removedIndices.includes(idx))
  const existingNames = existingMedicines.map((m) => (m.name || "").toLowerCase().trim())

  const getOriginalIndex = (med: { name: string; dosage: string; frequency: string; duration: string }, displayIndex: number) => {
    let foundCount = 0
    for (let i = 0; i < parsedMedicines.length; i++) {
      if (
        !removedIndices.includes(i) &&
        parsedMedicines[i].name === med.name &&
        parsedMedicines[i].dosage === med.dosage &&
        parsedMedicines[i].frequency === med.frequency &&
        parsedMedicines[i].duration === med.duration
      ) {
        if (foundCount === displayIndex) return i
        foundCount++
      }
    }
    return -1
  }

  const handleAddAllClick = () => {
    const toAdd = visibleMedicines.filter((m) => !existingNames.includes((m.name || "").toLowerCase().trim()))
    if (toAdd.length === 0) return
    onAddAll(toAdd)
  }

  const handleRemoveAllClick = () => {
    // Pass every parsed index so parent can set removed list in one update
    const allIndices = Array.from({ length: parsedMedicines.length }, (_, i) => i)
    if (allIndices.length > 0) onRemoveAll(allIndices)
  }

  const handleRemoveClick = (originalIndex: number) => {
    setPendingRemoveIndex(originalIndex)
  }

  const handleRemoveConfirm = () => {
    if (pendingRemoveIndex !== null) {
      onRemove(pendingRemoveIndex)
      setPendingRemoveIndex(null)
    }
  }

  return (
    <div className="mb-3 space-y-3">
      {/* AI disclaimer */}
      {/* <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
        <p className="text-sm text-slate-700">
          These are generated suggestions and must be reviewed by a doctor before prescribing.
        </p>
      </div> */}

      {/* Section header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Suggested medicines</h4>
        <div className="flex items-center gap-2">
          {visibleMedicines.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleAddAllClick}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Add all
              </button>
              <button
                type="button"
                onClick={handleRemoveAllClick}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Remove all
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerate suggestions"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
        </div>
      </div>

      {/* Medicine list */}
      {visibleMedicines.length > 0 ? (
        <div className="space-y-2 overflow-hidden">
          {visibleMedicines.map((med, displayIndex) => {
            const originalIndex = getOriginalIndex(med, displayIndex)
            const isAlreadyAdded = existingMedicines.some(
              (m) => (m.name || "").toLowerCase().trim() === (med.name || "").toLowerCase().trim()
            )
            const isPendingRemove = pendingRemoveIndex === originalIndex

            return (
              <div
                key={`${originalIndex}-${med.name}`}
                className="bg-white border border-slate-200 rounded-lg px-4 py-3"
              >
                {isPendingRemove ? (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-sm text-slate-700">
                      Remove <strong>{med.name || "this medicine"}</strong> from suggestions?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingRemoveIndex(null)}
                        className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveConfirm}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 border border-red-700 rounded-md hover:bg-red-700"
                      >
                        Remove suggestion
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                      <span className="font-semibold text-slate-900">{med.name || "Medicine"}</span>
                      {med.dosage && <span className="text-slate-700">{med.dosage}</span>}
                      {med.frequency && <span className="text-slate-700">{med.frequency}</span>}
                      {med.duration && <span className="text-slate-700">{med.duration}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isAlreadyAdded ? (
                        <button
                          type="button"
                          onClick={() => originalIndex >= 0 && onAddSingle(med, originalIndex)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 border border-blue-700 rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Add 
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-md">
                          Added
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => originalIndex >= 0 && handleRemoveClick(originalIndex)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        Remove 
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
          <p className="text-sm text-slate-600">No suggestions available or all have been added.</p>
        </div>
      )}
    </div>
  )
}
