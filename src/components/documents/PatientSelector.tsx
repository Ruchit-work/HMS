'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { auth } from "@/firebase/config"
import { getDocs } from "firebase/firestore"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import VoiceInput from "@/components/ui/VoiceInput"

interface Patient {
  id: string
  uid: string
  patientId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}

interface PatientSelectorProps {
  onPatientSelect: (patient: Patient | null) => void
  selectedPatient?: Patient | null
  className?: string
}

export default function PatientSelector({
  onPatientSelect,
  selectedPatient,
  className = "",
}: PatientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const { activeHospitalId } = useMultiHospital()
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const searchPatients = useCallback(async (searchTerm: string) => {
    if (!activeHospitalId) {
      return
    }

    setLoading(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in")
      }

      const searchTermLower = searchTerm.toLowerCase()

      // Search patients from hospital collection
      const patientsRef = getHospitalCollection(activeHospitalId, "patients")
      
      // Fetch all patients and filter client-side (more flexible than Firestore queries)
      // This allows searching across multiple fields
      const allPatientsSnapshot = await getDocs(patientsRef)
      const patientMap = new Map<string, Patient>()

      allPatientsSnapshot.forEach((doc) => {
        const data = doc.data()
        const patientId = data.patientId || doc.id
        const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim().toLowerCase()
        const email = (data.email || "").toLowerCase()
        const phone = (data.phone || "").toLowerCase()
        const patientIdLower = (patientId || "").toLowerCase()

        // Client-side filter for better matching
        if (
          fullName.includes(searchTermLower) ||
          email.includes(searchTermLower) ||
          phone.includes(searchTermLower) ||
          patientIdLower.includes(searchTermLower)
        ) {
          if (!patientMap.has(doc.id) && patientMap.size < 20) {
            patientMap.set(doc.id, {
              id: doc.id,
              uid: doc.id,
              patientId: patientId,
              firstName: data.firstName || "",
              lastName: data.lastName || "",
              email: data.email || "",
              phone: data.phone || "",
            })
          }
        }
      })

      const patientList = Array.from(patientMap.values())
      setPatients(patientList)
      setShowSuggestions(patientList.length > 0)
    } catch {
      setPatients([])
      setShowSuggestions(false)
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId])

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      searchPatients(searchQuery.trim())
    } else {
      setPatients([])
      setShowSuggestions(false)
    }
  }, [searchQuery, activeHospitalId, searchPatients])

  const handleSelectPatient = (patient: Patient) => {
    setSearchQuery(`${patient.firstName} ${patient.lastName}`.trim())
    setShowSuggestions(false)
    onPatientSelect(patient)
    // Blur the input to prevent it from staying focused
    if (inputRef.current) {
      inputRef.current.blur()
    }
  }

  const handleClear = () => {
    setSearchQuery("")
    setPatients([])
    setShowSuggestions(false)
    onPatientSelect(null)
  }

  useEffect(() => {
    if (selectedPatient) {
      setSearchQuery(`${selectedPatient.firstName} ${selectedPatient.lastName}`.trim())
    }
  }, [selectedPatient])

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Search Patient
      </label>
      <div className="relative">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (patients.length > 0) {
                setShowSuggestions(true)
              }
            }}
            onBlur={(e) => {
              const relatedTarget = e.relatedTarget as HTMLElement
              if (suggestionsRef.current && suggestionsRef.current.contains(relatedTarget)) {
                return
              }
              setTimeout(() => {
                if (!suggestionsRef.current?.contains(document.activeElement)) {
                  setShowSuggestions(false)
                }
              }, 150)
            }}
            placeholder="Search by name, email, phone, or patient ID"
            className="w-full rounded-md border border-gray-300 pl-3 pr-11 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {selectedPatient && !loading && (
            <button
              onClick={handleClear}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              type="button"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {loading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-end">
            <div className="pointer-events-auto">
              <VoiceInput
                onTranscript={(text) => {
                  setSearchQuery(text)
                  if (text.trim().length >= 2) {
                    setShowSuggestions(true)
                  }
                }}
                language="en-IN"
                useMedicalModel={false}
                variant="inline"
              />
            </div>
          </div>
        </div>
      </div>

      {showSuggestions && patients.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto"
        >
          {patients.map((patient) => (
            <button
              key={patient.id}
              type="button"
              onMouseDown={(e) => {
                // Prevent the input from losing focus when clicking
                e.preventDefault()
                handleSelectPatient(patient)
              }}
              onClick={(e) => {
                // Also handle click as a fallback
                e.preventDefault()
                handleSelectPatient(patient)
              }}
              className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {patient.email && <span>📧 {patient.email}</span>}
                    {patient.phone && <span>📞 {patient.phone}</span>}
                    <span>ID: {patient.patientId}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPatient && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm font-medium text-blue-900">
            Selected: {selectedPatient.firstName} {selectedPatient.lastName}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Patient ID: {selectedPatient.patientId} | UID: {selectedPatient.uid}
          </p>
        </div>
      )}
    </div>
  )
}

