"use client"

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
  showUsePrevious?: boolean
  onCopyPrevious?: () => void
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
  showUsePrevious,
  onCopyPrevious,
}: AIPrescriptionSuggestionProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-slate-500" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium text-slate-600">Generating suggestions…</span>
        </div>
      </div>
    )
  }

  if (!isVisible || !aiPrescriptionText) {
    if (isVisible) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-sm text-slate-600">Prescription suggestions are being prepared.</p>
        </div>
      )
    }
    return null
  }

  const parsedMedicines = parseAiPrescription(aiPrescriptionText)
  const visibleMedicines = parsedMedicines.filter((_, idx) => !removedIndices.includes(idx))

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

  const handleRemoveAllClick = () => {
    const allIndices = parsedMedicines.map((_, i) => i)
    if (allIndices.length > 0) onRemoveAll(allIndices)
  }

  return (
    <div className="space-y-3">
      {/* Section header: Suggested Medicines | Use Previous, Regenerate */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-sm font-semibold text-slate-900">Suggested medicines</h4>
        <div className="flex items-center gap-2">
          {visibleMedicines.length > 0 && (
            <button
              type="button"
              onClick={handleRemoveAllClick}
              className="h-8 px-3.5 rounded-lg border border-[#E2E8F0] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:opacity-90 transition-all"
              title="Remove all suggestions"
            >
              Remove all
            </button>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className="h-8 px-3.5 rounded-lg border border-[#E2E8F0] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:opacity-90 transition-all inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerate suggestions"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
        </div>
      </div>

      {/* Medicine cards */}
      {visibleMedicines.length > 0 ? (
        <div className="space-y-2.5">
          {visibleMedicines.map((med, displayIndex) => {
            const originalIndex = getOriginalIndex(med, displayIndex)
            const isAlreadyAdded = existingMedicines.some(
              (m) => (m.name || "").toLowerCase().trim() === (med.name || "").toLowerCase().trim()
            )

            return (
              <div
                key={`${originalIndex}-${med.name}`}
                className="flex items-center justify-between gap-4 rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{med.name || "Medicine"}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {[med.dosage, med.frequency, med.duration].filter(Boolean).join(" • ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isAlreadyAdded ? (
                    <button
                      type="button"
                      onClick={() => originalIndex >= 0 && onAddSingle(med, originalIndex)}
                      className="h-9 px-4 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Add to Prescription
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-slate-500">Added</span>
                  )}
                  <button
                    type="button"
                    onClick={() => originalIndex >= 0 && onRemove(originalIndex)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                    title="Remove from suggestions"
                    aria-label="Remove from suggestions"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-[10px] border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-sm text-slate-600">No suggestions available or all have been added.</p>
        </div>
      )}
    </div>
  )
}
