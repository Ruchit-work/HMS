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

const TIMES = ["Morning", "Afternoon", "Evening"] as const

function parseFrequencyToSlots(frequency: string): Record<string, string> {
  if (!frequency?.trim()) return { Morning: "After meal" }
  const out: Record<string, string> = {}
  const parts = frequency.split(",").map((p) => p.trim()).filter(Boolean)
  for (const p of parts) {
    const [time, meal] = p.split(" - ").map((s) => s?.trim())
    if (time && TIMES.includes(time as (typeof TIMES)[number])) out[time] = meal || "After meal"
  }
  if (Object.keys(out).length === 0) return { Morning: "After meal" }
  return out
}

function buildFrequencyFromSlots(slots: Record<string, string>): string {
  return Object.entries(slots)
    .sort((a, b) => TIMES.indexOf(a[0] as (typeof TIMES)[number]) - TIMES.indexOf(b[0] as (typeof TIMES)[number]))
    .map(([time, meal]) => `${time} - ${meal}`)
    .join(", ")
}

function parseDurationDays(duration: string): number {
  const n = parseInt(duration.replace(/\D/g, ""), 10)
  return Number.isNaN(n) || n < 1 ? 7 : Math.min(365, Math.max(1, n))
}

export default function MedicineForm({
  appointmentId,
  medicines,
  medicineSuggestions,
  medicineSuggestionsLoading,
  onMedicinesChange,
}: MedicineFormProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [nameDropdownOpenForIndex, setNameDropdownOpenForIndex] = useState<number | null>(null)
  const [frequencyOpenForIndex, setFrequencyOpenForIndex] = useState<number | null>(null)
  const frequencyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (frequencyOpenForIndex === null) return
    const handleClickOutside = (e: MouseEvent) => {
      if (frequencyRef.current && !frequencyRef.current.contains(e.target as Node)) {
        setFrequencyOpenForIndex(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [frequencyOpenForIndex])

  const addMedicine = () => {
    onMedicinesChange([...medicines, { name: "", dosage: "", frequency: "", duration: "" }])
  }

  const removeMedicine = (index: number) => {
    onMedicinesChange(medicines.filter((_, i) => i !== index))
    if (nameDropdownOpenForIndex === index) setNameDropdownOpenForIndex(null)
    else if (nameDropdownOpenForIndex !== null && nameDropdownOpenForIndex > index) {
      setNameDropdownOpenForIndex(nameDropdownOpenForIndex - 1)
    }
  }

  const updateMedicine = useCallback(
    (index: number, field: keyof CompletionFormEntry["medicines"][0], value: string) => {
      const next = [...medicines]
      const row = next[index] || { name: "", dosage: "", frequency: "", duration: "" }
      next[index] = { ...row, [field]: value }
      onMedicinesChange(next)
    },
    [medicines, onMedicinesChange]
  )

  const getSuggestions = useCallback(
    (query: string, limit = 8): MedicineSuggestion[] => {
      if (!medicineSuggestions.length) return []
      const q = query.trim().toLowerCase()
      if (!q) return medicineSuggestions.slice(0, limit)
      const starts = medicineSuggestions.filter((s) => s.name.toLowerCase().startsWith(q))
      const contains = medicineSuggestions.filter(
        (s) => !s.name.toLowerCase().startsWith(q) && s.name.toLowerCase().includes(q)
      )
      return [...starts, ...contains].slice(0, limit)
    },
    [medicineSuggestions]
  )

  const applySuggestion = useCallback(
    (index: number, suggestion: MedicineSuggestion) => {
      const name = sanitizeMedicineName(suggestion.name) || suggestion.name
      const row = medicines[index] || { name: "", dosage: "", frequency: "", duration: "" }
      const next = [...medicines]
      next[index] = {
        ...row,
        name,
        dosage: row.dosage?.trim() ? row.dosage : (suggestion.dosageOptions?.[0]?.value ?? ""),
        frequency: row.frequency?.trim() ? row.frequency : (suggestion.frequencyOptions?.[0]?.value ?? ""),
        duration: row.duration?.trim() ? row.duration : (suggestion.durationOptions?.[0]?.value ?? "7 days"),
      }
      onMedicinesChange(next)
      setNameDropdownOpenForIndex(null)
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>(`#dosage-${appointmentId}-${index}`)?.focus()
      })
    },
    [medicines, onMedicinesChange, appointmentId]
  )

  return (
    <div className="space-y-3">
      {/* Global medicine search with autocomplete */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-slate-600">Search medicines</label>
        </div>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                const q = searchQuery.trim()
                if (!q) return
                const matches = getSuggestions(q, 1)
                let newMed
                if (matches.length > 0) {
                  const sugg = matches[0]
                  const name = sanitizeMedicineName(sugg.name) || sugg.name
                  newMed = {
                    name,
                    dosage: sugg.dosageOptions?.[0]?.value ?? "",
                    frequency: sugg.frequencyOptions?.[0]?.value ?? "",
                    duration: sugg.durationOptions?.[0]?.value ?? "7 days",
                  }
                } else {
                  const name = sanitizeMedicineName(q) || q
                  newMed = {
                    name,
                    dosage: "",
                    frequency: "",
                    duration: "7 days",
                  }
                }
                onMedicinesChange([...medicines, newMed])
                setSearchQuery("")
              }
            }}
            placeholder="Search by medicine name and press Enter to add..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-3 pr-8 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-auto">
            <VoiceInput
              onTranscript={(text) => {
                setSearchQuery(text)
              }}
              language="en-IN"
              useGoogleCloud={false}
              useMedicalModel={false}
              variant="inline"
            />
          </div>
          {searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full z-[90] mt-1 max-h-52 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {medicineSuggestionsLoading ? (
                <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>
              ) : (
                (() => {
                  const matches = getSuggestions(searchQuery, 8)
                  if (!matches.length) {
                    return (
                      <div className="px-3 py-2 text-xs text-slate-500">
                        No matches. Press Enter to add manually.
                      </div>
                    )
                  }
                  return matches.map((sugg) => (
                    <button
                      key={sugg.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        const name = sanitizeMedicineName(sugg.name) || sugg.name
                        const newMed = {
                          name,
                          dosage: sugg.dosageOptions?.[0]?.value ?? "",
                          frequency: sugg.frequencyOptions?.[0]?.value ?? "",
                          duration: sugg.durationOptions?.[0]?.value ?? "7 days",
                        }
                        onMedicinesChange([...medicines, newMed])
                        setSearchQuery("")
                      }}
                    >
                      <span className="font-medium">{sugg.name}</span>
                      {sugg.dosageOptions?.[0] && (
                        <span className="text-slate-500 ml-1">
                          — {sugg.dosageOptions[0].value}
                        </span>
                      )}
                    </button>
                  ))
                })()
              )}
            </div>
          )}
        </div>
        {medicines.length === 0 && (
          <p className="text-[11px] text-slate-500 px-1">
            Type a medicine name and press Enter to add.
          </p>
        )}
      </div>

      {/* Header row for added medicines */}
      {medicines.length > 0 && (
        <div className="hidden sm:flex items-center text-[11px] font-medium text-slate-500 px-4 mt-1">
          <div className="flex-1 min-w-[120px] max-w-[200px]">Medicine Name</div>
          <div className="w-20 min-w-[72px]">Dose</div>
          <div className="min-w-[140px]">Time</div>
          <div className="w-16 text-right">Duration</div>
          <div className="w-10 text-right">Remove</div>
        </div>
      )}

      {medicines.map((medicine, index) => {
        const nameQuery = medicine.name?.trim() ?? ""
        const suggestions = getSuggestions(nameQuery)
        const showNameDropdown =
          nameDropdownOpenForIndex === index && (nameQuery.length >= 1 || suggestions.length > 0)

        return (
          <div key={index} className="relative">
            <div className="flex flex-wrap items-center gap-3 py-3 px-4 rounded-[10px] border border-[#E2E8F0] bg-white hover:bg-slate-50/80 transition-colors">
              {/* Name + dropdown */}
              <div className="relative flex-1 min-w-[120px] max-w-[200px]">
                    <input
                      type="text"
                      id={`name-${appointmentId}-${index}`}
                      value={medicine.name}
                      onChange={(e) => updateMedicine(index, "name", e.target.value)}
                      onFocus={() => setNameDropdownOpenForIndex(index)}
                      onBlur={() => {
                        setTimeout(() => setNameDropdownOpenForIndex(null), 180)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setNameDropdownOpenForIndex(null)
                        if (e.key === "ArrowDown" && showNameDropdown && suggestions.length > 0) {
                          e.preventDefault()
                          const first = document.querySelector<HTMLButtonElement>(
                            `[data-suggestion-index="${index}"]`
                          )
                          first?.focus()
                        }
                      }}
                      placeholder="Name *"
                      className="w-full pl-2 pr-9 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
                      required
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-auto">
                      <VoiceInput
                        onTranscript={(text) => {
                          updateMedicine(index, "name", text)
                          setNameDropdownOpenForIndex(index)
                        }}
                        language="en-IN"
                        useGoogleCloud={false}
                        useMedicalModel={false}
                        variant="inline"
                      />
                    </div>
                    {/* Dropdown list - render in a way that click always applies value */}
                    {showNameDropdown && (
                      <div
                        className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {medicineSuggestionsLoading ? (
                          <div className="px-3 py-2 text-xs text-slate-500">Loading…</div>
                        ) : suggestions.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-500">
                            {nameQuery ? "No match. Type to search or enter manually." : "Type to search medicines."}
                          </div>
                        ) : (
                          suggestions.map((suggestion, si) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              data-suggestion-index={index}
                              className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none first:rounded-t-md last:rounded-b-md"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                applySuggestion(index, suggestion)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  applySuggestion(index, suggestion)
                                }
                              }}
                            >
                              <span className="font-medium">{suggestion.name}</span>
                              {suggestion.dosageOptions?.[0] && (
                                <span className="text-slate-500 ml-1">— {suggestion.dosageOptions[0].value}</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dosage */}
                  <input
                    type="text"
                    id={`dosage-${appointmentId}-${index}`}
                    value={medicine.dosage}
                    onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                    placeholder="Dosage"
                    className="w-20 min-w-[72px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  />

                  {/* Frequency */}
                  <div className="relative shrink-0" ref={frequencyOpenForIndex === index ? frequencyRef : undefined}>
                    <button
                      type="button"
                      onClick={() => setFrequencyOpenForIndex(frequencyOpenForIndex === index ? null : index)}
                      className="flex items-center justify-between gap-2 min-w-[140px] px-2 py-1.5 border border-gray-300 rounded bg-white text-left text-[11px] focus:outline-none focus:ring-2 focus:ring-green-500/40"
                    >
                      <div className="flex items-center gap-1">
                        {TIMES.map((time) => {
                          const slots = parseFrequencyToSlots(medicine.frequency)
                          const checked = time in slots
                          const label = time === "Evening" ? "Night" : time
                          return (
                            <span
                              key={time}
                              className={`inline-flex items-center rounded-full px-2 py-0.5 border ${
                                checked
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                  : "bg-slate-50 border-slate-200 text-slate-500"
                              }`}
                            >
                              {label}
                            </span>
                          )
                        })}
                      </div>
                      <svg className="w-4 h-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {frequencyOpenForIndex === index && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
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
                                  if (e.target.checked) next[time] = "After meal"
                                  else delete next[time]
                                  if (Object.keys(next).length === 0) next["Morning"] = "After meal"
                                  updateMedicine(index, "frequency", buildFrequencyFromSlots(next))
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              <label
                                htmlFor={`freq-${appointmentId}-${index}-${time}`}
                                className="flex-1 cursor-pointer text-xs text-gray-800"
                              >
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
                                  className="rounded border border-gray-200 px-1.5 py-0.5 text-[11px]"
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

                  {/* Duration (days) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={parseDurationDays(medicine.duration)}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10)
                        if (!Number.isNaN(n) && n >= 1) {
                          updateMedicine(index, "duration", `${Math.min(365, n)} days`)
                        }
                      }}
                      className="w-14 px-1.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-green-500/40 text-right"
                      aria-label="Duration in days"
                    />
                    <span className="text-xs text-slate-600 font-medium whitespace-nowrap">days</span>
                  </div>

                  {/* Remove */}
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
              </div>
            )
      })}

      {medicines.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={addMedicine}
            className="h-8 px-3 rounded-full border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Manual row
          </button>
        </div>
      )}
    </div>
  )
}
