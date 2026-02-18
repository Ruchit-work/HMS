"use client"

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import ENTAnatomyViewer from '@/components/doctor/anatomy/ENTAnatomyViewer'
import InteractiveEarSVG from '@/components/doctor/anatomy/svg/InteractiveEarSVG'
import { earPartsData, type Disease } from '@/constants/earDiseases'
import { completeAppointment } from '@/utils/appointmentHelpers'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/firebase/config'
import { ENT_DIAGNOSES, CUSTOM_DIAGNOSIS_OPTION } from '@/constants/entDiagnoses'
import Notification from '@/components/ui/feedback/Notification'
import { doc, getDoc } from 'firebase/firestore'
import { getHospitalCollection } from '@/utils/firebase/hospital-queries'
import DiagnosisSelector from '@/components/doctor/DiagnosisSelector'
import { fetchMedicineSuggestions, MedicineSuggestion, sanitizeMedicineName } from '@/utils/medicineSuggestions'


// Dynamically import to avoid SSR issues
const DynamicENTAnatomyViewer = dynamic(
  () => Promise.resolve(ENTAnatomyViewer),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-slate-600">Loading 3D Anatomy Model...</div>
      </div>
    )
  }
)

function ENTAnatomyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('appointmentId')
  const patientName = searchParams.get('patientName') || 'Patient'
  const isInline = searchParams.get('inline') === 'true'
  const { activeHospitalId } = useMultiHospital()
  const { user } = useAuth("doctor")
  
  // Check if we're in an iframe
  const [isInIframe, setIsInIframe] = useState(false)
  
  useEffect(() => {
    setIsInIframe(window.self !== window.top)
  }, [])
  
  const handleClose = () => {
    if (isInIframe || isInline) {
      // Send message to parent to close
      if (window.parent && appointmentId) {
        window.parent.postMessage({ type: 'close-anatomy-viewer', appointmentId }, '*')
      }
    } else {
      router.back()
    }
  }
  const [completing, setCompleting] = useState(false)
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [finalDiagnosis, setFinalDiagnosis] = useState<string[]>([])
  const [customDiagnosis, setCustomDiagnosis] = useState('')
  const [medicineSuggestions, setMedicineSuggestions] = useState<MedicineSuggestion[]>([])
  const [activeNameSuggestion, setActiveNameSuggestion] = useState<{ section: '3d' | '2d', index: number } | null>(null)
  const [inlineSuggestion, setInlineSuggestion] = useState<{ section: '3d' | '2d', index: number, suggestion: string } | null>(null)
  const [activeView, setActiveView] = useState<'3d' | '2d'>('3d') // Toggle between 3D and 2D views
  
  // State for 3D model section
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [selectedPartInfo, setSelectedPartInfo] = useState<{ name: string; description: string } | null>(null)
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null)
  const [notes, setNotes] = useState('')
  const [selectedMedicines, setSelectedMedicines] = useState<Array<{
    name: string
    dosage: string
    frequency: string
    duration: string
  }>>([])

  // Separate state for 2D SVG section
  const [selectedPart2D, setSelectedPart2D] = useState<string | null>(null)
  const [selectedPartInfo2D, setSelectedPartInfo2D] = useState<{ name: string; description: string } | null>(null)
  const [selectedDisease2D, setSelectedDisease2D] = useState<Disease | null>(null)
  const [notes2D, setNotes2D] = useState('')
  const [selectedMedicines2D, setSelectedMedicines2D] = useState<Array<{
    name: string
    dosage: string
    frequency: string
    duration: string
  }>>([])

  // Map generic object names to real part names used in earPartsData
  const mapToRealPartName = (partName: string | null): string | null => {
    if (!partName) return null
    
    const mapping: Record<string, string> = {
      // Object with spaces
      'Object 1': 'Outer_Ear',
      'Object 2': 'Ear_Canal',
      'Object 3': 'Eardrum',
      'Object 4': 'Ossicles',
      'Object 5': 'Cochlea',
      'Object 6': 'Semicircular_Canals',
      'Object 7': 'Auditory_Nerve',
      'object 1': 'Outer_Ear',
      'object 2': 'Ear_Canal',
      'object 3': 'Eardrum',
      'object 4': 'Ossicles',
      'object 5': 'Cochlea',
      'object 6': 'Semicircular_Canals',
      'object 7': 'Auditory_Nerve',
      // Object with underscores (Object_1, Object_10, etc.)
      'Object_1': 'Outer_Ear',
      'Object_2': 'Ear_Canal',
      'Object_3': 'Eardrum',
      'Object_4': 'Ossicles',
      'Object_5': 'Cochlea',
      'Object_6': 'Semicircular_Canals',
      'Object_7': 'Auditory_Nerve',
      'Object_10': 'Outer_Ear',
      'Object_11': 'Ear_Canal',
      'Object_12': 'Eardrum',
      'Object_13': 'Ossicles',
      'Object_14': 'Cochlea',
      'Object_15': 'Semicircular_Canals',
      'Object_16': 'Auditory_Nerve',
      'object_1': 'Outer_Ear',
      'object_2': 'Ear_Canal',
      'object_3': 'Eardrum',
      'object_4': 'Ossicles',
      'object_5': 'Cochlea',
      'object_6': 'Semicircular_Canals',
      'object_7': 'Auditory_Nerve',
      'object_10': 'Outer_Ear',
      'object_11': 'Ear_Canal',
      'object_12': 'Eardrum',
      'object_13': 'Ossicles',
      'object_14': 'Cochlea',
      'object_15': 'Semicircular_Canals',
      'object_16': 'Auditory_Nerve',
      'mesh_1': 'Outer_Ear',
      'mesh_2': 'Ear_Canal',
      'mesh_3': 'Eardrum',
      'mesh_4': 'Ossicles',
      'mesh_5': 'Cochlea',
      'mesh_6': 'Semicircular_Canals',
      'mesh_7': 'Auditory_Nerve',
      'Mesh_1': 'Outer_Ear',
      'Mesh_2': 'Ear_Canal',
      'Mesh_3': 'Eardrum',
      'Mesh_4': 'Ossicles',
      'Mesh_5': 'Cochlea',
      'Mesh_6': 'Semicircular_Canals',
      'Mesh_7': 'Auditory_Nerve',
    }
    
    // Try to extract number from Object_X or Object X format and map it
    const objectMatch = partName.match(/^[Oo]bject[_ ]?(\d+)$/i)
    if (objectMatch && !mapping[partName]) {
      const objectNumber = parseInt(objectMatch[1], 10)
      // Map object numbers to ear parts (1-7 for standard parts, 10-16 for extended numbering)
      const partMapping: Record<number, string> = {
        1: 'Outer_Ear',
        2: 'Ear_Canal',
        3: 'Eardrum',
        4: 'Ossicles',
        5: 'Cochlea',
        6: 'Semicircular_Canals',
        7: 'Auditory_Nerve',
        10: 'Outer_Ear',
        11: 'Ear_Canal',
        12: 'Eardrum',
        13: 'Ossicles',
        14: 'Cochlea',
        15: 'Semicircular_Canals',
        16: 'Auditory_Nerve',
      }
      
      if (partMapping[objectNumber]) {
        return partMapping[objectNumber]
      }
    }
    
    // If it's a mapped name, return the real part name
    if (mapping[partName]) {
      return mapping[partName]
    }
    
    // If it's already a real part name (exists in earPartsData), return as is
    if (earPartsData[partName]) {
      return partName
    }
    
    // Try case-insensitive match
    const lowerName = partName.toLowerCase()
    for (const key in earPartsData) {
      if (key.toLowerCase() === lowerName) {
        return key
      }
    }
    
    // Return original if no mapping found
    return partName
  }

  const handlePartSelect = (partName: string | null, partInfo?: { name: string; description: string }) => {
    // Map generic name to real part name
    const realPartName = mapToRealPartName(partName)
    setSelectedPart(realPartName)
    
    // If we have real part data, use that instead of the generic partInfo
    if (realPartName && earPartsData[realPartName]) {
      setSelectedPartInfo({
        name: earPartsData[realPartName].partName,
        description: earPartsData[realPartName].description
      })
    } else {
      setSelectedPartInfo(partInfo || null)
    }
    
    setSelectedDisease(null) // Reset disease when part changes
    setSelectedMedicines([]) // Reset medicines
  }

  const handleDiseaseSelect = (disease: Disease) => {
    setSelectedDisease(disease)
    // Initialize with disease medicines, but allow editing
    setSelectedMedicines(disease.medicines ? [...disease.medicines] : [])
  }

  // Helper function to add a new medicine (3D section)
  const addMedicine = () => {
    setSelectedMedicines([...selectedMedicines, { name: "", dosage: "", frequency: "", duration: "" }])
  }

  // Helper function to remove a medicine (3D section)
  const removeMedicine = (index: number) => {
    setSelectedMedicines(selectedMedicines.filter((_, i) => i !== index))
  }

  // Helper function to update a medicine field (3D section)
  const updateMedicine = (index: number, field: string, value: string) => {
    const updatedMedicines = [...selectedMedicines]
    updatedMedicines[index] = { ...updatedMedicines[index], [field]: value }
    setSelectedMedicines(updatedMedicines)
    
    // Update inline suggestion when name changes
    if (field === 'name') {
      updateInlineSuggestion('3d', index, value)
    }
  }

  // Load medicine suggestions
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const suggestions = await fetchMedicineSuggestions(100)
        setMedicineSuggestions(suggestions)
      } catch {

      }
    }
    loadSuggestions()
  }, [])

  // Get medicine name suggestions
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

  // Find suggestion by name
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

  // Update inline suggestion
  const updateInlineSuggestion = useCallback(
    (section: '3d' | '2d', index: number, value: string) => {
      const cleanedValue = value.trim()
      if (cleanedValue.length < 1) {
        setInlineSuggestion((prev) =>
          prev?.section === section && prev.index === index ? null : prev
        )
        return
      }

      const bestMatch = getMedicineNameSuggestions(cleanedValue, 1)[0]
      if (bestMatch && bestMatch.name.toLowerCase().startsWith(cleanedValue.toLowerCase())) {
        setInlineSuggestion({
          section,
          index,
          suggestion: bestMatch.name
        })
      } else {
        setInlineSuggestion((prev) =>
          prev?.section === section && prev.index === index ? null : prev
        )
      }
    },
    [getMedicineNameSuggestions]
  )

  // Accept inline suggestion
  const acceptInlineSuggestion = (section: '3d' | '2d', index: number) => {
    if (inlineSuggestion?.section === section && inlineSuggestion.index === index) {
      const suggestion = findSuggestionByName(inlineSuggestion.suggestion)
      if (suggestion) {
        handleSelectMedicineSuggestion(section, index, suggestion)
      }
    }
  }

  // Handle selecting a medicine suggestion
  const handleSelectMedicineSuggestion = (section: '3d' | '2d', index: number, suggestion: MedicineSuggestion) => {
    const sanitizedName = sanitizeMedicineName(suggestion.name)
    
    if (section === '3d') {
      const updatedMedicines = [...selectedMedicines]
      updatedMedicines[index] = {
        ...updatedMedicines[index],
        name: sanitizedName || suggestion.name
      }
      
      // Auto-fill dosage, frequency, duration if empty
      if (!updatedMedicines[index].dosage && suggestion.dosageOptions?.length) {
        updatedMedicines[index].dosage = suggestion.dosageOptions[0].value
      }
      if (!updatedMedicines[index].frequency && suggestion.frequencyOptions?.length) {
        updatedMedicines[index].frequency = suggestion.frequencyOptions[0].value
      }
      if (!updatedMedicines[index].duration && suggestion.durationOptions?.length) {
        updatedMedicines[index].duration = suggestion.durationOptions[0].value
      }
      
      setSelectedMedicines(updatedMedicines)
    } else {
      const updatedMedicines = [...selectedMedicines2D]
      updatedMedicines[index] = {
        ...updatedMedicines[index],
        name: sanitizedName || suggestion.name
      }
      
      // Auto-fill dosage, frequency, duration if empty
      if (!updatedMedicines[index].dosage && suggestion.dosageOptions?.length) {
        updatedMedicines[index].dosage = suggestion.dosageOptions[0].value
      }
      if (!updatedMedicines[index].frequency && suggestion.frequencyOptions?.length) {
        updatedMedicines[index].frequency = suggestion.frequencyOptions[0].value
      }
      if (!updatedMedicines[index].duration && suggestion.durationOptions?.length) {
        updatedMedicines[index].duration = suggestion.durationOptions[0].value
      }
      
      setSelectedMedicines2D(updatedMedicines)
    }
    
    setActiveNameSuggestion(null)
    setInlineSuggestion(null)
  }

  // Separate handlers for 2D SVG section
  const handlePartSelect2D = (partName: string | null, partInfo?: { name: string; description: string }) => {
    const realPartName = mapToRealPartName(partName)
    setSelectedPart2D(realPartName)
    
    if (realPartName && earPartsData[realPartName]) {
      setSelectedPartInfo2D({
        name: earPartsData[realPartName].partName,
        description: earPartsData[realPartName].description
      })
    } else {
      setSelectedPartInfo2D(partInfo || null)
    }
    
    setSelectedDisease2D(null)
    setSelectedMedicines2D([])
  }

  const handleDiseaseSelect2D = (disease: Disease) => {
    setSelectedDisease2D(disease)
    // Initialize with disease medicines, but allow editing
    setSelectedMedicines2D(disease.medicines ? [...disease.medicines] : [])
  }

  // Helper function to add a new medicine (2D section)
  const addMedicine2D = () => {
    setSelectedMedicines2D([...selectedMedicines2D, { name: "", dosage: "", frequency: "", duration: "" }])
  }

  // Helper function to remove a medicine (2D section)
  const removeMedicine2D = (index: number) => {
    setSelectedMedicines2D(selectedMedicines2D.filter((_, i) => i !== index))
  }

  // Helper function to update a medicine field (2D section)
  const updateMedicine2D = (index: number, field: string, value: string) => {
    const updatedMedicines = [...selectedMedicines2D]
    updatedMedicines[index] = { ...updatedMedicines[index], [field]: value }
    setSelectedMedicines2D(updatedMedicines)
    
    // Update inline suggestion when name changes
    if (field === 'name') {
      updateInlineSuggestion('2d', index, value)
    }
  }

  // Helper function to get number emoji
  const getNumberEmoji = (num: number): string => {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
    return num <= 10 ? emojis[num - 1] : `${num}.`
  }

  // Helper function to format medicines as text for storage
  const formatMedicinesAsText = (medicines: Array<{name: string, dosage: string, frequency: string, duration: string}>, notes?: string): string => {
    if (medicines.length === 0) return ""
    
    let prescriptionText = "🧾 *Prescription*\n\n"
    
    medicines.forEach((med, index) => {
      const emoji = getNumberEmoji(index + 1)
      const name = med.name || 'Medicine'
      const dosage = med.dosage ? ` ${med.dosage}` : ''
      
      prescriptionText += `*${emoji} ${name}${dosage}*\n\n`
      
      // Format frequency line
      if (med.frequency) {
        prescriptionText += `• ${med.frequency}\n`
      }
      
      // Format duration line
      if (med.duration) {
        // Ensure "Duration:" prefix is added if not already present
        const durationText = med.duration.toLowerCase().includes('duration:') ? med.duration : `Duration: ${med.duration}`
        prescriptionText += `• ${durationText}\n`
      }
      
      prescriptionText += `\n`
    })
    
    // Add advice section if notes are provided
    if (notes && notes.trim()) {
      prescriptionText += `📌 *Advice:* ${notes.trim()}\n`
    }
    
    return prescriptionText.trim()
  }

  // Map disease name to diagnosis
  const mapDiseaseToDiagnosis = (disease: Disease | null): string[] => {
    if (!disease) return []
    
    // Try to find matching diagnosis in ENT_DIAGNOSES
    const matchingDiagnosis = ENT_DIAGNOSES.find(d => 
      d.name.toLowerCase() === disease.name.toLowerCase() ||
      disease.name.toLowerCase().includes(d.name.toLowerCase()) ||
      d.name.toLowerCase().includes(disease.name.toLowerCase())
    )
    
    if (matchingDiagnosis) {
      return [matchingDiagnosis.name]
    }
    
    // If no match found, use disease name as custom diagnosis
    return [disease.name]
  }

  const handleCompleteCheckup = async () => {
    if (!appointmentId) {
      setNotification({ type: "error", message: "Appointment ID is missing" })
      return
    }

    if (!activeHospitalId) {
      setNotification({ type: "error", message: "Hospital context is not available. Please refresh the page." })
      return
    }

    // Merge medicines from both 3D and 2D sections (if 2D section has data, prefer it; otherwise use 3D)
    const finalMedicines = selectedMedicines2D.length > 0 ? selectedMedicines2D : selectedMedicines
    const finalDisease = selectedDisease2D || selectedDisease
    const finalPartInfo = selectedPartInfo2D || selectedPartInfo
    const finalNotes = notes2D || notes

    // Validate that we have at least one medicine with a name
    if (finalMedicines.length === 0 || !finalMedicines.some(med => med.name && med.name.trim())) {
      setNotification({ type: "error", message: "Please add at least one medicine with a name before completing the checkup" })
      return
    }

    // Note: Disease selection is optional - doctors can add custom medicines without selecting a disease

    setCompleting(true)
    setNotification(null)

    try {
      // Format medicines as text
      const medicineText = formatMedicinesAsText(finalMedicines)

      // Build comprehensive notes
      const notesParts: string[] = []
      
      if (finalPartInfo) {
        notesParts.push(`Selected Anatomy Part: ${finalPartInfo.name}`)
        if (finalPartInfo.description) {
          notesParts.push(`Part Description: ${finalPartInfo.description}`)
        }
      }
      
      if (finalDisease) {
        notesParts.push(`Diagnosis: ${finalDisease.name}`)
        if (finalDisease.description) {
          notesParts.push(`Disease Description: ${finalDisease.description}`)
        }
        if (finalDisease.symptoms && finalDisease.symptoms.length > 0) {
          notesParts.push(`Symptoms: ${finalDisease.symptoms.join(', ')}`)
        }
      }
      
      if (finalDisease?.prescriptions && finalDisease.prescriptions.length > 0) {
        notesParts.push(`Prescriptions/Instructions: ${finalDisease.prescriptions.join('; ')}`)
      }
      
      if (finalNotes && finalNotes.trim()) {
        notesParts.push(`Doctor Notes: ${finalNotes}`)
      }
      
      const comprehensiveNotes = notesParts.join('\n\n')

      // Use selected diagnosis or map from disease
      const diagnoses = finalDiagnosis.length > 0 ? finalDiagnosis : (finalDisease ? mapDiseaseToDiagnosis(finalDisease) : [])
      
      // Filter out custom diagnosis option from the diagnosis array
      const filteredDiagnoses = diagnoses.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)
      const finalCustomDiagnosis = diagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) ? customDiagnosis : undefined

      // Validate diagnosis requirement
      if (filteredDiagnoses.length === 0 && !finalCustomDiagnosis) {
        setNotification({ type: "error", message: "Please select at least one diagnosis before completing the consultation." })
        setCompleting(false)
        return
      }

      // Complete the appointment
      await completeAppointment(
        appointmentId,
        medicineText || "", // Ensure never undefined
        comprehensiveNotes || "", // Ensure never undefined
        activeHospitalId,
        filteredDiagnoses,
        finalCustomDiagnosis || "",
        user?.uid,
        "doctor"
      )

      // Send completion WhatsApp message
      try {
        const currentUser = auth.currentUser
        if (currentUser) {
          // Fetch appointment data to get patientId
          const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
          const appointmentDoc = await getDoc(doc(appointmentsRef, appointmentId))
          
          if (appointmentDoc.exists()) {
            const appointmentData = appointmentDoc.data()
            const token = await currentUser.getIdToken()
            
            const completionResponse = await fetch("/api/doctor/send-completion-whatsapp", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({
                appointmentId,
                patientId: appointmentData.patientId,
                patientPhone: appointmentData.patientPhone,
                patientName: appointmentData.patientName,
                hospitalId: activeHospitalId,
              }),
            })

            await completionResponse.json().catch(() => ({}))
            
            if (completionResponse.ok) {

            } else {

            }
          }
        }
      } catch {

        // Don't fail the completion if WhatsApp fails
      }

      // Show success message
      setNotification({
        type: "success",
        message: "Checkup completed successfully! Recommended medicines and prescriptions have been added to the appointment."
      })

      // Navigate back to appointments page after a short delay
      setTimeout(() => {
        if (isInIframe || isInline) {
          // Send message to parent to close and refresh
          if (window.parent && appointmentId) {
            window.parent.postMessage({ type: 'close-anatomy-viewer', appointmentId, refresh: true }, '*')
          }
        } else {
          router.push('/doctor-dashboard/appointments')
        }
      }, 2000)

    } catch (error) {

      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to complete checkup. Please try again."
      })
      setCompleting(false)
    }
  }

  // Separate handler for 2D section - now also directly completes the appointment
  const handleCompleteCheckup2D = async () => {
    if (!appointmentId) {
      setNotification({ type: "error", message: "Appointment ID is missing" })
      return
    }

    if (!activeHospitalId) {
      setNotification({ type: "error", message: "Hospital context is not available. Please refresh the page." })
      return
    }

    // Validate that we have at least one medicine with a name
    if (selectedMedicines2D.length === 0 || !selectedMedicines2D.some(med => med.name && med.name.trim())) {
      setNotification({ type: "error", message: "Please add at least one medicine with a name before completing the checkup" })
      return
    }

    // Note: Disease selection is optional - doctors can add custom medicines without selecting a disease

    setCompleting(true)
    setNotification(null)

    try {
      // Format medicines as text
      const medicineText = formatMedicinesAsText(selectedMedicines2D)

      // Build comprehensive notes
      const notesParts: string[] = []
      
      if (selectedPartInfo2D) {
        notesParts.push(`Selected Anatomy Part: ${selectedPartInfo2D.name}`)
        if (selectedPartInfo2D.description) {
          notesParts.push(`Part Description: ${selectedPartInfo2D.description}`)
        }
      }
      
      if (selectedDisease2D) {
        notesParts.push(`Diagnosis: ${selectedDisease2D.name}`)
        if (selectedDisease2D.description) {
          notesParts.push(`Disease Description: ${selectedDisease2D.description}`)
        }
        if (selectedDisease2D.symptoms && selectedDisease2D.symptoms.length > 0) {
          notesParts.push(`Symptoms: ${selectedDisease2D.symptoms.join(', ')}`)
        }
      }
      
      if (selectedDisease2D?.prescriptions && selectedDisease2D.prescriptions.length > 0) {
        notesParts.push(`Prescriptions/Instructions: ${selectedDisease2D.prescriptions.join('; ')}`)
      }
      
      if (notes2D && notes2D.trim()) {
        notesParts.push(`Doctor Notes: ${notes2D}`)
      }
      
      const comprehensiveNotes = notesParts.join('\n\n')

      // Use selected diagnosis or map from disease
      const diagnoses = finalDiagnosis.length > 0 ? finalDiagnosis : (selectedDisease2D ? mapDiseaseToDiagnosis(selectedDisease2D) : [])
      
      // Filter out custom diagnosis option from the diagnosis array
      const filteredDiagnoses = diagnoses.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)
      const finalCustomDiagnosis = diagnoses.includes(CUSTOM_DIAGNOSIS_OPTION) ? customDiagnosis : undefined

      // Validate diagnosis requirement
      if (filteredDiagnoses.length === 0 && !finalCustomDiagnosis) {
        setNotification({ type: "error", message: "Please select at least one diagnosis before completing the consultation." })
        setCompleting(false)
        return
      }

      // Complete the appointment
      await completeAppointment(
        appointmentId,
        medicineText || "", // Ensure never undefined
        comprehensiveNotes || "", // Ensure never undefined
        activeHospitalId,
        filteredDiagnoses,
        finalCustomDiagnosis || "",
        user?.uid,
        "doctor"
      )

      // Send completion WhatsApp message
      try {
        const currentUser = auth.currentUser
        if (currentUser) {
          // Fetch appointment data to get patientId
          const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
          const appointmentDoc = await getDoc(doc(appointmentsRef, appointmentId))
          
          if (appointmentDoc.exists()) {
            const appointmentData = appointmentDoc.data()
            const token = await currentUser.getIdToken()
            
            const completionResponse = await fetch("/api/doctor/send-completion-whatsapp", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({
                appointmentId,
                patientId: appointmentData.patientId,
                patientPhone: appointmentData.patientPhone,
                patientName: appointmentData.patientName,
                hospitalId: activeHospitalId,
              }),
            })

            await completionResponse.json().catch(() => ({}))
            
            if (completionResponse.ok) {

            } else {

            }
          }
        }
      } catch {

        // Don't fail the completion if WhatsApp fails
      }

      // Show success message
      setNotification({
        type: "success",
        message: "Checkup completed successfully! Recommended medicines and prescriptions have been added to the appointment."
      })

      // Navigate back to appointments page after a short delay
      setTimeout(() => {
        if (isInIframe || isInline) {
          // Send message to parent to close and refresh
          if (window.parent && appointmentId) {
            window.parent.postMessage({ type: 'close-anatomy-viewer', appointmentId, refresh: true }, '*')
          }
        } else {
          router.push('/doctor-dashboard/appointments')
        }
      }, 2000)

    } catch (error) {

      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to complete checkup. Please try again."
      })
      setCompleting(false)
    }
  }

  const currentPartData = selectedPart ? earPartsData[selectedPart] : null

  // If inline mode, show only the essential parts (model + completion sections)
  if (isInline || isInIframe) {
    return (
      <div className="w-full h-full bg-white">
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
        <div className="p-4">
          {/* View Toggle */}
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit mb-4">
            <button
              onClick={() => setActiveView('3d')}
              className={`px-6 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                activeView === '3d'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              3D Model
            </button>
            <button
              onClick={() => setActiveView('2d')}
              className={`px-6 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                activeView === '2d'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              2D Diagram
            </button>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Model Viewer (3D or 2D based on activeView) */}
            <div className="lg:col-span-6">
              {activeView === '3d' ? (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200" style={{ height: '600px', minHeight: '600px' }}>
                  <DynamicENTAnatomyViewer
                    onPartSelect={handlePartSelect}
                    selectedPart={selectedPart}
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200" style={{ height: '600px', minHeight: '600px' }}>
                  <InteractiveEarSVG
                    onPartSelect={handlePartSelect2D}
                    selectedPart={selectedPart2D}
                  />
                </div>
              )}
            </div>

            {/* Right: Information Panel */}
            <div className="lg:col-span-6 space-y-4">
              {/* Selected Part Info Section - Show based on active view */}
              {(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D) ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5 shadow-lg">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-blue-900">Selected Part Information</h3>
                    <button
                      onClick={() => {
                        if (activeView === '3d') {
                          setSelectedPart(null)
                          setSelectedPartInfo(null)
                          setSelectedDisease(null)
                          setSelectedMedicines([])
                        } else {
                          setSelectedPart2D(null)
                          setSelectedPartInfo2D(null)
                          setSelectedDisease2D(null)
                          setSelectedMedicines2D([])
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 text-lg font-bold hover:bg-blue-100 rounded-full p-1 transition-colors"
                      title="Clear Selection"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Part Name</label>
                      <p className="text-base text-blue-900 font-bold mt-1">{(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D)?.name}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Description</label>
                      <p className="text-sm text-blue-800 leading-relaxed mt-1">{(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D)?.description}</p>
                    </div>
                  </div>
                </div>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="text-sm font-medium text-slate-600">Click on a part of the ear model</p>
                <p className="text-xs text-slate-500 mt-1">to see its name and description here</p>
              </div>
            )}

              {/* Diseases List */}
              {(() => {
                const partInfo = activeView === '3d' ? selectedPartInfo : selectedPartInfo2D
                const partData = activeView === '3d' ? currentPartData : (selectedPart2D ? earPartsData[selectedPart2D] : null)
                return partInfo && partData && partData.diseases.length > 0
              })() && (
                <div className="bg-white/95 backdrop-blur-sm border-2 border-blue-200 rounded-xl p-4 shadow-md">
                  <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Related Diseases/Conditions
                  </h4>
                  <div className="space-y-2">
                    {((activeView === '3d' ? currentPartData : (selectedPart2D ? earPartsData[selectedPart2D] : null))?.diseases || []).map((disease) => (
                      <button
                        key={disease.id}
                        onClick={() => activeView === '3d' ? handleDiseaseSelect(disease) : handleDiseaseSelect2D(disease)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          (activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id
                            ? 'bg-blue-100 border-blue-500 shadow-md'
                            : 'bg-white border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        <p className={`font-semibold mb-1 ${(activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id ? 'text-blue-900' : 'text-blue-800'}`}>
                          {disease.name}
                        </p>
                        <p className={`text-xs leading-relaxed line-clamp-2 ${(activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id ? 'text-blue-700' : 'text-blue-600'}`}>
                          {disease.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Disease Info */}
              {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (
                <div className="bg-green-50/95 backdrop-blur-sm border-2 border-green-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-green-900">Selected Disease</h3>
                    <button
                      onClick={() => {
                        if (activeView === '3d') {
                          setSelectedDisease(null)
                          setSelectedMedicines([])
                        } else {
                          setSelectedDisease2D(null)
                          setSelectedMedicines2D([])
                        }
                      }}
                      className="text-green-600 hover:text-green-800 text-sm font-bold"
                      title="Clear Selection"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-green-800 font-semibold mb-2">{(activeView === '3d' ? selectedDisease : selectedDisease2D)?.name}</p>
                  <p className="text-xs text-green-700 leading-relaxed mb-3">{(activeView === '3d' ? selectedDisease : selectedDisease2D)?.description}</p>
                  
                  {/* Symptoms */}
                  {(activeView === '3d' ? selectedDisease : selectedDisease2D)?.symptoms && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.symptoms.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-bold text-green-900 mb-1">Symptoms:</h4>
                      <div className="flex flex-wrap gap-1">
                        {(activeView === '3d' ? selectedDisease : selectedDisease2D)!.symptoms.map((symptom, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            {symptom}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prescriptions */}
              {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.prescriptions.length > 0 && (
                <div className="bg-amber-50/95 backdrop-blur-sm border border-amber-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-amber-900 mb-2">Prescriptions/Instructions:</h4>
                  <ul className="text-xs text-amber-800 space-y-1">
                    {(activeView === '3d' ? selectedDisease : selectedDisease2D)!.prescriptions.map((prescription, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>{prescription}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Medicines - Editable */}
              {(
                <div className="bg-purple-50/95 backdrop-blur-sm border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-purple-900">Medicines:</h4>
                    <button
                      onClick={activeView === '3d' ? addMedicine : addMedicine2D}
                      className="btn-modern btn-modern-purple btn-modern-sm flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(activeView === '3d' ? selectedMedicines : selectedMedicines2D).length === 0 ? (
                      <p className="text-xs text-purple-700 italic py-1">No medicines. Click "Add" to add one.</p>
                    ) : (
                      (activeView === '3d' ? selectedMedicines : selectedMedicines2D).map((medicine, idx) => {
                        const currentSection = activeView
                        const nameSuggestions = getMedicineNameSuggestions(medicine.name || "")
                        const showNameSuggestions =
                          activeNameSuggestion?.section === currentSection &&
                          activeNameSuggestion?.index === idx &&
                          nameSuggestions.length > 0
                      
                      return (
                      <div key={idx} className="bg-white rounded p-2 border border-purple-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-purple-900">#{idx + 1}</span>
                          <button
                            onClick={() => currentSection === '3d' ? removeMedicine(idx) : removeMedicine2D(idx)}
                            className="text-red-600 hover:text-red-800 text-xs font-bold"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="space-y-1.5">
                            <div className="relative">
                              <input
                                type="text"
                                value={medicine.name}
                                onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "name", e.target.value) : updateMedicine2D(idx, "name", e.target.value)}
                                onFocus={() => {
                                  setActiveNameSuggestion({ section: currentSection, index: idx })
                                  updateInlineSuggestion(currentSection, idx, medicine.name || "")
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setActiveNameSuggestion((current) => {
                                      if (current?.section === currentSection && current.index === idx) {
                                        return null
                                      }
                                      return current
                                    })
                                  }, 150)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Tab" || e.key === "ArrowRight") {
                                    if (inlineSuggestion?.section === currentSection && inlineSuggestion.index === idx) {
                                      e.preventDefault()
                                      acceptInlineSuggestion(currentSection, idx)
                                    }
                                  } else if (e.key === "Enter") {
                                    if (inlineSuggestion?.section === currentSection && inlineSuggestion.index === idx) {
                                      e.preventDefault()
                                      acceptInlineSuggestion(currentSection, idx)
                                    } else if (nameSuggestions.length > 0) {
                                      e.preventDefault()
                                      handleSelectMedicineSuggestion(currentSection, idx, nameSuggestions[0])
                                    }
                                  } else if (e.key === "ArrowDown") {
                                    if (nameSuggestions.length > 0) {
                                      e.preventDefault()
                                      const firstOption = document.querySelector<HTMLButtonElement>(
                                        `#suggestion-btn-${currentSection}-${idx}-0`
                                      )
                                      firstOption?.focus()
                                    }
                                  } else if (e.key === "Escape") {
                                    setInlineSuggestion((prev) =>
                                      prev?.section === currentSection && prev.index === idx ? null : prev
                                    )
                                  }
                                }}
                                placeholder="Medicine name *"
                                className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              {inlineSuggestion?.section === currentSection &&
                              inlineSuggestion?.index === idx &&
                              inlineSuggestion?.suggestion &&
                              inlineSuggestion.suggestion.toLowerCase().startsWith((medicine.name || "").toLowerCase()) && (
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
                              )}
                              {showNameSuggestions && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-purple-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                  {nameSuggestions.map((suggestion, sugIdx) => (
                                    <button
                                      key={suggestion.name}
                                      type="button"
                                      id={`suggestion-btn-${currentSection}-${idx}-${sugIdx}`}
                                      onClick={() => handleSelectMedicineSuggestion(currentSection, idx, suggestion)}
                                      onKeyDown={(e) => {
                                        if (e.key === "ArrowDown") {
                                          e.preventDefault()
                                          const next = document.querySelector<HTMLButtonElement>(
                                            `#suggestion-btn-${currentSection}-${idx}-${sugIdx + 1}`
                                          )
                                          next?.focus()
                                        } else if (e.key === "ArrowUp") {
                                          e.preventDefault()
                                          if (sugIdx === 0) {
                                            const input = e.currentTarget.closest('.relative')?.querySelector('input')
                                            input?.focus()
                                          } else {
                                            const prev = document.querySelector<HTMLButtonElement>(
                                              `#suggestion-btn-${currentSection}-${idx}-${sugIdx - 1}`
                                            )
                                            prev?.focus()
                                          }
                                        }
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-purple-50 text-xs text-purple-900 border-b border-purple-100 last:border-b-0"
                                    >
                                      {suggestion.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <input
                              type="text"
                              value={medicine.dosage}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "dosage", e.target.value) : updateMedicine2D(idx, "dosage", e.target.value)}
                              placeholder="Dosage"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                              type="text"
                              value={medicine.frequency}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "frequency", e.target.value) : updateMedicine2D(idx, "frequency", e.target.value)}
                              placeholder="Frequency"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                              type="text"
                              value={medicine.duration}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "duration", e.target.value) : updateMedicine2D(idx, "duration", e.target.value)}
                              placeholder="Duration"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

              {/* Disease Notes */}
              {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.notes && (
                <div className="bg-indigo-50/95 backdrop-blur-sm border border-indigo-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-indigo-900 mb-2">Clinical Notes:</h4>
                  <p className="text-xs text-indigo-800 leading-relaxed">{(activeView === '3d' ? selectedDisease : selectedDisease2D)!.notes}</p>
                </div>
              )}

              {/* Notes Section */}
              <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3">
                <label className="block font-semibold text-slate-800 mb-1.5 text-sm">
                  Doctor Notes
                </label>
                <textarea
                  value={activeView === '3d' ? notes : notes2D}
                  onChange={(e) => activeView === '3d' ? setNotes(e.target.value) : setNotes2D(e.target.value)}
                  placeholder={`Document your findings from the ${activeView === '3d' ? '3D model' : '2D diagram'} examination...`}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              {/* Diagnosis Selector */}
              <div className="bg-blue-50/95 backdrop-blur-sm border border-blue-200 rounded-xl p-4">
                <label className="block font-semibold text-blue-900 mb-2">
                  Final Diagnosis <span className="text-red-500">*</span>
                </label>
                <DiagnosisSelector
                  selectedDiagnoses={finalDiagnosis}
                  customDiagnosis={customDiagnosis}
                  onDiagnosesChange={setFinalDiagnosis}
                  onCustomDiagnosisChange={setCustomDiagnosis}
                  readOnly={false}
                />
              </div>

              {/* Complete Checkup Button */}
              {((activeView === '3d' ? selectedDisease : selectedDisease2D) || (activeView === '3d' ? selectedMedicines : selectedMedicines2D).length > 0) && (
                <button
                  onClick={activeView === '3d' ? handleCompleteCheckup : handleCompleteCheckup2D}
                  disabled={completing}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Completing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Complete Checkup
                    </>
                  )}
                </button>
              )}

              {/* Instructions */}
              <div className="bg-amber-50/95 backdrop-blur-sm border border-amber-200 rounded-xl p-4">
                <h4 className="font-semibold text-amber-900 mb-2 text-sm">💡 Instructions</h4>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li>• Toggle between 3D Model and 2D Diagram views</li>
                  <li>• Click on ear parts to select them</li>
                  <li>• Select a disease/condition from the list</li>
                  <li>• Review prescriptions and medicines</li>
                  <li>• Add examination notes and diagnosis</li>
                  <li>• Click "Complete Checkup" to save and return</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Full page mode with header and background
  return (
    <div
      className="min-h-screen pt-20 relative"
      style={{
        backgroundImage: 'url(/images/17973908.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay for better content readability */}
      <div className="absolute inset-0 bg-white/75"></div>
      
      {/* Content container with relative positioning */}
      <div className="relative z-10">
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="rounded-2xl shadow-xl mb-6 p-6 border border-white/20 relative overflow-hidden">
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes gradient-shift {
                0%, 100% {
                  background-position: 0% 50%;
                }
                50% {
                  background-position: 100% 50%;
                }
              }
              .gradient-bg-animated {
                background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #3b82f6);
                background-size: 300% 300%;
                animation: gradient-shift 5s ease infinite;
              }
            `}} />
            <div className="gradient-bg-animated absolute inset-0 opacity-90"></div>
            <div className="relative z-10 bg-white/80 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-slate-800 mb-2">ENT Anatomy Viewer</h1>
                <p className="text-slate-600">
                  {patientName && patientName !== 'Patient' ? `Patient: ${patientName}` : 'Interactive ear anatomy model for ENT consultation'}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors text-slate-800 font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {isInIframe || isInline ? 'Close' : 'Back'}
              </button>
              </div>

              {/* View Toggle */}
              <div className="flex gap-2 bg-slate-100/90 backdrop-blur-sm p-1 rounded-lg w-fit mt-4">
                <button
                  onClick={() => setActiveView('3d')}
                  className={`px-6 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                    activeView === '3d'
                      ? 'bg-white text-blue-600 shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  3D Model
                </button>
                <button
                  onClick={() => setActiveView('2d')}
                  className={`px-6 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                    activeView === '2d'
                      ? 'bg-white text-blue-600 shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  2D Diagram
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Model Viewer (3D or 2D based on activeView) */}
            <div className="lg:col-span-6">
              {activeView === '3d' ? (
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden border border-white/20" style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}>
                  <DynamicENTAnatomyViewer
                    onPartSelect={handlePartSelect}
                    selectedPart={selectedPart}
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden border border-white/20" style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}>
                  <InteractiveEarSVG
                    onPartSelect={handlePartSelect2D}
                    selectedPart={selectedPart2D}
                  />
                </div>
              )}
            </div>

            {/* Right: Information Panel */}
            <div className="lg:col-span-6 space-y-4">
              {/* Selected Part Info Section - Show based on active view */}
              {(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D) ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5 shadow-lg">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-blue-900">Selected Part Information</h3>
                    <button
                      onClick={() => {
                        if (activeView === '3d') {
                          setSelectedPart(null)
                          setSelectedPartInfo(null)
                          setSelectedDisease(null)
                          setSelectedMedicines([])
                        } else {
                          setSelectedPart2D(null)
                          setSelectedPartInfo2D(null)
                          setSelectedDisease2D(null)
                          setSelectedMedicines2D([])
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 text-lg font-bold hover:bg-blue-100 rounded-full p-1 transition-colors"
                      title="Clear Selection"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Part Name</label>
                      <p className="text-base text-blue-900 font-bold mt-1">{(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D)?.name}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Description</label>
                      <p className="text-sm text-blue-800 leading-relaxed mt-1">{(activeView === '3d' ? selectedPartInfo : selectedPartInfo2D)?.description}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                  <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  <p className="text-sm font-medium text-slate-600">Click on a part of the ear model</p>
                  <p className="text-xs text-slate-500 mt-1">to see its name and description here</p>
                </div>
              )}

              {/* Diseases List */}
              {(() => {
                const partInfo = activeView === '3d' ? selectedPartInfo : selectedPartInfo2D
                const partData = activeView === '3d' ? currentPartData : (selectedPart2D ? earPartsData[selectedPart2D] : null)
                return partInfo && partData && partData.diseases.length > 0
              })() && (
                <div className="bg-white/95 backdrop-blur-sm border-2 border-blue-200 rounded-xl p-4 shadow-md">
                  <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Related Diseases/Conditions
                  </h4>
                  <div className="space-y-2">
                    {((activeView === '3d' ? currentPartData : (selectedPart2D ? earPartsData[selectedPart2D] : null))?.diseases || []).map((disease) => (
                      <button
                        key={disease.id}
                        onClick={() => activeView === '3d' ? handleDiseaseSelect(disease) : handleDiseaseSelect2D(disease)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          (activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id
                            ? 'bg-blue-100 border-blue-500 shadow-md'
                            : 'bg-white border-blue-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        <p className={`font-semibold mb-1 ${(activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id ? 'text-blue-900' : 'text-blue-800'}`}>
                          {disease.name}
                        </p>
                        <p className={`text-xs leading-relaxed line-clamp-2 ${(activeView === '3d' ? selectedDisease?.id : selectedDisease2D?.id) === disease.id ? 'text-blue-700' : 'text-blue-600'}`}>
                          {disease.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Disease Info */}
              {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (
                <div className="bg-green-50/95 backdrop-blur-sm border-2 border-green-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-green-900">Selected Disease</h3>
                    <button
                      onClick={() => {
                        if (activeView === '3d') {
                          setSelectedDisease(null)
                          setSelectedMedicines([])
                        } else {
                          setSelectedDisease2D(null)
                          setSelectedMedicines2D([])
                        }
                      }}
                      className="text-green-600 hover:text-green-800 text-sm font-bold"
                      title="Clear Selection"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-green-800 font-semibold mb-2">{(activeView === '3d' ? selectedDisease : selectedDisease2D)?.name}</p>
                  <p className="text-xs text-green-700 leading-relaxed mb-3">{(activeView === '3d' ? selectedDisease : selectedDisease2D)?.description}</p>
                  
                  {/* Symptoms */}
                  {(activeView === '3d' ? selectedDisease : selectedDisease2D)?.symptoms && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.symptoms.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-bold text-green-900 mb-1">Symptoms:</h4>
                      <div className="flex flex-wrap gap-1">
                        {(activeView === '3d' ? selectedDisease : selectedDisease2D)!.symptoms.map((symptom, idx) => (
                          <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            {symptom}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Prescriptions */}
              {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.prescriptions.length > 0 && (
                <div className="bg-amber-50/95 backdrop-blur-sm border border-amber-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-amber-900 mb-2">Prescriptions/Instructions:</h4>
                  <ul className="text-xs text-amber-800 space-y-1">
                    {(activeView === '3d' ? selectedDisease : selectedDisease2D)!.prescriptions.map((prescription, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600">•</span>
                        <span>{prescription}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Medicines - Editable */}
              {(
                <div className="bg-purple-50/95 backdrop-blur-sm border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-purple-900">Medicines:</h4>
                    <button
                      onClick={activeView === '3d' ? addMedicine : addMedicine2D}
                      className="btn-modern btn-modern-purple btn-modern-sm flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(activeView === '3d' ? selectedMedicines : selectedMedicines2D).length === 0 ? (
                      <p className="text-xs text-purple-700 italic py-1">No medicines. Click "Add" to add one.</p>
                    ) : (
                      (activeView === '3d' ? selectedMedicines : selectedMedicines2D).map((medicine, idx) => {
                        const currentSection = activeView
                        const nameSuggestions = getMedicineNameSuggestions(medicine.name || "")
                        const showNameSuggestions =
                          activeNameSuggestion?.section === currentSection &&
                          activeNameSuggestion?.index === idx &&
                          nameSuggestions.length > 0
                      
                      return (
                      <div key={idx} className="bg-white rounded p-2 border border-purple-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-purple-900">#{idx + 1}</span>
                          <button
                            onClick={() => currentSection === '3d' ? removeMedicine(idx) : removeMedicine2D(idx)}
                            className="text-red-600 hover:text-red-800 text-xs font-bold"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="space-y-1.5">
                            <div className="relative">
                              <input
                                type="text"
                                value={medicine.name}
                                onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "name", e.target.value) : updateMedicine2D(idx, "name", e.target.value)}
                                onFocus={() => {
                                  setActiveNameSuggestion({ section: currentSection, index: idx })
                                  updateInlineSuggestion(currentSection, idx, medicine.name || "")
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setActiveNameSuggestion((current) => {
                                      if (current?.section === currentSection && current.index === idx) {
                                        return null
                                      }
                                      return current
                                    })
                                  }, 150)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Tab" || e.key === "ArrowRight") {
                                    if (inlineSuggestion?.section === currentSection && inlineSuggestion.index === idx) {
                                      e.preventDefault()
                                      acceptInlineSuggestion(currentSection, idx)
                                    }
                                  } else if (e.key === "Enter") {
                                    if (inlineSuggestion?.section === currentSection && inlineSuggestion.index === idx) {
                                      e.preventDefault()
                                      acceptInlineSuggestion(currentSection, idx)
                                    } else if (nameSuggestions.length > 0) {
                                      e.preventDefault()
                                      handleSelectMedicineSuggestion(currentSection, idx, nameSuggestions[0])
                                    }
                                  } else if (e.key === "ArrowDown") {
                                    if (nameSuggestions.length > 0) {
                                      e.preventDefault()
                                      const firstOption = document.querySelector<HTMLButtonElement>(
                                        `#suggestion-btn-${currentSection}-${idx}-0`
                                      )
                                      firstOption?.focus()
                                    }
                                  } else if (e.key === "Escape") {
                                    setInlineSuggestion((prev) =>
                                      prev?.section === currentSection && prev.index === idx ? null : prev
                                    )
                                  }
                                }}
                                placeholder="Medicine name *"
                                className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                              {inlineSuggestion?.section === currentSection &&
                              inlineSuggestion?.index === idx &&
                              inlineSuggestion?.suggestion &&
                              inlineSuggestion.suggestion.toLowerCase().startsWith((medicine.name || "").toLowerCase()) && (
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
                              )}
                              {showNameSuggestions && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-purple-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                  {nameSuggestions.map((suggestion, sugIdx) => (
                                    <button
                                      key={suggestion.name}
                                      type="button"
                                      id={`suggestion-btn-${currentSection}-${idx}-${sugIdx}`}
                                      onClick={() => handleSelectMedicineSuggestion(currentSection, idx, suggestion)}
                                      onKeyDown={(e) => {
                                        if (e.key === "ArrowDown") {
                                          e.preventDefault()
                                          const next = document.querySelector<HTMLButtonElement>(
                                            `#suggestion-btn-${currentSection}-${idx}-${sugIdx + 1}`
                                          )
                                          next?.focus()
                                        } else if (e.key === "ArrowUp") {
                                          e.preventDefault()
                                          if (sugIdx === 0) {
                                            const input = e.currentTarget.closest('.relative')?.querySelector('input')
                                            input?.focus()
                                          } else {
                                            const prev = document.querySelector<HTMLButtonElement>(
                                              `#suggestion-btn-${currentSection}-${idx}-${sugIdx - 1}`
                                            )
                                            prev?.focus()
                                          }
                                        }
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-purple-50 text-xs text-purple-900 border-b border-purple-100 last:border-b-0"
                                    >
                                      {suggestion.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <input
                              type="text"
                              value={medicine.dosage}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "dosage", e.target.value) : updateMedicine2D(idx, "dosage", e.target.value)}
                              placeholder="Dosage"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                              type="text"
                              value={medicine.frequency}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "frequency", e.target.value) : updateMedicine2D(idx, "frequency", e.target.value)}
                              placeholder="Frequency"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <input
                              type="text"
                              value={medicine.duration}
                              onChange={(e) => currentSection === '3d' ? updateMedicine(idx, "duration", e.target.value) : updateMedicine2D(idx, "duration", e.target.value)}
                              placeholder="Duration"
                              className="w-full px-2 py-1 border border-purple-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

              {/* Disease Notes */}
              {(activeView === '3d' ? selectedDisease : selectedDisease2D) && (activeView === '3d' ? selectedDisease : selectedDisease2D)!.notes && (
                <div className="bg-indigo-50/95 backdrop-blur-sm border border-indigo-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-indigo-900 mb-2">Clinical Notes:</h4>
                  <p className="text-xs text-indigo-800 leading-relaxed">{(activeView === '3d' ? selectedDisease : selectedDisease2D)!.notes}</p>
                </div>
              )}

              {/* Notes Section */}
              <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl p-3">
                <label className="block font-semibold text-slate-800 mb-1.5 text-sm">
                  Doctor Notes
                </label>
                <textarea
                  value={activeView === '3d' ? notes : notes2D}
                  onChange={(e) => activeView === '3d' ? setNotes(e.target.value) : setNotes2D(e.target.value)}
                  placeholder={`Document your findings from the ${activeView === '3d' ? '3D model' : '2D diagram'} examination...`}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              {/* Diagnosis Selector */}
              <div className="bg-blue-50/95 backdrop-blur-sm border border-blue-200 rounded-xl p-4">
                <label className="block font-semibold text-blue-900 mb-2">
                  Final Diagnosis <span className="text-red-500">*</span>
                </label>
                <DiagnosisSelector
                  selectedDiagnoses={finalDiagnosis}
                  customDiagnosis={customDiagnosis}
                  onDiagnosesChange={setFinalDiagnosis}
                  onCustomDiagnosisChange={setCustomDiagnosis}
                  readOnly={false}
                />
              </div>

              {/* Complete Checkup Button */}
              {((activeView === '3d' ? selectedDisease : selectedDisease2D) || (activeView === '3d' ? selectedMedicines : selectedMedicines2D).length > 0) && (
                <button
                  onClick={activeView === '3d' ? handleCompleteCheckup : handleCompleteCheckup2D}
                  disabled={completing}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Completing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Complete Checkup
                    </>
                  )}
                </button>
              )}

              {/* Instructions */}
              <div className="bg-amber-50/95 backdrop-blur-sm border border-amber-200 rounded-xl p-4">
                <h4 className="font-semibold text-amber-900 mb-2 text-sm">💡 Instructions</h4>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li>• Toggle between 3D Model and 2D Diagram views</li>
                  <li>• Click on ear parts to select them</li>
                  <li>• Select a disease/condition from the list</li>
                  <li>• Review prescriptions and medicines</li>
                  <li>• Add examination notes and diagnosis</li>
                  <li>• Click "Complete Checkup" to save and return</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ENTAnatomyPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-slate-600">Loading...</div>
      </div>
    }>
      <ENTAnatomyPageContent />
    </Suspense>
  )
}
