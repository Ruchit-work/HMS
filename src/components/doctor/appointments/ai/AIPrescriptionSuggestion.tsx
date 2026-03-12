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
  const visibleMedicines = parsedMedicines
    .map((med, originalIndex) => ({ med, originalIndex }))
    .filter(({ originalIndex }) => !removedIndices.includes(originalIndex))

  const handleRemoveAllClick = () => {
    const allIndices = parsedMedicines.map((_, i) => i)
    if (allIndices.length > 0) onRemoveAll(allIndices)
  }

  return (
    <div className="space-y-3">
      {/* Section header: Suggested Medicines | actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Suggested medicines</h4>
          {visibleMedicines.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {visibleMedicines.length} suggestion{visibleMedicines.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {visibleMedicines.length > 0 && (
            <button
              type="button"
              onClick={handleRemoveAllClick}
              className="h-8 px-3.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              title="Remove all suggestions"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className="h-8 px-3.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Regenerate suggestions"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
        </div>
      </div>

      {/* Medicine pill cards */}
      {visibleMedicines.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {visibleMedicines.map(({ med, originalIndex }, idx) => {
            const isAlreadyAdded = existingMedicines.some(
              (m) => (m.name || "").toLowerCase().trim() === (med.name || "").toLowerCase().trim()
            )

            return (
              <div
                key={`${originalIndex}-${med.name}-${idx}`}
                className="group inline-flex items-center gap-3 rounded-full border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs shadow-sm hover:border-sky-300 hover:bg-sky-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white shrink-0">
                    💊
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate max-w-[150px]">
                      {med.name || "Medicine"}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {med.dosage && (
                        <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                          {med.dosage}
                        </span>
                      )}
                      {med.frequency && (
                        <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                          {med.frequency}
                        </span>
                      )}
                      {med.duration && (
                        <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                          {med.duration}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isAlreadyAdded ? (
                    <button
                      type="button"
                      onClick={() => onAddSingle(med, originalIndex)}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      Added
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(originalIndex)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                    title="Remove from suggestions"
                    aria-label="Remove from suggestions"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
