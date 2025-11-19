"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { auth, db } from "@/firebase/config"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import Notification from "@/components/ui/Notification"
import { generatePrescriptionPDF } from "@/utils/prescriptionPDF"
import { completeAppointment, getStatusColor } from "@/utils/appointmentHelpers"
import { calculateAge } from "@/utils/date"
import { Appointment as AppointmentType } from "@/types/patient"
import axios from "axios"
import Pagination from "@/components/ui/Pagination"
import {
  fetchMedicineSuggestions,
  MedicineSuggestion,
  MedicineSuggestionOption,
  recordMedicineSuggestions,
  sanitizeMedicineName,
} from "@/utils/medicineSuggestions"

// Helper function to parse and render prescription text
const parsePrescription = (text: string) => {
  if (!text) return null
  
  const lines = text.split('\n').filter(line => line.trim())
  const medicines: Array<{emoji: string, name: string, dosage: string, frequency: string, duration: string}> = []
  let advice = ""
  
  let currentMedicine: {emoji: string, name: string, dosage: string, frequency: string, duration: string} | null = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip prescription header
    if (line.includes('🧾') && line.includes('Prescription')) continue
    
    // Check for medicine line (contains emoji and medicine name) - matches *1️⃣ Medicine Name Dosage*
    const medicineMatch = line.match(/\*([1-9]️⃣|🔟)\s+(.+?)\*/)
    if (medicineMatch) {
      // Save previous medicine
      if (currentMedicine) {
        medicines.push(currentMedicine)
      }
      
      const emoji = medicineMatch[1]
      let nameWithDosage = medicineMatch[2].trim()
      
      // Extract dosage from anywhere (e.g., "20mg", "400mg")
      const dosageMatch = nameWithDosage.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|capsule|tablet|tab|cap))/i)
      let dosage = ""
      if (dosageMatch) {
        dosage = dosageMatch[1]
        nameWithDosage = nameWithDosage.replace(dosageMatch[0], '').trim()
      }
      
      // Extract duration if present in the line (e.g., "for 14 days", "for 7 days")
      let duration = ""
      const durationMatch = nameWithDosage.match(/(?:for|duration)\s+(\d+\s*(?:days?|weeks?|months?))/i)
      if (durationMatch) {
        duration = durationMatch[1]
        nameWithDosage = nameWithDosage.replace(durationMatch[0], '').trim()
      }
      
      // Extract frequency if present (e.g., "daily", "twice", "three times")
      let frequency = ""
      const frequencyMatch = nameWithDosage.match(/(daily|once|twice|three times|four times|\d+\s*times)/i)
      if (frequencyMatch) {
        frequency = frequencyMatch[1]
        nameWithDosage = nameWithDosage.replace(frequencyMatch[0], '').trim()
      }
      
      // Clean up name (remove brackets, dashes, extra spaces)
      const name = nameWithDosage.replace(/\[.*?\]/g, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim()
      
      currentMedicine = {
        emoji,
        name: name || "Medicine",
        dosage,
        frequency,
        duration
      }
    } else if (currentMedicine) {
      // Check for frequency (starts with • and doesn't contain "duration")
      if (line.startsWith('•') && !line.toLowerCase().includes('duration')) {
        const freq = line.replace('•', '').trim()
        if (freq && !currentMedicine.frequency) {
          currentMedicine.frequency = freq
        }
      }
      
      // Check for duration (starts with • and contains "duration")
      if (line.startsWith('•') && line.toLowerCase().includes('duration')) {
        const duration = line.replace('•', '').replace(/duration:/i, '').trim()
        if (duration) {
          currentMedicine.duration = duration
        }
      }
    }
    
    // Capture advice
    if (line.includes('📌') && /advice/i.test(line)) {
      advice = line.replace(/📌\s*\*?Advice:\*?\s*/i, '').trim()
    }
  }
  
  // Add last medicine
  if (currentMedicine) {
    medicines.push(currentMedicine)
  }
  
  return { medicines, advice }
}

type CompletionFormEntry = {
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  notes: string
  recheckupRequired: boolean
}

const hasValidPrescriptionInput = (entry?: CompletionFormEntry) =>
  Boolean(entry?.medicines?.some((med) => med.name && med.name.trim()))

interface UserData {
  id: string;
  name: string;
  firstName?: string;
  email: string;
  role: string;
}

// Use the canonical type from src/types/patient

