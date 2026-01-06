"use client"

import { useCallback, useEffect, useMemo, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { auth, db } from "@/firebase/config"
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/hospital-queries"
import LoadingSpinner from "@/components/ui/StatusComponents"
import Notification from "@/components/ui/Notification"
import { generatePrescriptionPDF } from "@/utils/pdfGenerators"
import { completeAppointment, getStatusColor } from "@/utils/appointmentHelpers"
import { calculateAge } from "@/utils/date"
import { Appointment as AppointmentType } from "@/types/patient"
import axios from "axios"
import Pagination from "@/components/ui/Pagination"
import { fetchMedicineSuggestions, MedicineSuggestion,  MedicineSuggestionOption,recordMedicineSuggestions, sanitizeMedicineName,} from "@/utils/medicineSuggestions"
import type { Branch } from "@/types/branch"
import DiagnosisSelector from "@/components/doctor/DiagnosisSelector"
import { CUSTOM_DIAGNOSIS_OPTION } from "@/constants/entDiagnoses"
import InlineAnatomyViewer, { type AnatomyViewerData } from "@/components/doctor/InlineAnatomyViewer"
import AppointmentDocuments from "@/components/documents/AppointmentDocuments"
import DocumentUpload from "@/components/documents/DocumentUpload"
import DocumentViewer from "@/components/documents/DocumentViewer"
import { DocumentMetadata } from "@/types/document"
import { getAvailableAnatomyModels, type AnatomyModel } from "@/utils/anatomyModelMapping"

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
  recheckupNote?: string
  finalDiagnosis?: string[]
  customDiagnosis?: string
}

const hasValidPrescriptionInput = (entry?: CompletionFormEntry) =>
  Boolean(entry?.medicines?.some((med) => med.name && med.name.trim()))

type TabKey = "today" | "tomorrow" | "thisWeek" | "nextWeek" | "history"

const StatPill = ({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: string
}) => (
  <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 shadow-sm backdrop-blur">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-100/80">
      <span>{icon}</span>
      <span>{label}</span>
    </div>
    <div className="mt-1 text-lg font-semibold text-white">{value}</div>
  </div>
)

interface UserData {
  id: string;
  name: string;
  firstName?: string;
  email: string;
  role: string;
  specialization?: string;
}

// Use the canonical type from src/types/patient

