 "use client"

import { useCallback, useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { auth } from "@/firebase/config"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { TabSkeleton } from '@/shared/components'
import { Notification } from '@/shared/components'
import { generatePrescriptionPDF } from "@/utils/documents/pdfGenerators"
import { completeAppointment } from "@/utils/appointmentHelpers"
import { calculateAge } from "@/utils/shared/date"
import { Appointment as AppointmentType } from "@/types/patient"
import axios from "axios"
import { Pagination } from '@/shared/components'
import { fetchMedicineSuggestions, MedicineSuggestion, recordMedicineSuggestions } from "@/utils/medicineSuggestions"
import AppointmentDocuments from "@/features/documents/AppointmentDocuments"
import PatientConsentVideo from "@/features/consent/PatientConsentVideo"
import type { AnatomyViewerData } from "@/features/doctor/anatomy/InlineAnatomyViewer"
import { getAvailableAnatomyModels } from "@/utils/anatomyModelMapping"
import { ClipboardList, Ear, ScanFace, Mic, HeartPulse, Stethoscope, Bone, ChevronLeft } from "lucide-react"
import { DocumentMetadata } from "@/types/document"
import { parsePrescription as parsePrescriptionUtil } from "@/utils/appointments/prescriptionParsers"
import { formatMedicinesAsText as formatMedicinesAsTextUtil } from "@/utils/appointments/prescriptionFormatters"
import { TabKey, CompletionFormEntry, hasValidPrescriptionInput, QueueView } from "@/types/appointments"
import ConsultationModeModal from "@/features/doctor/appointments/modals/ConsultationModeModal"
import CompletionForm from "@/features/doctor/appointments/forms/CompletionForm"
import { AdmitDialog } from "@/features/doctor/appointments/modals/AdmitDialog"
import { ReportModal } from "@/features/doctor/appointments/modals/ReportModal"
import { HistoryDocumentViewer } from "@/features/doctor/appointments/ui/HistoryDocumentViewer"
import PageHeader from "@/features/doctor/appointments/ui/PageHeader"
import DoctorQueuePulse from "@/features/doctor/appointments/ui/DoctorQueuePulse"
import NextPatientBanner from "@/features/doctor/appointments/ui/NextPatientBanner"
import AppointmentScheduleRail from "@/features/doctor/appointments/ui/AppointmentScheduleRail"
import FilterBar from "@/features/doctor/appointments/ui/FilterBar"
import EmptyState from "@/features/doctor/appointments/ui/EmptyState"
import HistorySearch from "@/features/doctor/appointments/ui/HistorySearch"
import AppointmentsListPane from "@/features/doctor/appointments/ui/AppointmentsListPane"
import { useDoctorAppointments } from "@/hooks/useDoctorAppointments"
import { useDoctorBranches } from "@/hooks/useDoctorBranches"
import { usePatientHistory } from "@/hooks/usePatientHistory"
import { buildMorningClinicSnapshot } from "@/features/doctor/dashboard/morningClinicUtils"
import { useAppointmentFilters } from "@/hooks/useAppointmentFilters"
import {
  ClinicalPageFrame,
  ConsultationLayout,
  ReportViewer,
  PatientClinicalWorkspace,
} from "@/features/doctor/clinical"
import ConsultationActionBar from "@/features/doctor/clinical/consultation/ConsultationActionBar"
import ConsultationStickyPatientBar from "@/features/doctor/clinical/consultation/ConsultationStickyPatientBar"
import ConsultationAnatomyView from "@/features/doctor/clinical/consultation/ConsultationAnatomyView"
import { syncAnatomySelectionToCompletion } from "@/features/doctor/clinical/consultation/anatomySyncUtils"
import {
  buildSubmissionNotes,
  hasClinicalDocumentation,
} from "@/features/doctor/clinical/consultation/consultationNotesUtils"
import {
  clearConsultationDraft,
  loadConsultationDraft,
  saveConsultationDraft,
} from "@/features/doctor/clinical/consultation/consultationDraftStorage"
import type { AnatomyType } from "@/utils/anatomyModelMapping"

function DoctorAppointmentsContent() {
  const searchParams = useSearchParams()
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("today")
  const [queueView, setQueueView] = useState<QueueView>("all")
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [updating, setUpdating] = useState<{ [key: string]: boolean }>({})
  const [showCompletionForm, setShowCompletionForm] = useState<{ [key: string]: boolean }>({})
  const [consultationMode, setConsultationMode] = useState<{ [key: string]: "normal" | "anatomy" | null }>({})
  const [selectedAnatomyTypes, setSelectedAnatomyTypes] = useState<{ [key: string]: ("ear" | "nose" | "throat" | "dental" | "lungs" | "kidney" | "skeleton" | "lymph_nodes" | "female_reproductive")[] }>({})
  const [activeAnatomyTab, setActiveAnatomyTab] = useState<{ [key: string]: "ear" | "nose" | "throat" | "dental" | "lungs" | "kidney" | "skeleton" | "lymph_nodes" | "female_reproductive" }>({})
  const [anatomyViewerData, setAnatomyViewerData] = useState<{ [key: string]: { [anatomyType: string]: AnatomyViewerData | null } }>({})
  const appointmentCardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const appointmentDetailsRef = useRef<HTMLDivElement | null>(null)
  const completionFormRef = useRef<HTMLDivElement | null>(null)
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [completionData, setCompletionData] = useState<Record<string, CompletionFormEntry>>({})
  const [aiPrescription, setAiPrescription] = useState<{ [key: string]: { medicine: string; notes: string } }>({})
  const [loadingAiPrescription, setLoadingAiPrescription] = useState<{ [key: string]: boolean }>({})
  const [showAiPrescriptionSuggestion, setShowAiPrescriptionSuggestion] = useState<{ [key: string]: boolean }>({})
  const [removedAiMedicines, setRemovedAiMedicines] = useState<{ [appointmentId: string]: number[] }>({})
  const [historyTabFilters, setHistoryTabFilters] = useState<{ text: string; date: string }>({ text: "", date: "" })
  const [aiDiagnosis, setAiDiagnosis] = useState<{ [key: string]: string }>({})
  const [loadingAiDiagnosis, setLoadingAiDiagnosis] = useState<{ [key: string]: boolean }>({})
  const [showAiDiagnosisSuggestion, setShowAiDiagnosisSuggestion] = useState<{ [key: string]: boolean }>({})
  const [showHistory, setShowHistory] = useState<{ [key: string]: boolean }>({})
  const [showDocumentUpload, setShowDocumentUpload] = useState<{ [key: string]: boolean }>({})
  const [selectedHistoryDocument, setSelectedHistoryDocument] = useState<DocumentMetadata | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [admitting, setAdmitting] = useState<{ [key: string]: boolean }>({})
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportFilter, setReportFilter] = useState<"daily" | "weekly" | "monthly" | "yearly" | "custom" | "all">("all")
  const [reportFormat, setReportFormat] = useState<"pdf" | "excel">("pdf")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
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
  const [documentsModal, setDocumentsModal] = useState<{
    open: boolean
    appointment: AppointmentType | null
  }>({
    open: false,
    appointment: null,
  })
  const [consentModal, setConsentModal] = useState<{
    open: boolean
    appointment: AppointmentType | null
  }>({
    open: false,
    appointment: null,
  })
  const [medicineSuggestions, setMedicineSuggestions] = useState<MedicineSuggestion[]>([])
  const [showConsultationModeModal, setShowConsultationModeModal] = useState<{
    open: boolean
    appointmentId: string | null
  }>({
    open: false,
    appointmentId: null,
  })
  const [medicineSuggestionsLoading, setMedicineSuggestionsLoading] = useState(false)
  const [lastVisitModal, setLastVisitModal] = useState<{
    open: boolean
    appointment: AppointmentType | null
    recommendation: {
      finalDiagnosis: string[]
      medicine?: string | null
      notes?: string | null
      date?: string
    } | null
  }>({
    open: false,
    appointment: null,
    recommendation: null,
  })
  const [skippingId, setSkippingId] = useState<string | null>(null)
  const [skipConfirmAppointment, setSkipConfirmAppointment] = useState<{ id: string; patientName: string } | null>(null)

  const refreshMedicineSuggestions = useCallback(async () => {
    try {
      setMedicineSuggestionsLoading(true)
      const suggestions = await fetchMedicineSuggestions(100)
      setMedicineSuggestions(suggestions)
    } catch {
    } finally {
      setMedicineSuggestionsLoading(false)
    }
  }, [])

  const handleDownloadVisitPdf = (appointment: AppointmentType) => {
    try {
      generatePrescriptionPDF(appointment)
      setNotification({
        type: "success",
        message: "Prescription PDF downloaded successfully.",
      })
    } catch (error) {
      console.error("Failed to generate prescription PDF:", error)
      setNotification({
        type: "error",
        message: "Failed to generate prescription PDF. Please try again.",
      })
    }
  }

  useEffect(() => {
    refreshMedicineSuggestions()
  }, [refreshMedicineSuggestions])

  const { user, loading } = useAuth("doctor")
  const { activeHospitalId } = useMultiHospital()
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  
  // Use custom hooks for data fetching
  const { appointments, userData, setAppointments } = useDoctorAppointments(user, activeHospitalId, selectedBranchId)
  const { branches, loadingBranches } = useDoctorBranches(activeHospitalId)
  const {
    patientHistory,
    historyDocuments,
    historySearchFilters,
    fetchPatientHistory,
    fetchHistoryDocuments,
  } = usePatientHistory()

  useEffect(() => {
    const expandAppointmentId = sessionStorage.getItem("expandAppointmentId")
    if (expandAppointmentId) {
      sessionStorage.removeItem("expandAppointmentId")
      setActiveTab("today")
      setTimeout(() => {
        setExpandedAppointment(expandAppointmentId)
        const element = document.getElementById(`appointment-${expandAppointmentId}`)
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }, 500)
    }
  }, [appointments])

  useEffect(() => {
    const appointmentIdFromQuery = searchParams.get("appointmentId")
    if (appointmentIdFromQuery && appointments.length > 0) {
      const anatomyDataKey = `anatomyCheckup_${appointmentIdFromQuery}`
      const storedAnatomyData = sessionStorage.getItem(anatomyDataKey)

      if (storedAnatomyData) {
        const appointment = appointments.find((apt) => apt.id === appointmentIdFromQuery)
        if (appointment && appointment.status === "confirmed") {
          setActiveTab("today")

          setTimeout(() => {
            toggleCompletionForm(appointmentIdFromQuery)
            const element = document.getElementById(`appointment-${appointmentIdFromQuery}`)
            if (element) {
              element.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          }, 500)
        }
      }
    }
     
  }, [searchParams, appointments])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      setNotification({
        type: "success",
        message: "Appointments are automatically updated in real-time!",
      })
    } catch {
      setNotification({ type: "error", message: "Failed to refresh appointments" })
    } finally {
      setRefreshing(false)
    }
  }

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true)
      setNotification(null)

      if (reportFilter === "custom") {
        if (!customStartDate || !customEndDate) {
          setNotification({
            type: "error",
            message: "Please select both start and end dates for custom range",
          })
          setGeneratingReport(false)
          return
        }
        if (new Date(customStartDate) > new Date(customEndDate)) {
          setNotification({
            type: "error",
            message: "Start date must be before end date",
          })
          setGeneratingReport(false)
          return
        }
      }

      const params = new URLSearchParams({
        filter: reportFilter,
        format: reportFormat,
      })

      if (reportFilter === "custom") {
        params.append("startDate", customStartDate)
        params.append("endDate", customEndDate)
      }

      const currentUser = auth.currentUser
      if (!currentUser) {
        setNotification({ type: "error", message: "You must be logged in to generate reports" })
        setGeneratingReport(false)
        return
      }

      const token = await currentUser.getIdToken()

      const response = await fetch(`/api/admin/patient-reports?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to generate report")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `patient_report_${reportFilter}_${new Date()
        .toISOString()
        .split("T")[0]}.${reportFormat === "pdf" ? "pdf" : "xlsx"}`
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

      setShowReportModal(false)
      setNotification({
        type: "success",
        message: "Report generated and downloaded successfully!",
      })
    } catch (error) {
      setNotification({
        type: "error",
        message: (error as Error).message || "Failed to generate report",
      })
    } finally {
      setGeneratingReport(false)
    }
  }

  const closePatientWorkspace = () => {
    setExpandedAppointment(null)
    setShowHistory({})
  }

  const toggleAccordion = async (appointmentId: string) => {
    if (expandedAppointment === appointmentId) {
      closePatientWorkspace()
    } else {
      setExpandedAppointment(appointmentId)
      
      // Auto-scroll to appointment details after a short delay to allow DOM update
      setTimeout(() => {
        if (appointmentDetailsRef.current) {
          appointmentDetailsRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest",
          })
        }
      }, 100)

      const appointment = appointments.find((apt) => apt.id === appointmentId)
      if (appointment && appointment.patientId && activeHospitalId) {
        const history = await fetchPatientHistory(appointment, appointmentId, activeHospitalId)
        if (history && history.length > 0 && user) {
          fetchHistoryDocuments(
            history.map((h) => h.id),
            appointment.patientUid || appointment.patientId
          )
        }
      }
    }
  }

  const getLatestCheckupRecommendation = (appointment: AppointmentType) => {
    const samePatientDoctorAppointments = appointments.filter(
      (other) =>
        other.id !== appointment.id &&
        other.doctorId === appointment.doctorId &&
        other.patientId === appointment.patientId &&
        other.status === "completed" &&
        (other.medicine || other.doctorNotes)
    )

    if (samePatientDoctorAppointments.length === 0) {
      return null
    }

    const latest = samePatientDoctorAppointments.sort((a, b) => {
      const aDate = new Date(`${a.appointmentDate}T${a.appointmentTime || "00:00"}`)
      const bDate = new Date(`${b.appointmentDate}T${b.appointmentTime || "00:00"}`)
      return bDate.getTime() - aDate.getTime()
    })[0]

    const latestAny: any = latest

    return {
      appointmentId: latest.id,
      doctorName:
        latest.doctorName ||
        userData?.name ||
        (userData?.firstName ? `Dr. ${userData.firstName}` : "Doctor"),
      date: new Date(latest.appointmentDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      medicine: latest.medicine || undefined,
      notes: latest.doctorNotes || undefined,
      finalDiagnosis: Array.isArray(latestAny.finalDiagnosis) ? latestAny.finalDiagnosis : [],
      customDiagnosis: latestAny.customDiagnosis || "",
    }
  }

  const handleConsultationModeSelect = (
    mode: "normal" | "anatomy",
    anatomyType?: "ear" | "nose" | "throat" | "dental" | "lungs" | "kidney" | "skeleton" | "lymph_nodes" | "female_reproductive"
  ) => {
    const appointmentId = showConsultationModeModal.appointmentId
    if (!appointmentId) return

    setShowConsultationModeModal({ open: false, appointmentId: null })

    setConsultationMode((prev) => ({
      ...prev,
      [appointmentId]: mode === "anatomy" ? "anatomy" : "normal",
    }))

    if (mode === "anatomy" && anatomyType) {
      setActiveAnatomyTab((prev) => ({ ...prev, [appointmentId]: anatomyType }))
      setSelectedAnatomyTypes((prev) => {
        const current = prev[appointmentId] || []
        if (!current.includes(anatomyType)) {
          return {
            ...prev,
            [appointmentId]: [...current, anatomyType],
          }
        }
        return prev
      })
    }

    setShowCompletionForm((prev) => ({
      ...prev,
      [appointmentId]: true,
    }))

    // Auto-scroll to completion form after a short delay
    setTimeout(() => {
      if (completionFormRef.current) {
        completionFormRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        })
      }
    }, 300)
  }

  const handleAddAnotherAnatomy = (appointmentId: string) => {
    setShowConsultationModeModal({ open: true, appointmentId })
  }

  const openNormalConsultation = (appointmentId: string) => {
    setConsultationMode((prev) => ({ ...prev, [appointmentId]: "normal" }))
    setShowCompletionForm((prev) => ({ ...prev, [appointmentId]: true }))
    setTimeout(() => {
      completionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" })
    }, 200)
  }

  const openAnatomyFromQuickCard = (
    appointmentId: string,
    anatomyType: "ear" | "nose" | "throat" | "dental" | "lungs" | "kidney" | "skeleton" | "lymph_nodes" | "female_reproductive"
  ) => {
    setConsultationMode((prev) => ({ ...prev, [appointmentId]: "anatomy" }))
    setSelectedAnatomyTypes((prev) => {
      const current = prev[appointmentId] || []
      if (current.includes(anatomyType)) return prev
      return { ...prev, [appointmentId]: [...current, anatomyType] }
    })
    setActiveAnatomyTab((prev) => ({ ...prev, [appointmentId]: anatomyType }))
    setShowCompletionForm((prev) => ({ ...prev, [appointmentId]: true }))
  }

  const handleAnatomyDataChange = (
    appointmentId: string,
    tab: AnatomyType,
    data: AnatomyViewerData | null
  ) => {
    setAnatomyViewerData((prev) => ({
      ...prev,
      [appointmentId]: {
        ...(prev[appointmentId] || {}),
        [tab]: data,
      },
    }))

    if (!data) return

    setCompletionData((prev) => {
      const current =
        prev[appointmentId] || {
          medicines: [],
          notes: "",
          recheckupRequired: false,
          finalDiagnosis: [],
          customDiagnosis: "",
        }
      return {
        ...prev,
        [appointmentId]: syncAnatomySelectionToCompletion(current, data),
      }
    })
  }

  const handleSkip = useCallback(
    async (appointmentId: string) => {
      if (!activeHospitalId) {
        setNotification({ type: "error", message: "Hospital not selected" })
        return
      }
      setSkipConfirmAppointment(null)
      setSkippingId(appointmentId)
      setNotification(null)
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {
          throw new Error("You must be logged in to skip appointments")
        }
        const token = await currentUser.getIdToken()
        const response = await fetch("/api/doctor/skip-appointment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            appointmentId,
            hospitalId: activeHospitalId,
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to skip appointment")
        }

        setAppointments((prev) =>
          prev.map((apt) =>
            apt.id === appointmentId ? { ...apt, status: "no_show" as const } : apt
          )
        )

        const whatsappNote = data.whatsappSent
          ? " Missed-appointment WhatsApp sent."
          : data.whatsappError
            ? ` WhatsApp not sent: ${data.whatsappError}`
            : " No patient phone — WhatsApp not sent."

        setNotification({
          type: data.whatsappSent ? "success" : "error",
          message: `Appointment skipped.${whatsappNote}`,
        })
      } catch (e) {
        setNotification({ type: "error", message: (e as Error).message })
      } finally {
        setSkippingId(null)
      }
    },
    [activeHospitalId, setAppointments]
  )

  const openSkipConfirm = useCallback((appointmentId: string) => {
    const apt = appointments.find((a) => a.id === appointmentId)
    if (apt) setSkipConfirmAppointment({ id: apt.id, patientName: apt.patientName || "Patient" })
  }, [appointments])

  useEffect(() => {
    if (!skipConfirmAppointment) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSkipConfirmAppointment(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [skipConfirmAppointment])

  const toggleCompletionForm = (appointmentId: string) => {
    const appointment = appointments.find((apt) => apt.id === appointmentId)
    if (!appointment) return

    const isOpen = showCompletionForm[appointmentId] || false
    setShowCompletionForm({ ...showCompletionForm, [appointmentId]: !isOpen })

    if (!isOpen) {
      // Auto-scroll to completion form when opening
      setTimeout(() => {
        if (completionFormRef.current) {
          completionFormRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
            inline: "nearest",
          })
        }
      }, 300)
      
      const anatomyDataKey = `anatomyCheckup_${appointmentId}`
      const storedAnatomyData = sessionStorage.getItem(anatomyDataKey)

      let initialMedicines: Array<{
        name: string
        dosage: string
        frequency: string
        duration: string
      }> = []
      let initialNotes = ""

      if (storedAnatomyData) {
        try {
          const anatomyData = JSON.parse(storedAnatomyData)
          initialMedicines = anatomyData.medicines || []

          const notesParts = []
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
            notesParts.push(`Prescriptions: ${anatomyData.prescriptions.join(", ")}`)
          }
          if (anatomyData.notes) {
            notesParts.push(`Doctor Notes: ${anatomyData.notes}`)
          }
          initialNotes = notesParts.join("\n")

          sessionStorage.removeItem(anatomyDataKey)
        } catch {}
      }

      setCompletionData((prev) => ({
        ...prev,
        [appointmentId]: {
          medicines: initialMedicines.length > 0 ? initialMedicines : [],
          notes: initialNotes,
          recheckupRequired: false,
          recheckupDays: 7,
          finalDiagnosis: [],
          customDiagnosis: "",
        },
      }))
      setShowAiPrescriptionSuggestion((prev) => ({ ...prev, [appointmentId]: true }))
      setRemovedAiMedicines((prev) => {
        const updated = { ...prev }
        delete updated[appointmentId]
        return updated
      })
    } else {
      setCompletionData((prev) => {
        const updated = { ...prev }
        delete updated[appointmentId]
        return updated
      })

      const newAiPrescription = { ...aiPrescription }
      delete newAiPrescription[appointmentId]
      setAiPrescription(newAiPrescription)

      setRemovedAiMedicines((prev) => {
        const updated = { ...prev }
        delete updated[appointmentId]
        return updated
      })
    }
  }

  const formatMedicinesAsText = formatMedicinesAsTextUtil

  const getAIDiagnosisSuggestion = useCallback(async (appointment: AppointmentType) => {
    if (!appointment.chiefComplaint?.trim()) {
      setNotification({
        type: "error",
        message: "Chief complaint is required before generating a clinical data suggestion.",
      })
      return
    }

    setLoadingAiDiagnosis((prev) => ({ ...prev, [appointment.id]: true }))
    setShowAiDiagnosisSuggestion((prev) => ({ ...prev, [appointment.id]: true }))

    try {
      const ageValue = calculateAge(appointment.patientDateOfBirth)
      const age = ageValue !== null ? `${ageValue}` : "Unknown"
      let patientInfo = `Age: ${age}, Gender: ${
        appointment.patientGender || "Unknown"
      }, Blood Group: ${
        appointment.patientBloodGroup || "Unknown"
      }, Drinking Habits: ${
        appointment.patientDrinkingHabits || "None"
      }, Smoking Habits: ${
        appointment.patientSmokingHabits || "None"
      }, Diet: ${appointment.patientVegetarian || "Unknown"}`

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
        const preg = /yes/i.test(appointment.patientPregnancyStatus)
          ? "Yes"
          : /no/i.test(appointment.patientPregnancyStatus)
          ? "No"
          : appointment.patientPregnancyStatus
        patientInfo += `, Pregnancy Status: ${preg}`
      }

      if (appointment.patientAllergies) {
        patientInfo += `, ALLERGIES: ${appointment.patientAllergies} (DO NOT prescribe these)`
      }

      if (appointment.patientCurrentMedications) {
        patientInfo += `, Current Medications: ${appointment.patientCurrentMedications}`
      }

      const symptoms = appointment.chiefComplaint
      const medicalHistory = appointment.medicalHistory || ""

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to generate a clinical suggestion")
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

      const diagnosisText = data?.[0]?.generated_text || "Unable to generate diagnosis"

      setAiDiagnosis((prev) => ({ ...prev, [appointment.id]: diagnosisText }))

      setNotification({ type: "success", message: "Clinical data suggestion is ready." })
    } catch (error: unknown) {
      const errorResponse = (error as { response?: { data?: unknown; status?: number } }).response

      let errorMessage = "Failed to generate clinical data suggestion"

      if (errorResponse?.data) {
        if (typeof errorResponse.data === "object") {
          const data = errorResponse.data as { error?: string; details?: any }
          errorMessage = data.error || errorMessage
        } else if (typeof errorResponse.data === "string") {
          errorMessage = errorResponse.data
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      if (errorResponse?.status === 403) {
        if (errorMessage.includes("pending approval") || errorMessage.includes("pending")) {
          errorMessage =
            "Your doctor account is pending approval. Please contact the administrator to approve your account."
        } else if (errorMessage.includes("Access denied")) {
          errorMessage =
            "Access denied. You need an active doctor account to use this feature. Please contact the administrator if you believe this is an error."
        } else if (errorMessage.includes("doesn't have") || errorMessage.includes("not found")) {
          errorMessage =
            "Doctor account not found. Please contact the administrator to verify your account setup."
        } else {
          errorMessage = `Access denied: ${
            errorMessage || "Please ensure your doctor account is active and approved."
          }`
        }
      }

      setNotification({
        type: "error",
        message: errorMessage,
      })
    } finally {
      setLoadingAiDiagnosis((prev) => ({ ...prev, [appointment.id]: false }))
    }
  }, [])

  const handleDeclineAiDiagnosis = (appointmentId: string) => {
    setShowAiDiagnosisSuggestion((prev) => ({ ...prev, [appointmentId]: false }))
  }

  const handleGenerateAiPrescription = useCallback(async (appointmentId: string, _showNotification: boolean = true) => {
    if (!appointmentId) return

    const appointment = appointments.find((apt) => apt.id === appointmentId)
    if (!appointment) return

    setLoadingAiPrescription((prev) => ({ ...prev, [appointmentId]: true }))
    try {
      const ageValue = calculateAge(appointment.patientDateOfBirth)
      let patientInfo = `Age: ${ageValue}, Gender: ${
        appointment.patientGender || "Unknown"
      }, Blood Group: ${appointment.patientBloodGroup || "Unknown"}`

      if (appointment.patientHeightCm != null) {
        patientInfo += `, Height: ${appointment.patientHeightCm} cm`
      }
      if (appointment.patientWeightKg != null) {
        patientInfo += `, Weight: ${appointment.patientWeightKg} kg`
      }

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to generate a prescription")
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

      setAiPrescription((prev) => ({
        ...prev,
        [appointmentId]: {
          medicine: data.medicine || "",
          notes: data.notes || "",
        },
      }))
      setShowAiPrescriptionSuggestion((prev) => ({ ...prev, [appointmentId]: true }))
    } catch (error: unknown) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        (error as Error).message ||
        "Failed to generate prescription"
      setNotification({
        type: "error",
        message: errorMessage,
      })
    } finally {
      setLoadingAiPrescription((prev) => ({ ...prev, [appointmentId]: false }))
    }
  }, [appointments, aiPrescription])

  const handleDeclinePrescription = (appointmentId: string) => {
    setShowAiPrescriptionSuggestion({
      ...showAiPrescriptionSuggestion,
      [appointmentId]: false,
    })
  }

  const handleCopyPreviousPrescription = (appointmentId: string) => {
    const appointment = appointments.find((apt) => apt.id === appointmentId)
    if (!appointment) return

    const sameDoctorHistory = patientHistory.filter(
      (historyItem: AppointmentType) =>
        historyItem.doctorId === appointment.doctorId &&
        historyItem.id !== appointment.id &&
        historyItem.medicine
    )

    if (sameDoctorHistory.length > 0) {
      const latest = sameDoctorHistory[0]
      if (latest.medicine) {
        const parsed = parsePrescriptionUtil(latest.medicine)
        if (parsed && parsed.medicines.length > 0) {
          const structuredMedicines = parsed.medicines.map((med) => ({
            name: med.name || "",
            dosage: med.dosage || "",
            frequency: med.frequency || "",
            duration: med.duration || "",
          }))

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
            message: "Previous prescription copied! You can edit it as needed.",
          })
        } else {
          setNotification({
            type: "error",
            message: "Could not parse previous prescription",
          })
        }
      }
    } else {
      setNotification({
        type: "error",
        message: "No previous prescription found for this patient",
      })
    }
  }

  const runCompletionFlow = async (
    appointmentId: string,
    formData: CompletionFormEntry,
    options?: { showToast?: boolean }
  ) => {
    if (!activeHospitalId) {
      setNotification({
        type: "error",
        message: "Hospital context is not available. Please refresh the page.",
      })
      return
    }

    if (!hasClinicalDocumentation(formData)) {
      setNotification({
        type: "error",
        message: "Please enter clinical notes or diagnosis before completing the consultation.",
      })
      return
    }

    const submissionNotes = buildSubmissionNotes(formData)
    const appointmentSnapshot = appointments.find((apt) => apt.id === appointmentId)
    const medicineText = formatMedicinesAsText(formData.medicines, submissionNotes)

    const result = await completeAppointment(
      appointmentId,
      medicineText,
      submissionNotes,
      activeHospitalId,
      [], // diagnosis removed — using doctor's notes only
      "",
      user?.uid,
      "doctor"
    )

    setAppointments((prevAppointments) =>
      prevAppointments.map((apt) =>
        apt.id === appointmentId ? { ...apt, ...result.updates } : apt
      )
    )

    if (appointmentSnapshot) {
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {
        } else {
          const token = await currentUser.getIdToken()

          if (!activeHospitalId) {
          }

          const completionResponse = await fetch(
            "/api/doctor/send-completion-whatsapp",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                appointmentId,
                patientId: appointmentSnapshot.patientId,
                patientPhone: appointmentSnapshot.patientPhone,
                patientName: appointmentSnapshot.patientName,
                hospitalId: activeHospitalId,
              }),
            }
          )

          const responseData = await completionResponse
            .json()
            .catch(() => ({}))

          if (!completionResponse.ok) {
          } else {
            if (options?.showToast !== false) {
              setNotification({
                type: "success",
                message:
                  responseData.message ||
                  "Checkup completed and thank you message sent!",
              })
            }
          }
        }
      } catch {
      }
    } else {
    }

    if (formData.recheckupRequired && appointmentSnapshot) {
      // Auto-book recheckup appointment (after N days, skip Sunday)
      const recheckupDays = formData.recheckupDays ?? 7
      const start = new Date()
      const d = new Date(start)
      d.setDate(d.getDate() + recheckupDays)
      while (d.getDay() === 0) d.setDate(d.getDate() + 1)
      const recheckupDateStr = d.toISOString().slice(0, 10)
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
        if (token && appointmentSnapshot) {
          const res = await fetch("/api/doctor/create-appointment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              appointmentData: {
                patientId: appointmentSnapshot.patientId,
                patientName: appointmentSnapshot.patientName || "Patient",
                patientEmail: (appointmentSnapshot as any).patientEmail || "",
                patientPhone: appointmentSnapshot.patientPhone || "",
                appointmentDate: recheckupDateStr,
                appointmentTime: appointmentSnapshot.appointmentTime || "10:00",
                chiefComplaint: "Re-checkup" + (formData.recheckupNote ? ` — ${formData.recheckupNote}` : ""),
                medicalHistory: "",
                status: "confirmed",
                paymentAmount: 0,
                paymentMethod: "cash",
                paymentType: "full",
                branchId: (appointmentSnapshot as any).branchId ?? null,
                branchName: (appointmentSnapshot as any).branchName ?? null,
              },
              isRecheck: true,
            }),
          })
          if (res.ok) {
            // Realtime listener will add the new appointment to the list
          }
        }
      } catch {
        // Recheckup auto-book failed; user can book manually
      }
    }

    if (options?.showToast !== false) {
      setNotification({
        type: "success",
        message:
          result.message +
          (formData.recheckupRequired
            ? " Re-checkup appointment booked."
            : ""),
      })
    }

    try {
      await recordMedicineSuggestions(formData.medicines)
      await refreshMedicineSuggestions()
    } catch {}

    setCompletionData((prev) => {
      const updated = { ...prev }
      delete updated[appointmentId]
      return updated
    })
    clearConsultationDraft(appointmentId)

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

  const handleCompleteAppointment = async (
    e: React.FormEvent,
    appointmentId: string
  ) => {
    e.preventDefault()

    if (!appointmentId) return

    const currentData: CompletionFormEntry = completionData[appointmentId] || {
      medicines: [],
      notes: "",
      recheckupRequired: false,
      recheckupDays: 7,
      finalDiagnosis: [],
      customDiagnosis: "",
    }

    if (!hasValidPrescriptionInput(currentData)) {
      setNotification({
        type: "error",
        message: "Please add at least one medicine with a name",
      })
      return
    }

    if (!hasClinicalDocumentation(currentData)) {
      setNotification({
        type: "error",
        message: "Please enter clinical notes or diagnosis before completing the consultation.",
      })
      return
    }

    setUpdating({ ...updating, [appointmentId]: true })
    try {
      await runCompletionFlow(appointmentId, currentData)
    } catch (error: unknown) {
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to complete appointment",
      })
    } finally {
      setUpdating({ ...updating, [appointmentId]: false })
    }
  }

  const advanceToNextPatient = (completedId: string) => {
    const currentIdx = paginatedAppointments.findIndex((a) => a.id === completedId)
    const nextInQueue = paginatedAppointments
      .slice(currentIdx + 1)
      .find((a) => a.status === "confirmed")
    const fallback = paginatedAppointments.find(
      (a) => a.status === "confirmed" && a.id !== completedId
    )
    const next = nextInQueue || fallback
    if (next) {
      setExpandedAppointment(next.id)
    } else {
      closePatientWorkspace()
    }
  }

  const handleSaveAndNext = async (appointmentId: string) => {
    const currentData: CompletionFormEntry = completionData[appointmentId] || {
      medicines: [],
      notes: "",
      recheckupRequired: false,
      recheckupDays: 7,
      finalDiagnosis: [],
      customDiagnosis: "",
    }

    if (!hasValidPrescriptionInput(currentData)) {
      setNotification({ type: "error", message: "Please add at least one medicine with a name" })
      return
    }
    if (!hasClinicalDocumentation(currentData)) {
      setNotification({ type: "error", message: "Please enter clinical notes or diagnosis before saving." })
      return
    }

    setUpdating((prev) => ({ ...prev, [appointmentId]: true }))
    try {
      await runCompletionFlow(appointmentId, currentData)
      advanceToNextPatient(appointmentId)
    } catch (error: unknown) {
      setNotification({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to complete appointment",
      })
    } finally {
      setUpdating((prev) => ({ ...prev, [appointmentId]: false }))
    }
  }

  const handlePrintPrescriptionDraft = (appointment: AppointmentType) => {
    const data = completionData[appointment.id]
    if (!data || !hasValidPrescriptionInput(data)) {
      setNotification({ type: "error", message: "Add at least one medicine before printing." })
      return
    }
    try {
      const medicineText = formatMedicinesAsText(data.medicines, data.notes || "")
      generatePrescriptionPDF({
        ...appointment,
        medicine: medicineText,
        doctorNotes: data.notes,
      })
      setNotification({ type: "success", message: "Prescription PDF generated." })
    } catch {
      setNotification({ type: "error", message: "Failed to generate prescription PDF." })
    }
  }

  const handleSaveDraft = (appointmentId: string) => {
    const data = completionData[appointmentId]
    if (!data) {
      setNotification({ type: "error", message: "Nothing to save yet." })
      return
    }
    saveConsultationDraft(appointmentId, data)
    setNotification({
      type: "success",
      message: "Draft saved — restores automatically if you refresh or switch patients.",
    })
  }

  const handleAdmitPatient = async (appointment: AppointmentType) => {
    if (!appointment?.id) return
    const appointmentId = appointment.id
    if (admitting[appointmentId]) return

    setAdmitting((prev) => ({ ...prev, [appointmentId]: true }))
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          appointmentId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to submit admission request")
      }

      const data = await res.json().catch(() => ({}))
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId
            ? {
                ...apt,
                status: "awaiting_admission" as any,
                admissionRequestId:
                  data?.requestId || (apt as any)?.admissionRequestId || null,
                updatedAt: new Date().toISOString(),
              }
            : apt
        )
      )
      setNotification({
        type: "success",
        message: "Admission request sent to receptionist.",
      })
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to submit admission request",
      })
    } finally {
      setAdmitting((prev) => ({ ...prev, [appointmentId]: false }))
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

    if (admitting[appointmentId]) return

    const appointment = appointments.find((apt) => apt.id === appointmentId)
    if (appointment?.admissionRequestId) {
      setNotification({
        type: "error",
        message:
          "Admission request already sent. Please wait for receptionist to process.",
      })
      closeAdmitDialog()
      return
    }

    setAdmitting((prev) => ({ ...prev, [appointmentId]: true }))

    try {
      let hasMedicine = Boolean(appointment?.medicine && appointment.medicine.trim())

      const formData = completionData[appointmentId]
      const hasFormMedicine = hasValidPrescriptionInput(formData)

      if (!hasMedicine && !hasFormMedicine) {
        setNotification({
          type: "error",
          message: "Please add at least one medicine before admitting the patient.",
        })
        setAdmitting((prev) => ({ ...prev, [appointmentId]: false }))
        closeAdmitDialog()
        return
      }

      if (!hasMedicine && hasFormMedicine && formData) {
        setUpdating((prev) => ({ ...prev, [appointmentId]: true }))
        try {
          await runCompletionFlow(appointmentId, formData, { showToast: false })
          hasMedicine = true
        } catch (error) {
          setNotification({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Failed to save prescription before admitting. Please try again.",
          })
          setAdmitting((prev) => ({ ...prev, [appointmentId]: false }))
          closeAdmitDialog()
          return
        } finally {
          setUpdating((prev) => ({ ...prev, [appointmentId]: false }))
        }
      }

      if (!hasMedicine) {
        setNotification({
          type: "error",
          message: "Please add at least one medicine before admitting the patient.",
        })
        setAdmitting((prev) => ({ ...prev, [appointmentId]: false }))
        closeAdmitDialog()
        return
      }

      await handleAdmitPatient(admitDialog.appointment)
      closeAdmitDialog()
    } catch (error) {
      setNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to admit patient. Please try again.",
      })
      closeAdmitDialog()
    } finally {
      setAdmitting((prev) => ({ ...prev, [appointmentId]: false }))
    }
  }

  // Use appointment filters hook
  const {
    paginatedAppointments,
    allNonHistoryAppointments,
    historyAppointments,
    todayAppointments,
    doctorQueueStats,
    tabItems,
    historyPage,
    setHistoryPage,
    historyPageSize,
    setHistoryPageSize,
    appointmentsPage,
    setAppointmentsPage,
    appointmentsPageSize,
    setAppointmentsPageSize,
    totalHistoryPages,
    totalAppointmentsPages,
    filteredHistoryAppointments,
  } = useAppointmentFilters(appointments, activeTab, historyTabFilters, queueView)

  const clinicSnapshot = buildMorningClinicSnapshot(appointments)

  // Default open normal consultation form when a confirmed appointment is selected
  const expandedAptId = expandedAppointment
    ? paginatedAppointments.find((a) => a.id === expandedAppointment)?.id ?? null
    : null
  const expandedAptStatus = expandedAppointment
    ? paginatedAppointments.find((a) => a.id === expandedAppointment)?.status ?? null
    : null
  useEffect(() => {
    if (!expandedAptId || expandedAptStatus !== "confirmed") return
    setShowCompletionForm((prev) => ({ ...prev, [expandedAptId]: true }))
    setConsultationMode((prev) => ({ ...prev, [expandedAptId]: prev[expandedAptId] ?? "normal" }))
    const draft = loadConsultationDraft(expandedAptId)
    if (draft) {
      setCompletionData((prev) => {
        const existing = prev[expandedAptId]
        if (existing?.notes?.trim() || existing?.medicines?.some((m) => m.name?.trim())) {
          return prev
        }
        return { ...prev, [expandedAptId]: draft }
      })
    }
  }, [expandedAptId, expandedAptStatus])

  useEffect(() => {
    if (!expandedAptId || !showCompletionForm[expandedAptId]) return
    const data = completionData[expandedAptId]
    if (!data) return
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current)
    draftSaveTimeoutRef.current = setTimeout(() => {
      saveConsultationDraft(expandedAptId, data)
    }, 1500)
    return () => {
      if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current)
    }
  }, [completionData, expandedAptId, showCompletionForm])

  useEffect(() => {
    if (!expandedAptId || !showCompletionForm[expandedAptId]) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePatientWorkspace()
        return
      }

      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      if (isTyping && !(e.ctrlKey || e.metaKey)) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        const data = completionData[expandedAptId]
        if (data) {
          saveConsultationDraft(expandedAptId, data)
          setNotification({ type: "success", message: "Draft saved." })
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        if (e.shiftKey) {
          handleSaveAndNext(expandedAptId)
        } else {
          const form = document.getElementById(
            `completion-form-${expandedAptId}`
          ) as HTMLFormElement | null
          form?.requestSubmit()
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [expandedAptId, showCompletionForm, completionData])

  useEffect(() => {
    appointments.forEach((apt) => {
      const isFormOpen = showCompletionForm[apt.id]
      const hasSuggestion = !!aiPrescription[apt.id]?.medicine
      const isLoading = !!loadingAiPrescription[apt.id]
      const explicitlyHidden = showAiPrescriptionSuggestion[apt.id] === false

      if (isFormOpen && !hasSuggestion && !isLoading && !explicitlyHidden) {
        setShowAiPrescriptionSuggestion((prev) => ({ ...prev, [apt.id]: true }))
        handleGenerateAiPrescription(apt.id, true)
      }
    })
  }, [
    appointments,
    showCompletionForm,
    aiPrescription,
    loadingAiPrescription,
    showAiPrescriptionSuggestion,
    handleGenerateAiPrescription,
  ])

  useEffect(() => {
    appointments.forEach((apt) => {
      const isFormOpen = showCompletionForm[apt.id]
      const hasDiagnosis = !!aiDiagnosis[apt.id]
      const isLoading = !!loadingAiDiagnosis[apt.id]
      const explicitlyHidden = showAiDiagnosisSuggestion[apt.id] === false

      if (
        isFormOpen &&
        !hasDiagnosis &&
        !isLoading &&
        !explicitlyHidden &&
        apt.chiefComplaint?.trim()
      ) {
        setShowAiDiagnosisSuggestion((prev) => ({ ...prev, [apt.id]: true }))
        getAIDiagnosisSuggestion(apt)
      }
    })
  }, [
    appointments,
    showCompletionForm,
    aiDiagnosis,
    loadingAiDiagnosis,
    showAiDiagnosisSuggestion,
    getAIDiagnosisSuggestion,
  ])

  if (loading) {
    return <TabSkeleton variant="table" />
  }

  if (!user || !userData) {
    return null
  }

  const selectedAppointment =
    expandedAppointment
      ? paginatedAppointments.find((apt) => apt.id === expandedAppointment) || null
      : null

  const isConsultationWorkspaceOpen = Boolean(
    selectedAppointment &&
      activeTab !== "history" &&
      selectedAppointment.status === "confirmed" &&
      showCompletionForm[selectedAppointment.id]
  )

  const isNormalConsultationActive = Boolean(
    isConsultationWorkspaceOpen &&
      consultationMode[selectedAppointment!.id] !== "anatomy"
  )

  const isAnatomyConsultationActive = Boolean(
    isConsultationWorkspaceOpen &&
      consultationMode[selectedAppointment!.id] === "anatomy"
  )

  const confirmedQueue = paginatedAppointments.filter((a) => a.status === "confirmed")
  const queuePosition =
    selectedAppointment && isNormalConsultationActive
      ? (() => {
          const idx = confirmedQueue.findIndex((a) => a.id === selectedAppointment.id)
          return idx >= 0 ? { current: idx + 1, total: confirmedQueue.length } : undefined
        })()
      : undefined

  return (
    <ClinicalPageFrame maxWidth={expandedAppointment ? "full" : "7xl"}>
        {/* Queue navigation + filters */}
        <header className="clinical-surface overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <PageHeader
              variant="light"
              onGenerateReport={() => setShowReportModal(true)}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          </div>
          <div className="px-4 sm:px-6 py-3 border-b border-slate-100">
            <DoctorQueuePulse
              stats={doctorQueueStats}
              activeTab={activeTab}
              queueView={queueView}
              onSelect={(tab, view) => {
                setActiveTab(tab)
                setQueueView(view)
              }}
            />
          </div>
          <FilterBar
            activeTab={activeTab}
            planningTabs={[
              { key: "tomorrow", label: "Upcoming", count: tabItems.find((t) => t.key === "tomorrow")?.count ?? 0 },
              { key: "thisWeek", label: "This week", count: tabItems.find((t) => t.key === "thisWeek")?.count ?? 0 },
            ]}
            onPlanningTabChange={(tab) => {
              setActiveTab(tab)
              setQueueView("all")
            }}
            branches={branches}
            selectedBranchId={selectedBranchId}
            onBranchChange={setSelectedBranchId}
            loadingBranches={loadingBranches}
          />
        </header>

        {/* Main content */}
        <div className="clinical-surface overflow-hidden">
          {activeTab === "history" && (
            <HistorySearch
              text={historyTabFilters.text}
              date={historyTabFilters.date}
              onTextChange={(text) =>
                setHistoryTabFilters((prev) => ({ ...prev, text }))
              }
              onDateChange={(date) =>
                setHistoryTabFilters((prev) => ({ ...prev, date }))
              }
              onReset={() => setHistoryTabFilters({ text: "", date: "" })}
              resultCount={filteredHistoryAppointments.length}
              totalCount={historyAppointments.length}
            />
          )}
          <main className="p-4 sm:p-6 lg:p-7">
        {paginatedAppointments.length === 0 ? (
          <EmptyState activeTab={activeTab} />
        ) : (
          <ConsultationLayout
            hasSelection={!!selectedAppointment}
            queue={
            <div className="flex flex-col w-full gap-3">
              {!selectedAppointment && activeTab === "today" && queueView !== "completed" && (
                <>
                  <NextPatientBanner
                    patient={clinicSnapshot.nextPatient}
                    onStart={toggleAccordion}
                    selectedId={expandedAppointment}
                  />
                  <AppointmentScheduleRail
                    appointments={todayAppointments}
                    selectedId={expandedAppointment}
                    onSelect={toggleAccordion}
                  />
                </>
              )}
              <AppointmentsListPane
                appointments={paginatedAppointments}
                selectedId={selectedAppointment ? selectedAppointment.id : null}
                onSelect={(id) => toggleAccordion(id)}
                onSkip={activeTab === "today" ? openSkipConfirm : undefined}
                skippingId={skippingId}
                showSkipActions={activeTab === "today" && queueView === "all"}
              />
              {/* Pagination for history tab */}
              {activeTab === "history" && filteredHistoryAppointments.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={historyPage}
                    totalPages={totalHistoryPages}
                    pageSize={historyPageSize}
                    totalItems={filteredHistoryAppointments.length}
                    onPageChange={setHistoryPage}
                    onPageSizeChange={setHistoryPageSize}
                    itemLabel="appointments"
                  />
                </div>
              )}
              {/* Pagination for non-history tabs */}
              {activeTab !== "history" && allNonHistoryAppointments.length > 0 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={appointmentsPage}
                    totalPages={totalAppointmentsPages}
                    pageSize={appointmentsPageSize}
                    totalItems={allNonHistoryAppointments.length}
                    onPageChange={setAppointmentsPage}
                    onPageSizeChange={setAppointmentsPageSize}
                    itemLabel="appointments"
                  />
                </div>
              )}
            </div>
            }
            workspace={
            <div
              ref={appointmentDetailsRef}
              className="h-full min-h-0 flex flex-col overflow-hidden"
            >
              {selectedAppointment ? (
                <>
                  {isNormalConsultationActive ? (
                    <ConsultationStickyPatientBar
                      appointment={selectedAppointment}
                      queuePosition={queuePosition}
                      onBackToQueue={closePatientWorkspace}
                    />
                  ) : (
                  <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={closePatientWorkspace}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shrink-0"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Back to queue
                      </button>
                    </div>
                    <span className="text-xs text-slate-500 hidden sm:inline shrink-0">
                      {paginatedAppointments.length} appointment{paginatedAppointments.length === 1 ? "" : "s"} in queue
                    </span>
                  </div>
                  )}
                  <div
                    className={
                      isNormalConsultationActive
                        ? "flex-1 min-h-0 flex flex-col overflow-hidden gap-3 py-3"
                        : "flex-1 min-h-0 overflow-y-auto bg-slate-50/50 pb-28 p-3 sm:p-4 space-y-3"
                    }
                  >
                    {!isNormalConsultationActive && !isAnatomyConsultationActive && (
                    <PatientClinicalWorkspace
                      appointment={selectedAppointment}
                      patientHistory={patientHistory}
                      historyDocuments={historyDocuments}
                      historyFilters={
                        historySearchFilters[selectedAppointment.id] || { text: "", date: "" }
                      }
                      showHistory={showHistory[selectedAppointment.id] || false}
                      onToggleHistory={() =>
                        setShowHistory((prev) => ({
                          ...prev,
                          [selectedAppointment.id]: !prev[selectedAppointment.id],
                        }))
                      }
                      onDocumentClick={(doc) => setSelectedHistoryDocument(doc)}
                      latestRecommendation={
                        activeTab !== "history"
                          ? getLatestCheckupRecommendation(selectedAppointment)
                          : null
                      }
                      onLastVisitClick={() => {
                        const recommendation = getLatestCheckupRecommendation(selectedAppointment)
                        if (recommendation) {
                          setLastVisitModal({
                            open: true,
                            appointment: selectedAppointment,
                            recommendation,
                          })
                        }
                      }}
                      onOpenDocuments={
                        activeTab !== "history"
                          ? () => setDocumentsModal({ open: true, appointment: selectedAppointment })
                          : undefined
                      }
                      onOpenConsentVideo={
                        activeTab !== "history"
                          ? () => setConsentModal({ open: true, appointment: selectedAppointment })
                          : undefined
                      }
                      isReturningPatient={
                        patientHistory.filter(
                          (h: AppointmentType) =>
                            h.patientId === selectedAppointment.patientId &&
                            h.doctorId === selectedAppointment.doctorId &&
                            h.id !== selectedAppointment.id
                        ).length > 0
                      }
                      isHistoryView={activeTab === "history"}
                      onDownloadPdf={
                        activeTab === "history"
                          ? () => handleDownloadVisitPdf(selectedAppointment)
                          : undefined
                      }
                    />
                    )}

                    {activeTab !== "history" &&
                      selectedAppointment.status === "confirmed" &&
                      isConsultationWorkspaceOpen &&
                      (() => {
                        const models = getAvailableAnatomyModels(selectedAppointment.doctorSpecialization)
                        const isNormal =
                          consultationMode[selectedAppointment.id] === "normal" ||
                          !consultationMode[selectedAppointment.id]
                        const added = selectedAnatomyTypes[selectedAppointment.id] || []
                        const renderAnatomyIcon = (type: "ear" | "nose" | "throat" | "dental" | "lungs" | "kidney" | "skeleton" | "lymph_nodes" | "female_reproductive") => {
                          switch (type) {
                            case "ear":
                              return <Ear className="w-5 h-5 text-sky-600" />
                            case "nose":
                              return <ScanFace className="w-5 h-5 text-cyan-600" />
                            case "throat":
                              return <Mic className="w-5 h-5 text-rose-600" />
                            case "dental":
                              return <Stethoscope className="w-5 h-5 text-emerald-600" />
                            case "lungs":
                              return <HeartPulse className="w-5 h-5 text-teal-600" />
                            case "female_reproductive":
                              return <Stethoscope className="w-5 h-5 text-pink-600" />
                            case "skeleton":
                              return <Bone className="w-5 h-5 text-slate-700" />
                            case "kidney":
                            case "lymph_nodes":
                            default:
                              return <Stethoscope className="w-6 h-6 text-sky-600" />
                          }
                        }

                        return (
                          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm mx-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                              Consultation
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-1 scroll-smooth [scrollbar-width:thin]">
                              <button
                                type="button"
                                onClick={() => openNormalConsultation(selectedAppointment.id)}
                                className={`flex-shrink-0 w-20 sm:w-24 rounded-xl border-2 px-3 py-2.5 flex flex-col items-center justify-center gap-1 transition-all hover:shadow-md ${
                                  isNormal
                                    ? "border-cyan-400 bg-cyan-50/80 text-cyan-900"
                                    : "border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300 hover:bg-slate-100"
                                }`}
                              >
                                <span aria-hidden>
                                  <ClipboardList className="w-5 h-5 text-sky-600" />
                                </span>
                                <span className="text-xs font-semibold text-center leading-tight line-clamp-2">
                                  Normal consultation
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {isNormal ? "Open" : "Click to open"}
                                </span>
                              </button>
                              {models.map((model) => {
                                const isAdded = added.includes(model.type)
                                return (
                                  <button
                                    key={model.type}
                                    type="button"
                                    onClick={() => openAnatomyFromQuickCard(selectedAppointment.id, model.type)}
                                    className={`flex-shrink-0 w-20 sm:w-24 rounded-xl border-2 px-3 py-2.5 flex flex-col items-center justify-center gap-1 transition-all hover:shadow-md ${
                                      isAdded
                                        ? "border-cyan-400 bg-cyan-50/80 text-cyan-900"
                                        : "border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300 hover:bg-slate-100"
                                    }`}
                                  >
                                    <span aria-hidden>
                                      {renderAnatomyIcon(model.type)}
                                    </span>
                                    <span className="text-xs font-semibold text-center leading-tight line-clamp-2">
                                      {model.label}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {isAdded ? "Open" : "Click to open"}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </section>
                        )
                      })()}

                    {isAnatomyConsultationActive && (
                      <ConsultationAnatomyView
                        appointmentId={selectedAppointment.id}
                        patientName={selectedAppointment.patientName || "Patient"}
                        doctorSpecialization={selectedAppointment.doctorSpecialization}
                        selectedTypes={selectedAnatomyTypes[selectedAppointment.id] || []}
                        activeTab={activeAnatomyTab[selectedAppointment.id]}
                        viewerData={anatomyViewerData[selectedAppointment.id] || {}}
                        onSelectTab={(tab) =>
                          setActiveAnatomyTab((prev) => ({
                            ...prev,
                            [selectedAppointment.id]: tab,
                          }))
                        }
                        onAddAnatomy={() =>
                          setShowConsultationModeModal({
                            open: true,
                            appointmentId: selectedAppointment.id,
                          })
                        }
                        onRemoveTab={(tab) => {
                          const newTabs = (
                            selectedAnatomyTypes[selectedAppointment.id] || []
                          ).filter((t) => t !== tab)
                          setSelectedAnatomyTypes((prev) => ({
                            ...prev,
                            [selectedAppointment.id]: newTabs,
                          }))
                          if (activeAnatomyTab[selectedAppointment.id] === tab) {
                            setActiveAnatomyTab((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: newTabs[0] ?? "ear",
                            }))
                          }
                          if (newTabs.length === 0) {
                            setConsultationMode((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: "normal",
                            }))
                          }
                        }}
                        onDataChange={(tab, data) =>
                          handleAnatomyDataChange(selectedAppointment.id, tab, data)
                        }
                        onBackToForm={() => openNormalConsultation(selectedAppointment.id)}
                      />
                    )}

                    {isNormalConsultationActive && (
                        <div ref={completionFormRef} className="flex-1 min-h-0 flex flex-col">
                        <CompletionForm
                          layout="workspace"
                          formId={`completion-form-${selectedAppointment.id}`}
                          doctorUid={user.uid}
                          latestRecommendation={getLatestCheckupRecommendation(selectedAppointment)}
                          onLastVisitClick={() => {
                            const recommendation = getLatestCheckupRecommendation(selectedAppointment)
                            if (recommendation) {
                              setLastVisitModal({
                                open: true,
                                appointment: selectedAppointment,
                                recommendation,
                              })
                            }
                          }}
                          onOpenDocuments={() =>
                            setDocumentsModal({ open: true, appointment: selectedAppointment })
                          }
                          isReturningPatient={
                            patientHistory.filter(
                              (h: AppointmentType) =>
                                h.patientId === selectedAppointment.patientId &&
                                h.doctorId === selectedAppointment.doctorId &&
                                h.id !== selectedAppointment.id
                            ).length > 0
                          }
                          appointment={selectedAppointment}
                          completionData={
                            completionData[selectedAppointment.id] || {
                              medicines: [],
                              notes: "",
                              recheckupRequired: false,
                              finalDiagnosis: [],
                              customDiagnosis: "",
                            }
                          }
                          patientHistory={patientHistory}
                          medicineSuggestions={medicineSuggestions}
                          medicineSuggestionsLoading={medicineSuggestionsLoading}
                          aiPrescription={aiPrescription[selectedAppointment.id]}
                          loadingAiPrescription={
                            loadingAiPrescription[selectedAppointment.id] || false
                          }
                          showAiPrescriptionSuggestion={
                            showAiPrescriptionSuggestion[selectedAppointment.id] ||
                            false
                          }
                          aiDiagnosisText={aiDiagnosis[selectedAppointment.id]}
                          loadingAiDiagnosis={
                            loadingAiDiagnosis[selectedAppointment.id] || false
                          }
                          showAiDiagnosisSuggestion={
                            showAiDiagnosisSuggestion[selectedAppointment.id] !== false
                          }
                          removedAiMedicines={
                            removedAiMedicines[selectedAppointment.id] || []
                          }
                          showDocumentUpload={showDocumentUpload[selectedAppointment.id] || false}
                          updating={updating[selectedAppointment.id] || false}
                          admitting={admitting[selectedAppointment.id] || false}
                          onCompletionDataChange={(data) => {
                            setCompletionData((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: data,
                            }))
                          }}
                          onAiPrescriptionAddAll={(toAdd) => {
                            const existing =
                              completionData[selectedAppointment.id]?.medicines ||
                              []
                            setCompletionData((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: {
                                ...prev[selectedAppointment.id],
                                medicines: [...existing, ...toAdd],
                              },
                            }))
                            setShowAiPrescriptionSuggestion((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: false,
                            }))
                            setRemovedAiMedicines((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: [],
                            }))
                          }}
                          onAiPrescriptionAddSingle={(med, originalIndex) => {
                            setCompletionData((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: {
                                ...prev[selectedAppointment.id],
                                medicines: [
                                  ...(prev[selectedAppointment.id]?.medicines ||
                                    []),
                                  med,
                                ],
                              },
                            }))
                            setRemovedAiMedicines((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: [
                                ...(prev[selectedAppointment.id] || []),
                                originalIndex,
                              ],
                            }))
                          }}
                          onAiPrescriptionRemove={(originalIndex) => {
                            setRemovedAiMedicines((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: [
                                ...(prev[selectedAppointment.id] || []),
                                originalIndex,
                              ],
                            }))
                          }}
                          onAiPrescriptionRemoveAll={(indices) => {
                            setRemovedAiMedicines((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: indices,
                            }))
                          }}
                          onAiPrescriptionRegenerate={() => {
                            setRemovedAiMedicines((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: [],
                            }))
                            handleGenerateAiPrescription(
                              selectedAppointment.id
                            )
                          }}
                          onDeclinePrescription={() =>
                            handleDeclinePrescription(selectedAppointment.id)
                          }
                          onGenerateAiDiagnosis={() => {
                            setShowAiDiagnosisSuggestion((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: true,
                            }))
                            getAIDiagnosisSuggestion(selectedAppointment)
                          }}
                          onAiDiagnosisRegenerate={() =>
                            getAIDiagnosisSuggestion(selectedAppointment)
                          }
                          onDeclineAiDiagnosis={() =>
                            handleDeclineAiDiagnosis(selectedAppointment.id)
                          }
                          onCopyPreviousPrescription={() =>
                            handleCopyPreviousPrescription(selectedAppointment.id)
                          }
                          onDocumentUploadToggle={() =>
                            setShowDocumentUpload((prev) => ({
                              ...prev,
                              [selectedAppointment.id]:
                                !prev[selectedAppointment.id],
                            }))
                          }
                          onDocumentUploadSuccess={(document) => {
                            setNotification({
                              type: "success",
                              message: `Document "${document.originalFileName}" uploaded successfully.`,
                            })
                          }}
                          onDocumentUploadError={(error) => {
                            setNotification({
                              type: "error",
                              message: error,
                            })
                          }}
                          onSubmit={(e) =>
                            handleCompleteAppointment(e, selectedAppointment.id)
                          }
                          onAdmitClick={() => openAdmitDialog(selectedAppointment)}
                          onAddAnatomy={() =>
                            setShowConsultationModeModal({
                              open: true,
                              appointmentId: selectedAppointment.id,
                            })
                          }
                          historyDocuments={historyDocuments}
                          onDocumentClick={(doc) => setSelectedHistoryDocument(doc)}
                          actionBar={
                            <ConsultationActionBar
                              formId={`completion-form-${selectedAppointment.id}`}
                              updating={!!updating[selectedAppointment.id]}
                              admitting={!!admitting[selectedAppointment.id]}
                              canComplete={hasValidPrescriptionInput(
                                completionData[selectedAppointment.id] || {
                                  medicines: [],
                                  notes: "",
                                  recheckupRequired: false,
                                  finalDiagnosis: [],
                                  customDiagnosis: "",
                                }
                              )}
                              hasDocumentation={hasClinicalDocumentation(
                                completionData[selectedAppointment.id] || {
                                  medicines: [],
                                  notes: "",
                                  recheckupRequired: false,
                                  finalDiagnosis: [],
                                  customDiagnosis: "",
                                }
                              )}
                              recheckupRequired={
                                completionData[selectedAppointment.id]?.recheckupRequired || false
                              }
                              recheckupDays={
                                completionData[selectedAppointment.id]?.recheckupDays ?? 7
                              }
                              onRecheckupRequiredChange={(value) =>
                                setCompletionData((prev) => ({
                                  ...prev,
                                  [selectedAppointment.id]: {
                                    ...prev[selectedAppointment.id],
                                    recheckupRequired: value,
                                  },
                                }))
                              }
                              onRecheckupDaysChange={(value) =>
                                setCompletionData((prev) => ({
                                  ...prev,
                                  [selectedAppointment.id]: {
                                    ...prev[selectedAppointment.id],
                                    recheckupDays: value,
                                  },
                                }))
                              }
                              onSaveDraft={() => handleSaveDraft(selectedAppointment.id)}
                              onPrintPrescription={() =>
                                handlePrintPrescriptionDraft(selectedAppointment)
                              }
                              onSaveAndNext={() =>
                                handleSaveAndNext(selectedAppointment.id)
                              }
                              onAdmit={() => openAdmitDialog(selectedAppointment)}
                            />
                          }
                        />
                        </div>
                      )}

                  </div>
                </>
              ) : null}
            </div>
            }
          />
        )}
      </main>
        </div>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          filter={reportFilter}
          format={reportFormat}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onFilterChange={setReportFilter}
          onFormatChange={setReportFormat}
          onStartDateChange={setCustomStartDate}
          onEndDateChange={setCustomEndDate}
          onGenerate={handleGenerateReport}
          generating={generatingReport}
          errorMessage={notification?.type === "error" ? notification.message : undefined}
        />
      )}
      {skipConfirmAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-confirm-title"
          onClick={() => setSkipConfirmAppointment(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="skip-confirm-title" className="text-base font-semibold text-slate-900 mb-2">
              Skip this appointment?
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {skipConfirmAppointment.patientName} will be marked as skipped. You can take the next patient.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSkipConfirmAppointment(null)}
                className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSkip(skipConfirmAppointment.id)}
                disabled={skippingId === skipConfirmAppointment.id}
                className="px-3 py-2 text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-300 rounded-md hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {skippingId === skipConfirmAppointment.id ? "Skipping…" : "Skip appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
      {admitDialog.open && admitDialog.appointment && (
        <AdmitDialog
          open={admitDialog.open}
          appointment={admitDialog.appointment}
          isSubmitting={!!(
            admitDialog.appointment && admitting[admitDialog.appointment.id]
          )}
          onCancel={closeAdmitDialog}
          onConfirm={confirmAdmitPatient}
        />
      )}
      {documentsModal.open && documentsModal.appointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl">
            <ReportViewer
              title="Documents & Reports"
              subtitle={`${documentsModal.appointment.patientName} · ${new Date(
                documentsModal.appointment.appointmentDate
              ).toLocaleDateString("en-US", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })} at ${documentsModal.appointment.appointmentTime}`}
              onClose={() => setDocumentsModal({ open: false, appointment: null })}
            >
              <AppointmentDocuments
                appointmentId={documentsModal.appointment.id}
                patientId={documentsModal.appointment.patientId}
                patientUid={
                  documentsModal.appointment.patientUid ||
                  documentsModal.appointment.patientId ||
                  ""
                }
                appointmentSpecialty={documentsModal.appointment.doctorSpecialization}
                appointmentStatus={documentsModal.appointment.status}
                canUpload={true}
                canEdit={true}
                canDelete={true}
              />
            </ReportViewer>
          </div>
        </div>
      )}
      {consentModal.open && consentModal.appointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Patient consent video</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {consentModal.appointment.patientName} · Record or upload consent for serious procedures
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConsentModal({ open: false, appointment: null })}
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Close consent video"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              <PatientConsentVideo
                patientId={consentModal.appointment.patientId}
                patientUid={consentModal.appointment.patientUid || consentModal.appointment.patientId || ""}
                patientName={consentModal.appointment.patientName || ""}
                appointmentId={consentModal.appointment.id}
                optional={false}
              />
            </div>
          </div>
        </div>
      )}

      {showConsultationModeModal.open && showConsultationModeModal.appointmentId && (
        <ConsultationModeModal
          appointmentId={showConsultationModeModal.appointmentId}
          isOpen={showConsultationModeModal.open}
          onClose={() =>
            setShowConsultationModeModal({ open: false, appointmentId: null })
          }
          onSelectNormal={() => handleConsultationModeSelect("normal")}
          onSelectAnatomy={(anatomyType) =>
            handleConsultationModeSelect("anatomy", anatomyType)
          }
          doctorSpecialization={
            appointments.find((a) => a.id === showConsultationModeModal.appointmentId)
              ?.doctorSpecialization
          }
          alreadySelectedTypes={
            selectedAnatomyTypes[showConsultationModeModal.appointmentId] || []
          }
        />
      )}
      {selectedHistoryDocument && (
        <HistoryDocumentViewer
          document={selectedHistoryDocument}
          onClose={() => setSelectedHistoryDocument(null)}
          currentAppointmentId={expandedAppointment || undefined}
        />
      )}
      {lastVisitModal.open && lastVisitModal.appointment && lastVisitModal.recommendation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-teal-50/50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Last Visit Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {lastVisitModal.appointment.patientName} ·{" "}
                  {lastVisitModal.recommendation.date || "Previous visit"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLastVisitModal({ open: false, appointment: null, recommendation: null })}
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Close last visit details"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {lastVisitModal.appointment.chiefComplaint && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Chief complaint
                  </p>
                  <p className="text-sm text-slate-900 whitespace-pre-line">
                    {lastVisitModal.appointment.chiefComplaint}
                  </p>
                </div>
              )}

              {lastVisitModal.recommendation.finalDiagnosis.length > 0 && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Final diagnosis
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {lastVisitModal.recommendation.finalDiagnosis.map((diag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800 border border-blue-100"
                      >
                        {diag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Prescription
                </p>
                {lastVisitModal.recommendation.medicine ? (
                  (() => {
                    const parsed = parsePrescriptionUtil(lastVisitModal.recommendation.medicine!)
                    if (parsed && parsed.medicines.length > 0) {
                      return (
                        <div className="space-y-2">
                          {parsed.medicines.map((med, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 text-sm text-slate-800 bg-white rounded-lg px-3 py-2 border border-slate-200"
                            >
                              <span className="text-xl">{med.emoji}</span>
                              <div className="flex-1">
                                <p className="font-medium">{med.name}</p>
                                {(med.dosage || med.frequency || med.duration) && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {med.dosage && `Dosage: ${med.dosage}`}
                                    {med.dosage && med.frequency && " · "}
                                    {med.frequency && `Frequency: ${med.frequency}`}
                                    {med.duration && ` · Duration: ${med.duration}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return (
                      <p className="text-sm text-slate-700 whitespace-pre-line">
                        {lastVisitModal.recommendation.medicine}
                      </p>
                    )
                  })()
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No prescription recorded in last visit.
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Doctor&apos;s notes
                </p>
                {lastVisitModal.recommendation.notes ? (
                  <p className="text-sm text-slate-700 whitespace-pre-line">
                    {lastVisitModal.recommendation.notes}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    No notes recorded in last visit.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ClinicalPageFrame>
  )
}

export default function DoctorAppointments() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-gray-50">
          <div className="text-gray-600">Loading...</div>
        </div>
      }
    >
      <DoctorAppointmentsContent />
    </Suspense>
  )
}