export default function DoctorAppointments() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [appointments, setAppointments] = useState<AppointmentType[]>([])
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "thisWeek" | "nextWeek" | "history">("today")
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [updating, setUpdating] = useState<{[key: string]: boolean}>({})
  const [showCompletionForm, setShowCompletionForm] = useState<{[key: string]: boolean}>({})
  const [completionData, setCompletionData] = useState<Record<string, CompletionFormEntry>>({})
  const [aiPrescription, setAiPrescription] = useState<{[key: string]: {medicine: string, notes: string}}>({})
  const [loadingAiPrescription, setLoadingAiPrescription] = useState<{[key: string]: boolean}>({})
  const [showAiPrescriptionSuggestion, setShowAiPrescriptionSuggestion] = useState<{[key: string]: boolean}>({})
  const [patientHistory, setPatientHistory] = useState<AppointmentType[]>([])
  const [historySearchFilters, setHistorySearchFilters] = useState<{ [key: string]: { text: string; date: string } }>({})
  const [historyTabFilters, setHistoryTabFilters] = useState<{ text: string; date: string }>({ text: "", date: "" })
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [aiDiagnosis, setAiDiagnosis] = useState<{[key: string]: string}>({})
  const [loadingAiDiagnosis, setLoadingAiDiagnosis] = useState<{[key: string]: boolean}>({})
  const [showHistory, setShowHistory] = useState<{[key: string]: boolean}>({})
  const [refreshing, setRefreshing] = useState(false)
  const [admitting, setAdmitting] = useState<{ [key: string]: boolean }>({})
  const [admitDialog, setAdmitDialog] = useState<{
    open: boolean
    appointment: AppointmentType | null
    note: string
  }>({
    open: false,
    appointment: null,
    note: "",
  })
  const [medicineSuggestions, setMedicineSuggestions] = useState<MedicineSuggestion[]>([])
  const [activeNameSuggestion, setActiveNameSuggestion] = useState<{ appointmentId: string; index: number } | null>(null)
  const [inlineSuggestion, setInlineSuggestion] = useState<{
    appointmentId: string
    index: number
    suggestion: string
  } | null>(null)
  const [medicineSuggestionsLoading, setMedicineSuggestionsLoading] = useState(false)

  const refreshMedicineSuggestions = useCallback(async () => {
    try {
      setMedicineSuggestionsLoading(true)
      const suggestions = await fetchMedicineSuggestions(100)
      setMedicineSuggestions(suggestions)
    } catch (error) {
      console.error("Failed to load medicine suggestions", error)
    } finally {
      setMedicineSuggestionsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMedicineSuggestions()
  }, [refreshMedicineSuggestions])

  // Protect route - only allow doctors
  const { user, loading } = useAuth("doctor")

  const fetchData = async () => {
    if (!user) return

      const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
      if (doctorDoc.exists()) {
        const data = doctorDoc.data() as UserData
        setUserData(data)
      }

      // Get appointments for the doctor
      const appointmentsRef = collection(db, "appointments")
      const q = query(appointmentsRef, where("doctorId", "==", user.uid))
      const appointmentsSnapshot = await getDocs(q)
      const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as AppointmentType))
      setAppointments(appointmentsList)
    }

  useEffect(() => {
    fetchData()
  }, [user])

  // Auto-expand appointment if redirected from dashboard
  useEffect(() => {
    const expandAppointmentId = sessionStorage.getItem('expandAppointmentId')
    if (expandAppointmentId) {
      // Clear the stored ID
      sessionStorage.removeItem('expandAppointmentId')
      // Set active tab to "today" since we're coming from today's schedule
      setActiveTab("today")
      // Auto-expand the appointment after a short delay to ensure data is loaded
      setTimeout(() => {
        setExpandedAppointment(expandAppointmentId)
        // Scroll to the appointment
        const element = document.getElementById(`appointment-${expandAppointmentId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500)
    }
  }, [appointments])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchData()
      setNotification({ type: "success", message: "Appointments refreshed successfully!" })
    } catch (error) {
      console.error("Error refreshing appointments:", error)
      setNotification({ type: "error", message: "Failed to refresh appointments" })
    } finally {
      setRefreshing(false)
    }
  }

  // Toggle accordion and fetch patient history
  const toggleAccordion = async (appointmentId: string) => {
    if (expandedAppointment === appointmentId) {
      setExpandedAppointment(null)
      setPatientHistory([])
    } else {
      setExpandedAppointment(appointmentId)
      
      const appointment = appointments.find(apt => apt.id === appointmentId)
      if (appointment && appointment.patientId) {
        try {
          const patientAppointmentsQuery = query(
            collection(db, "appointments"), 
            where("patientId", "==", appointment.patientId),
            where("status", "==", "completed")
          )
          const snapshot = await getDocs(patientAppointmentsQuery)
      const history = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as AppointmentType))
            .filter((apt: AppointmentType) => apt.id !== appointmentId)
            .sort((a: AppointmentType, b: AppointmentType) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
          setPatientHistory(history)
          setHistorySearchFilters(prev => ({
            ...prev,
            [appointmentId]: { text: "", date: "" }
          }))
        } catch (error) {
          console.error("Error fetching patient history:", error)
        }
      }
    }
  }

  const handleHistorySearchChange = (appointmentId: string, field: "text" | "date", value: string) => {
    setHistorySearchFilters(prev => ({
      ...prev,
      [appointmentId]: {
        ...(prev[appointmentId] || { text: "", date: "" }),
        [field]: value
      }
    }))
  }

  const clearHistoryFilters = (appointmentId: string) => {
    setHistorySearchFilters(prev => ({
      ...prev,
      [appointmentId]: { text: "", date: "" }
    }))
  }

  // Get latest checkup recommendation for same doctor
  const getLatestCheckupRecommendation = (appointment: AppointmentType) => {
    const sameDoctorHistory = patientHistory.filter((historyItem: AppointmentType) => 
      historyItem.doctorId === appointment.doctorId && 
      historyItem.id !== appointment.id &&
      (historyItem.medicine || historyItem.doctorNotes)
    )
    
    if (sameDoctorHistory.length > 0) {
      const latest = sameDoctorHistory[0] // Already sorted by date desc
      return {
        doctorName: userData?.name || "Dr. " + (userData?.firstName || "Unknown"),
        date: new Date(latest.appointmentDate).toLocaleDateString(),
        medicine: latest.medicine,
        notes: latest.doctorNotes
      }
    }
    return null
  }

  const toggleCompletionForm = (appointmentId: string) => {
    const isOpen = showCompletionForm[appointmentId] || false
    setShowCompletionForm({...showCompletionForm, [appointmentId]: !isOpen})
    
    if (!isOpen) {
      // Initialize completion data for this appointment
      setCompletionData((prev) => ({
        ...prev,
        [appointmentId]: {
          medicines: [],
          notes: "",
          recheckupRequired: false,
        },
      }))
      setShowAiPrescriptionSuggestion({...showAiPrescriptionSuggestion, [appointmentId]: true})
      // Auto-generate AI prescription when form opens
      const appointment = appointments.find(apt => apt.id === appointmentId)
      if (appointment) {
        handleGenerateAiPrescription(appointmentId)
      }
    } else {
      // Clean up when closing
      setCompletionData((prev) => {
        const updated = { ...prev }
        delete updated[appointmentId]
        return updated
      })
      
      const newAiPrescription = {...aiPrescription}
      delete newAiPrescription[appointmentId]
      setAiPrescription(newAiPrescription)
    }
  }

  // Helper function to add a new medicine
  const addMedicine = (appointmentId: string) => {
    setCompletionData((prev) => {
      const currentData = prev[appointmentId] || { medicines: [], notes: "", recheckupRequired: false }
      return {
        ...prev,
        [appointmentId]: {
          ...currentData,
          medicines: [...currentData.medicines, { name: "", dosage: "", frequency: "", duration: "" }],
        },
      }
    })
  }

  // Helper function to remove a medicine
  const removeMedicine = (appointmentId: string, index: number) => {
    setCompletionData((prev) => {
      const currentData = prev[appointmentId] || { medicines: [], notes: "", recheckupRequired: false }
      const updatedMedicines = currentData.medicines.filter((_, i) => i !== index)
      return {
        ...prev,
        [appointmentId]: {
          ...currentData,
          medicines: updatedMedicines,
        },
      }
    })
  }

  // Helper function to update a medicine field
  const updateMedicine = (appointmentId: string, index: number, field: string, value: string) => {
    setCompletionData((prev) => {
      const currentData = prev[appointmentId] || { medicines: [], notes: "", recheckupRequired: false }
      const updatedMedicines = [...currentData.medicines]
      updatedMedicines[index] = { ...updatedMedicines[index], [field]: value }
      return {
        ...prev,
        [appointmentId]: {
          ...currentData,
          medicines: updatedMedicines,
        },
      }
    })
  }

  const getMedicineNameSuggestions = useCallback(
    (query: string, limitOptions = 5) => {
      if (!medicineSuggestions.length) return []
      const cleaned = query.trim().toLowerCase()
      if (cleaned.length < 2) return []

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
    appointmentId: string,
    index: number,
    suggestion: MedicineSuggestion,
    { setFocusNext = false }: { setFocusNext?: boolean } = {}
  ) => {
    const sanitizedName = sanitizeMedicineName(suggestion.name)
    updateMedicine(appointmentId, index, "name", sanitizedName || suggestion.name)
    const currentMed = completionData[appointmentId]?.medicines?.[index]

    if ((!currentMed?.dosage || !currentMed.dosage.trim()) && suggestion.dosageOptions?.length) {
      updateMedicine(appointmentId, index, "dosage", suggestion.dosageOptions[0].value)
    }
    if (
      (!currentMed?.frequency || !currentMed.frequency.trim()) &&
      suggestion.frequencyOptions?.length
    ) {
      updateMedicine(appointmentId, index, "frequency", suggestion.frequencyOptions[0].value)
    }
    if (
      (!currentMed?.duration || !currentMed.duration.trim()) &&
      suggestion.durationOptions?.length
    ) {
      updateMedicine(appointmentId, index, "duration", suggestion.durationOptions[0].value)
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

  const getTopOptions = (options?: MedicineSuggestionOption[]) =>
    (options || []).slice(0, 4)

  const handleOptionChipClick = (
    appointmentId: string,
    index: number,
    field: "dosage" | "frequency" | "duration",
    value: string
  ) => {
    updateMedicine(appointmentId, index, field, value)
  }

  const updateInlineSuggestion = useCallback(
    (appointmentId: string, index: number, value: string) => {
      const cleanedValue = value.trim()
      if (cleanedValue.length < 2) {
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
    [getMedicineNameSuggestions]
  )

  const acceptInlineSuggestion = (
    appointmentId: string,
    index: number
  ) => {
    if (
      inlineSuggestion &&
      inlineSuggestion.appointmentId === appointmentId &&
      inlineSuggestion.index === index
    ) {
      const suggestion = medicineSuggestions.find(
        (item) => item.name === inlineSuggestion.suggestion
      )
      if (suggestion) {
        handleSelectMedicineSuggestion(appointmentId, index, suggestion, { setFocusNext: true })
      } else {
        updateMedicine(appointmentId, index, "name", inlineSuggestion.suggestion)
        setInlineSuggestion(null)
      }
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

  // Parse AI diagnosis into structured format for better display
  const parseAIDiagnosis = (text: string) => {
    const sections: {
      diagnosis: string;
      tests: string[];
      treatment: string;
      urgent: string;
      notes: string;
    } = {
      diagnosis: '',
      tests: [],
      treatment: '',
      urgent: '',
      notes: ''
    }

    // Extract sections using regex - Updated to match new AI format
    const diagnosisMatch = text.match(/\*\*.*?DIAGNOSIS:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
    const testsMatch = text.match(/\*\*.*?TESTS:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
    const treatmentMatch = text.match(/\*\*.*?TREATMENT.*?:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
    const urgentMatch = text.match(/\*\*.*?(?:WHEN TO SEEK|WARNING SIGNS|RED FLAGS).*?:\*\*\s*([\s\S]*?)(?=\*\*|---|\n\n\*Note|$)/i)
    const notesMatch = text.match(/\*\*.*?(?:⚠️\s*IMPORTANT NOTES|IMPORTANT NOTES|NOTES|EDUCATION).*?:\*\*\s*([\s\S]*?)(?=\*\*|---|\n\n\*Note|$)/i)

    if (diagnosisMatch) sections.diagnosis = diagnosisMatch[1].trim()
    if (testsMatch) {
      const testsList = testsMatch[1].match(/\d+\.\s*(.+?)(?=\n\d+\.|\n\n|$)/g)
      if (testsList) {
        sections.tests = testsList.map((t: string) => t.replace(/^\d+\.\s*/, '').trim()).filter(test => test.length > 0)
      }
    }
    if (treatmentMatch) sections.treatment = treatmentMatch[1].trim()
    if (urgentMatch) sections.urgent = urgentMatch[1].trim()
    if (notesMatch) sections.notes = notesMatch[1].trim()

    return sections
  }

  // AI Diagnosis Function - Automatically uses patient data from appointment
  const getAIDiagnosisSuggestion = async (appointment: AppointmentType) => {
    setLoadingAiDiagnosis({...loadingAiDiagnosis, [appointment.id]: true})
    
    try {
      // Automatically build comprehensive patient info from appointment data
      const ageValue = calculateAge(appointment.patientDateOfBirth)
      const age = ageValue !== null ? `${ageValue}` : 'Unknown'
      let patientInfo = `Age: ${age}, Gender: ${appointment.patientGender || 'Unknown'}, Blood Group: ${appointment.patientBloodGroup || 'Unknown'}, Drinking Habits: ${appointment.patientDrinkingHabits || 'None'}, Smoking Habits: ${appointment.patientSmokingHabits || 'None'}, Diet: ${appointment.patientVegetarian || 'Unknown'}`

      if (appointment.patientHeightCm != null) {
        patientInfo += `, Height: ${appointment.patientHeightCm} cm`
      }
      if (appointment.patientWeightKg != null) {
        patientInfo += `, Weight: ${appointment.patientWeightKg} kg`
      }
      if (appointment.patientOccupation) {
        patientInfo += `, Occupation: ${appointment.patientOccupation}`
      }
      if (appointment.patientFamilyHistory) {
        patientInfo += `, Family History: ${appointment.patientFamilyHistory}`
      }
      if (appointment.patientPregnancyStatus) {
        const preg = /yes/i.test(appointment.patientPregnancyStatus) ? 'Yes' : /no/i.test(appointment.patientPregnancyStatus) ? 'No' : appointment.patientPregnancyStatus
        patientInfo += `, Pregnancy Status: ${preg}`
      }

      // Add allergies - CRITICAL for prescriptions
      if (appointment.patientAllergies) {
        patientInfo += `, ALLERGIES: ${appointment.patientAllergies} (DO NOT prescribe these)`
      }
      
      // Add current medications - to avoid drug interactions
      if (appointment.patientCurrentMedications) {
        patientInfo += `, Current Medications: ${appointment.patientCurrentMedications}`
      }
      
      // Automatically use chief complaint and medical history
      const symptoms = appointment.chiefComplaint
      const medicalHistory = appointment.medicalHistory || ""
      
      // Call diagnosis API
      //
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to generate AI diagnosis")
      }
      const token = await currentUser.getIdToken()

      const { data } = await axios.post(
        "/api/diagnosis",
        {
          symptoms,
          patientInfo,
          medicalHistory,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      //
      
      const diagnosisText = data?.[0]?.generated_text || "Unable to generate diagnosis"
      //
      
      setAiDiagnosis({...aiDiagnosis, [appointment.id]: diagnosisText})
      //
      
      setNotification({ type: "success", message: "AI diagnosis suggestion generated!" })
    } catch (error: unknown) {
      console.error("AI Diagnosis error:", error)
      console.error("Error response:", (error as { response?: { data?: unknown; status?: number } }).response?.data)
      console.error("Error status:", (error as { response?: { data?: unknown; status?: number } }).response?.status)
      
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || (error as Error).message || "Failed to get AI diagnosis"
      setNotification({ 
        type: "error", 
        message: `AI Diagnosis Error: ${errorMessage}` 
      })
    } finally {
      setLoadingAiDiagnosis({...loadingAiDiagnosis, [appointment.id]: false})
    }
  }

  const handleGenerateAiPrescription = async (appointmentId: string) => {
    if (!appointmentId) return
    
    const appointment = appointments.find(apt => apt.id === appointmentId)
    if (!appointment) return

    setLoadingAiPrescription({...loadingAiPrescription, [appointmentId]: true})
    try {
      const ageValue = calculateAge(appointment.patientDateOfBirth)
      let patientInfo = `Age: ${ageValue}, Gender: ${appointment.patientGender || 'Unknown'}, Blood Group: ${appointment.patientBloodGroup || 'Unknown'}`

      if (appointment.patientHeightCm != null) {
        patientInfo += `, Height: ${appointment.patientHeightCm} cm`
      }
      if (appointment.patientWeightKg != null) {
        patientInfo += `, Weight: ${appointment.patientWeightKg} kg`
      }

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to generate AI prescription")
      }
      const token = await currentUser.getIdToken()

      const { data } = await axios.post(
        "/api/prescription/generate",
        {
          chiefComplaint: appointment.chiefComplaint || "",
          medicalHistory: appointment.medicalHistory || "",
          patientInfo,
          allergies: appointment.patientAllergies || "",
          currentMedications: appointment.patientCurrentMedications || "",
          patientAge: ageValue,
          patientGender: appointment.patientGender || "",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      setAiPrescription({
        ...aiPrescription,
        [appointmentId]: {
          medicine: data.medicine || "",
          notes: data.notes || ""
        }
      })
      setNotification({ type: "success", message: "AI prescription generated!" })
    } catch (error: unknown) {
      console.error("AI Prescription error:", error)
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || (error as Error).message || "Failed to generate AI prescription"
      setNotification({ 
        type: "error", 
        message: `AI Prescription Error: ${errorMessage}` 
      })
    } finally {
      setLoadingAiPrescription({...loadingAiPrescription, [appointmentId]: false})
    }
  }

  // Helper function to parse AI prescription text into structured format
  const parseAiPrescription = (text: string): Array<{name: string, dosage: string, frequency: string, duration: string}> => {
    const medicines: Array<{name: string, dosage: string, frequency: string, duration: string}> = []
    
    // Split by newlines and try to parse each line
    const lines = text.split('\n').filter(line => line.trim())
    
    let currentMedicine: {name: string, dosage: string, frequency: string, duration: string} | null = null
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // Skip empty lines
      if (!trimmedLine) continue
      
      // Check if this looks like a new medicine (starts with number, dash, or medicine name pattern)
      const medicinePattern = /^(\d+\.?\s*)?([A-Z][a-zA-Z\s]+(?:\s+\d+[a-z]{2})?)/i
      const match = trimmedLine.match(medicinePattern)
      
      if (match || trimmedLine.match(/^[A-Z]/)) {
        // Save previous medicine if exists
        if (currentMedicine && currentMedicine.name) {
          medicines.push(currentMedicine)
        }
        
        // Extract medicine name (remove numbering and common prefixes)
        let name = trimmedLine.replace(/^\d+\.?\s*/, '').replace(/^-\s*/, '').trim()
        
        // Try to extract dosage, frequency, etc. from the same line
        let dosage = ""
        let frequency = ""
        let duration = ""
        
        // Look for common patterns like "500mg", "1-0-1", "2 times daily", "for 5 days"
        const dosageMatch = trimmedLine.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|tablet|tab|capsule|cap))/i)
        if (dosageMatch) {
          dosage = dosageMatch[1]
          name = name.replace(dosageMatch[0], '').trim()
        }
        
        const frequencyMatch = trimmedLine.match(/(\d+[-\s]\d+[-\s]\d+|\d+\s*(?:times|tab|cap)s?\s*(?:daily|per day|a day)|once|twice)/i)
        if (frequencyMatch) {
          frequency = frequencyMatch[1]
          name = name.replace(frequencyMatch[0], '').trim()
        }
        
        const durationMatch = trimmedLine.match(/(?:for|duration|take|continue)\s+(\d+\s*(?:days?|weeks?|months?|times?))?/i)
        if (durationMatch && durationMatch[1]) {
          duration = durationMatch[1]
        }
        
        // Clean up name (remove extra spaces and punctuation)
        name = name.replace(/[,;:]\s*$/, '').trim()
        
        currentMedicine = { name: name || "Medicine", dosage, frequency, duration }
      } else if (currentMedicine) {
        // Check if this line contains frequency or duration info
        const frequencyMatch = trimmedLine.match(/(\d+[-\s]\d+[-\s]\d+|\d+\s*(?:times|tab|cap)s?\s*(?:daily|per day|a day)|once|twice)/i)
        if (frequencyMatch && !currentMedicine.frequency) {
          currentMedicine.frequency = frequencyMatch[1]
        }
        
        const durationMatch = trimmedLine.match(/(?:for|duration|take|continue)\s+(\d+\s*(?:days?|weeks?|months?|times?))?/i)
        if (durationMatch && durationMatch[1] && !currentMedicine.duration) {
          currentMedicine.duration = durationMatch[1]
        }
      }
    }
    
    // Add last medicine if exists
    if (currentMedicine && currentMedicine.name) {
      medicines.push(currentMedicine)
    }
    
    // If parsing failed, create one medicine entry with the name from text
    if (medicines.length === 0 && text.trim()) {
      const firstLine = text.split('\n')[0].trim()
      medicines.push({
        name: firstLine || "Medicine",
        dosage: "",
        frequency: "",
        duration: ""
      })
    }
    
    return medicines
  }

  const handleAcceptPrescription = (appointmentId: string) => {
    if (aiPrescription[appointmentId]) {
      const parsedMedicines = parseAiPrescription(aiPrescription[appointmentId].medicine)
      setCompletionData((prev) => ({
        ...prev,
        [appointmentId]: {
          ...prev[appointmentId],
          medicines:
            parsedMedicines.length > 0
              ? parsedMedicines
              : [{ name: "", dosage: "", frequency: "", duration: "" }],
        },
      }))
      setShowAiPrescriptionSuggestion({...showAiPrescriptionSuggestion, [appointmentId]: false})
      setNotification({ type: "success", message: "AI prescription accepted! You can still edit it." })
    }
  }

  const handleDeclinePrescription = (appointmentId: string) => {
    setShowAiPrescriptionSuggestion({...showAiPrescriptionSuggestion, [appointmentId]: false})
  }

  const handleCopyPreviousPrescription = (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId)
    if (!appointment) return

    // Get the latest previous prescription from patient history
    const sameDoctorHistory = patientHistory.filter((historyItem: AppointmentType) => 
      historyItem.doctorId === appointment.doctorId && 
      historyItem.id !== appointment.id &&
      historyItem.medicine
    )
    
    if (sameDoctorHistory.length > 0) {
      const latest = sameDoctorHistory[0] // Already sorted by date desc
      if (latest.medicine) {
        // Parse the previous prescription
        const parsed = parsePrescription(latest.medicine)
        if (parsed && parsed.medicines.length > 0) {
          // Convert to structured format
          const structuredMedicines = parsed.medicines.map(med => ({
            name: med.name || "",
            dosage: med.dosage || "",
            frequency: med.frequency || "",
            duration: med.duration || ""
          }))
          
          // Populate completion data with previous prescription
          setCompletionData((prev) => ({
            ...prev,
            [appointmentId]: {
              medicines: structuredMedicines,
              notes: latest.doctorNotes || "",
              recheckupRequired: false,
            },
          }))
          
          setNotification({ 
            type: "success", 
            message: "Previous prescription copied! You can edit it as needed." 
          })
        } else {
          setNotification({ 
            type: "error", 
            message: "Could not parse previous prescription" 
          })
        }
      }
    } else {
      setNotification({ 
        type: "error", 
        message: "No previous prescription found for this patient" 
      })
    }
  }

  const runCompletionFlow = async (
    appointmentId: string,
    formData: CompletionFormEntry,
    options?: { showToast?: boolean }
  ) => {
    const appointmentSnapshot = appointments.find((apt) => apt.id === appointmentId)
    const medicineText = formatMedicinesAsText(formData.medicines, formData.notes)

    const result = await completeAppointment(
      appointmentId,
      medicineText,
      formData.notes
    )

    setAppointments((prevAppointments) =>
      prevAppointments.map((apt) =>
        apt.id === appointmentId ? { ...apt, ...result.updates } : apt
      )
    )

    if (formData.recheckupRequired && appointmentSnapshot) {
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {
          throw new Error("You must be logged in to send re-checkup messages")
        }
        const token = await currentUser.getIdToken()

        const response = await fetch("/api/doctor/send-recheckup-whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            appointmentId,
            patientId: appointmentSnapshot.patientId,
            patientPhone: appointmentSnapshot.patientPhone,
            doctorName: appointmentSnapshot.doctorName || userData?.name || "Doctor",
            appointmentDate: appointmentSnapshot.appointmentDate,
          }),
        })

        if (!response.ok) {
          console.error("Failed to send re-checkup WhatsApp message")
        }
      } catch (error) {
        console.error("Error sending re-checkup WhatsApp:", error)
      }
    }

    if (options?.showToast !== false) {
      setNotification({
        type: "success",
        message:
          result.message +
          (formData.recheckupRequired
            ? " Re-checkup message sent to patient."
            : ""),
      })
    }

    try {
      await recordMedicineSuggestions(formData.medicines)
      await refreshMedicineSuggestions()
    } catch (suggestionError) {
      console.error("Failed to record medicine suggestions", suggestionError)
    }

    setCompletionData((prev) => {
      const updated = { ...prev }
      delete updated[appointmentId]
      return updated
    })

    setAiPrescription((prev) => {
      const updated = { ...prev }
      delete updated[appointmentId]
      return updated
    })

    setShowCompletionForm((prev) => ({ ...prev, [appointmentId]: false }))
    setShowAiPrescriptionSuggestion((prev) => ({
      ...prev,
      [appointmentId]: true,
    }))

    return result
  }

  const handleCompleteAppointment = async (e: React.FormEvent, appointmentId: string) => {
    e.preventDefault()
    
    if (!appointmentId) return
    
    const currentData: CompletionFormEntry = completionData[appointmentId] || { medicines: [], notes: "", recheckupRequired: false }
    
    // Validate that at least one medicine has a name
    if (!hasValidPrescriptionInput(currentData)) {
      setNotification({ 
        type: "error", 
        message: "Please add at least one medicine with a name" 
      })
      return
    }

    setUpdating({...updating, [appointmentId]: true})
    try {
      await runCompletionFlow(appointmentId, currentData)
    } catch (error: unknown) {
      console.error("Error completing appointment:", error)
      setNotification({ 
        type: "error", 
        message: error instanceof Error ? error.message : "Failed to complete appointment" 
      })
    } finally {
      setUpdating({...updating, [appointmentId]: false})
    }
  }

  const handleAdmitPatient = async (appointment: AppointmentType) => {
    if (!appointment?.id) return
    const appointmentId = appointment.id
    if (admitting[appointmentId]) return

    setAdmitting(prev => ({ ...prev, [appointmentId]: true }))
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to submit admission requests")
      }
      const token = await currentUser.getIdToken()

      const res = await fetch("/api/doctor/admission-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          appointmentId
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to submit admission request")
      }

      const data = await res.json().catch(() => ({}))
      setAppointments(prev =>
        prev.map(apt =>
          apt.id === appointmentId
            ? {
                ...apt,
                status: "awaiting_admission" as any,
                admissionRequestId: data?.requestId || (apt as any)?.admissionRequestId || null,
                updatedAt: new Date().toISOString()
              }
            : apt
        )
      )
      setNotification({
        type: "success",
        message: "Admission request sent to receptionist."
      })
    } catch (error: any) {
      console.error("Admit patient error", error)
      setNotification({
        type: "error",
        message: error?.message || "Failed to submit admission request"
      })
    } finally {
      setAdmitting(prev => ({ ...prev, [appointmentId]: false }))
    }
  }

  const openAdmitDialog = (appointment: AppointmentType) => {
    setAdmitDialog({
      open: true,
      appointment,
      note: "",
    })
  }

  const closeAdmitDialog = () => {
    setAdmitDialog({
      open: false,
      appointment: null,
      note: "",
    })
  }

  const confirmAdmitPatient = async () => {
    if (!admitDialog.appointment) return
    
    const appointmentId = admitDialog.appointment.id
    
    // Prevent duplicate clicks - disable immediately
    if (admitting[appointmentId]) return
    
    // Check if appointment already has an admission request
    const appointment = appointments.find(apt => apt.id === appointmentId)
    if (appointment?.admissionRequestId) {
      setNotification({
        type: "error",
        message: "Admission request already sent. Please wait for receptionist to process."
      })
      closeAdmitDialog()
      return
    }
    
    // Set admitting state immediately to disable button
    setAdmitting(prev => ({ ...prev, [appointmentId]: true }))
    
    try {
      // Check if appointment already has a saved prescription
      let hasMedicine = Boolean(appointment?.medicine && appointment.medicine.trim())
      
      // Check completion form data (not yet submitted)
      const formData = completionData[appointmentId]
      const hasFormMedicine = hasValidPrescriptionInput(formData)
      
      if (!hasMedicine && !hasFormMedicine) {
        setNotification({
          type: "error",
          message: "Please add at least one medicine before admitting the patient."
        })
        setAdmitting(prev => ({ ...prev, [appointmentId]: false }))
        closeAdmitDialog()
        return
      }
      
      // If form data exists but wasn't saved yet, finalize the checkup automatically
      if (!hasMedicine && hasFormMedicine && formData) {
        setUpdating(prev => ({ ...prev, [appointmentId]: true }))
        try {
          await runCompletionFlow(appointmentId, formData, { showToast: false })
          hasMedicine = true
        } catch (error) {
          console.error("Auto-complete before admission failed:", error)
          setNotification({
            type: "error",
            message: error instanceof Error
              ? error.message
              : "Failed to save prescription before admitting. Please try again."
          })
          setAdmitting(prev => ({ ...prev, [appointmentId]: false }))
          closeAdmitDialog()
          return
        } finally {
          setUpdating(prev => ({ ...prev, [appointmentId]: false }))
        }
      }
      
      if (!hasMedicine) {
        setNotification({
          type: "error",
          message: "Please add at least one medicine before admitting the patient."
        })
        setAdmitting(prev => ({ ...prev, [appointmentId]: false }))
        closeAdmitDialog()
        return
      }
      
      // handleAdmitPatient will manage the admitting state
      await handleAdmitPatient(admitDialog.appointment)
      closeAdmitDialog()
    } catch (error) {
      console.error("Admit patient error:", error)
      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to admit patient. Please try again."
      })
    } finally {
      setAdmitting(prev => ({ ...prev, [appointmentId]: false }))
    }
  }

  // Date filtering functions
  const isToday = (date: string) => {
    const appointmentDate = new Date(date)
    const today = new Date()
    return appointmentDate.toDateString() === today.toDateString()
  }

  const isTomorrow = (date: string) => {
    const appointmentDate = new Date(date)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return appointmentDate.toDateString() === tomorrow.toDateString()
  }

  const isThisWeek = (date: string) => {
    const appointmentDate = new Date(date)
    const today = new Date()
    const endOfWeek = new Date(today)
    endOfWeek.setDate(today.getDate() + 7)
    return appointmentDate >= today && appointmentDate <= endOfWeek
  }

  const isNextWeek = (date: string) => {
    const appointmentDate = new Date(date)
    const today = new Date()
    const startOfNextWeek = new Date(today)
    startOfNextWeek.setDate(today.getDate() + 8)
    const endOfNextWeek = new Date(today)
    endOfNextWeek.setDate(today.getDate() + 14)
    return appointmentDate >= startOfNextWeek && appointmentDate <= endOfNextWeek
  }

  // Filter appointments by date ranges
  const confirmedAppointments = appointments.filter(apt => apt.status === "confirmed")
  const historyAppointments = appointments.filter(apt => apt.status === "completed")
  
  const todayAppointments = confirmedAppointments.filter(apt => isToday(apt.appointmentDate))
  const tomorrowAppointments = confirmedAppointments.filter(apt => isTomorrow(apt.appointmentDate))
  const thisWeekAppointments = confirmedAppointments.filter(apt => isThisWeek(apt.appointmentDate))
  const nextWeekAppointments = confirmedAppointments.filter(apt => isNextWeek(apt.appointmentDate))
  
  // Sort functions
  const sortByDateTime = (a: AppointmentType, b: AppointmentType) => {
    const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`)
    const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`)
    return dateA.getTime() - dateB.getTime()
  }
  
  const sortByDateTimeDesc = (a: AppointmentType, b: AppointmentType) => {
    const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`)
    const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`)
    return dateB.getTime() - dateA.getTime()
  }
  
  const filteredHistoryAppointments = useMemo(() => {
    const normalizedQuery = historyTabFilters.text.trim().toLowerCase()
    return historyAppointments.filter(apt => {
      const matchesText = normalizedQuery
        ? [
            apt.patientName,
            apt.patientId,
            apt.id,
            apt.chiefComplaint,
            apt.associatedSymptoms,
            apt.medicalHistory,
            apt.doctorNotes
          ].some(field => (field || "").toLowerCase().includes(normalizedQuery))
        : true

      const matchesDate = historyTabFilters.date
        ? new Date(apt.appointmentDate).toISOString().split("T")[0] === historyTabFilters.date
        : true

      return matchesText && matchesDate
    })
  }, [historyAppointments, historyTabFilters])

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistoryAppointments.length / historyPageSize))

  const paginatedHistoryAppointments = useMemo(() => {
    const sorted = [...filteredHistoryAppointments].sort(sortByDateTimeDesc)
    const startIndex = (historyPage - 1) * historyPageSize
    return sorted.slice(startIndex, startIndex + historyPageSize)
  }, [filteredHistoryAppointments, historyPage, historyPageSize])

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages)
    }
  }, [historyPage, totalHistoryPages])

  useEffect(() => {
    if (activeTab === "history") {
      setHistoryPage(1)
    }
  }, [historyTabFilters, historyPageSize, activeTab])

  if (loading) {
    return <LoadingSpinner message="Loading appointments..." />
  }

  if (!user || !userData) {
    return null
  }

  // Get displayed appointments based on active tab
  const getDisplayedAppointments = () => {
    switch (activeTab) {
      case "today":
        return [...todayAppointments].sort(sortByDateTime)
      case "tomorrow":
        return [...tomorrowAppointments].sort(sortByDateTime)
      case "thisWeek":
        return [...thisWeekAppointments].sort(sortByDateTime)
      case "nextWeek":
        return [...nextWeekAppointments].sort(sortByDateTime)
      case "history":
        return paginatedHistoryAppointments
      default:
        return []
    }
  }
  
  const displayedAppointments = getDisplayedAppointments()

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Page Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-3xl text-slate-700">
              📋
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Patient Appointments</h1>
              <p className="text-slate-500 text-sm mt-1">Manage and complete patient consultations</p>
            </div>
          </div>
        </div>

        {/* Appointments Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">
            All Appointments
          </h2>

          {/* Tabs - Clean Professional Design */}
          <div className="border-b border-slate-200 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex gap-4 sm:gap-6 lg:gap-8 overflow-x-auto pb-px w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("today")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "today"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">Today</span>
                  {todayAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {todayAppointments.length}
                    </div>
                  )}
                  {activeTab === "today" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
                
            <button
              onClick={() => setActiveTab("tomorrow")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "tomorrow"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">Tomorrow</span>
                  {tomorrowAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {tomorrowAppointments.length}
                    </div>
                  )}
                  {activeTab === "tomorrow" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
                
            <button
              onClick={() => setActiveTab("thisWeek")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "thisWeek"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">This Week</span>
                  {thisWeekAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {thisWeekAppointments.length}
                    </div>
                  )}
                  {activeTab === "thisWeek" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
                
            <button
              onClick={() => setActiveTab("nextWeek")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "nextWeek"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">Next Week</span>
                  {nextWeekAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {nextWeekAppointments.length}
                    </div>
                  )}
                  {activeTab === "nextWeek" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
                
            <button
              onClick={() => setActiveTab("history")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "history"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">History</span>
                  {historyAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {historyAppointments.length}
                    </div>
                  )}
                  {activeTab === "history" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
          </div>
              
        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs sm:text-sm"
        >
                {refreshing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <style jsx>{`
            @keyframes slide-in {
              from {
                transform: scaleX(0);
                opacity: 0;
              }
              to {
                transform: scaleX(1);
                opacity: 1;
              }
            }
            
            .animate-slide-in {
              animation: slide-in 0.3s ease-out;
              transform-origin: left;
            }
          `}</style>

          {activeTab === "history" && (
            <div className="mb-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
                  <input type="text" value={historyTabFilters.text}
                    onChange={(e) => setHistoryTabFilters(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Search by patient name, appointment ID, symptoms..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                  />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <input type="date" value={historyTabFilters.date}
                    onChange={(e) => setHistoryTabFilters(prev => ({ ...prev, date: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                  />
                  {(historyTabFilters.text || historyTabFilters.date) && (
                    <button type="button"  onClick={() => setHistoryTabFilters({ text: "", date: "" })}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg bg-white hover:bg-slate-100"
                    > Reset </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-500 flex items-center justify-between">
                <span>
                  Filtering{" "}
                  <span className="font-semibold text-slate-800">{filteredHistoryAppointments.length}</span> of{" "}
                  <span className="font-semibold text-slate-800">{historyAppointments.length}</span> completed appointments
                </span>
                <span className="italic">Tip: search by patient ID, date, or chief complaint</span>
              </div>
            </div>
          )}

          {displayedAppointments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <span className="text-6xl text-slate-300 block mb-3"> 📋 </span>
              <p className="text-slate-600 font-medium">
                {activeTab === "today" ? "No appointments scheduled for today" :
                 activeTab === "tomorrow" ? "No appointments scheduled for tomorrow" :
                 activeTab === "thisWeek" ? "No appointments scheduled this week" :
                 activeTab === "nextWeek" ? "No appointments scheduled next week" :
                 "No appointment history"}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                {activeTab === "history" ? "Completed appointments will appear here" : 
                 "Appointments will appear here once patients book them"}
              </p>
            </div>
          ) : activeTab === "history" ? (
            <div className="space-y-2.5">
              {displayedAppointments.map((appointment) => {
                const isExpanded = expandedAppointment === appointment.id
                return (
                  <div key={appointment.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span>{appointment.patientName}</span>
                        <span className="text-[11px] font-normal text-slate-500 border-l border-slate-200 pl-2">
                          ID: {appointment.patientId}
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">
                        <p className="font-semibold text-slate-700 text-xs">
                          {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p>{appointment.appointmentTime}</p>
                      </div>
                    </div>
                    <div className="mt-1 text-[12px] text-slate-600 line-clamp-2">
                      {appointment.chiefComplaint || "No chief complaint recorded."}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>Doctor: {appointment.doctorName}</span>
                        <span>Prescription: {appointment.medicine ? "Provided" : "Pending"}</span>
                        <span>Notes: {appointment.doctorNotes ? "Added" : "Pending"}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleAccordion(appointment.id)}
                          className="px-2.5 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 font-semibold transition-colors"
                        >
                          {isExpanded ? "Hide Details" : "View Details"}
                        </button>
                        {appointment.medicine && (
                          <button
                            onClick={() => generatePrescriptionPDF(appointment as unknown as AppointmentType)}
                            className="px-2.5 py-1 rounded-md border border-teal-300 text-teal-700 hover:bg-teal-50 font-semibold transition-colors"
                          >Download PDF  </button>
                        )}
                      </div>
                    </div>
                    {appointment.associatedSymptoms && (
                      <div className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                        Symptoms: {appointment.associatedSymptoms}
                      </div>
                    )}
                    {isExpanded && (
                      <div className="mt-2 border border-slate-200 rounded-lg bg-slate-50 p-2.5 space-y-2 text-[11px] text-slate-700">
                        {appointment.medicine && (() => {
                          const parsed = parsePrescription(appointment.medicine)
                          if (parsed && parsed.medicines.length > 0) {
                            return (
                              <div className="space-y-2">
                                <p className="font-semibold text-slate-800 mb-1">Prescription</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {parsed.medicines.map((med, medIndex) => (
                                    <div key={medIndex} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm">
                                      <div className="flex items-start gap-1.5 mb-1">
                                        <span className="text-base">{med.emoji}</span>
                                        <div className="flex-1">
                                          <p className="font-semibold text-slate-900 text-xs">
                                            {med.name}
                                            {med.dosage && <span className="text-slate-500 font-normal ml-1">({med.dosage})</span>}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="ml-5 space-y-0.5 text-[11px] text-slate-600">
                                        {med.frequency && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-slate-300">•</span>
                                            <span>{med.frequency}</span>
                                          </div>
                                        )}
                                        {med.duration && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-slate-300">•</span>
                                            <span><span className="font-medium">Duration:</span> {med.duration}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {parsed.advice && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-xs text-amber-800">
                                    <span className="font-semibold">📌 Advice:</span> {parsed.advice}
                                  </div>
                                )}
                              </div>
                            )
                          }
                          return (
                            <div>
                              <p className="font-semibold text-slate-800 mb-1">Prescription</p>
                              <pre className="whitespace-pre-wrap">{appointment.medicine}</pre>
                            </div>
                          )
                        })()}
                        {appointment.doctorNotes && (
                          <div>
                            <p className="font-semibold text-slate-800 mb-1">Doctor Notes</p>
                            <p>{appointment.doctorNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {displayedAppointments.map((appointment) => (
                <div key={appointment.id} id={`appointment-${appointment.id}`} className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-teal-300 hover:shadow-lg transition-all">
                  {/* Accordion Header */}
                  <div 
                    onClick={() => toggleAccordion(appointment.id)}
                    className="p-5 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Patient Avatar */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-teal-700 group-hover:scale-110 transition-transform flex-shrink-0">
                        {appointment.patientName.charAt(0).toUpperCase()}
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-slate-900 group-hover:text-teal-700 transition-colors">
                            {appointment.patientName}
                          </h3>
                          {appointment.patientGender && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                              {appointment.patientGender === "Male" ? "👨" : appointment.patientGender === "Female" ? "👩" : "👤"} {appointment.patientGender}
                            </span>
                          )}
                          {appointment.patientBloodGroup && (
                            <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-semibold">
                              🩸 {appointment.patientBloodGroup}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <span>📅</span>
                            {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <span>🕐</span>
                            {appointment.appointmentTime}
                          </span>
                          {appointment.patientPhone && (
                            <span className="flex items-center gap-1">
                              <span>📱</span>
                              {appointment.patientPhone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-3">
                        <span className={`px-4 py-2 rounded-lg text-sm font-bold ${getStatusColor(appointment.status)}`}>
                          {appointment.status === "confirmed" ? "✓ Confirmed" : 
                           appointment.status === "completed" ? "✓ Completed" : 
                           appointment.status}
                        </span>
                        
                        {/* Expand Icon */}
                        <div className={`w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition-transform duration-300 ${expandedAppointment === appointment.id ? 'rotate-180 bg-teal-100' : ''}`}>
                          <span className="text-slate-600 text-sm">▼</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {expandedAppointment === appointment.id && (
                    <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-t-2 border-slate-200">
                      {/* Top Section: Patient Info (Left) + Lifestyle & Appointment (Right) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* LEFT: Patient Information Only */}
                        <div>
                          <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base pb-3 border-b border-slate-200">
                              <span className="text-xl">👤</span>
                              <span>Patient Information</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Patient ID</span>
                                <p className="font-mono text-slate-800 mt-1 text-xs break-all">{appointment.patientId}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Full Name</span>
                                <p className="text-slate-900 mt-1 font-semibold">{appointment.patientName}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Email</span>
                                <p className="text-slate-900 mt-1">{appointment.patientEmail}</p>
                              </div>
                              {appointment.patientPhone && (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold">Phone</span>
                                  <p className="text-slate-900 mt-1 font-semibold">{appointment.patientPhone}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                {appointment.patientGender && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <span className="text-slate-500 text-xs font-semibold">Gender</span>
                                    <p className="text-slate-900 mt-1 font-semibold">{appointment.patientGender}</p>
                                  </div>
                                )}
                                {appointment.patientBloodGroup && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <span className="text-slate-500 text-xs font-semibold">Blood Group</span>
                                    <p className="text-slate-900 mt-1 font-bold text-lg">{appointment.patientBloodGroup}</p>
                                  </div>
                                )}
                            {appointment.patientHeightCm != null && (
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Height</span>
                                <p className="text-slate-900 mt-1 font-semibold">{appointment.patientHeightCm} cm</p>
                              </div>
                            )}
                            {appointment.patientWeightKg != null && (
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Weight</span>
                                <p className="text-slate-900 mt-1 font-semibold">{appointment.patientWeightKg} kg</p>
                              </div>
                            )}
                              </div>
                              {appointment.patientDateOfBirth && (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  <span className="text-slate-600 text-xs font-semibold uppercase">Date of Birth</span>
                                  <p className="text-slate-900 mt-1 font-semibold">
                                    {new Date(appointment.patientDateOfBirth).toLocaleDateString()}
                                    <span className="text-slate-500 text-xs ml-2">
                                      {(() => {
                                        const age = calculateAge(appointment.patientDateOfBirth)
                                        return age !== null ? `(Age: ${age} years)` : '(Age: N/A)'
                                      })()}
                                    </span>
                                  </p>
                                </div>
                              )}
                              
                              {/* Latest Checkup Recommendation - Only show if available */}
                              {(() => {
                                const latestRecommendation = getLatestCheckupRecommendation(appointment)
                                return latestRecommendation && (
                                  <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 mt-3">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-blue-600 text-lg">🩺</span>
                                      <h5 className="font-bold text-blue-800 text-sm">Latest Recommendation</h5>
                                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                        {latestRecommendation.date}
                                      </span>
                                    </div>
                                    
                                    {latestRecommendation.medicine && (() => {
                                      const parsed = parsePrescription(latestRecommendation.medicine)
                                      if (parsed && parsed.medicines.length > 0) {
                                        return (
                                          <div className="mb-3">
                                            <span className="text-blue-700 text-xs font-semibold block mb-2">💊 Previous Medicine:</span>
                                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {parsed.medicines.map((med, index) => (
                                                  <div key={index} className="bg-gray-50 border border-gray-200 rounded p-2">
                                                    <div className="flex items-start gap-1.5 mb-1">
                                                      <span className="text-sm">{med.emoji}</span>
                                                      <div className="flex-1">
                                                        <h6 className="font-semibold text-gray-900 text-xs">
                                                          {med.name}
                                                          {med.dosage && <span className="text-gray-600 font-normal">({med.dosage})</span>}
                                                        </h6>
                                                      </div>
                                                    </div>
                                                    <div className="ml-5 space-y-0.5 text-xs text-gray-700">
                                                      {med.frequency && (
                                                        <div className="flex items-center gap-1.5">
                                                          <span className="text-gray-400">•</span>
                                                          <span>{med.frequency}</span>
                                                        </div>
                                                      )}
                                                      {med.duration && (
                                                        <div className="flex items-center gap-1.5">
                                                          <span className="text-gray-400">•</span>
                                                          <span><span className="font-medium">Duration:</span> {med.duration}</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      } else {
                                        return (
                                          <div className="mb-3">
                                            <span className="text-blue-700 text-xs font-semibold block mb-1">💊 Previous Medicine:</span>
                                            <p className="text-blue-900 text-sm font-medium bg-white p-2 rounded border border-blue-200 whitespace-pre-line">
                                              {latestRecommendation.medicine}
                                            </p>
                                          </div>
                                        )
                                      }
                                    })()}
                                    
                                    {latestRecommendation.notes && (
                                      <div className="mb-2">
                                        <span className="text-blue-700 text-xs font-semibold block mb-1">📝 Previous Notes:</span>
                                        <p className="text-blue-900 text-sm font-medium bg-white p-2 rounded border border-blue-200 whitespace-pre-line">
                                          {latestRecommendation.notes}
                                        </p>
                                      </div>
                                    )}
                                    
                                    <div className="text-xs text-blue-600 font-medium mt-2">
                                      Recommended by {latestRecommendation.doctorName}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                            </div>
                          </div>

                        {/* RIGHT: Lifestyle & Appointment Details */}
                        <div className="space-y-4">
                          {/* Social & Lifestyle Information */}
                          {(appointment.patientDrinkingHabits || appointment.patientSmokingHabits || appointment.patientVegetarian) && (
                            <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base pb-3 border-b border-slate-200">
                                <span className="text-xl">🌱</span>
                                <span>Lifestyle</span>
                              </h4>
                              <div className="space-y-3 text-sm">
                                {appointment.patientDrinkingHabits && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                                    <span className="text-slate-600 font-medium">Drinking</span>
                                    <span className="bg-slate-200 px-3 py-1 rounded-full text-slate-800 font-semibold capitalize text-xs">
                                      {appointment.patientDrinkingHabits}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientSmokingHabits && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                                    <span className="text-slate-600 font-medium">Smoking</span>
                                    <span className="bg-slate-200 px-3 py-1 rounded-full text-slate-800 font-semibold capitalize text-xs">
                                      {appointment.patientSmokingHabits}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientOccupation && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                                    <span className="text-slate-600 font-medium">Occupation</span>
                                    <span className="bg-slate-200 px-3 py-1 rounded-full text-slate-800 font-semibold text-xs">
                                      {appointment.patientOccupation}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientVegetarian && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                                    <span className="text-slate-600 font-medium">Diet</span>
                                    <span className="bg-slate-200 px-3 py-1 rounded-full text-slate-800 font-semibold capitalize text-xs">
                                      {appointment.patientVegetarian}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Appointment Details */}
                          <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base pb-3 border-b border-slate-200">
                              <span className="text-xl">📅</span>
                              <span>Appointment Details</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Date</span>
                                <p className="text-slate-900 mt-1 font-bold">{new Date(appointment.appointmentDate).toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Time</span>
                                <p className="text-slate-900 mt-1 font-bold text-lg">{appointment.appointmentTime}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold mb-2 block">Status</span>
                                <span className={`px-4 py-2 rounded-lg text-sm font-bold inline-block ${getStatusColor(appointment.status)}`}>
                                  {appointment.status === "confirmed" ? "✓ Confirmed" : 
                                   appointment.status === "completed" ? "✓ Completed" : 
                                   appointment.status}
                                </span>
                              </div>
                              </div>
                            </div>
                          </div>
                        </div>

                      {/* Bottom Section: Medical Info + AI Diagnosis (Full Width) */}
                      <div className="space-y-6">
                        {/* Medical Information */}
                        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base pb-3 border-b border-slate-200">
                              <span className="text-xl">🩺</span>
                              <span>Medical Information</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Chief Complaint</span>
                                <p className="text-slate-900 font-medium leading-relaxed">
                                  {appointment.chiefComplaint || "No chief complaint provided"}
                                </p>
                              </div>
                              {appointment.patientAdditionalConcern && (
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Additional Details</span>
                                  <p className="text-slate-900 font-medium leading-relaxed">
                                    {appointment.patientAdditionalConcern}
                                  </p>
                                </div>
                              )}
                              {appointment.medicalHistory && (
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Medical History</span>
                                  <p className="text-slate-900 font-medium leading-relaxed">
                                    {appointment.medicalHistory}
                                  </p>
                                </div>
                              )}
                              {appointment.patientAllergies && (
                                <div className="bg-red-50 rounded-lg p-4 border-2 border-red-400">
                                  <span className="text-red-700 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                                    <span>⚠️</span> ALLERGIES - DO NOT PRESCRIBE
                                  </span>
                                  <p className="text-red-900 font-bold leading-relaxed">
                                    {appointment.patientAllergies}
                                  </p>
                                </div>
                              )}
                              {appointment.patientCurrentMedications && (
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Current Medications</span>
                                  <p className="text-slate-900 font-medium leading-relaxed">
                                    {appointment.patientCurrentMedications}
                                  </p>
                                </div>
                              )}
                              {appointment.patientFamilyHistory && (
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Family History</span>
                                  <p className="text-slate-900 font-medium leading-relaxed">
                                    {appointment.patientFamilyHistory}
                                  </p>
                                </div>
                              )}
                              {appointment.patientPregnancyStatus && (
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Pregnancy Status</span>
                                  <p className="text-slate-900 font-medium leading-relaxed">
                                    {appointment.patientPregnancyStatus}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AI Diagnosis Button - Only show if not already generated */}
                          {!aiDiagnosis[appointment.id] && appointment.status === "confirmed" && (
                            <div className="bg-white rounded-xl p-5 border-2 border-slate-300 shadow-sm">
                              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-base">
                                <span className="text-2xl">🤖</span>
                                <span>AI Diagnostic Assistant</span>
                            </h4>
                              <p className="text-xs text-slate-600 mb-4">
                                Get AI-powered diagnosis suggestions using patient&apos;s symptoms and medical history
                              </p>
                              <button
                                onClick={() => getAIDiagnosisSuggestion(appointment)}
                                disabled={loadingAiDiagnosis[appointment.id]}
                                className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-md hover:bg-black transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 shadow-sm"
                              >
                                {loadingAiDiagnosis[appointment.id] ? (
                                  <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Analyzing Patient Data...
                                  </>
                                ) : (
                                  <>
                                    <span>🔍</span> Get AI Diagnosis Suggestion
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* AI Diagnosis Result - Clean Unified Design */}
                          {aiDiagnosis[appointment.id] && (() => {
                            const parsed = parseAIDiagnosis(aiDiagnosis[appointment.id])
                            return (
                              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Header */}
                                <div className="bg-slate-900 text-white p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-xl backdrop-blur">
                                        🤖
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-white text-base">AI Diagnosis Suggestion</h4>
                                        <p className="text-slate-300 text-xs">Powered by Groq Llama 3.3 70B</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const newDiagnosis = {...aiDiagnosis}
                                        delete newDiagnosis[appointment.id]
                                        setAiDiagnosis(newDiagnosis)
                                      }}
                                      className="text-white hover:bg-white/10 rounded-lg p-2 transition-all"
                                      title="Close"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 space-y-4">
                                  {/* Diagnosis */}
                                  <div className="pb-4 border-b border-slate-200">
                                    <div className="flex items-start gap-3 mb-2">
                                      <span className="text-lg">🩺</span>
                                      <h5 className="font-bold text-slate-800 text-sm">PRELIMINARY DIAGNOSIS</h5>
                                    </div>
                                    <div className="ml-8 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                        {parsed.diagnosis || 'Not generated'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Tests */}
                                  <div className="pb-4 border-b border-slate-200">
                                    <div className="flex items-start gap-3 mb-3">
                                      <span className="text-lg">🔬</span>
                                      <h5 className="font-bold text-slate-800 text-sm">RECOMMENDED TESTS</h5>
                                    </div>
                                    <div className="ml-8 space-y-2">
                                      {parsed.tests.length > 0 ? (
                                        parsed.tests.map((test: string, idx: number) => (
                                          <div key={idx} className="flex items-start gap-2 text-sm">
                                            <span className="text-slate-500 font-mono mt-0.5">{idx + 1}.</span>
                                            <span className="text-slate-700">{test}</span>
                                          </div>
                                        ))
                                      ) : (
                                        <p className="text-sm text-slate-500">Not generated</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Treatment */}
                                  <div className="pb-4 border-b border-slate-200">
                                    <div className="flex items-start gap-3 mb-2">
                                      <span className="text-lg">💊</span>
                                      <h5 className="font-bold text-slate-800 text-sm">TREATMENT RECOMMENDATIONS</h5>
                                    </div>
                                    <div className="ml-8 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                      <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                        {parsed.treatment || 'Not generated'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Urgent Care */}
                                  <div className="pb-4 border-b border-slate-200">
                                    <div className="flex items-start gap-3 mb-2">
                                      <span className="text-lg text-red-600">⚠️</span>
                                      <h5 className="font-bold text-red-700 text-sm">WHEN TO SEEK IMMEDIATE CARE</h5>
                                    </div>
                                    <div className="ml-8 bg-red-50 p-3 rounded-lg border border-red-200">
                                      <p className="text-sm text-red-800 font-medium leading-relaxed">
                                        {parsed.urgent || 'Not generated'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Additional Notes */}
                                  <div className="pb-4 border-b border-slate-200">
                                    <details>
                                      <summary className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                        <span className="text-lg">📝</span>
                                        <h5 className="font-bold text-slate-800 text-sm">ADDITIONAL NOTES</h5>
                                      </summary>
                                      <div className="ml-8 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <p className="text-sm text-slate-700 leading-relaxed">
                                          {parsed.notes || 'Not generated'}
                                        </p>
                                      </div>
                                    </details>
                                  </div>

                                  {/* Disclaimer */}
                                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                                    <p className="text-xs text-amber-900 leading-relaxed">
                                      <strong className="font-semibold">⚠️ Medical Disclaimer:</strong> This is an AI-generated suggestion. 
                                      Always use your professional judgment and conduct proper examination before final diagnosis.
                                    </p>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      onClick={() => getAIDiagnosisSuggestion(appointment)}
                                      disabled={loadingAiDiagnosis[appointment.id]}
                                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-semibold text-sm border border-slate-300 flex items-center justify-center gap-2"
                                    >
                                      <span>🔄</span> Regenerate
                                    </button>
                              {appointment.status === "confirmed" && (
                                      <button
                                        onClick={() => toggleCompletionForm(appointment.id)}
                                        disabled={updating[appointment.id] || false}
                                        className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 shadow-sm"
                                      >
                                        <span>✓</span> Complete Checkup
                                      </button>
                              )}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                        {/* Patient History */}
                        {patientHistory.length > 0 && (() => {
                          const historyFilters = historySearchFilters[appointment.id] || { text: "", date: "" }
                          const normalizedQuery = historyFilters.text.trim().toLowerCase()
                          const historyForPatient = patientHistory.filter(historyItem => historyItem.patientId === appointment.patientId)
                          if (!historyForPatient.length) return null

                          const filteredHistory = historyForPatient.filter(historyItem => {
                            const matchesText = normalizedQuery
                              ? [
                                  historyItem.patientName,
                                  historyItem.patientId,
                                  historyItem.id,
                                  historyItem.chiefComplaint,
                                  historyItem.associatedSymptoms,
                                  historyItem.medicalHistory,
                                  historyItem.doctorNotes
                                ].some(field => (field || "").toLowerCase().includes(normalizedQuery))
                              : true

                            const matchesDate = historyFilters.date
                              ? new Date(historyItem.appointmentDate).toISOString().split("T")[0] === historyFilters.date
                              : true

                            return matchesText && matchesDate
                          })

                          return (
                            <div className="mt-4">
                              <div className="bg-white rounded-xl p-4 border-2 border-slate-200 shadow-sm">
                                <button
                                  onClick={() => setShowHistory({ ...showHistory, [appointment.id]: !showHistory[appointment.id] })}
                                  className="w-full flex items-center justify-between hover:bg-slate-50 rounded-lg p-2 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl">📚</span>
                                    <h4 className="font-semibold text-slate-800 text-base">
                                      Previous Checkup History ({filteredHistory.length}/{historyForPatient.length})
                                    </h4>
                                  </div>
                                  <div className={`transition-transform duration-200 ${showHistory[appointment.id] ? "rotate-180" : ""}`}>
                                    <span className="text-slate-600 text-lg">▼</span>
                                  </div>
                                </button>

                                {showHistory[appointment.id] && (
                                  <div className="mt-4 space-y-3">
                                    {filteredHistory.length === 0 ? (
                                      <div className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                        No visits match the current search filters.
                                      </div>
                                    ) : (
                                      filteredHistory.map((historyItem) => {
                                        const visitIndex = historyForPatient.findIndex(item => item.id === historyItem.id)
                                        const visitNumber = visitIndex >= 0 ? historyForPatient.length - visitIndex : "-"
                                        return (
                                          <div key={historyItem.id} className="bg-white p-3 rounded border">
                                            <div className="flex items-center justify-between mb-2">
                                              <p className="text-sm font-semibold text-gray-900">
                                                Visit #{visitNumber}
                                              </p>
                                              <p className="text-xs text-gray-600">
                                                {new Date(historyItem.appointmentDate).toLocaleDateString()}
                                              </p>
                                            </div>
                                            <div className="space-y-2 text-xs">
                                              <div>
                                                <span className="text-gray-600 font-medium">Chief Complaint:</span>
                                                <p className="text-gray-900 mt-1">{historyItem.chiefComplaint}</p>
                                              </div>
                                              {historyItem.associatedSymptoms && (
                                                <div>
                                                  <span className="text-gray-600 font-medium">Symptoms:</span>
                                                  <p className="text-gray-900 mt-1 whitespace-pre-line">{historyItem.associatedSymptoms}</p>
                                                </div>
                                              )}
                                              {historyItem.medicine && (() => {
                                                const parsed = parsePrescription(historyItem.medicine)
                                                if (parsed && parsed.medicines.length > 0) {
                                                  return (
                                                    <div>
                                                      <span className="text-gray-600 font-medium mb-2 block">💊 Prescribed Medicines:</span>
                                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                                        {parsed.medicines.map((med, medIndex) => (
                                                          <div key={medIndex} className="bg-gray-50 border border-gray-200 rounded p-2">
                                                            <div className="flex items-start gap-1.5 mb-1">
                                                              <span className="text-sm">{med.emoji}</span>
                                                              <div className="flex-1">
                                                                <h6 className="font-semibold text-gray-900 text-xs">
                                                                  {med.name}
                                                                  {med.dosage && <span className="text-gray-600 font-normal">({med.dosage})</span>}
                                                                </h6>
                                                              </div>
                                                            </div>
                                                            <div className="ml-5 space-y-0.5 text-xs text-gray-700">
                                                              {med.frequency && (
                                                                <div className="flex items-center gap-1.5">
                                                                  <span className="text-gray-400">•</span>
                                                                  <span>{med.frequency}</span>
                                                                </div>
                                                              )}
                                                              {med.duration && (
                                                                <div className="flex items-center gap-1.5">
                                                                  <span className="text-gray-400">•</span>
                                                                  <span><span className="font-medium">Duration:</span> {med.duration}</span>
                                                                </div>
                                                              )}
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )
                                                } else {
                                                  return (
                                                    <div>
                                                      <span className="text-gray-600 font-medium">💊 Medicine:</span>
                                                      <p className="text-gray-900 mt-1 whitespace-pre-line">{historyItem.medicine}</p>
                                                    </div>
                                                  )
                                                }
                                              })()}
                                              {historyItem.doctorNotes && (
                                                <div>
                                                  <span className="text-gray-600 font-medium">📝 Notes:</span>
                                                  <p className="text-gray-900 mt-1 whitespace-pre-line">{historyItem.doctorNotes}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })()}

                          {/* Complete Checkup Button - Show at bottom if AI not shown yet */}
                          {!aiDiagnosis[appointment.id] && appointment.status === "confirmed" && (
                            <div className="mt-4">
                                <button
                                  onClick={() => toggleCompletionForm(appointment.id)}
                                  disabled={updating[appointment.id] || false}
                                  className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 shadow-sm"
                                >
                                  <span>✓</span> Complete Checkup
                                </button>
                            </div>
                          )}

                          {/* Complete Checkup Form Accordion */}
                          {showCompletionForm[appointment.id] && appointment.status === "confirmed" && (
                            <div className="mt-3 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-slate-800 font-semibold text-sm flex items-center gap-1.5">
                                    <span>✓</span> Complete Checkup
                                  </h4>
                                  <button
                                    onClick={() => toggleCompletionForm(appointment.id)}
                                    className="text-slate-500 hover:text-slate-800 rounded p-0.5 transition-all"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              <form onSubmit={(e) => handleCompleteAppointment(e, appointment.id)} className="p-3 space-y-2.5">
                                {/* Prescription Section */}
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-medium text-gray-700">
                                      Prescribed Medicines <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                      {(() => {
                                        const sameDoctorHistory = patientHistory.filter((historyItem: AppointmentType) => 
                                          historyItem.doctorId === appointment.doctorId && 
                                          historyItem.id !== appointment.id &&
                                          historyItem.medicine
                                        )
                                        if (sameDoctorHistory.length > 0) {
                                          return (
                                            <button
                                              type="button"
                                              onClick={() => handleCopyPreviousPrescription(appointment.id)}
                                              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-all"
                                              title="Copy previous prescription"
                                            >
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                              </svg>
                                              Use Previous
                                            </button>
                                          )
                                        }
                                        return null
                                      })()}
                                      <p className="text-xs text-gray-500">Add</p>
                                    </div>
                                  </div>
                                  
                                  {/* AI Generated Prescription Suggestion Box */}
                                  {loadingAiPrescription[appointment.id] ? (
                                    <div className="mb-2 bg-purple-50 border border-purple-200 rounded p-2">
                                      <div className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4 text-purple-600" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="text-xs font-medium text-purple-700">Generating AI prescription...</span>
                                      </div>
                                    </div>
                                  ) : showAiPrescriptionSuggestion[appointment.id] && aiPrescription[appointment.id]?.medicine ? (
                                    <div className="mb-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-300 rounded p-2 shadow-sm">
                                      <div className="flex items-start justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                          </svg>
                                          <span className="text-xs font-semibold text-purple-700 uppercase">AI Generated</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleAcceptPrescription(appointment.id)}
                                            className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-all"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Accept
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeclinePrescription(appointment.id)}
                                            className="flex items-center gap-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded transition-all"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Decline
                                          </button>
                                        </div>
                                      </div>
                                      <div className="bg-white rounded p-2 border border-purple-100">
                                        <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans">{aiPrescription[appointment.id].medicine}</pre>
                                      </div>
                                    </div>
                                  ) : null}

                                  {/* Structured Medicine Form */}
                                  <div className="space-y-2">
                                    {(completionData[appointment.id]?.medicines || []).length === 0 ? (
                                      <div className="text-center py-3 bg-gray-50 rounded border border-dashed border-gray-300">
                                        <p className="text-xs text-gray-600 mb-2">No medicines added yet</p>
                                        <button
                                          type="button"
                                          onClick={() => addMedicine(appointment.id)}
                                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-xs transition-all"
                                        >
                                          + Add Medicine
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        {(completionData[appointment.id]?.medicines || []).map((medicine, index) => {
                                          const selectedSuggestion = findSuggestionByName(medicine.name)
                                          const nameSuggestions = getMedicineNameSuggestions(medicine.name || "")
                                          const showNameSuggestions =
                                            activeNameSuggestion?.appointmentId === appointment.id &&
                                            activeNameSuggestion?.index === index &&
                                            nameSuggestions.length > 0

                                          return (
                                          <div key={index} className="bg-gray-50 rounded p-2.5 border border-gray-200">
                                            <div className="flex items-center justify-between mb-2">
                                              <h5 className="font-semibold text-gray-800 text-xs">#{index + 1}</h5>
                                              <button
                                                type="button"
                                                onClick={() => removeMedicine(appointment.id, index)}
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
                                                    id={`name-${appointment.id}-${index}`}
                                                    value={medicine.name}
                                                    onChange={(e) => {
                                                      updateMedicine(appointment.id, index, "name", e.target.value)
                                                      updateInlineSuggestion(appointment.id, index, e.target.value)
                                                    }}
                                                    onFocus={() => {
                                                      setActiveNameSuggestion({ appointmentId: appointment.id, index })
                                                      updateInlineSuggestion(appointment.id, index, medicine.name || "")
                                                    }}
                                                    onBlur={() => {
                                                      setTimeout(() => {
                                                        setActiveNameSuggestion((current) => {
                                                          if (
                                                            current?.appointmentId === appointment.id &&
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
                                                        if (inlineSuggestion?.appointmentId === appointment.id && inlineSuggestion.index === index) {
                                                          e.preventDefault()
                                                          acceptInlineSuggestion(appointment.id, index)
                                                        }
                                                      } else if (e.key === "Enter") {
                                                        if (inlineSuggestion?.appointmentId === appointment.id && inlineSuggestion.index === index) {
                                                          e.preventDefault()
                                                          acceptInlineSuggestion(appointment.id, index)
                                                        }
                                                      } else if (e.key === "ArrowDown") {
                                                        if (nameSuggestions.length > 0) {
                                                          e.preventDefault()
                                                          const firstOption = document.querySelector<HTMLButtonElement>(
                                                            `#suggestion-btn-${appointment.id}-${index}-0`
                                                          )
                                                          firstOption?.focus()
                                                        }
                                                      } else if (e.key === "Escape") {
                                                        setInlineSuggestion((prev) =>
                                                          prev?.appointmentId === appointment.id && prev.index === index ? null : prev
                                                        )
                                                      }
                                                    }}
                                                    placeholder="e.g., Paracetamol"
                                                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs"
                                                    required
                                                  />
                                                  {inlineSuggestion?.appointmentId === appointment.id &&
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
                                                            id={`suggestion-btn-${appointment.id}-${index}-${suggestionIndex}`}
                                                            className="w-full px-3 py-1.5 text-left hover:bg-green-50 transition text-[11px]"
                                                            onMouseDown={(e) => {
                                                              e.preventDefault()
                                                              handleSelectMedicineSuggestion(appointment.id, index, suggestion, { setFocusNext: true })
                                                            }}
                                                            onKeyDown={(e) => {
                                                              if (e.key === "Enter") {
                                                                e.preventDefault()
                                                                handleSelectMedicineSuggestion(appointment.id, index, suggestion, { setFocusNext: true })
                                                              } else if (e.key === "ArrowDown") {
                                                                const nextButton = document.querySelector<HTMLButtonElement>(
                                                                  `#suggestion-btn-${appointment.id}-${index}-${suggestionIndex + 1}`
                                                                )
                                                                if (nextButton) {
                                                                  e.preventDefault()
                                                                  nextButton.focus()
                                                                }
                                                              } else if (e.key === "ArrowUp") {
                                                                if (suggestionIndex === 0) {
                                                                  e.preventDefault()
                                                                  const input = document.querySelector<HTMLInputElement>(
                                                                    `#name-${appointment.id}-${index}`
                                                                  )
                                                                  input?.focus()
                                                                } else {
                                                                  const prevButton = document.querySelector<HTMLButtonElement>(
                                                                    `#suggestion-btn-${appointment.id}-${index}-${suggestionIndex - 1}`
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
                                                  value={medicine.dosage}
                                                  onChange={(e) => updateMedicine(appointment.id, index, "dosage", e.target.value)}
                                                  placeholder="e.g., 500mg"
                                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs"
                                                />
                                                {selectedSuggestion?.dosageOptions?.length ? (
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                    {getTopOptions(selectedSuggestion.dosageOptions).map((option) => (
                                                      <button
                                                        type="button"
                                                        key={`${option.value}-dosage`}
                                                        onClick={() => handleOptionChipClick(appointment.id, index, "dosage", option.value)}
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
                                                  onChange={(e) => updateMedicine(appointment.id, index, "frequency", e.target.value)}
                                                  placeholder="e.g., 1-0-1"
                                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs"
                                                />
                                                {selectedSuggestion?.frequencyOptions?.length ? (
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                    {getTopOptions(selectedSuggestion.frequencyOptions).map((option) => (
                                                      <button
                                                        type="button"
                                                        key={`${option.value}-frequency`}
                                                        onClick={() => handleOptionChipClick(appointment.id, index, "frequency", option.value)}
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
                                                  onChange={(e) => updateMedicine(appointment.id, index, "duration", e.target.value)}
                                                  placeholder="e.g., 5 days"
                                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs"
                                                />
                                                {selectedSuggestion?.durationOptions?.length ? (
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                    {getTopOptions(selectedSuggestion.durationOptions).map((option) => (
                                                      <button
                                                        type="button"
                                                        key={`${option.value}-duration`}
                                                        onClick={() => handleOptionChipClick(appointment.id, index, "duration", option.value)}
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
                                            onClick={() => addMedicine(appointment.id)}
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
                                </div>

                                {/* Notes Section */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Doctor&apos;s Notes <span className="text-gray-400 text-xs">(Optional)</span>
                                  </label>
                                  <textarea
                                    value={completionData[appointment.id]?.notes || ""}
                                    onChange={(e) =>
                                      setCompletionData((prev) => ({
                                        ...prev,
                                        [appointment.id]: {
                                          ...prev[appointment.id],
                                          notes: e.target.value,
                                          medicines: prev[appointment.id]?.medicines || [],
                                          recheckupRequired: prev[appointment.id]?.recheckupRequired || false,
                                        },
                                      }))
                                    }
                                    rows={3}
                                    placeholder="Enter observations, diagnosis, recommendations..."
                                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs resize-none"
                                    required
                                  />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <input
                                    type="checkbox"
                                    id={`recheckupRequired-${appointment.id}`}
                                    checked={completionData[appointment.id]?.recheckupRequired || false}
                                    onChange={(e) =>
                                      setCompletionData((prev) => ({
                                        ...prev,
                                        [appointment.id]: {
                                          ...prev[appointment.id],
                                          recheckupRequired: e.target.checked,
                                          medicines: prev[appointment.id]?.medicines || [],
                                          notes: prev[appointment.id]?.notes || "",
                                        },
                                      }))
                                    }
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                  />
                                  <label htmlFor={`recheckupRequired-${appointment.id}`} className="text-xs font-medium text-gray-700 cursor-pointer">
                                    🔄 Re-checkup Required
                                  </label>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <button
                                    type="submit"
                                    disabled={
                                      updating[appointment.id] ||
                                      !hasValidPrescriptionInput(completionData[appointment.id])
                                    }
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {updating[appointment.id] ? "Completing..." : "Complete Checkup"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openAdmitDialog(appointment)}
                                    disabled={
                                      updating[appointment.id] ||
                                      Boolean(admitting[appointment.id]) ||
                                      !hasValidPrescriptionInput(completionData[appointment.id])
                                    }
                                    className="flex-1 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {admitting[appointment.id] ? (
                                      <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Sending...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>🏥</span>
                                        <span>Admit Patient</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}

                          {/* Completed Status with Prescription */}
                              {appointment.status === "completed" && (
                            <div className="bg-white rounded-xl p-4 border-2 border-green-200 shadow-sm">
                                <div className="space-y-3">
                                  <div className="text-center py-2 text-green-600 font-medium text-sm">
                                    ✓ Checkup Completed
                                  </div>
                                  {appointment.medicine && (() => {
                                    const parsed = parsePrescription(appointment.medicine)
                                    if (parsed && parsed.medicines.length > 0) {
                                      return (
                                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                          <h5 className="text-gray-700 font-semibold mb-2 flex items-center gap-2 text-sm">
                                            <span>💊</span>
                                            <span>Prescribed Medicines</span>
                                          </h5>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {parsed.medicines.map((med, index) => (
                                              <div key={index} className="bg-white border border-gray-200 rounded p-2 text-xs">
                                                <div className="flex items-start gap-1.5 mb-1">
                                                  <span className="text-base">{med.emoji}</span>
                                                  <div className="flex-1">
                                                    <h6 className="font-semibold text-gray-900 text-xs">
                                                      {med.name}
                                                      {med.dosage && <span className="text-gray-600 font-normal">({med.dosage})</span>}
                                                    </h6>
                                                  </div>
                                                </div>
                                                <div className="ml-5 space-y-0.5 text-xs text-gray-700">
                                                  {med.frequency && (
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-gray-400">•</span>
                                                      <span>{med.frequency}</span>
                                                    </div>
                                                  )}
                                                  {med.duration && (
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-gray-400">•</span>
                                                      <span><span className="font-medium">Duration:</span> {med.duration}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )
                                    } else {
                                      return (
                                        <div className="bg-white p-3 rounded border">
                                          <p className="text-xs text-gray-600 mb-1 font-semibold">💊 Prescribed Medicine:</p>
                                          <p className="text-sm text-gray-900 whitespace-pre-line">{appointment.medicine}</p>
                                        </div>
                                      )
                                    }
                                  })()}
                                  {appointment.doctorNotes && (
                                    <div className="bg-white p-3 rounded border">
                                      <p className="text-xs text-gray-600 mb-1 font-semibold">📝 Doctor&apos;s Notes:</p>
                                      <p className="text-sm text-gray-900 whitespace-pre-line">{appointment.doctorNotes}</p>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => generatePrescriptionPDF(appointment as unknown as AppointmentType)}
                                    className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Download Prescription PDF
                                  </button>
                                </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "history" && filteredHistoryAppointments.length > 0 && (
            <Pagination
              currentPage={historyPage}
              totalPages={totalHistoryPages}
              pageSize={historyPageSize}
              totalItems={filteredHistoryAppointments.length}
              onPageChange={setHistoryPage}
              onPageSizeChange={setHistoryPageSize}
              itemLabel="appointments"
              className="mt-4 rounded-xl"
            />
          )}
        </div>
      </main>

      {/* Notification Toast */}
      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {admitDialog.open && admitDialog.appointment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                🏥
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">Admit patient?</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Are you sure you want to send an admission request for{" "}
                  <span className="font-semibold text-slate-900">
                    {admitDialog.appointment.patientName || "this patient"}
                  </span>
                  ? This will send the request to the receptionist for further processing.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeAdmitDialog}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
                disabled={admitting[admitDialog.appointment.id]}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAdmitPatient}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={admitting[admitDialog.appointment.id]}
              >
                {admitting[admitDialog.appointment.id] ? "Sending..." : "Yes, Admit Patient"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