function DoctorAppointmentsContent() {
  const searchParams = useSearchParams()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [appointments, setAppointments] = useState<AppointmentType[]>([])
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("today")
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [updating, setUpdating] = useState<{[key: string]: boolean}>({})
  const [showCompletionForm, setShowCompletionForm] = useState<{[key: string]: boolean}>({})
  const [consultationMode, setConsultationMode] = useState<{[key: string]: 'normal' | 'anatomy' | null}>({})
  const [selectedAnatomyTypes, setSelectedAnatomyTypes] = useState<{[key: string]: ('ear' | 'throat' | 'dental')[]}>({})
  const [anatomyViewerData, setAnatomyViewerData] = useState<{[key: string]: {[anatomyType: string]: AnatomyViewerData | null}}>({})
  const [showCombinedCompletionModal, setShowCombinedCompletionModal] = useState<{[key: string]: boolean}>({})
  const appointmentCardRefs = useRef<{[key: string]: HTMLDivElement | null}>({})
  const [completionData, setCompletionData] = useState<Record<string, CompletionFormEntry>>({})
  const [aiPrescription, setAiPrescription] = useState<{[key: string]: {medicine: string, notes: string}}>({})
  const [loadingAiPrescription, setLoadingAiPrescription] = useState<{[key: string]: boolean}>({})
  const [showAiPrescriptionSuggestion, setShowAiPrescriptionSuggestion] = useState<{[key: string]: boolean}>({})
  const [removedAiMedicines, setRemovedAiMedicines] = useState<{[appointmentId: string]: number[]}>({})
  const [patientHistory, setPatientHistory] = useState<AppointmentType[]>([])
  const [historySearchFilters, setHistorySearchFilters] = useState<{ [key: string]: { text: string; date: string } }>({})
  const [historyTabFilters, setHistoryTabFilters] = useState<{ text: string; date: string }>({ text: "", date: "" })
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [aiDiagnosis, setAiDiagnosis] = useState<{[key: string]: string}>({})
  const [loadingAiDiagnosis, setLoadingAiDiagnosis] = useState<{[key: string]: boolean}>({})
  const [showHistory, setShowHistory] = useState<{[key: string]: boolean}>({})
  const [showAllDoctorsHistory, setShowAllDoctorsHistory] = useState<{[key: string]: boolean}>({})
  const [expandedDoctors, setExpandedDoctors] = useState<{[key: string]: boolean}>({})
  const [showDocuments, setShowDocuments] = useState<{[key: string]: boolean}>({})
  const [showDocumentUpload, setShowDocumentUpload] = useState<{[key: string]: boolean}>({})
  const [historyDocuments, setHistoryDocuments] = useState<{[appointmentId: string]: DocumentMetadata[]}>({})
  const [selectedHistoryDocument, setSelectedHistoryDocument] = useState<DocumentMetadata | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [admitting, setAdmitting] = useState<{ [key: string]: boolean }>({})
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportFilter, setReportFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'all'>('all')
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)
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
  const [showConsultationModeModal, setShowConsultationModeModal] = useState<{
    open: boolean
    appointmentId: string | null
  }>({
    open: false,
    appointmentId: null
  })
  const [medicineSuggestionsLoading, setMedicineSuggestionsLoading] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)

  const refreshMedicineSuggestions = useCallback(async () => {
    try {
      setMedicineSuggestionsLoading(true)
      const suggestions = await fetchMedicineSuggestions(100)
      setMedicineSuggestions(suggestions)
    } catch (error) {

    } finally {
      setMedicineSuggestionsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMedicineSuggestions()
  }, [refreshMedicineSuggestions])

  // Auto-scroll to modal when combined completion modal opens
  useEffect(() => {
    // Find which appointment has the modal open
    const openAppointmentId = Object.keys(showCombinedCompletionModal).find(
      id => showCombinedCompletionModal[id]
    )
    
    if (openAppointmentId && appointmentCardRefs.current[openAppointmentId]) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        const cardElement = appointmentCardRefs.current[openAppointmentId]
        if (cardElement) {
          // Scroll the appointment card into view so user can see the modal context
          cardElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          })
        }
      }, 150)
    }
  }, [showCombinedCompletionModal])

  // Protect route - only allow doctors
  const { user, loading } = useAuth("doctor")
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      if (!activeHospitalId) return

      try {
        setLoadingBranches(true)
        const currentUser = auth.currentUser
        if (!currentUser) {

          return
        }
        const token = await currentUser.getIdToken()

        const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const data = await response.json()

        if (data.success && data.branches) {
          setBranches(data.branches)
        }
      } catch (error) {

      } finally {
        setLoadingBranches(false)
      }
    }

    fetchBranches()
  }, [activeHospitalId])

  const setupRealtimeListeners = async (branchId: string | null) => {
    if (!user || !activeHospitalId) return () => {}

    // Get doctor data (one-time fetch)
    const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
    if (doctorDoc.exists()) {
      const data = doctorDoc.data() as UserData
      setUserData(data)
    }

    // Set up real-time appointments listener - use hospital-scoped collection
    const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
    // Build query with optional branch filter
    let q
    if (branchId) {
      q = query(
        appointmentsRef,
        where("doctorId", "==", user.uid),
        where("branchId", "==", branchId)
      )
    } else {
      q = query(appointmentsRef, where("doctorId", "==", user.uid))
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const appointmentsList = snapshot.docs
        .map((doc) => ({ 
          id: doc.id, 
          ...doc.data() 
        } as AppointmentType))
        // Filter out WhatsApp pending appointments - they should only appear in WhatsApp Bookings Panel
        .filter((appointment) => {
          const appt = appointment as any
          return appt.status !== "whatsapp_pending" && !appt.whatsappPending
        })
      
      setAppointments(appointmentsList)
    }, (error) => {

    })

    return unsubscribe
  }

  useEffect(() => {
    if (!user || hospitalLoading || !activeHospitalId) return

    let unsubscribe: (() => void) | null = null

    const initializeRealtimeData = async () => {
      unsubscribe = await setupRealtimeListeners(selectedBranchId)
    }

    initializeRealtimeData()

    // Cleanup function to unsubscribe from listeners
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeHospitalId, hospitalLoading, selectedBranchId])

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

  // Auto-open completion form if returning from anatomy page
  useEffect(() => {
    const appointmentIdFromQuery = searchParams.get('appointmentId')
    if (appointmentIdFromQuery && appointments.length > 0) {
      // Check if there's anatomy checkup data
      const anatomyDataKey = `anatomyCheckup_${appointmentIdFromQuery}`
      const storedAnatomyData = sessionStorage.getItem(anatomyDataKey)
      
      if (storedAnatomyData) {
        // Find the appointment
        const appointment = appointments.find(apt => apt.id === appointmentIdFromQuery)
        if (appointment && appointment.status === 'confirmed') {
          // Set active tab to "today" to show the appointment
          setActiveTab("today")
          
          // Auto-open the completion form after a short delay
          setTimeout(() => {
            toggleCompletionForm(appointmentIdFromQuery)
            // Scroll to the appointment
            const element = document.getElementById(`appointment-${appointmentIdFromQuery}`)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 500)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, appointments])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      // Real-time listeners will automatically update, so just show success message
      setNotification({ type: "success", message: "Appointments are automatically updated in real-time!" })
    } catch (error) {

      setNotification({ type: "error", message: "Failed to refresh appointments" })
    } finally {
      setRefreshing(false)
    }
  }

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true)
      setNotification(null)

      // Validate custom date range if custom filter is selected
      if (reportFilter === 'custom') {
        if (!customStartDate || !customEndDate) {
          setNotification({ type: "error", message: 'Please select both start and end dates for custom range' })
          setGeneratingReport(false)
          return
        }
        if (new Date(customStartDate) > new Date(customEndDate)) {
          setNotification({ type: "error", message: 'Start date must be before end date' })
          setGeneratingReport(false)
          return
        }
      }

      // Build query parameters
      const params = new URLSearchParams({
        filter: reportFilter,
        format: reportFormat
      })

      if (reportFilter === 'custom') {
        params.append('startDate', customStartDate)
        params.append('endDate', customEndDate)
      }

      // Get auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        setNotification({ type: "error", message: 'You must be logged in to generate reports' })
        setGeneratingReport(false)
        return
      }

      const token = await currentUser.getIdToken()

      // Fetch report
      const response = await fetch(`/api/admin/patient-reports?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate report')
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `patient_report_${reportFilter}_${new Date().toISOString().split('T')[0]}.${reportFormat === 'pdf' ? 'pdf' : 'xlsx'}`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Close modal and show success
      setShowReportModal(false)
      setNotification({ type: "success", message: 'Report generated and downloaded successfully!' })
    } catch (error) {

      setNotification({ type: "error", message: (error as Error).message || 'Failed to generate report' })
    } finally {
      setGeneratingReport(false)
    }
  }

  // Toggle accordion and fetch patient history
  const toggleAccordion = async (appointmentId: string) => {
    if (expandedAppointment === appointmentId) {
      setExpandedAppointment(null)
      setPatientHistory([])
      setShowHistory({})
      setShowAllDoctorsHistory(prev => ({ ...prev, [appointmentId]: false }))
    } else {
      setExpandedAppointment(appointmentId)
      
      const appointment = appointments.find(apt => apt.id === appointmentId)
      if (appointment && appointment.patientId && activeHospitalId) {
        try {
          // Use hospital-scoped collection
          const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
          // Always fetch all completed appointments for this patient (all doctors)
          const patientAppointmentsQuery = query(
            appointmentsRef, 
            where("patientId", "==", appointment.patientId),
            where("status", "==", "completed")
          )
          
          const snapshot = await getDocs(patientAppointmentsQuery)
          const history = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as AppointmentType))
            .filter((apt: AppointmentType) => apt.id !== appointmentId)
            .sort((a: AppointmentType, b: AppointmentType) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
          setPatientHistory(history)
          // Keep history accordion closed by default; only open when user clicks
          setHistorySearchFilters(prev => ({
            ...prev,
            [appointmentId]: { text: "", date: "" }
          }))
          
          // Fetch documents for each history item
          if (history.length > 0 && user) {
            fetchHistoryDocuments(history.map(h => h.id), appointment.patientUid || appointment.patientId)
          }
        } catch (error) {
          console.error("Error fetching patient history:", error)
        }
      }
    }
  }

  // Fetch documents for history appointments
  const fetchHistoryDocuments = async (appointmentIds: string[], patientUid: string) => {
    if (!patientUid || !user || appointmentIds.length === 0) return
    
    try {
      const currentUser = auth.currentUser
      if (!currentUser) return
      
      const token = await currentUser.getIdToken()
      const params = new URLSearchParams()
      params.append("patientUid", patientUid)
      params.append("status", "active")
      
      const response = await fetch(`/api/documents?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      
      const data = await response.json()
      if (response.ok && data.documents) {
        // Group documents by appointmentId
        const documentsByAppointment: {[appointmentId: string]: DocumentMetadata[]} = {}
        data.documents.forEach((doc: DocumentMetadata) => {
          if (doc.appointmentId && appointmentIds.includes(doc.appointmentId)) {
            if (!documentsByAppointment[doc.appointmentId]) {
              documentsByAppointment[doc.appointmentId] = []
            }
            documentsByAppointment[doc.appointmentId].push(doc)
          }
        })
        setHistoryDocuments(prev => ({ ...prev, ...documentsByAppointment }))
      }
    } catch (error) {
      console.error("Error fetching history documents:", error)
    }
  }

  // Toggle to show/hide other doctors' history (no re-fetch, we already have all history)
  const toggleAllDoctorsHistory = (appointmentId: string) => {
    setShowAllDoctorsHistory(prev => ({
      ...prev,
      [appointmentId]: !(prev[appointmentId] || false),
    }))
  }

  const _handleHistorySearchChange = (appointmentId: string, field: "text" | "date", value: string) => {
    setHistorySearchFilters(prev => ({
      ...prev,
      [appointmentId]: {
        ...(prev[appointmentId] || { text: "", date: "" }),
        [field]: value
      }
    }))
  }

  const _clearHistoryFilters = (appointmentId: string) => {
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
      const latestAny: any = latest
      return {
        appointmentId: latest.id,
        doctorName: userData?.name || "Dr. " + (userData?.firstName || "Unknown"),
        date: new Date(latest.appointmentDate).toLocaleDateString(),
        medicine: latest.medicine,
        notes: latest.doctorNotes,
        finalDiagnosis: Array.isArray(latestAny.finalDiagnosis) ? latestAny.finalDiagnosis : [],
        customDiagnosis: latestAny.customDiagnosis || "",
        documents: historyDocuments[latest.id] || []
      }
    }
    return null
  }

  const handleCompleteConsultationClick = (appointmentId: string) => {
    // Always show modal to let doctor choose between Normal and 3D Anatomy,
    // regardless of how many anatomy models are available.
    setShowConsultationModeModal({
      open: true,
      appointmentId: appointmentId
    })
  }

  const handleConsultationModeSelect = (mode: 'normal' | 'anatomy', anatomyType?: 'ear' | 'throat' | 'dental') => {
    const appointmentId = showConsultationModeModal.appointmentId
    if (!appointmentId) return

    // Close modal
    setShowConsultationModeModal({ open: false, appointmentId: null })

    // Set the consultation mode for this appointment
    setConsultationMode(prev => ({
      ...prev,
      [appointmentId]: mode
    }))

    // If anatomy mode, add the selected anatomy type
    if (mode === 'anatomy' && anatomyType) {
      setSelectedAnatomyTypes(prev => {
        const current = prev[appointmentId] || []
        if (!current.includes(anatomyType)) {
          return {
            ...prev,
            [appointmentId]: [...current, anatomyType]
          }
        }
        return prev
      })
    }

    // Also set showCompletionForm to true so the container shows
    setShowCompletionForm(prev => ({
      ...prev,
      [appointmentId]: true
    }))
  }


  const handleAddAnotherAnatomy = (appointmentId: string) => {
    setShowConsultationModeModal({ open: true, appointmentId })
  }

  const toggleCompletionForm = (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId)
    if (!appointment) return
    
    const isOpen = showCompletionForm[appointmentId] || false
    setShowCompletionForm({...showCompletionForm, [appointmentId]: !isOpen})
    
    if (!isOpen) {
      // Check if there's anatomy checkup data from the 3D model page
      const anatomyDataKey = `anatomyCheckup_${appointmentId}`
      const storedAnatomyData = sessionStorage.getItem(anatomyDataKey)
      
      let initialMedicines: Array<{ name: string; dosage: string; frequency: string; duration: string }> = []
      let initialNotes = ""
      
      if (storedAnatomyData) {
        try {
          const anatomyData = JSON.parse(storedAnatomyData)
          initialMedicines = anatomyData.medicines || []
          
          // Build notes from anatomy data
          let notesParts = []
          if (anatomyData.selectedPartInfo) {
            notesParts.push(`Selected Anatomy Part: ${anatomyData.selectedPartInfo.name}`)
          }
          if (anatomyData.selectedDisease) {
            notesParts.push(`Diagnosis: ${anatomyData.selectedDisease.name}`)
            if (anatomyData.selectedDisease.description) {
              notesParts.push(`Description: ${anatomyData.selectedDisease.description}`)
            }
          }
          if (anatomyData.prescriptions && anatomyData.prescriptions.length > 0) {
            notesParts.push(`Prescriptions: ${anatomyData.prescriptions.join(', ')}`)
          }
          if (anatomyData.notes) {
            notesParts.push(`Examination Notes: ${anatomyData.notes}`)
          }
          initialNotes = notesParts.join('\n')
          
          // Clear the stored data after using it
          sessionStorage.removeItem(anatomyDataKey)
        } catch (error) {

        }
      }
      
      // Initialize completion data for this appointment
      setCompletionData((prev) => ({
        ...prev,
        [appointmentId]: {
          medicines: initialMedicines.length > 0 ? initialMedicines : [],
          notes: initialNotes,
          recheckupRequired: false,
          finalDiagnosis: [],
          customDiagnosis: "",
        },
      }))
      // Mark that AI suggestion should be visible for this appointment
      setShowAiPrescriptionSuggestion(prev => ({ ...prev, [appointmentId]: true }))
      // Clear any previous removed-medicine state
      setRemovedAiMedicines(prev => {
        const updated = { ...prev }
        delete updated[appointmentId]
        return updated
      })
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
      
      // Clear removed medicines for this appointment
      setRemovedAiMedicines(prev => {
        const updated = {...prev}
        delete updated[appointmentId]
        return updated
      })
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

      const errorResponse = (error as { response?: { data?: unknown; status?: number } }).response
      
      // Extract error message from response
      let errorMessage = "Failed to get AI diagnosis"
      let _errorDetails: any = null
      
      if (errorResponse?.data) {
        if (typeof errorResponse.data === 'object') {
          const data = errorResponse.data as { error?: string; details?: any }
          errorMessage = data.error || errorMessage
          _errorDetails = data.details
        } else if (typeof errorResponse.data === 'string') {
          errorMessage = errorResponse.data
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }
      
      // Provide more helpful error messages
      if (errorResponse?.status === 403) {
        if (errorMessage.includes("pending approval") || errorMessage.includes("pending")) {
          errorMessage = "Your doctor account is pending approval. Please contact the administrator to approve your account."
        } else if (errorMessage.includes("Access denied")) {
          errorMessage = "Access denied. You need an active doctor account to use this feature. Please contact the administrator if you believe this is an error."
        } else if (errorMessage.includes("doesn't have") || errorMessage.includes("not found")) {
          errorMessage = "Doctor account not found. Please contact the administrator to verify your account setup."
        } else {
          errorMessage = `Access denied: ${errorMessage || "Please ensure your doctor account is active and approved."}`
        }
      }
      
      setNotification({ 
        type: "error", 
        message: errorMessage
      })
    } finally {
      setLoadingAiDiagnosis({...loadingAiDiagnosis, [appointment.id]: false})
    }
  }

  const handleGenerateAiPrescription = async (appointmentId: string) => {
    if (!appointmentId) return
    
    const appointment = appointments.find(apt => apt.id === appointmentId)
    if (!appointment) return

    // Start loading for this appointment
    setLoadingAiPrescription(prev => ({ ...prev, [appointmentId]: true }))
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

      setAiPrescription(prev => ({
        ...prev,
        [appointmentId]: {
          medicine: data.medicine || "",
          notes: data.notes || ""
        }
      }))
      setShowAiPrescriptionSuggestion(prev => ({...prev, [appointmentId]: true}))
      setNotification({ type: "success", message: "AI prescription generated!" })
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || (error as Error).message || "Failed to generate AI prescription"
      setNotification({ 
        type: "error", 
        message: `AI Prescription Error: ${errorMessage}` 
      })
    } finally {
      setLoadingAiPrescription(prev => ({ ...prev, [appointmentId]: false }))
    }
  }

  // Auto-generate AI prescription when consultation form opens (no button click)
  useEffect(() => {
    appointments.forEach((apt) => {
      const isFormOpen = showCompletionForm[apt.id]
      const hasSuggestion = !!aiPrescription[apt.id]?.medicine
      const isLoading = !!loadingAiPrescription[apt.id]
      const explicitlyHidden = showAiPrescriptionSuggestion[apt.id] === false

      if (isFormOpen && !hasSuggestion && !isLoading && !explicitlyHidden) {
        // Mark suggestion as visible and trigger generation once
        setShowAiPrescriptionSuggestion(prev => ({ ...prev, [apt.id]: true }))
        handleGenerateAiPrescription(apt.id)
      }
    })
  }, [appointments, showCompletionForm, aiPrescription, loadingAiPrescription, showAiPrescriptionSuggestion])

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
        
        // Look for common patterns like "500mg", "50mcg", "1 tablet", etc.
        const dosageMatch = trimmedLine.match(/(\d+(?:\.\d+)?\s*(?:mcg|µg|mg|g|ml|tablet|tab|capsule|cap))/i)
        if (dosageMatch) {
          dosage = dosageMatch[1]
          // Remove dosage (and any surrounding brackets) from the name
          name = name
            .replace(dosageMatch[0], '')
            .replace(/\[[^\]]*\]/g, '')  // remove [50mcg] style blocks
            .trim()
        }
        
        const frequencyMatch = trimmedLine.match(/(\d+[-\s]\d+[-\s]\d+|\d+\s*(?:times|tab|cap)s?\s*(?:daily|per day|a day)|once|twice|daily)/i)
        if (frequencyMatch) {
          frequency = frequencyMatch[1]
          name = name.replace(frequencyMatch[0], '').trim()
        }
        
        const durationMatch = trimmedLine.match(/(?:for|duration|take|continue)\s+(\d+\s*(?:days?|weeks?|months?|times?))?/i)
        if (durationMatch && durationMatch[1]) {
          duration = durationMatch[1]
          // Remove the whole duration phrase from name (e.g. "for 3 months")
          name = name.replace(durationMatch[0], '').trim()
        }
        
        // Clean up name (remove extra spaces, brackets, trailing hyphens, and extra words)
        name = name
          .replace(/\[[^\]]*\]/g, '')                    // any remaining [ ... ]
          .replace(/\s*-\s*(daily|once|twice).*$/i, '')  // "- daily for 3 months" etc
          .replace(/\s*-\s*$/, '')                       // trailing hyphen
          .replace(/[,;:]\s*$/, '')                      // trailing punctuation
          .replace(/\s{2,}/g, ' ')                       // collapse multiple spaces
          .trim()
        
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

  // Merge all anatomy viewer data into a single completion entry
  const mergeAnatomyData = (appointmentId: string): CompletionFormEntry | null => {
    const allData = anatomyViewerData[appointmentId]
    if (!allData) return null

    const dataEntries = Object.values(allData).filter((d): d is AnatomyViewerData => d !== null)
    if (dataEntries.length === 0) return null

    // Merge all medicines (deduplicate by name)
    const allMedicines: Array<{ name: string; dosage: string; frequency: string; duration: string }> = []
    const medicineNames = new Set<string>()
    
    dataEntries.forEach(data => {
      data.medicines.forEach(med => {
        const medName = med.name.trim().toLowerCase()
        if (medName && !medicineNames.has(medName)) {
          medicineNames.add(medName)
          allMedicines.push(med)
        }
      })
    })

    // Merge all notes
    const allNotes: string[] = []
    dataEntries.forEach((data, index) => {
      if (data.notes && data.notes.trim()) {
        allNotes.push(`[${data.anatomyType.toUpperCase()}]: ${data.notes}`)
      }
      if (data.selectedPartInfo) {
        allNotes.push(`[${data.anatomyType.toUpperCase()}] Selected Part: ${data.selectedPartInfo.name}`)
      }
      if (data.selectedDisease) {
        allNotes.push(`[${data.anatomyType.toUpperCase()}] Diagnosis: ${data.selectedDisease.name}`)
        if (data.selectedDisease.description) {
          allNotes.push(`[${data.anatomyType.toUpperCase()}] Description: ${data.selectedDisease.description}`)
        }
        if (data.selectedDisease.prescriptions && data.selectedDisease.prescriptions.length > 0) {
          allNotes.push(`[${data.anatomyType.toUpperCase()}] Prescriptions: ${data.selectedDisease.prescriptions.join('; ')}`)
        }
      }
    })

    // Merge all diagnoses (deduplicate)
    const allDiagnoses = new Set<string>()
    const customDiagnoses: string[] = []
    
    dataEntries.forEach(data => {
      data.diagnoses.forEach(diag => {
        if (diag && diag.trim()) {
          allDiagnoses.add(diag.trim())
        }
      })
      if (data.customDiagnosis && data.customDiagnosis.trim()) {
        customDiagnoses.push(`[${data.anatomyType.toUpperCase()}]: ${data.customDiagnosis.trim()}`)
      }
    })

    const finalDiagnoses = Array.from(allDiagnoses)
    if (customDiagnoses.length > 0) {
      finalDiagnoses.push(CUSTOM_DIAGNOSIS_OPTION)
    }

    return {
      medicines: allMedicines,
      notes: allNotes.join('\n\n'),
      recheckupRequired: false,
      finalDiagnosis: finalDiagnoses,
      customDiagnosis: customDiagnoses.length > 0 ? customDiagnoses.join('; ') : undefined
    }
  }

  // Handle combined anatomy completion
  const handleCombinedAnatomyCompletion = async (appointmentId: string) => {
    const mergedData = mergeAnatomyData(appointmentId)
    if (!mergedData) {
      setNotification({
        type: "error",
        message: "No anatomy data found. Please complete at least one anatomy checkup."
      })
      return
    }

    if (mergedData.medicines.length === 0) {
      setNotification({
        type: "error",
        message: "Please add at least one medicine before completing the checkup."
      })
      return
    }

    if (!mergedData.finalDiagnosis || mergedData.finalDiagnosis.length === 0) {
      setNotification({
        type: "error",
        message: "Please select at least one diagnosis before completing the consultation."
      })
      return
    }

    setShowCombinedCompletionModal(prev => ({
      ...prev,
      [appointmentId]: false
    }))

    await runCompletionFlow(appointmentId, mergedData, { showToast: true })
    
    // Clear anatomy data after completion
    setAnatomyViewerData(prev => {
      const updated = { ...prev }
      delete updated[appointmentId]
      return updated
    })
    setSelectedAnatomyTypes(prev => {
      const updated = { ...prev }
      delete updated[appointmentId]
      return updated
    })
    setConsultationMode(prev => {
      const updated = { ...prev }
      updated[appointmentId] = null
      return updated
    })
  }

  const runCompletionFlow = async (
    appointmentId: string,
    formData: CompletionFormEntry,
    options?: { showToast?: boolean }
  ) => {
    if (!activeHospitalId) {
      setNotification({ 
        type: "error", 
        message: "Hospital context is not available. Please refresh the page." 
      })
      return
    }

    // Validate diagnosis requirement
    if (!formData.finalDiagnosis || formData.finalDiagnosis.length === 0) {
      setNotification({
        type: "error",
        message: "Please select at least one diagnosis before completing the consultation."
      })
      return
    }

    const appointmentSnapshot = appointments.find((apt) => apt.id === appointmentId)
    const medicineText = formatMedicinesAsText(formData.medicines, formData.notes)

    // Filter out custom diagnosis option from the diagnosis array
    const diagnoses = formData.finalDiagnosis.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION)

    const result = await completeAppointment(
      appointmentId,
      medicineText,
      formData.notes,
      activeHospitalId,
      diagnoses,
      formData.customDiagnosis,
      user?.uid,
      "doctor"
    )

    setAppointments((prevAppointments) =>
      prevAppointments.map((apt) =>
        apt.id === appointmentId ? { ...apt, ...result.updates } : apt
      )
    )

    // Send completion WhatsApp message with Google Review link
    if (appointmentSnapshot) {
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {

        } else {
          const token = await currentUser.getIdToken()

          if (!activeHospitalId) {

          }

          const completionResponse = await fetch("/api/doctor/send-completion-whatsapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              appointmentId,
              patientId: appointmentSnapshot.patientId,
              patientPhone: appointmentSnapshot.patientPhone,
              patientName: appointmentSnapshot.patientName,
              hospitalId: activeHospitalId, // Pass hospitalId to API
            }),
          })

          const responseData = await completionResponse.json().catch(() => ({}))
          
          if (!completionResponse.ok) {

          } else {

            if (options?.showToast !== false) {
              setNotification({
                type: "success",
                message: responseData.message || "Checkup completed and thank you message sent!"
              })
            }
          }
        }
      } catch (error) {

        // Don't fail the completion if WhatsApp fails
      }
    } else {

    }

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
            recheckupNote: formData.recheckupNote || "",
          }),
        })

        if (!response.ok) {

        }
      } catch (error) {

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
    
    // Find the appointment and validate date
    // COMMENTED OUT FOR TESTING - Allow completing appointments from any date
    const appointment = appointments.find(apt => apt.id === appointmentId)
    // if (appointment) {
    //   const appointmentDate = new Date(appointment.appointmentDate)
    //   const today = new Date()
    //   today.setHours(0, 0, 0, 0)
    //   appointmentDate.setHours(0, 0, 0, 0)
    //   const isToday = appointmentDate.getTime() === today.getTime()
    //   const isFutureAppointment = appointmentDate > today
    //   
    //   if (isFutureAppointment && !isToday) {
    //     setNotification({
    //       type: "error",
    //       message: "Cannot complete future appointments. You can only complete appointments scheduled for today."
    //     })
    //     return
    //   }
    // }
    
    const currentData: CompletionFormEntry = completionData[appointmentId] || { 
      medicines: [], 
      notes: "", 
      recheckupRequired: false,
      finalDiagnosis: [],
      customDiagnosis: ""
    }
    
    // Validate that at least one medicine has a name
    if (!hasValidPrescriptionInput(currentData)) {
      setNotification({ 
        type: "error", 
        message: "Please add at least one medicine with a name" 
      })
      return
    }

    // Validate diagnosis requirement
    if (!currentData.finalDiagnosis || currentData.finalDiagnosis.length === 0) {
      setNotification({
        type: "error",
        message: "Please select at least one diagnosis before completing the consultation."
      })
      return
    }

    setUpdating({...updating, [appointmentId]: true})
    try {
      await runCompletionFlow(appointmentId, currentData)
    } catch (error: unknown) {

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

  const tabItems: { key: TabKey; label: string; count: number }[] = [
    { key: "today", label: "Today", count: todayAppointments.length },
    { key: "tomorrow", label: "Tomorrow", count: tomorrowAppointments.length },
    { key: "thisWeek", label: "This Week", count: thisWeekAppointments.length },
    { key: "nextWeek", label: "Next Week", count: nextWeekAppointments.length },
    { key: "history", label: "History", count: historyAppointments.length },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-white pt-20">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 opacity-90" />
          <div className="relative px-6 sm:px-8 py-6 sm:py-8 flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between text-white">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl">📋</div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold">Appointments</h1>
                <p className="text-sm text-slate-200/90 mt-1">Manage today’s schedule and history in one place.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <StatPill label="Today" value={todayAppointments.length} icon="☀️" />
              <StatPill label="Tomorrow" value={tomorrowAppointments.length} icon="⏭️" />
              <StatPill label="This week" value={thisWeekAppointments.length} icon="📆" />
              <StatPill label="History" value={historyAppointments.length} icon="🗂️" />
            </div>
          </div>
        </div>

        {/* Branch Selection */}
        {branches.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg">🏥</span>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Select Branch</label>
                  <p className="text-xs text-slate-500">View appointments for a specific branch</p>
                </div>
              </div>
              <div className="flex-1 max-w-xs">
                <select
                  value={selectedBranchId || ""}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                  disabled={loadingBranches}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="relative bg-white border border-slate-200 rounded-2xl shadow-sm p-6 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500"></div>
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="schedule-pattern-appointments" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="1.5" fill="currentColor" className="text-indigo-600" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#schedule-pattern-appointments)" />
            </svg>
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <h2 className="text-xl font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Schedule
                  </h2>
                  <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"></div>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-sm animate-pulse">
                  <span className="relative flex items-center gap-1">
                    <span className="absolute h-2 w-2 bg-white rounded-full animate-ping"></span>
                    <span className="relative h-2 w-2 bg-white rounded-full"></span>
                    Live synced
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition text-sm font-medium shadow-sm hover:shadow-md"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Report
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg border-2 border-blue-300 text-blue-700 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm hover:shadow-md"
                >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="relative flex flex-wrap items-center gap-2 rounded-xl p-2 bg-slate-50/60 mb-4 shadow-sm border border-slate-200">
            <div className="relative flex flex-wrap items-center gap-2 w-full z-10">
            {tabItems.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 min-w-[80px] ${
                  activeTab === tab.key
                    ? "bg-slate-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white bg-white/60"
                }`}
              >
                <span className="whitespace-nowrap">{tab.label}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
            </div>
          </div>

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
                  <div 
                    key={appointment.id} 
                    ref={(el) => {
                      if (el) {
                        appointmentCardRefs.current[appointment.id] = el
                      }
                    }}
                    className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm"
                  >
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
                        {(appointment as any).finalDiagnosis && (appointment as any).finalDiagnosis.length > 0 && (
                          <div>
                            <p className="font-semibold text-slate-800 mb-1">Final Diagnosis</p>
                            <div className="flex flex-wrap gap-2">
                              {(appointment as any).finalDiagnosis.map((diagnosis: string, index: number) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs font-medium text-blue-700"
                                >
                                  {diagnosis}
                                </span>
                              ))}
                            </div>
                            {(appointment as any).customDiagnosis && (
                              <div className="mt-2 bg-purple-50 border border-purple-200 rounded p-2 text-xs text-purple-800">
                                <span className="font-semibold">Custom:</span> {(appointment as any).customDiagnosis}
                              </div>
                            )}
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
                <div
                  key={appointment.id}
                  id={`appointment-${appointment.id}`}
                  ref={(el) => {
                    if (el) {
                      appointmentCardRefs.current[appointment.id] = el
                    }
                  }}
                  className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-slate-300"
                >
                  {/* Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleAccordion(appointment.id)}
                    className="w-full text-left p-3 sm:p-4 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100/80 hover:to-white transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      {/* Patient Avatar */}
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 via-sky-100 to-cyan-100 text-indigo-700 font-semibold text-lg flex items-center justify-center shadow-sm">
                        {appointment.patientName.charAt(0).toUpperCase()}
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {appointment.patientName}
                          </h3>
                          {appointment.patientGender && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                              {appointment.patientGender}
                            </span>
                          )}
                          {appointment.patientBloodGroup && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-700 border border-red-200 font-semibold">
                              {appointment.patientBloodGroup}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            {appointment.appointmentTime}
                          </span>
                          {appointment.patientPhone && (
                            <span className="inline-flex items-center gap-1">
                              {appointment.patientPhone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status / Chevron */}
                      <div className="flex items-center gap-2 justify-between sm:justify-end">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            appointment.status
                          )}`}
                        >
                          {appointment.status === "confirmed"
                            ? "Confirmed"
                            : appointment.status === "completed"
                            ? "Completed"
                            : appointment.status}
                        </span>
                        <div
                          className={`w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 transition-transform duration-300 ease-in-out ${
                            expandedAppointment === appointment.id ? "rotate-180" : ""
                          }`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Accordion Body */}
                  <div
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      expandedAppointment === appointment.id
                        ? "max-h-[10000px] opacity-100 translate-y-0"
                        : "max-h-0 opacity-0 -translate-y-4"
                    }`}
                  >
                    {expandedAppointment === appointment.id && (
                      <div className="p-6 bg-gradient-to-br from-emerald-50/30 via-cyan-50/20 to-white border-t-2 border-emerald-200/50">
                      {/* Top Section: Patient Info (Left) + Lifestyle & Appointment (Right) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        {/* LEFT: Patient Information Only */}
                        <div>
                          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-100/50 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <h4 className="font-semibold text-slate-800 text-sm">
                                Patient Information
                              </h4>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
                                <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Patient ID</span>
                                <p className="font-mono text-slate-800 mt-1 text-xs font-medium break-all">{appointment.patientId}</p>
                              </div>
                              <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
                                <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Full Name</span>
                                <p className="text-slate-900 mt-1 text-sm font-semibold">{appointment.patientName}</p>
                              </div>
                              <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
                                <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Email</span>
                                <p className="text-slate-900 mt-1 text-xs">{appointment.patientEmail}</p>
                              </div>
                              {appointment.patientPhone && (
                                <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
                                  <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Phone</span>
                                  <p className="text-slate-900 mt-1 font-medium text-xs">{appointment.patientPhone}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                {appointment.patientGender && (
                                  <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50">
                                    <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Gender</span>
                                    <p className="text-slate-900 mt-1 font-medium text-xs">{appointment.patientGender}</p>
                                  </div>
                                )}
                                {appointment.patientBloodGroup && (
                                  <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-2 border border-red-200">
                                    <span className="text-red-600 text-[10px] font-semibold uppercase tracking-wide">Blood Group</span>
                                    <p className="text-red-700 mt-1 font-semibold text-xs">{appointment.patientBloodGroup}</p>
                                  </div>
                                )}
                            {appointment.patientHeightCm != null && (
                              <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50">
                                <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Height</span>
                                <p className="text-slate-900 mt-1 font-medium text-xs">{appointment.patientHeightCm} cm</p>
                              </div>
                            )}
                            {appointment.patientWeightKg != null && (
                              <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50">
                                <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Weight</span>
                                <p className="text-slate-900 mt-1 font-medium text-xs">{appointment.patientWeightKg} kg</p>
                              </div>
                            )}
                              </div>
                              {appointment.patientDateOfBirth && (
                                <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
                                  <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Date of Birth</span>
                                  <p className="text-slate-900 mt-1 text-xs font-medium">
                                    {new Date(appointment.patientDateOfBirth).toLocaleDateString()}
                                    <span className="text-emerald-600 text-xs ml-1.5">
                                      {(() => {
                                        const age = calculateAge(appointment.patientDateOfBirth)
                                        return age !== null ? `(Age: ${age})` : '(N/A)'
                                      })()}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>
                            </div>
                          </div>

                        {/* RIGHT: Lifestyle & Appointment Details */}
                        <div className="space-y-3">
                          {/* Social & Lifestyle Information */}
                          {(appointment.patientDrinkingHabits || appointment.patientSmokingHabits || appointment.patientVegetarian) && (
                            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-100/50 shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center text-white shadow-sm">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                  </svg>
                                </div>
                                <h4 className="font-semibold text-slate-800 text-sm">
                                  Lifestyle
                                </h4>
                              </div>
                              <div className="space-y-2 text-xs">
                                {appointment.patientDrinkingHabits && (
                                  <div className="bg-gradient-to-r from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50 flex items-center justify-between">
                                    <span className="text-emerald-700 font-medium text-xs">Drinking</span>
                                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 px-2 py-1 rounded-full text-white font-semibold capitalize text-[10px]">
                                      {appointment.patientDrinkingHabits}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientSmokingHabits && (
                                  <div className="bg-gradient-to-r from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50 flex items-center justify-between">
                                    <span className="text-emerald-700 font-medium text-xs">Smoking</span>
                                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 px-2 py-1 rounded-full text-white font-semibold capitalize text-[10px]">
                                      {appointment.patientSmokingHabits}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientOccupation && (
                                  <div className="bg-gradient-to-r from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50 flex items-center justify-between">
                                    <span className="text-emerald-700 font-medium text-xs">Occupation</span>
                                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 px-2 py-1 rounded-full text-white font-semibold text-[10px]">
                                      {appointment.patientOccupation}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientVegetarian && (
                                  <div className="bg-gradient-to-r from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50 flex items-center justify-between">
                                    <span className="text-emerald-700 font-medium text-xs">Diet</span>
                                    <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 px-2 py-1 rounded-full text-white font-semibold capitalize text-[10px]">
                                      {appointment.patientVegetarian}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Appointment Details */}
                          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-100/50 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <h4 className="font-semibold text-slate-800 text-sm">
                                Appointment Details
                              </h4>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/30 rounded-lg p-2 border border-blue-100/50">
                                <span className="text-blue-600 text-[10px] font-semibold uppercase tracking-wide">Date</span>
                                <p className="text-slate-900 mt-1 font-medium text-xs">{new Date(appointment.appointmentDate).toLocaleDateString('en-US', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'})}</p>
                              </div>
                              <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/30 rounded-lg p-2 border border-blue-100/50">
                                <span className="text-blue-600 text-[10px] font-semibold uppercase tracking-wide">Time</span>
                                <p className="text-slate-900 mt-1 font-semibold text-sm">{appointment.appointmentTime}</p>
                              </div>
                              <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/30 rounded-lg p-2 border border-blue-100/50">
                                <span className="text-blue-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Status</span>
                                <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${getStatusColor(appointment.status)}`}>
                                  {appointment.status === "confirmed" ? "✓ Confirmed" : 
                                   appointment.status === "completed" ? "✓ Completed" : 
                                   appointment.status}
                                </span>
                              </div>
                              </div>
                            </div>
                          </div>
                        </div>

                      {/* Bottom Section: Latest Recommendation + Medical Info + AI Diagnosis (Full Width) */}
                      <div className="space-y-4">
                        {/* Last Appointment Details - Full width section */}
                        {(() => {
                          const latestRecommendation = getLatestCheckupRecommendation(appointment)
                          return latestRecommendation && (
                            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-4 md:p-5 border border-blue-200/70 shadow-sm">
                              <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-blue-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                                    🩺
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-blue-900 text-sm md:text-base">
                                      Last appointment detials
                                    </h5>
                                    <p className="text-[11px] text-blue-700/80">
                                      Summary of the most recent completed visit
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] md:text-xs text-blue-700 bg-white/80 px-2.5 py-1 rounded-full border border-blue-200 shadow-sm">
                                  {latestRecommendation.date}
                                </span>
                              </div>

                              {/* Diagnosis from last appointment */}
                              {(latestRecommendation.finalDiagnosis?.length > 0 || latestRecommendation.customDiagnosis) && (
                                <div className="mb-3">
                                  <span className="text-blue-900 text-xs font-semibold block mb-2">
                                    🧾 Diagnosis
                                  </span>
                                  {latestRecommendation.finalDiagnosis?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-1">
                                      {latestRecommendation.finalDiagnosis.map((diagnosis: string, index: number) => (
                                        <span
                                          key={index}
                                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 border border-blue-200"
                                        >
                                          {diagnosis}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {latestRecommendation.customDiagnosis && (
                                    <div className="mt-1 bg-white rounded-lg border border-blue-100 px-2.5 py-1.5">
                                      <span className="text-[11px] font-semibold text-blue-800 block mb-0.5">
                                        Custom:
                                      </span>
                                      <p className="text-[11px] text-blue-900 whitespace-pre-line">
                                        {latestRecommendation.customDiagnosis}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {latestRecommendation.medicine && (() => {
                                const parsed = parsePrescription(latestRecommendation.medicine)
                                if (parsed && parsed.medicines.length > 0) {
                                  return (
                                    <div className="mb-3">
                                      <span className="text-blue-800 text-xs font-semibold block mb-2">
                                        💊 Previous Medicines
                                      </span>
                                      <div className="bg-white rounded-lg p-3 border border-blue-100">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                          {parsed.medicines.map((med, index) => (
                                            <div
                                              key={index}
                                              className="bg-blue-50/60 border border-blue-100 rounded-lg p-2 flex flex-col gap-1"
                                            >
                                              <div className="flex items-start gap-1.5">
                                                <span className="text-sm">{med.emoji}</span>
                                                <div className="flex-1 min-w-0">
                                                  <p className="font-semibold text-[12px] text-blue-900 truncate">
                                                    {med.name}
                                                    {med.dosage && (
                                                      <span className="text-[11px] text-blue-700 font-normal ml-1">
                                                        ({med.dosage})
                                                      </span>
                                                    )}
                                                  </p>
                                                  {(med.frequency || med.duration) && (
                                                    <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-blue-800/90">
                                                      {med.frequency && (
                                                        <span className="inline-flex items-center gap-1">
                                                          <span className="text-blue-400">⏱</span>
                                                          <span>{med.frequency}</span>
                                                        </span>
                                                      )}
                                                      {med.duration && (
                                                        <span className="inline-flex items-center gap-1">
                                                          <span className="text-blue-400">📅</span>
                                                          <span>{med.duration}</span>
                                                        </span>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
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
                                      <span className="text-blue-800 text-xs font-semibold block mb-1">
                                        💊 Previous Medicines
                                      </span>
                                      <p className="text-blue-900 text-sm font-medium bg-white p-2 rounded-lg border border-blue-100 whitespace-pre-line">
                                        {latestRecommendation.medicine}
                                      </p>
                                    </div>
                                  )
                                }
                              })()}

                              {latestRecommendation.notes && (
                                <div className="mb-2">
                                  <span className="text-blue-800 text-xs font-semibold block mb-1">
                                    📝 Previous Notes
                                  </span>
                                  <p className="text-blue-900 text-xs md:text-sm font-medium bg-white p-2 rounded-lg border border-blue-100 whitespace-pre-line line-hight-1">
                                    {latestRecommendation.notes}
                                  </p>
                                </div>
                              )}

                              {/* Documents from last appointment */}
                              {(() => {
                                const docs =
                                  latestRecommendation.appointmentId &&
                                  historyDocuments[latestRecommendation.appointmentId]
                                    ? historyDocuments[latestRecommendation.appointmentId]
                                    : []
                                return (
                                  <div className="mb-2">
                                    <span className="text-blue-800 text-xs font-semibold block mb-1">
                                      📄 Documents
                                    </span>
                                    {docs.length > 0 ? (
                                      <div className="space-y-1">
                                        {docs.map((doc) => (
                                          <button
                                            key={doc.id}
                                            type="button"
                                            onClick={() => setSelectedHistoryDocument(doc)}
                                            className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] bg-white/90 text-blue-800 border border-blue-100 hover:bg-blue-50 transition-colors"
                                          >
                                            <span>📄</span>
                                            <span className="truncate flex-1 text-left">
                                              {doc.originalFileName}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-blue-900 bg-white p-2 rounded-lg border border-blue-100">
                                        📄 Documents: No any document attached.
                                      </p>
                                    )}
                                  </div>
                                )
                              })()}

                              <div className="mt-2 text-[11px] md:text-xs text-blue-700 font-medium flex items-center gap-1">
                                <span className="text-blue-500">👨‍⚕️</span>
                                <span>
                                  Recommended by <span className="font-semibold">{latestRecommendation.doctorName}</span>
                                </span>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Medical Information */}
                        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-100/50 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <h4 className="font-semibold text-slate-800 text-sm">
                                Medical Information
                              </h4>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
                                <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Chief Complaint</span>
                                <p className="text-slate-900 font-medium text-xs leading-relaxed">
                                  {appointment.chiefComplaint || "No chief complaint provided"}
                                </p>
                              </div>
                              {appointment.patientAdditionalConcern && (
                                <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
                                  <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Additional Details</span>
                                  <p className="text-slate-900 font-medium text-xs leading-relaxed">
                                    {appointment.patientAdditionalConcern}
                                  </p>
                                </div>
                              )}
                              {appointment.medicalHistory && (
                                <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
                                  <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Medical History</span>
                                  <p className="text-slate-900 font-medium text-xs leading-relaxed">
                                    {appointment.medicalHistory}
                                  </p>
                                </div>
                              )}
                              {appointment.patientAllergies && (
                                <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-2.5 border border-red-300">
                                  <span className="text-red-700 text-[10px] font-semibold uppercase tracking-wide mb-1 block flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    ALLERGIES - DO NOT PRESCRIBE
                                  </span>
                                  <p className="text-red-900 font-semibold text-xs leading-relaxed">
                                    {appointment.patientAllergies}
                                  </p>
                                </div>
                              )}
                              {appointment.patientCurrentMedications && (
                                <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
                                  <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Current Medications</span>
                                  <p className="text-slate-900 font-medium text-xs leading-relaxed">
                                    {appointment.patientCurrentMedications}
                                  </p>
                                </div>
                              )}
                              {appointment.patientFamilyHistory && (
                                <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
                                  <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Family History</span>
                                  <p className="text-slate-900 font-medium text-xs leading-relaxed">
                                    {appointment.patientFamilyHistory}
                                  </p>
                                </div>
                              )}
                              {appointment.patientPregnancyStatus && (
                                <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
                                  <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Pregnancy Status</span>
                                  <p className="text-slate-900 font-medium text-xs leading-relaxed">
                                    {appointment.patientPregnancyStatus}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AI Diagnosis Button - Only show if not already generated */}
                          {!aiDiagnosis[appointment.id] && appointment.status === "confirmed" && (
                            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/60 rounded-lg p-4 border border-indigo-200 shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-slate-800 text-sm truncate">
                                      AI Diagnostic Assistant
                                    </h4>
                                    <p className="text-xs text-slate-500 truncate">
                                      Groq Llama 3.3 70B
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => getAIDiagnosisSuggestion(appointment)}
                                  disabled={loadingAiDiagnosis[appointment.id]}
                                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-1.5 shadow-sm flex-shrink-0"
                                >
                                  {loadingAiDiagnosis[appointment.id] ? (
                                    <>
                                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Analyzing...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                      </svg>
                                      Get Suggestion
                                    </>
                                  )}
                                </button>
                              </div>
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
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                      Regenerate
                                    </button>
                              {appointment.status === "confirmed" && !showCompletionForm[appointment.id] && (
                                <button
                                  onClick={() => handleCompleteConsultationClick(appointment.id)}
                                  disabled={updating[appointment.id]}
                                  className="btn-modern btn-modern-sm flex items-center justify-center gap-2"
                                  title="Complete consultation"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Complete Consultation
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
                            <div className="mt-3">
                              <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                                <button
                                  onClick={() => setShowHistory({ ...showHistory, [appointment.id]: !showHistory[appointment.id] })}
                                  className="w-full flex items-center justify-between hover:bg-slate-50 rounded-lg p-1.5 transition-colors"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-base">📚</span>
                                    <h4 className="font-semibold text-slate-800 text-sm">
                                      Previous Checkup History ({filteredHistory.length}/{historyForPatient.length})
                                    </h4>
                                  </div>
                                  <div className={`transition-transform duration-200 ${showHistory[appointment.id] ? "rotate-180" : ""}`}>
                                    <span className="text-slate-600 text-sm">▼</span>
                                  </div>
                                </button>

                                {showHistory[appointment.id] && (() => {
                                  // Group history by doctor
                                  const showAll = showAllDoctorsHistory[appointment.id] || false
                                  const currentDoctorId = appointment.doctorId
                                  const currentDoctorHistory = filteredHistory.filter(item => item.doctorId === currentDoctorId)
                                  const otherDoctorsHistory = showAll 
                                    ? filteredHistory.filter(item => item.doctorId !== currentDoctorId)
                                    : []
                                  
                                  // Group other doctors' history by doctor
                                  const otherDoctorsGrouped: Record<string, AppointmentType[]> = {}
                                  otherDoctorsHistory.forEach(item => {
                                    const doctorKey = `${item.doctorId}_${item.doctorName || 'Unknown'}_${item.doctorSpecialization || ''}`
                                    if (!otherDoctorsGrouped[doctorKey]) {
                                      otherDoctorsGrouped[doctorKey] = []
                                    }
                                    otherDoctorsGrouped[doctorKey].push(item)
                                  })

                                  // Helper function to render history item
                                  const renderHistoryItem = (historyItem: AppointmentType, visitNumber: string | number, isCurrentDoctor: boolean = true) => (
                                    <div key={historyItem.id} className={`p-2 rounded border ${isCurrentDoctor ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-300'}`}>
                                      <div className="flex items-center justify-between mb-1">
                                        <p className={`text-xs font-semibold ${isCurrentDoctor ? 'text-gray-900' : 'text-slate-700'}`}>
                                          Visit #{visitNumber}
                                        </p>
                                        <p className={`text-[10px] ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-500'}`}>
                                          {new Date(historyItem.appointmentDate).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <div className="space-y-1 text-[11px]">
                                        <div>
                                          <span className={`font-medium ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-600'}`}>Chief Complaint:</span>
                                          <p className={`mt-0.5 ${isCurrentDoctor ? 'text-gray-900' : 'text-slate-800'}`}>{historyItem.chiefComplaint}</p>
                                        </div>
                                        {historyItem.associatedSymptoms && (
                                          <div>
                                            <span className={`font-medium ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-600'}`}>Symptoms:</span>
                                            <p className={`mt-0.5 whitespace-pre-line ${isCurrentDoctor ? 'text-gray-900' : 'text-slate-800'}`}>{historyItem.associatedSymptoms}</p>
                                          </div>
                                        )}
                                        {((historyItem as any).finalDiagnosis && (historyItem as any).finalDiagnosis.length > 0) && (
                                          <div>
                                            <span className={`font-medium ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-600'}`}>Final Diagnosis:</span>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                              {(historyItem as any).finalDiagnosis.map((diagnosis: string, index: number) => (
                                                <span
                                                  key={index}
                                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${isCurrentDoctor ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-slate-100 border border-slate-300 text-slate-700'}`}
                                                >
                                                  {diagnosis}
                                                </span>
                                              ))}
                                            </div>
                                            {(historyItem as any).customDiagnosis && (
                                              <div className={`mt-1 rounded px-1.5 py-0.5 text-[10px] ${isCurrentDoctor ? 'bg-purple-50 border border-purple-200 text-purple-800' : 'bg-slate-100 border border-slate-300 text-slate-700'}`}>
                                                <span className="font-semibold">Custom:</span> {(historyItem as any).customDiagnosis}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {historyItem.medicine && (() => {
                                          const parsed = parsePrescription(historyItem.medicine)
                                          if (parsed && parsed.medicines.length > 0) {
                                            return (
                                              <div>
                                                <span className={`font-medium mb-0.5 block text-[11px] ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-600'}`}>💊 Medicines:</span>
                                                <div className="grid grid-cols-3 gap-1">
                                                  {parsed.medicines.map((med, medIndex) => (
                                                    <div key={medIndex} className={`border rounded p-1 ${isCurrentDoctor ? 'bg-gray-50 border-gray-200' : 'bg-slate-100 border-slate-300'}`}>
                                                      <div className="flex items-start gap-0.5">
                                                        <span className="text-[10px]">{med.emoji}</span>
                                                        <div className="flex-1 min-w-0">
                                                          <span className={`font-semibold text-[11px] leading-tight ${isCurrentDoctor ? 'text-gray-900' : 'text-slate-800'}`}>
                                                            {med.name}
                                                            {med.dosage && <span className={`font-normal text-[10px] ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-600'}`}> ({med.dosage})</span>}
                                                          </span>
                                                          {(med.frequency || med.duration) && (
                                                            <div className="flex items-center gap-1 mt-0.5 text-[10px] leading-tight" style={{ color: isCurrentDoctor ? '#6B7280' : '#64748B' }}>
                                                              {med.frequency && <span>{med.frequency}</span>}
                                                              {med.frequency && med.duration && <span>•</span>}
                                                              {med.duration && <span>{med.duration}</span>}
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )
                                          } else {
                                            return (
                                              <div>
                                                <span className={`font-medium text-[11px] ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-600'}`}>💊 Medicine:</span>
                                                <p className={`mt-0.5 whitespace-pre-line text-[11px] ${isCurrentDoctor ? 'text-gray-900' : 'text-slate-800'}`}>{historyItem.medicine}</p>
                                              </div>
                                            )
                                          }
                                        })()}
                                        {historyItem.doctorNotes && (
                                          <div>
                                            <span className={`font-medium ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-600'}`}>📝 Notes:</span>
                                            <p className={`mt-0.5 whitespace-pre-line ${isCurrentDoctor ? 'text-gray-900' : 'text-slate-800'}`}>{historyItem.doctorNotes}</p>
                                          </div>
                                        )}
                                        
                                        {/* Documents for this visit */}
                                        {historyDocuments[historyItem.id] && historyDocuments[historyItem.id].length > 0 && (
                                          <div className="mt-2 pt-2 border-t border-slate-200">
                                            <span className={`font-medium text-[11px] ${isCurrentDoctor ? 'text-gray-600' : 'text-slate-600'}`}>📄 Documents ({historyDocuments[historyItem.id].length}):</span>
                                            <div className="mt-1 space-y-1">
                                              {historyDocuments[historyItem.id].map((doc) => (
                                                <button
                                                  key={doc.id}
                                                  onClick={() => setSelectedHistoryDocument(doc)}
                                                  className={`w-full flex items-center gap-1.5 p-1 rounded text-[10px] cursor-pointer hover:bg-opacity-80 transition-colors ${isCurrentDoctor ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                                >
                                                  <span>📄</span>
                                                  <span className="truncate flex-1 text-left">{doc.originalFileName}</span>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )

                                  return (
                                    <div className="mt-3 space-y-2">
                                      {filteredHistory.length === 0 ? (
                                        <div className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                          No visits match the current search filters.
                                        </div>
                                      ) : (
                                        <>
                                          {/* Current Doctor's History */}
                                          {currentDoctorHistory.length > 0 && (
                                            <div className="space-y-2">
                                              {currentDoctorHistory.map((historyItem) => {
                                                const visitIndex = historyForPatient.findIndex(item => item.id === historyItem.id)
                                                const visitNumber = visitIndex >= 0 ? historyForPatient.length - visitIndex : "-"
                                                return renderHistoryItem(historyItem, visitNumber, true)
                                              })}
                                            </div>
                                          )}

                                          {/* Other Doctors' History - Accordion Format */}
                                          {showAll && Object.keys(otherDoctorsGrouped).length > 0 && (
                                            <div className="space-y-2 mt-3 pt-3 border-t-2 border-slate-300">
                                              <h5 className="text-xs font-semibold text-slate-700 mb-1.5">Other Doctors' History</h5>
                                              {Object.entries(otherDoctorsGrouped).map(([doctorKey, doctorHistory]) => {
                                                const firstItem = doctorHistory[0]
                                                const doctorName = firstItem.doctorName || 'Unknown Doctor'
                                                const doctorSpecialization = firstItem.doctorSpecialization || 'General'
                                                const accordionKey = `${appointment.id}_${doctorKey}`
                                                
                                                return (
                                                  <div key={doctorKey} className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
                                                    <button
                                                      onClick={() => setExpandedDoctors(prev => ({ ...prev, [accordionKey]: !prev[accordionKey] }))}
                                                      className="w-full flex items-center justify-between p-2 bg-gradient-to-r from-slate-100 to-slate-50 hover:from-slate-200 hover:to-slate-100 transition-colors"
                                                    >
                                                      <div className="flex items-center gap-1.5">
                                                        <span className="text-sm">👨‍⚕️</span>
                                                        <div className="text-left">
                                                          <p className="text-xs font-semibold text-slate-800">{doctorName}</p>
                                                          <p className="text-[10px] text-slate-600">{doctorSpecialization}</p>
                                                        </div>
                                                      </div>
                                                      <div className={`transition-transform duration-200 ${expandedDoctors[accordionKey] ? "rotate-180" : ""}`}>
                                                        <span className="text-slate-600 text-sm">▼</span>
                                                      </div>
                                                    </button>
                                                    {expandedDoctors[accordionKey] && (
                                                      <div className="p-2 space-y-2 bg-white">
                                                        {doctorHistory.map((historyItem) => {
                                                          const visitIndex = historyForPatient.findIndex(item => item.id === historyItem.id)
                                                          const visitNumber = visitIndex >= 0 ? historyForPatient.length - visitIndex : "-"
                                                          return renderHistoryItem(historyItem, visitNumber, false)
                                                        })}
                                                      </div>
                                                    )}
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          )}

                                          {/* Toggle Button at Bottom */}
                                          <div className="mt-3 pt-3 border-t border-slate-200">
                                            <button
                                              onClick={() => toggleAllDoctorsHistory(appointment.id)}
                                              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-xs font-medium"
                                            >
                                              <svg className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                              {showAll ? 'Hide Other Doctors\' History' : 'Show All Doctors\' History'}
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          )
                        })(                          )}

                          {/* Documents & Reports Section - Accordion */}
                          <div className="mt-3">
                            <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
                              <button
                                onClick={() => setShowDocuments(prev => ({ ...prev, [appointment.id]: !prev[appointment.id] }))}
                                className="w-full flex items-center justify-between hover:bg-slate-50 rounded-lg p-1.5 transition-colors"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base">📄</span>
                                  <h4 className="font-semibold text-slate-800 text-sm">
                                   All  Documents & Reports
                                  </h4>
                                </div>
                                <div className={`transition-transform duration-200 ${showDocuments[appointment.id] ? "rotate-180" : ""}`}>
                                  <span className="text-slate-600 text-sm">▼</span>
                                </div>
                              </button>

                              {showDocuments[appointment.id] && (
                                <div className="mt-3">
                                  <AppointmentDocuments
                                    appointmentId={appointment.id}
                                    patientId={appointment.patientId}
                                    // Fallback to patientId if patientUid is missing so uploads work for legacy data
                                    patientUid={appointment.patientUid || appointment.patientId || ""}
                                    appointmentSpecialty={appointment.doctorSpecialization}
                                    appointmentStatus={appointment.status}
                                    canUpload={true}
                                    canEdit={true}
                                    canDelete={true}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Complete Consultation Button - Show at bottom if AI not shown yet */}
                          {!aiDiagnosis[appointment.id] && appointment.status === "confirmed" && !showCompletionForm[appointment.id] && (
                            <div className="mt-4">
                              <button
                                onClick={() => handleCompleteConsultationClick(appointment.id)}
                                disabled={updating[appointment.id]}
                                className="btn-modern btn-modern-sm w-full flex items-center justify-center gap-2"
                                title="Complete consultation"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Complete Consultation
                              </button>
                            </div>
                          )}

                          {/* Complete Checkup Form Accordion */}
                          {showCompletionForm[appointment.id] && appointment.status === "confirmed" && (
                            <div className="mt-3 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-slide-up-fade">
                              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-slate-800 font-semibold text-sm flex items-center gap-1.5">
                                    {consultationMode[appointment.id] === 'anatomy' ? (
                                      <>
                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                        3D Anatomy Viewer
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Consultation Form
                                      </>
                                    )}
                                  </h4>
                                  <button
                                    onClick={() => {
                                      toggleCompletionForm(appointment.id)
                                      setConsultationMode(prev => ({
                                        ...prev,
                                        [appointment.id]: null
                                      }))
                                    }}
                                    className="text-slate-500 hover:text-slate-800 rounded p-0.5 transition-all hover:bg-slate-200"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {consultationMode[appointment.id] === 'anatomy' ? (
                                <div className="space-y-6">
                                  {selectedAnatomyTypes[appointment.id]?.map((anatomyType, index) => (
                                    <div key={`${anatomyType}-${index}`} className="border-2 border-purple-200 rounded-xl p-4 bg-gradient-to-br from-purple-50 to-pink-50">
                                      <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-purple-900 capitalize">{anatomyType} Anatomy</h3>
                                        {selectedAnatomyTypes[appointment.id] && selectedAnatomyTypes[appointment.id].length > 1 && (
                                          <button
                                            onClick={() => {
                                              setSelectedAnatomyTypes(prev => {
                                                const current = prev[appointment.id] || []
                                                return {
                                                  ...prev,
                                                  [appointment.id]: current.filter((_, i) => i !== index)
                                                }
                                              })
                                            }}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                          >
                                            Remove
                                          </button>
                                        )}
                                      </div>
                                      <InlineAnatomyViewer
                                        appointmentId={appointment.id}
                                        patientName={appointment.patientName || 'Patient'}
                                        anatomyType={anatomyType}
                                        onDataChange={(data) => {
                                          setAnatomyViewerData(prev => {
                                            const currentData = prev[appointment.id]?.[anatomyType]
                                            // Only update if data actually changed (deep comparison)
                                            if (JSON.stringify(currentData) === JSON.stringify(data)) {
                                              return prev
                                            }
                                            return {
                                              ...prev,
                                              [appointment.id]: {
                                                ...(prev[appointment.id] || {}),
                                                [anatomyType]: data
                                              }
                                            }
                                          })
                                        }}
                                        onComplete={() => {
                                          setShowCombinedCompletionModal(prev => ({
                                            ...prev,
                                            [appointment.id]: true
                                          }))
                                        }}
                                      />
                                    </div>
                                  ))}
                                  
                                  {/* Add Another Anatomy Button */}
                                  <button
                                    onClick={() => handleAddAnotherAnatomy(appointment.id)}
                                    className="w-full p-4 border-2 border-dashed border-purple-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all text-center text-purple-700 font-medium"
                                  >
                                    + Add Another Anatomy
                                  </button>

                                  {/* Combined Completion Modal */}
                                  {showCombinedCompletionModal[appointment.id] && (() => {
                                    const allData = anatomyViewerData[appointment.id]
                                    const dataEntries = allData ? Object.values(allData).filter((d): d is AnatomyViewerData => d !== null) : []
                                    const mergedData = mergeAnatomyData(appointment.id)

                                    return (
                                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                                          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                                            <h3 className="text-2xl font-bold text-slate-800">Confirm Completion - All Anatomy Types</h3>
                                            <button
                                              onClick={() => setShowCombinedCompletionModal(prev => ({
                                                ...prev,
                                                [appointment.id]: false
                                              }))}
                                              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
                                            >
                                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </div>

                                          <div className="p-6 space-y-6">
                                            {/* Patient Info */}
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                              <h4 className="font-semibold text-blue-900 mb-2">Patient Information</h4>
                                              <p className="text-slate-700">{appointment.patientName || 'Patient'}</p>
                                            </div>

                                            {/* All Anatomy Types */}
                                            {dataEntries.map((data, idx) => (
                                              <div key={idx} className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
                                                <h4 className="font-bold text-purple-900 mb-3 text-lg capitalize">{data.anatomyType} Anatomy</h4>
                                                
                                                {data.selectedPartInfo && (
                                                  <div className="mb-3">
                                                    <p className="text-sm font-semibold text-purple-800 mb-1">Selected Part:</p>
                                                    <p className="text-slate-700">{data.selectedPartInfo.name}</p>
                                                  </div>
                                                )}

                                                {data.selectedDisease && (
                                                  <div className="mb-3">
                                                    <p className="text-sm font-semibold text-purple-800 mb-1">Diagnosis:</p>
                                                    <p className="text-slate-700">{data.selectedDisease.name}</p>
                                                  </div>
                                                )}

                                                {data.medicines.length > 0 && (
                                                  <div className="mb-3">
                                                    <p className="text-sm font-semibold text-purple-800 mb-2">Medicines ({data.medicines.filter(m => m.name && m.name.trim()).length}):</p>
                                                    <div className="space-y-2">
                                                      {data.medicines.filter(m => m.name && m.name.trim()).map((med, medIdx) => (
                                                        <div key={medIdx} className="bg-white rounded p-2 border border-purple-300">
                                                          <p className="font-medium text-slate-800">{med.name}</p>
                                                          {med.dosage && <p className="text-xs text-slate-600">Dosage: {med.dosage}</p>}
                                                          {med.frequency && <p className="text-xs text-slate-600">Frequency: {med.frequency}</p>}
                                                          {med.duration && <p className="text-xs text-slate-600">Duration: {med.duration}</p>}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}

                                                {data.notes && (
                                                  <div>
                                                    <p className="text-sm font-semibold text-purple-800 mb-1">Notes:</p>
                                                    <p className="text-slate-700 whitespace-pre-wrap text-sm">{data.notes}</p>
                                                  </div>
                                                )}
                                              </div>
                                            ))}

                                            {/* Combined Summary */}
                                            {mergedData && (
                                              <>
                                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                  <h4 className="font-semibold text-green-900 mb-2">Combined Diagnosis</h4>
                                                  <div className="space-y-1">
                                                    {mergedData.finalDiagnosis?.filter(d => d !== CUSTOM_DIAGNOSIS_OPTION).map((diag, idx) => (
                                                      <p key={idx} className="text-slate-700">• {diag}</p>
                                                    ))}
                                                    {mergedData.customDiagnosis && <p className="text-slate-700">• {mergedData.customDiagnosis}</p>}
                                                  </div>
                                                </div>

                                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                                  <h4 className="font-semibold text-amber-900 mb-2">All Medicines ({mergedData.medicines.length})</h4>
                                                  <div className="space-y-2">
                                                    {mergedData.medicines.map((med, idx) => (
                                                      <div key={idx} className="bg-white rounded p-2 border border-amber-300">
                                                        <p className="font-medium text-slate-800">{med.name}</p>
                                                        {med.dosage && <p className="text-xs text-slate-600">Dosage: {med.dosage}</p>}
                                                        {med.frequency && <p className="text-xs text-slate-600">Frequency: {med.frequency}</p>}
                                                        {med.duration && <p className="text-xs text-slate-600">Duration: {med.duration}</p>}
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              </>
                                            )}
                                          </div>

                                          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
                                            <button
                                              onClick={() => setShowCombinedCompletionModal(prev => ({
                                                ...prev,
                                                [appointment.id]: false
                                              }))}
                                              className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              onClick={() => handleCombinedAnatomyCompletion(appointment.id)}
                                              className="btn-modern btn-modern-success flex-1 flex items-center justify-center gap-2"
                                            >
                                              Confirm & Complete All
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              ) : (
                                <form onSubmit={(e) => handleCompleteAppointment(e, appointment.id)} className="p-3 space-y-4">
                                {/* Final Diagnosis Section */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                  <DiagnosisSelector
                                    selectedDiagnoses={completionData[appointment.id]?.finalDiagnosis || []}
                                    customDiagnosis={completionData[appointment.id]?.customDiagnosis || ""}
                                    onDiagnosesChange={(diagnoses) => {
                                      setCompletionData((prev) => ({
                                        ...prev,
                                        [appointment.id]: {
                                          ...prev[appointment.id],
                                          finalDiagnosis: diagnoses,
                                          medicines: prev[appointment.id]?.medicines || [],
                                          notes: prev[appointment.id]?.notes || "",
                                          recheckupRequired: prev[appointment.id]?.recheckupRequired || false,
                                          customDiagnosis: prev[appointment.id]?.customDiagnosis || "",
                                        },
                                      }))
                                    }}
                                    onCustomDiagnosisChange={(customDiagnosis) => {
                                      setCompletionData((prev) => ({
                                        ...prev,
                                        [appointment.id]: {
                                          ...prev[appointment.id],
                                          customDiagnosis: customDiagnosis,
                                          medicines: prev[appointment.id]?.medicines || [],
                                          notes: prev[appointment.id]?.notes || "",
                                          recheckupRequired: prev[appointment.id]?.recheckupRequired || false,
                                          finalDiagnosis: prev[appointment.id]?.finalDiagnosis || [],
                                        },
                                      }))
                                    }}
                                    showPatientComplaints={appointment.chiefComplaint || undefined}
                                    error={
                                      completionData[appointment.id]?.finalDiagnosis?.length === 0
                                        ? "At least one diagnosis is required"
                                        : undefined
                                    }
                                  />
                                </div>

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
                                      {/* AI Suggest button removed – AI now handled via auto/section below */}
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
                                  ) : (showAiPrescriptionSuggestion[appointment.id] && aiPrescription[appointment.id]?.medicine) ? (() => {
                                    const parsedMedicines = parseAiPrescription(aiPrescription[appointment.id].medicine)
                                    const removedIndices = removedAiMedicines[appointment.id] || []
                                    const visibleMedicines = parsedMedicines.filter((_, idx) => !removedIndices.includes(idx))
                                    
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
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const existing = completionData[appointment.id]?.medicines || []
                                                const existingNames = existing.map(m => (m.name || "").toLowerCase().trim())
                                                const toAdd = visibleMedicines.filter(m => !existingNames.includes((m.name || "").toLowerCase().trim()))
                                                if (toAdd.length === 0) {
                                                  // If everything already added, just hide suggestions
                                                  setShowAiPrescriptionSuggestion(prev => ({ ...prev, [appointment.id]: false }))
                                                  return
                                                }
                                                setCompletionData(prev => ({
                                                  ...prev,
                                                  [appointment.id]: {
                                                    ...prev[appointment.id],
                                                    medicines: [...existing, ...toAdd],
                                                  },
                                                }))
                                                // After adding all, hide suggestion box
                                                setShowAiPrescriptionSuggestion(prev => ({ ...prev, [appointment.id]: false }))
                                                setRemovedAiMedicines(prev => ({ ...prev, [appointment.id]: [] }))
                                              }}
                                              className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold rounded"
                                            >
                                              Add All
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                // Regenerate suggestion
                                                setRemovedAiMedicines(prev => ({ ...prev, [appointment.id]: [] }))
                                                handleGenerateAiPrescription(appointment.id)
                                              }}
                                              disabled={loadingAiPrescription[appointment.id]}
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
                                              
                                              // Fallback to displayIndex if not found
                                              if (medIndex === -1) {
                                                medIndex = displayIndex
                                              }
                                              
                                              const isAlreadyAdded = (completionData[appointment.id]?.medicines || []).some(
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
                                                            setCompletionData((prev) => ({
                                                              ...prev,
                                                              [appointment.id]: {
                                                                ...prev[appointment.id],
                                                                medicines: [...(prev[appointment.id]?.medicines || []), med],
                                                              },
                                                            }))
                                                            // Remove this medicine from AI suggestions after adding
                                                            setRemovedAiMedicines(prev => ({
                                                              ...prev,
                                                              [appointment.id]: [...(prev[appointment.id] || []), medIndex]
                                                            }))
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
                                                          setRemovedAiMedicines(prev => ({
                                                            ...prev,
                                                            [appointment.id]: [...(prev[appointment.id] || []), medIndex]
                                                          }))
                                                          if (visibleMedicines.length === 1) {
                                                            handleDeclinePrescription(appointment.id)
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
                                            <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans">{aiPrescription[appointment.id].medicine}</pre>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })() : showAiPrescriptionSuggestion[appointment.id] ? (
                                    <div className="mb-2 bg-yellow-50 border border-yellow-200 rounded p-2">
                                      <p className="text-xs text-yellow-700">AI prescription is being generated. Please wait...</p>
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

                                {/* ENT Anatomy Viewer Section */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-medium text-gray-700">
                                      3D ENT Anatomy Viewer <span className="text-gray-400 text-xs">(Optional)</span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const url = `/doctor-dashboard/anatomy?appointmentId=${appointment.id}&patientName=${encodeURIComponent(appointment.patientName || 'Patient')}`
                                        window.location.href = url
                                      }}
                                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition-all flex items-center gap-1"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      Open 3D Model
                                    </button>
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
                                    rows={2}
                                    placeholder="Enter observations, diagnosis, recommendations..."
                                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs resize-none"
                                  />
                                </div>

                                <div className="pt-1">
                                  <div className="flex items-center gap-2 mb-2">
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
                                            recheckupNote: prev[appointment.id]?.recheckupNote || "",
                                          },
                                        }))
                                      }
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                    />
                                    <label htmlFor={`recheckupRequired-${appointment.id}`} className="text-xs font-medium text-gray-700 cursor-pointer">
                                      🔄 Re-checkup Required
                                    </label>
                                  </div>
                                  {completionData[appointment.id]?.recheckupRequired && (
                                    <div className="mt-2">
                                      <label htmlFor={`recheckupNote-${appointment.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                                        Re-checkup Note (Optional)
                                      </label>
                                      <textarea
                                        id={`recheckupNote-${appointment.id}`}
                                        value={completionData[appointment.id]?.recheckupNote || ""}
                                        onChange={(e) =>
                                          setCompletionData((prev) => ({
                                            ...prev,
                                            [appointment.id]: {
                                              ...prev[appointment.id],
                                              recheckupNote: e.target.value,
                                              medicines: prev[appointment.id]?.medicines || [],
                                              notes: prev[appointment.id]?.notes || "",
                                              recheckupRequired: prev[appointment.id]?.recheckupRequired || false,
                                            },
                                          }))
                                        }
                                        rows={2}
                                        placeholder="Enter note for re-checkup (e.g., 'Follow-up required in 2 weeks', 'Monitor blood pressure')"
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs resize-none"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Document Upload Section */}
                                <div className="border-t border-slate-200 pt-3 mt-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-medium text-gray-700">
                                      Documents & Reports <span className="text-gray-400 text-xs">(Optional)</span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => setShowDocumentUpload(prev => ({ ...prev, [appointment.id]: !prev[appointment.id] }))}
                                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-all flex items-center gap-1"
                                    >
                                      {showDocumentUpload[appointment.id] ? (
                                        <>
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                          Hide
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                          </svg>
                                          Add Documents
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  {showDocumentUpload[appointment.id] && (
                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                      <DocumentUpload
                                        patientId={appointment.patientId}
                                        // Fallback to patientId if patientUid is missing (legacy/WhatsApp appointments)
                                        patientUid={appointment.patientUid || appointment.patientId || ""}
                                        appointmentId={appointment.id}
                                        specialty={appointment.doctorSpecialization}
                                        onUploadSuccess={(document: DocumentMetadata) => {
                                          setNotification({
                                            type: "success",
                                            message: `Document "${document.originalFileName}" uploaded successfully!`
                                          })
                                          setTimeout(() => setNotification(null), 3000)
                                        }}
                                        onUploadError={(error: string) => {
                                          setNotification({
                                            type: "error",
                                            message: error
                                          })
                                          setTimeout(() => setNotification(null), 5000)
                                        }}
                                        allowBulk={true}
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <button
                                    type="submit"
                                    disabled={
                                      updating[appointment.id] ||
                                      !hasValidPrescriptionInput(completionData[appointment.id])
                                    }
                                    className="btn-modern btn-modern-success btn-modern-sm flex-1"
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
                              )}
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
      {/* Generate Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-gradient-to-r from-green-50 to-blue-50 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Generate Patient Report</h3>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-6 space-y-6">
              {notification && notification.type === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {notification.message}
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Date Range</label>
                <select
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="daily">Daily (Today)</option>
                  <option value="weekly">Weekly (Last 7 days)</option>
                  <option value="monthly">Monthly (Current month)</option>
                  <option value="yearly">Yearly (Current year)</option>
                  <option value="custom">Custom Range</option>
                  <option value="all">All Patients</option>
                </select>
              </div>
              {reportFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Report Format</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="pdf"
                      checked={reportFormat === 'pdf'}
                      onChange={(e) => setReportFormat(e.target.value as 'pdf')}
                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-700">PDF</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="excel"
                      checked={reportFormat === 'excel'}
                      onChange={(e) => setReportFormat(e.target.value as 'excel')}
                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-700">Excel (.xlsx)</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowReportModal(false)}
                  disabled={generatingReport}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {generatingReport ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Generate Report
                    </>
                  )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Consultation Mode Selection Modal */}
      {showConsultationModeModal.open && (() => {
        const appointmentId = showConsultationModeModal.appointmentId
        const alreadySelected = appointmentId ? (selectedAnatomyTypes[appointmentId] || []) : []
        const allAvailableModels = getAvailableAnatomyModels(userData?.specialization)
        // Filter out already selected anatomy types when adding another
        const availableModels = allAvailableModels.filter(model => !alreadySelected.includes(model.type))
        const modelColors: Record<string, { from: string; to: string; border: string; hoverBorder: string; bg: string }> = {
          ear: { from: 'from-purple-50', to: 'to-pink-50', border: 'border-purple-200', hoverBorder: 'border-purple-400', bg: 'bg-purple-600' },
          throat: { from: 'from-red-50', to: 'to-rose-50', border: 'border-red-200', hoverBorder: 'border-red-400', bg: 'bg-red-600' },
          dental: { from: 'from-teal-50', to: 'to-cyan-50', border: 'border-teal-200', hoverBorder: 'border-teal-400', bg: 'bg-teal-600' }
        }
        const modelIcons: Record<string, React.ReactElement> = {
          ear: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          ),
          throat: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          dental: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          )
        }
        
        return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-slate-800">Select Consultation Mode</h3>
              <button
                onClick={() => setShowConsultationModeModal({ open: false, appointmentId: null })}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-slate-600 mb-6">Choose how you would like to complete the consultation:</p>

              <div className={`grid gap-3 ${availableModels.length === 0 ? 'grid-cols-1' : availableModels.length === 1 ? 'grid-cols-2' : availableModels.length === 2 ? 'grid-cols-3' : 'grid-cols-3'}`}>
                {/* Normal Mode - Always available */}
              <button
                onClick={() => handleConsultationModeSelect('normal')}
                className="p-4 bg-gradient-to-b from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all text-center group flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="font-bold text-sm text-slate-800 mb-1">Normal</h4>
                <p className="text-xs text-slate-600">Standard form</p>
              </button>

                {/* Show only available anatomy models based on specialization */}
                {availableModels.map((model) => {
                  const colors = modelColors[model.type]
                  return (
              <button
                      key={model.type}
                      onClick={() => handleConsultationModeSelect('anatomy', model.type)}
                      className={`p-4 bg-gradient-to-b ${colors.from} ${colors.to} border-2 ${colors.border} rounded-lg hover:${colors.hoverBorder} hover:shadow-md transition-all text-center group flex flex-col items-center justify-center`}
              >
                      <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center text-white group-hover:scale-110 transition-transform mb-3`}>
                        {modelIcons[model.type]}
                </div>
                      <h4 className="font-bold text-sm text-slate-800 mb-1">{model.label}</h4>
                <p className="text-xs text-slate-600">3D/2D Model</p>
              </button>
                  )
                })}
                </div>

              {/* Show message if no anatomy models available */}
              {availableModels.length === 0 && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    {alreadySelected.length > 0 ? (
                      <>
                        <strong>Note:</strong> All available anatomy models for your specialization have already been added. Please use the Normal mode or remove an existing anatomy model to add a different one.
                      </>
                    ) : (
                      <>
                        <strong>Note:</strong> No anatomy models are available for your specialization ({userData?.specialization || 'Unknown'}). Please use the Normal mode.
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
        </div>
        )
      })()}

      {/* Document Viewer Modal for History Documents */}
      {selectedHistoryDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[92vh] flex flex-col overflow-y-auto">
            <DocumentViewer
              document={selectedHistoryDocument}
              onClose={() => setSelectedHistoryDocument(null)}
              canEdit={false}
              canDelete={false}
            />
          </div>
        </div>
      )}

    </div>
  )
}

export default function DoctorAppointments() {
  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-slate-600">Loading...</div>
    </div>
    }>
      <DoctorAppointmentsContent />
    </Suspense>
  )
}

