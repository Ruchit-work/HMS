"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { MedicineSuggestion, sanitizeMedicineName } from "@/utils/medicineSuggestions"
import VoiceInput from "@/components/ui/VoiceInput"
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
  const [openFrequencyIndex, setOpenFrequencyIndex] = useState<number | null>(null)
  const frequencyDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openFrequencyIndex === null) return
    const handleClickOutside = (e: MouseEvent) => {
      if (frequencyDropdownRef.current && !frequencyDropdownRef.current.contains(e.target as Node)) {
        setOpenFrequencyIndex(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [openFrequencyIndex])

  const PRESET_DAYS = [3, 5, 7, 10, 14, 21] as const
  const parseDurationDays = (duration: string): { preset: number | "custom"; customDays: number } => {
    const n = parseInt(duration.replace(/\D/g, ""), 10)
    if (Number.isNaN(n) || n < 1) return { preset: 7, customDays: 7 }
    if (PRESET_DAYS.includes(n as typeof PRESET_DAYS[number])) return { preset: n as typeof PRESET_DAYS[number], customDays: n }
    return { preset: "custom", customDays: n }
  }
  const TIMES = ["Morning", "Afternoon", "Evening"] as const
  const parseFrequencyToSlots = (frequency: string): Record<string, string> => {
    if (!frequency?.trim()) return { Morning: "After meal" }
    const out: Record<string, string> = {}
    const parts = frequency.split(",").map((p) => p.trim()).filter(Boolean)
    for (const p of parts) {
      const [time, meal] = p.split(" - ").map((s) => s?.trim())
      if (time && TIMES.includes(time as typeof TIMES[number])) out[time] = meal || "After meal"
    }
    if (Object.keys(out).length === 0) return { Morning: "After meal" }
    return out
  }
  const buildFrequencyFromSlots = (slots: Record<string, string>) =>
    Object.entries(slots)
      .sort((a, b) => TIMES.indexOf(a[0] as typeof TIMES[number]) - TIMES.indexOf(b[0] as typeof TIMES[number]))
      .map(([time, meal]) => `${time} - ${meal}`)
      .join(", ")

  const addMedicine = () => {
    onMedicinesChange([...medicines, { name: "", dosage: "", frequency: "", duration: "" }])
  }

  const removeMedicine = (index: number) => {
    onMedicinesChange(medicines.filter((_, i) => i !== index))
  }

  const updateMedicine = (index: number, field: string, value: string) => {
    const updatedMedicines = [...medicines]
    const prev = updatedMedicines[index] || {}
    updatedMedicines[index] = { ...prev, [field]: value }
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
              <div key={index} className="relative">
                <div className="flex flex-wrap items-center gap-2 py-1.5 px-2 rounded border border-gray-200 bg-gray-50/80 hover:bg-gray-50">
                  <div className="relative flex-1 min-w-[100px] max-w-[180px]">
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
                            if (current?.appointmentId === appointmentId && current.index === index) return null
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
                        } else if (e.key === "ArrowDown" && nameSuggestions.length > 0) {
                          e.preventDefault()
                          document.querySelector<HTMLButtonElement>(`#suggestion-btn-${appointmentId}-${index}-0`)?.focus()
                        } else if (e.key === "Escape") {
                          setInlineSuggestion((prev) =>
                            prev?.appointmentId === appointmentId && prev.index === index ? null : prev
                          )
                        }
                      }}
                      placeholder="Name *"
                      className="w-full pl-2 pr-8 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                      required
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <VoiceInput
                        onTranscript={(text) => {
                          updateMedicine(index, "name", text)
                          updateInlineSuggestion(index, text)
                          setActiveNameSuggestion({ appointmentId, index })
                        }}
                        language="en-IN"
                        useGoogleCloud={false}
                        useMedicalModel={false}
                        variant="inline"
                      />
                    </div>
                    {inlineSuggestion?.appointmentId === appointmentId &&
                    inlineSuggestion?.index === index &&
                    inlineSuggestion?.suggestion?.toLowerCase().startsWith((medicine.name || "").toLowerCase()) ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center pl-2 pr-8 text-xs text-gray-400 select-none">
                        <span className="opacity-0">{(medicine.name || "").split("").map(() => "•").join("")}</span>
                        <span>{inlineSuggestion.suggestion.slice((medicine.name || "").length)}</span>
                      </div>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    id={`dosage-${appointmentId}-${index}`}
                    value={medicine.dosage}
                    onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                    placeholder="Dosage"
                    className="w-20 min-w-[72px] px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <div className="relative shrink-0" ref={openFrequencyIndex === index ? frequencyDropdownRef : undefined}>
                    <button
                      type="button"
                      onClick={() => setOpenFrequencyIndex(openFrequencyIndex === index ? null : index)}
                      className="flex items-center justify-between gap-2 min-w-[140px] px-2 py-1 border border-gray-300 rounded bg-white text-left text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <span className="text-gray-700 truncate">
                        {(() => {
                          const slots = parseFrequencyToSlots(medicine.frequency)
                          const selected = TIMES.filter((t) => t in slots)
                          return selected.length === 0 ? "None selected" : selected.join(", ")
                        })()}
                      </span>
                      <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openFrequencyIndex === index && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[180px] rounded border border-gray-200 bg-white py-1 shadow-lg">
                        {TIMES.map((time) => {
                          const slots = parseFrequencyToSlots(medicine.frequency)
                          const checked = time in slots
                          const meal = slots[time] || "After meal"
                          return (
                            <div key={time} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
                              <input
                                type="checkbox"
                                id={`freq-${appointmentId}-${index}-${time}`}
                                checked={checked}
                                onChange={(e) => {
                                  const next = { ...parseFrequencyToSlots(medicine.frequency) }
                                  if (e.target.checked) {
                                    next[time] = "After meal"
                                  } else {
                                    delete next[time]
                                  }
                                  if (Object.keys(next).length === 0) next["Morning"] = "After meal"
                                  updateMedicine(index, "frequency", buildFrequencyFromSlots(next))
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <label htmlFor={`freq-${appointmentId}-${index}-${time}`} className="flex-1 cursor-pointer text-xs text-gray-800">
                                {time}
                              </label>
                              {checked && (
                                <select
                                  value={meal}
                                  onChange={(e) => {
                                    const next = { ...parseFrequencyToSlots(medicine.frequency) }
                                    next[time] = e.target.value
                                    updateMedicine(index, "frequency", buildFrequencyFromSlots(next))
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded border border-gray-200 px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                  <option value="Before meal">Before meal</option>
                                  <option value="After meal">After meal</option>
                                </select>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {(() => {
                    const { preset, customDays } = parseDurationDays(medicine.duration)
                    const isCustom = preset === "custom"
                    return (
                      <div className="flex items-center gap-1 shrink-0">
                        <select
                          value={isCustom ? "custom" : String(preset)}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === "custom") updateMedicine(index, "duration", `${customDays || 7} days`)
                            else updateMedicine(index, "duration", `${v} days`)
                          }}
                          className="rounded border border-gray-300 pl-1.5 pr-7 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500 w-20"
                        >
                          {PRESET_DAYS.map((d) => (
                            <option key={d} value={d}>{d} days</option>
                          ))}
                          <option value="custom">Custom</option>
                        </select>
                        {isCustom && (
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={customDays || ""}
                            onChange={(e) => {
                              const n = parseInt(e.target.value, 10)
                              if (!Number.isNaN(n) && n >= 1) updateMedicine(index, "duration", `${n} days`)
                            }}
                            className="w-14 px-1.5 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="Days"
                          />
                        )}
                      </div>
                    )
                  })()}
                  <button
                    type="button"
                    onClick={() => removeMedicine(index)}
                    className="shrink-0 p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                    title="Remove medicine"
                    aria-label="Remove medicine"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                {showNameSuggestions && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-40 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {medicineSuggestionsLoading ? (
                      <div className="px-3 py-2 text-[11px] text-gray-500">Loading...</div>
                    ) : (
                      nameSuggestions.map((suggestion, suggestionIndex) => (
                        <button
                          type="button"
                          key={suggestion.id}
                          id={`suggestion-btn-${appointmentId}-${index}-${suggestionIndex}`}
                          className="w-full px-3 py-1.5 text-left hover:bg-green-50 transition text-[11px] first:rounded-t-lg last:rounded-b-lg"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSelectMedicineSuggestion(index, suggestion, { setFocusNext: true })
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleSelectMedicineSuggestion(index, suggestion, { setFocusNext: true })
                            } else if (e.key === "ArrowDown") {
                              const next = document.querySelector<HTMLButtonElement>(
                                `#suggestion-btn-${appointmentId}-${index}-${suggestionIndex + 1}`
                              )
                              if (next) { e.preventDefault(); next.focus() }
                            } else if (e.key === "ArrowUp") {
                              if (suggestionIndex === 0) {
                                e.preventDefault()
                                document.querySelector<HTMLInputElement>(`#name-${appointmentId}-${index}`)?.focus()
                              } else {
                                const prev = document.querySelector<HTMLButtonElement>(
                                  `#suggestion-btn-${appointmentId}-${index}-${suggestionIndex - 1}`
                                )
                                if (prev) { e.preventDefault(); prev.focus() }
                              }
                            }
                          }}
                        >
                          <span className="font-semibold text-gray-800">{suggestion.name}</span>
                          {suggestion.dosageOptions?.length ? (
                            <span className="text-gray-500 ml-1">— {suggestion.dosageOptions[0].value}</span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
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

