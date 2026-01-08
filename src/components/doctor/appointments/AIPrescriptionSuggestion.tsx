"use client"

import { parseAiPrescription } from "@/utils/appointments/prescriptionParsers"
import { CompletionFormEntry } from "@/types/appointments"

interface AIPrescriptionSuggestionProps {
  appointmentId: string
  isLoading: boolean
  isVisible: boolean
  aiPrescriptionText: string | undefined
  removedIndices: number[]
  existingMedicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  onAddAll: (medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>) => void
  onAddSingle: (medicine: { name: string; dosage: string; frequency: string; duration: string }, originalIndex: number) => void
  onRemove: (originalIndex: number) => void
  onRegenerate: () => void
}

export default function AIPrescriptionSuggestion({
  appointmentId,
  isLoading,
  isVisible,
  aiPrescriptionText,
  removedIndices,
  existingMedicines,
  onAddAll,
  onAddSingle,
  onRemove,
  onRegenerate,
}: AIPrescriptionSuggestionProps) {
  if (isLoading) {
    return (
      <div className="mb-2 bg-purple-50 border border-purple-200 rounded p-2">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-purple-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs font-medium text-purple-700">Generating AI prescription...</span>
        </div>
      </div>
    )
  }

  if (!isVisible || !aiPrescriptionText) {
    if (isVisible) {
      return (
        <div className="mb-2 bg-yellow-50 border border-yellow-200 rounded p-2">
          <p className="text-xs text-yellow-700">AI prescription is being generated. Please wait...</p>
        </div>
      )
    }
    return null
  }

  const parsedMedicines = parseAiPrescription(aiPrescriptionText)
  const visibleMedicines = parsedMedicines.filter((_, idx) => !removedIndices.includes(idx))
  const existingNames = existingMedicines.map(m => (m.name || "").toLowerCase().trim())

  return (
    <div className="mb-2 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-xs font-semibold text-purple-700 uppercase">AI Suggested Medicines</span>
        </div>
        <div className="flex items-center gap-1.5">
          {visibleMedicines.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const toAdd = visibleMedicines.filter(m => !existingNames.includes((m.name || "").toLowerCase().trim()))
                if (toAdd.length === 0) {
                  return
                }
                onAddAll(toAdd)
              }}
              className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold rounded"
            >
              Add All
            </button>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className="flex items-center justify-center gap-1 px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-semibold rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerate AI suggestion"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
        </div>
      </div>

      {visibleMedicines.length > 0 ? (
        <div className="space-y-1.5">
          {visibleMedicines.map((med, displayIndex) => {
            // Find the original index in parsedMedicines array
            let medIndex = -1
            let foundCount = 0
            for (let i = 0; i < parsedMedicines.length; i++) {
              if (!removedIndices.includes(i) && 
                  parsedMedicines[i].name === med.name &&
                  parsedMedicines[i].dosage === med.dosage &&
                  parsedMedicines[i].frequency === med.frequency &&
                  parsedMedicines[i].duration === med.duration) {
                if (foundCount === displayIndex) {
                  medIndex = i
                  break
                }
                foundCount++
              }
            }

            const isAlreadyAdded = existingMedicines.some(
              (m: any) => m.name?.toLowerCase().trim() === med.name?.toLowerCase().trim()
            )

            return (
              <div key={`${medIndex}-${med.name}`} className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded p-2 relative">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-semibold text-purple-900">{med.name || "Medicine"}</span>
                    </div>
                    <div className="space-y-0.5 text-[10px] text-purple-700">
                      {med.dosage && (
                        <div><span className="font-medium">Dosage:</span> {med.dosage}</div>
                      )}
                      {med.frequency && (
                        <div><span className="font-medium">Frequency:</span> {med.frequency}</div>
                      )}
                      {med.duration && (
                        <div><span className="font-medium">Duration:</span> {med.duration}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isAlreadyAdded ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (medIndex >= 0) {
                            onAddSingle(med, medIndex)
                          }
                        }}
                        className="p-1 bg-green-500 hover:bg-green-600 text-white rounded transition-all"
                        title="Add medicine"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">Added</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (medIndex >= 0) {
                          onRemove(medIndex)
                        }
                      }}
                      className="p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-all"
                      title="Remove from suggestion"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded p-2 border border-purple-100">
          <p className="text-xs text-gray-800 whitespace-pre-wrap font-sans">No AI suggestions available or all have been added.</p>
        </div>
      )}
    </div>
  )
}

