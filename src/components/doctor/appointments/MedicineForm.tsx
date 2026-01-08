"use client"

import { useState, useCallback } from "react"
import { MedicineSuggestion, sanitizeMedicineName } from "@/utils/medicineSuggestions"
import { CompletionFormEntry } from "@/types/appointments"

interface MedicineFormProps {
  appointmentId: string
  medicines: CompletionFormEntry["medicines"]
  medicineSuggestions: MedicineSuggestion[]
  medicineSuggestionsLoading: boolean
  onMedicinesChange: (medicines: CompletionFormEntry["medicines"]) => void
}

export default function MedicineForm({
  appointmentId,
  medicines,
  medicineSuggestions,
  medicineSuggestionsLoading,
  onMedicinesChange,
}: MedicineFormProps) {
  const [activeNameSuggestion, setActiveNameSuggestion] = useState<{ appointmentId: string; index: number } | null>(null)
  const [inlineSuggestion, setInlineSuggestion] = useState<{
    appointmentId: string
    index: number
    suggestion: string
  } | null>(null)

  const addMedicine = () => {
    onMedicinesChange([...medicines, { name: "", dosage: "", frequency: "", duration: "" }])
  }

  const removeMedicine = (index: number) => {
    onMedicinesChange(medicines.filter((_, i) => i !== index))
  }

  const updateMedicine = (index: number, field: string, value: string) => {
    const updatedMedicines = [...medicines]
    updatedMedicines[index] = { ...updatedMedicines[index], [field]: value }
    onMedicinesChange(updatedMedicines)
  }

  const getMedicineNameSuggestions = useCallback(
    (query: string, limitOptions = 5) => {
      if (!medicineSuggestions.length) return []
      const cleaned = query.trim().toLowerCase()
      if (cleaned.length < 1) return []

      const startsWithMatches = medicineSuggestions.filter((suggestion) =>
        suggestion.name.toLowerCase().startsWith(cleaned)
      )
      if (startsWithMatches.length >= limitOptions) {
        return startsWithMatches.slice(0, limitOptions)
      }

      const remainingSlots = limitOptions - startsWithMatches.length
      const containsMatches = medicineSuggestions
        .filter(
          (suggestion) =>
            !suggestion.name.toLowerCase().startsWith(cleaned) &&
            suggestion.name.toLowerCase().includes(cleaned)
        )
        .slice(0, remainingSlots)

      return [...startsWithMatches, ...containsMatches]
    },
    [medicineSuggestions]
  )

  const findSuggestionByName = useCallback(
    (name?: string) => {
      if (!name) return undefined
      const cleaned = name.trim().toLowerCase()
      if (!cleaned) return undefined
      return medicineSuggestions.find(
        (suggestion) =>
          suggestion.normalizedName === cleaned || suggestion.name.toLowerCase() === cleaned
      )
    },
    [medicineSuggestions]
  )

  const handleSelectMedicineSuggestion = (
    index: number,
    suggestion: MedicineSuggestion,
    { setFocusNext = false }: { setFocusNext?: boolean } = {}
  ) => {
    const sanitizedName = sanitizeMedicineName(suggestion.name)
    updateMedicine(index, "name", sanitizedName || suggestion.name)
    const currentMed = medicines[index]

    if ((!currentMed?.dosage || !currentMed.dosage.trim()) && suggestion.dosageOptions?.length) {
      updateMedicine(index, "dosage", suggestion.dosageOptions[0].value)
    }
    if (
      (!currentMed?.frequency || !currentMed.frequency.trim()) &&
      suggestion.frequencyOptions?.length
    ) {
      updateMedicine(index, "frequency", suggestion.frequencyOptions[0].value)
    }
    if (
      (!currentMed?.duration || !currentMed.duration.trim()) &&
      suggestion.durationOptions?.length
    ) {
      updateMedicine(index, "duration", suggestion.durationOptions[0].value)
    }

    setActiveNameSuggestion(null)
    setInlineSuggestion(null)
    if (setFocusNext) {
      const nextField = document.querySelector<HTMLInputElement>(
        `#dosage-${appointmentId}-${index}`
      )
      if (nextField) {
        requestAnimationFrame(() => nextField.focus())
      }
    }
  }

  const getTopOptions = (options?: Array<{ value: string; count?: number }>) =>
    (options || []).slice(0, 4)

  const handleOptionChipClick = (
    index: number,
    field: "dosage" | "frequency" | "duration",
    value: string
  ) => {
    updateMedicine(index, field, value)
  }

  const updateInlineSuggestion = useCallback(
    (index: number, value: string) => {
      const cleanedValue = value.trim()
      if (cleanedValue.length < 1) {
        setInlineSuggestion((prev) =>
          prev?.appointmentId === appointmentId && prev.index === index ? null : prev
        )
        return
      }

      const bestMatch = getMedicineNameSuggestions(cleanedValue, 1)[0]
      if (bestMatch && bestMatch.name.toLowerCase().startsWith(cleanedValue.toLowerCase())) {
        setInlineSuggestion({
          appointmentId,
          index,
          suggestion: bestMatch.name,
        })
      } else {
        setInlineSuggestion((prev) =>
          prev?.appointmentId === appointmentId && prev.index === index ? null : prev
        )
      }
    },
    [appointmentId, getMedicineNameSuggestions]
  )

  const acceptInlineSuggestion = (index: number) => {
    if (
      inlineSuggestion &&
      inlineSuggestion.appointmentId === appointmentId &&
      inlineSuggestion.index === index
    ) {
      const suggestion = medicineSuggestions.find(
        (item) => item.name === inlineSuggestion.suggestion
      )
      if (suggestion) {
        handleSelectMedicineSuggestion(index, suggestion, { setFocusNext: true })
      } else {
        updateMedicine(index, "name", inlineSuggestion.suggestion)
        setInlineSuggestion(null)
      }
    }
  }

  return (
    <div className="space-y-2">
      {medicines.length === 0 ? (
        <div className="text-center py-3 bg-gray-50 rounded border border-dashed border-gray-300">
          <p className="text-xs text-gray-600 mb-2">No medicines added yet</p>
          <button
            type="button"
            onClick={addMedicine}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-xs transition-all"
          >
            + Add Medicine
          </button>
        </div>
      ) : (
        <>
          {medicines.map((medicine, index) => {
            const selectedSuggestion = findSuggestionByName(medicine.name)
            const nameSuggestions = getMedicineNameSuggestions(medicine.name || "")
            const showNameSuggestions =
              activeNameSuggestion?.appointmentId === appointmentId &&
              activeNameSuggestion?.index === index &&
              nameSuggestions.length > 0

            return (
              <div key={index} className="bg-gray-50 rounded p-2.5 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-semibold text-gray-800 text-xs">#{index + 1}</h5>
                  <button
                    type="button"
                    onClick={() => removeMedicine(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded p-0.5 transition-all"
                    title="Remove medicine"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id={`name-${appointmentId}-${index}`}
                        value={medicine.name}
                        onChange={(e) => {
                          updateMedicine(index, "name", e.target.value)
                          updateInlineSuggestion(index, e.target.value)
                        }}
                        onFocus={() => {
                          setActiveNameSuggestion({ appointmentId, index })
                          updateInlineSuggestion(index, medicine.name || "")
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setActiveNameSuggestion((current) => {
                              if (
                                current?.appointmentId === appointmentId &&
                                current.index === index
                              ) {
                                return null
                              }
                              return current
                            })
                          }, 150)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Tab" || e.key === "ArrowRight") {
                            if (inlineSuggestion?.appointmentId === appointmentId && inlineSuggestion.index === index) {
                              e.preventDefault()
                              acceptInlineSuggestion(index)
                            }
                          } else if (e.key === "Enter") {
                            if (inlineSuggestion?.appointmentId === appointmentId && inlineSuggestion.index === index) {
                              e.preventDefault()
                              acceptInlineSuggestion(index)
                            }
                          } else if (e.key === "ArrowDown") {
                            if (nameSuggestions.length > 0) {
                              e.preventDefault()
                              const firstOption = document.querySelector<HTMLButtonElement>(
                                `#suggestion-btn-${appointmentId}-${index}-0`
                              )
                              firstOption?.focus()
                            }
                          } else if (e.key === "Escape") {
                            setInlineSuggestion((prev) =>
                              prev?.appointmentId === appointmentId && prev.index === index ? null : prev
                            )
                          }
                        }}
                        placeholder="e.g., Paracetamol"
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs"
                        required
                      />
                      {inlineSuggestion?.appointmentId === appointmentId &&
                      inlineSuggestion?.index === index &&
                      inlineSuggestion?.suggestion &&
                      inlineSuggestion.suggestion.toLowerCase().startsWith((medicine.name || "").toLowerCase()) ? (
                        <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-xs text-gray-400 select-none">
                          <span className="opacity-0">
                            {(medicine.name || "").split("").map(() => "•").join("")}
                          </span>
                          <span>
                            {
                              inlineSuggestion.suggestion.slice(
                                (medicine.name || "").length
                              )
                            }
                          </span>
                        </div>
                      ) : null}
                      {showNameSuggestions && (
                        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto bg-white border border-gray-200 rounded shadow-lg">
                          {medicineSuggestionsLoading ? (
                            <div className="px-3 py-2 text-[11px] text-gray-500">Loading suggestions...</div>
                          ) : (
                            nameSuggestions.map((suggestion, suggestionIndex) => (
                              <button
                                type="button"
                                key={suggestion.id}
                                id={`suggestion-btn-${appointmentId}-${index}-${suggestionIndex}`}
                                className="w-full px-3 py-1.5 text-left hover:bg-green-50 transition text-[11px]"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  handleSelectMedicineSuggestion(index, suggestion, { setFocusNext: true })
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    handleSelectMedicineSuggestion(index, suggestion, { setFocusNext: true })
                                  } else if (e.key === "ArrowDown") {
                                    const nextButton = document.querySelector<HTMLButtonElement>(
                                      `#suggestion-btn-${appointmentId}-${index}-${suggestionIndex + 1}`
                                    )
                                    if (nextButton) {
                                      e.preventDefault()
                                      nextButton.focus()
                                    }
                                  } else if (e.key === "ArrowUp") {
                                    if (suggestionIndex === 0) {
                                      e.preventDefault()
                                      const input = document.querySelector<HTMLInputElement>(
                                        `#name-${appointmentId}-${index}`
                                      )
                                      input?.focus()
                                    } else {
                                      const prevButton = document.querySelector<HTMLButtonElement>(
                                        `#suggestion-btn-${appointmentId}-${index}-${suggestionIndex - 1}`
                                      )
                                      if (prevButton) {
                                        e.preventDefault()
                                        prevButton.focus()
                                      }
                                    }
                                  }
                                }}
                              >
                                <div className="text-gray-800 font-semibold text-xs">
                                  {suggestion.name}
                                </div>
                                {suggestion.dosageOptions?.length ? (
                                  <div className="text-[10px] text-gray-500">
                                    Common dosage: {suggestion.dosageOptions[0].value}
                                  </div>
                                ) : null}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Dosage
                    </label>
                    <input
                      type="text"
                      id={`dosage-${appointmentId}-${index}`}
                      value={medicine.dosage}
                      onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                      placeholder="e.g., 500mg"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs"
                    />
                    {selectedSuggestion?.dosageOptions?.length ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getTopOptions(selectedSuggestion.dosageOptions).map((option) => (
                          <button
                            type="button"
                            key={`${option.value}-dosage`}
                            onClick={() => handleOptionChipClick(index, "dosage", option.value)}
                            className="px-2 py-0.5 bg-white text-[10px] border border-gray-200 rounded-full hover:border-green-400 hover:text-green-600 transition"
                          >
                            {option.value}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Frequency
                    </label>
                    <input
                      type="text"
                      value={medicine.frequency}
                      onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                      placeholder="e.g., 1-0-1"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs"
                    />
                    {selectedSuggestion?.frequencyOptions?.length ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getTopOptions(selectedSuggestion.frequencyOptions).map((option) => (
                          <button
                            type="button"
                            key={`${option.value}-frequency`}
                            onClick={() => handleOptionChipClick(index, "frequency", option.value)}
                            className="px-2 py-0.5 bg-white text-[10px] border border-gray-200 rounded-full hover:border-green-400 hover:text-green-600 transition"
                          >
                            {option.value}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-0.5">
                      Duration
                    </label>
                    <input
                      type="text"
                      value={medicine.duration}
                      onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                      placeholder="e.g., 5 days"
                      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs"
                    />
                    {selectedSuggestion?.durationOptions?.length ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {getTopOptions(selectedSuggestion.durationOptions).map((option) => (
                          <button
                            type="button"
                            key={`${option.value}-duration`}
                            onClick={() => handleOptionChipClick(index, "duration", option.value)}
                            className="px-2 py-0.5 bg-white text-[10px] border border-gray-200 rounded-full hover:border-green-400 hover:text-green-600 transition"
                          >
                            {option.value}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
          
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addMedicine}
              className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-medium hover:bg-slate-200 transition flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add More
            </button>
          </div>
        </>
      )}
    </div>
  )
}

