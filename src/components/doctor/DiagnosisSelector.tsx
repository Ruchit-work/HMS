"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { ENT_DIAGNOSES, CUSTOM_DIAGNOSIS_OPTION, searchDiagnoses, EntDiagnosis } from "@/constants/entDiagnoses"

interface DiagnosisSelectorProps {
  selectedDiagnoses: string[]
  customDiagnosis?: string
  onDiagnosesChange: (diagnoses: string[]) => void
  onCustomDiagnosisChange: (customDiagnosis: string) => void
  readOnly?: boolean
  showPatientComplaints?: string // Patient-reported symptoms/complaints (read-only)
  error?: string
}

export default function DiagnosisSelector({
  selectedDiagnoses,
  customDiagnosis = "",
  onDiagnosesChange,
  onCustomDiagnosisChange,
  readOnly = false,
  showPatientComplaints,
  error
}: DiagnosisSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Check if custom diagnosis option is selected
  useEffect(() => {
    setShowCustomInput(selectedDiagnoses.includes(CUSTOM_DIAGNOSIS_OPTION))
  }, [selectedDiagnoses])

  // Filter diagnoses based on search query
  const filteredDiagnoses = useMemo(() => {
    if (!searchQuery.trim()) {
      return ENT_DIAGNOSES
    }
    return searchDiagnoses(searchQuery)
  }, [searchQuery])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isDropdownOpen])

  const toggleDiagnosis = (diagnosisName: string) => {
    if (readOnly) return

    if (selectedDiagnoses.includes(diagnosisName)) {
      // Remove diagnosis
      const updated = selectedDiagnoses.filter(d => d !== diagnosisName)
      onDiagnosesChange(updated)
      
      // If removing custom diagnosis option, clear custom text
      if (diagnosisName === CUSTOM_DIAGNOSIS_OPTION) {
        onCustomDiagnosisChange("")
      }
    } else {
      // Add diagnosis
      onDiagnosesChange([...selectedDiagnoses, diagnosisName])
    }
  }

  const handleCustomDiagnosisToggle = () => {
    if (readOnly) return
    toggleDiagnosis(CUSTOM_DIAGNOSIS_OPTION)
  }

  const getCategoryLabel = (category: EntDiagnosis["category"]) => {
    switch (category) {
      case "ear": return "Ear"
      case "nose": return "Nose"
      case "throat": return "Throat"
      default: return "General"
    }
  }

  const getCategoryColor = (category: EntDiagnosis["category"]) => {
    switch (category) {
      case "ear": return "bg-blue-50 border-blue-200 text-blue-700"
      case "nose": return "bg-green-50 border-green-200 text-green-700"
      case "throat": return "bg-red-50 border-red-200 text-red-700"
      default: return "bg-gray-50 border-gray-200 text-gray-700"
    }
  }

  return (
    <div className="space-y-4">
      {/* Patient Complaints Section (Read-only) */}
      {showPatientComplaints && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 mb-1">Patient Complaints</h4>
              <p className="text-sm text-amber-800">{showPatientComplaints || "No complaints recorded"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnosis Selection Section */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Final Diagnosis <span className="text-red-500">*</span>
        </label>
        
        {!readOnly && (
          <div className="relative" ref={dropdownRef}>
            {/* Search Input */}
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setIsDropdownOpen(true)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search diagnoses..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Dropdown */}
            {isDropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {filteredDiagnoses.length > 0 ? (
                  <div className="p-2">
                    {filteredDiagnoses.map((diagnosis) => {
                      const isSelected = selectedDiagnoses.includes(diagnosis.name)
                      return (
                        <button
                          key={diagnosis.code}
                          type="button"
                          onClick={() => {
                            toggleDiagnosis(diagnosis.name)
                            setSearchQuery("")
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                            isSelected
                              ? "bg-blue-100 text-blue-900 font-medium"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className="flex-1">{diagnosis.name}</span>
                          <span className="text-xs text-slate-400">{diagnosis.code}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No diagnoses found
                  </div>
                )}
                
                {/* Custom Diagnosis Option */}
                <div className="border-t border-slate-200 p-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleCustomDiagnosisToggle()
                      setSearchQuery("")
                      setIsDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                      selectedDiagnoses.includes(CUSTOM_DIAGNOSIS_OPTION)
                        ? "bg-purple-100 text-purple-900 font-medium"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedDiagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) ? "bg-purple-600 border-purple-600" : "border-slate-300"
                    }`}>
                      {selectedDiagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1">Other / Custom Diagnosis</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected Diagnoses Display */}
        {selectedDiagnoses.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {selectedDiagnoses
                .filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)
                .map((diagnosisName) => {
                  const diagnosis = ENT_DIAGNOSES.find(d => d.name === diagnosisName)
                  return (
                    <div
                      key={diagnosisName}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                        diagnosis ? getCategoryColor(diagnosis.category) : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      <span className="font-medium">{diagnosisName}</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => toggleDiagnosis(diagnosisName)}
                          className="ml-1 text-slate-500 hover:text-red-600 transition-colors"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>

            {/* Custom Diagnosis Input */}
            {showCustomInput && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Custom Diagnosis Details
                </label>
                <textarea
                  value={customDiagnosis}
                  onChange={(e) => onCustomDiagnosisChange(e.target.value)}
                  disabled={readOnly}
                  placeholder="Enter custom diagnosis..."
                  rows={2}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
                    readOnly ? "bg-slate-50 text-slate-500 cursor-not-allowed" : ""
                  }`}
                />
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <p className="mt-2 text-sm text-red-600 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </p>
        )}

        {/* Helper Text */}
        {!readOnly && selectedDiagnoses.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Select one or more diagnoses. Use search to quickly find common ENT conditions.
          </p>
        )}
      </div>
    </div>
  )
}

