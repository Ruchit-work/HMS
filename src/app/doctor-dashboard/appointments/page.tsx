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
import { fetchMedicineSuggestions, MedicineSuggestion, recordMedicineSuggestions } from "@/utils/medicineSuggestions"
import type { Branch } from "@/types/branch"
import { CUSTOM_DIAGNOSIS_OPTION } from "@/constants/entDiagnoses"
import InlineAnatomyViewer, { type AnatomyViewerData } from "@/components/doctor/InlineAnatomyViewer"
import AppointmentDocuments from "@/components/documents/AppointmentDocuments"
import { DocumentMetadata } from "@/types/document"
import { parsePrescription as parsePrescriptionUtil, parseAiPrescription as parseAiPrescriptionUtil } from "@/utils/appointments/prescriptionParsers"
import { formatMedicinesAsText as formatMedicinesAsTextUtil } from "@/utils/appointments/prescriptionFormatters"
import { isToday as isTodayUtil, isTomorrow as isTomorrowUtil, isThisWeek as isThisWeekUtil, isNextWeek as isNextWeekUtil, sortByDateTime as sortByDateTimeUtil, sortByDateTimeDesc as sortByDateTimeDescUtil } from "@/utils/appointments/appointmentFilters"
import { TabKey, CompletionFormEntry, UserData, hasValidPrescriptionInput } from "@/types/appointments"
import LastAppointmentDetails from "@/components/doctor/appointments/LastAppointmentDetails"
import ConsultationModeModal from "@/components/doctor/appointments/ConsultationModeModal"
import CompletionForm from "@/components/doctor/appointments/CompletionForm"
import PatientInfoSection from "@/components/doctor/appointments/PatientInfoSection"
import LifestyleSection from "@/components/doctor/appointments/LifestyleSection"
import MedicalInfoSection from "@/components/doctor/appointments/MedicalInfoSection"
import AIDiagnosisSuggestion from "@/components/doctor/appointments/AIDiagnosisSuggestion"
import PatientHistorySection from "@/components/doctor/appointments/PatientHistorySection"
import CombinedCompletionModal from "@/components/doctor/appointments/CombinedCompletionModal"
import { AdmitDialog } from "@/components/doctor/appointments/AdmitDialog"
import { ReportModal } from "@/components/doctor/appointments/ReportModal"
import { HistoryDocumentViewer } from "@/components/doctor/appointments/HistoryDocumentViewer"
import PageHeader from "@/components/doctor/appointments/PageHeader"
import StatsBar from "@/components/doctor/appointments/StatsBar"
import FilterBar from "@/components/doctor/appointments/FilterBar"
import AppointmentCard from "@/components/doctor/appointments/AppointmentCard"
import EmptyState from "@/components/doctor/appointments/EmptyState"
import HistorySearch from "@/components/doctor/appointments/HistorySearch"

function PatientSummaryBar({
  appointment,
}: {
  appointment: AppointmentType
}) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null

  return (
    <div className="sticky top-0 z-10 border-b border-slate-200/50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 backdrop-blur-md shadow-xl px-4 py-4 flex items-center justify-between gap-4 animate-slide-up-fade">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm flex items-center justify-center text-base font-bold text-white shadow-2xl border-2 border-white/30 transform transition-all duration-300 hover:scale-110 hover:rotate-12 animate-breathe">
          {appointment.patientName?.charAt(0).toUpperCase() || "P"}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate drop-shadow-md">
            {appointment.patientName || "Patient"}
          </div>
          <div className="mt-0.5 text-xs text-white/90 truncate flex items-center gap-1">
            {age !== null && (
              <>
                <span>{age}y</span>
                <span className="text-white/60">·</span>
              </>
            )}
            <span>{appointment.patientPhone || appointment.patientGender || "—"}</span>
          </div>
        </div>
      </div>
      <div className="hidden md:flex flex-col items-end gap-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg border border-white/30 backdrop-blur-sm bg-white/20 text-white animate-badge-pulse`}
          >
            {appointment.status === "confirmed"
              ? "Confirmed"
              : appointment.status === "completed"
              ? "Completed"
              : appointment.status}
          </span>
          <span className="text-white/90 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            <span className="text-white/70">·</span> {appointment.appointmentTime}
          </span>
        </div>
        {appointment.chiefComplaint && (
          <p className="max-w-md text-[11px] text-white/80 line-clamp-1 flex items-center gap-1">
            <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {appointment.chiefComplaint}
          </p>
        )}
      </div>
    </div>
  )
}

function ClinicalSummaryCard({
  appointment,
  latestRecommendation,
  onClick,
}: {
  appointment: AppointmentType
  latestRecommendation: {
    finalDiagnosis: string[]
    medicine?: string | null
    notes?: string | null
    date?: string
  } | null
  onClick?: () => void
}) {
  const primaryDiagnosis =
    latestRecommendation && latestRecommendation.finalDiagnosis.length > 0
      ? latestRecommendation.finalDiagnosis[0]
      : null

  return (
    <div 
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/30 shadow-sm p-4 transition-all duration-300 hover:shadow-xl hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50/50 hover:-translate-y-1 hover:scale-[1.02] animate-fade-in card-hover ${
        latestRecommendation && onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-900">Last visit details</h3>
        {latestRecommendation ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-100">
              {latestRecommendation.date || "Previous visit"}
            </span>
            {onClick && (
              <span className="text-[10px] text-blue-600 font-medium">Click to view</span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">No previous visit</span>
        )}
      </div>

      {latestRecommendation ? (
        <>
          {/* Compact summary row (always visible) */}
          <div className="flex flex-col gap-2 text-xs">
            {appointment.chiefComplaint && (
              <div className="rounded-lg bg-white/70 border border-slate-100 px-2.5 py-1.5">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                  Chief complaint
                </p>
                <p className="mt-0.5 text-slate-900 line-clamp-2">
                  {appointment.chiefComplaint}
                </p>
              </div>
            )}

            {primaryDiagnosis && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Diagnosis
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100">
                  {primaryDiagnosis}
                </span>
                {latestRecommendation.finalDiagnosis.length > 1 && (
                  <span className="text-[11px] text-slate-500">
                    +{latestRecommendation.finalDiagnosis.length - 1} more
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

function AppointmentActionsCard({
  appointment,
  updating,
  onStartConsultation,
  onOpenDocuments,
  consultationStarted,
}: {
  appointment: AppointmentType
  updating: boolean
  onStartConsultation: () => void
  onOpenDocuments: () => void
  consultationStarted: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50/20 shadow-sm p-4 space-y-4 transition-all duration-300 hover:shadow-md hover:border-emerald-200 animate-fade-in card-hover">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Appointment
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          · {appointment.appointmentTime}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Status:{" "}
          <span className="font-medium text-slate-900">
            {appointment.status === "confirmed"
              ? "Confirmed"
              : appointment.status === "completed"
              ? "Completed"
              : appointment.status}
          </span>
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onStartConsultation}
          disabled={updating || consultationStarted}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <span>{consultationStarted ? "Consultation in progress" : "Start consultation"}</span>
        </button>
        <button
          type="button"
          onClick={onOpenDocuments}
          className="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 hover:border-blue-400 flex items-center justify-center gap-2 transform transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <span>Documents &amp; reports</span>
        </button>
      </div>
    </div>
  )
}

function AppointmentsListPane({
  appointments,
  selectedId,
  onSelect,
}: {
  appointments: AppointmentType[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 shadow-lg overflow-hidden flex flex-col h-full animate-fade-in">
      <div className="px-4 py-3.5 border-b border-slate-200/50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shadow-md animate-slide-up-fade">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Appointments
        </h3>
        <span className="text-[11px] font-bold text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-lg animate-pulse-slow border border-white/30">
          {appointments.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {appointments.map((apt, index) => (
          <button
            key={apt.id}
            type="button"
            onClick={() => onSelect(apt.id)}
            className={`w-full px-4 py-3 text-left text-xs border-b border-slate-100 flex flex-col gap-1 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50/50 hover:shadow-sm stagger-item ${
              selectedId === apt.id 
                ? "bg-gradient-to-r from-blue-100 to-indigo-100 border-l-4 border-l-blue-500 shadow-md" 
                : "bg-white"
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900 truncate">
                {apt.patientName || "Patient"}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(
                  apt.status
                )}`}
              >
                {apt.status === "confirmed"
                  ? "Confirmed"
                  : apt.status === "completed"
                  ? "Completed"
                  : apt.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">
                {new Date(apt.appointmentDate).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                })}
                {" · "}
                {apt.appointmentTime}
              </span>
              {apt.chiefComplaint && (
                <span className="ml-2 truncate max-w-[140px]">
                  {apt.chiefComplaint}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function DoctorAppointmentsContent() {
  const searchParams = useSearchParams()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [appointments, setAppointments] = useState<AppointmentType[]>([])
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("today")
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [updating, setUpdating] = useState<{ [key: string]: boolean }>({})
  const [showCompletionForm, setShowCompletionForm] = useState<{ [key: string]: boolean }>({})
  const [consultationMode, setConsultationMode] = useState<{ [key: string]: "normal" | "anatomy" | null }>({})
  const [selectedAnatomyTypes, setSelectedAnatomyTypes] = useState<{ [key: string]: ("ear" | "throat" | "dental")[] }>({})
  const [anatomyViewerData, setAnatomyViewerData] = useState<{ [key: string]: { [anatomyType: string]: AnatomyViewerData | null } }>({})
  const [showCombinedCompletionModal, setShowCombinedCompletionModal] = useState<{ [key: string]: boolean }>({})
  const appointmentCardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const appointmentDetailsRef = useRef<HTMLDivElement | null>(null)
  const completionFormRef = useRef<HTMLDivElement | null>(null)
  const [completionData, setCompletionData] = useState<Record<string, CompletionFormEntry>>({})
  const [aiPrescription, setAiPrescription] = useState<{ [key: string]: { medicine: string; notes: string } }>({})
  const [loadingAiPrescription, setLoadingAiPrescription] = useState<{ [key: string]: boolean }>({})
  const [showAiPrescriptionSuggestion, setShowAiPrescriptionSuggestion] = useState<{ [key: string]: boolean }>({})
  const [removedAiMedicines, setRemovedAiMedicines] = useState<{ [appointmentId: string]: number[] }>({})
  const [patientHistory, setPatientHistory] = useState<AppointmentType[]>([])
  const [historySearchFilters, setHistorySearchFilters] = useState<{ [key: string]: { text: string; date: string } }>({})
  const [historyTabFilters, setHistoryTabFilters] = useState<{ text: string; date: string }>({ text: "", date: "" })
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const [appointmentsPage, setAppointmentsPage] = useState(1)
  const [appointmentsPageSize, setAppointmentsPageSize] = useState(10)
  const [aiDiagnosis, setAiDiagnosis] = useState<{ [key: string]: string }>({})
  const [loadingAiDiagnosis, setLoadingAiDiagnosis] = useState<{ [key: string]: boolean }>({})
  const [showHistory, setShowHistory] = useState<{ [key: string]: boolean }>({})
  const [showAllDoctorsHistory, setShowAllDoctorsHistory] = useState<{ [key: string]: boolean }>({})
  const [expandedDoctors, setExpandedDoctors] = useState<{ [key: string]: boolean }>({})
  const [showDocumentUpload, setShowDocumentUpload] = useState<{ [key: string]: boolean }>({})
  const [historyDocuments, setHistoryDocuments] = useState<{ [appointmentId: string]: DocumentMetadata[] }>({})
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
  const [medicineSuggestions, setMedicineSuggestions] = useState<MedicineSuggestion[]>([])
  const [showConsultationModeModal, setShowConsultationModeModal] = useState<{
    open: boolean
    appointmentId: string | null
  }>({
    open: false,
    appointmentId: null,
  })
  const [medicineSuggestionsLoading, setMedicineSuggestionsLoading] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)
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

  useEffect(() => {
    const openAppointmentId = Object.keys(showCombinedCompletionModal).find(
      (id) => showCombinedCompletionModal[id]
    )

    if (openAppointmentId && appointmentCardRefs.current[openAppointmentId]) {
      setTimeout(() => {
        const cardElement = appointmentCardRefs.current[openAppointmentId]
        if (cardElement) {
          cardElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          })
        }
      }, 150)
    }
  }, [showCombinedCompletionModal])

  const { user, loading } = useAuth("doctor")
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()

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

    const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
    if (doctorDoc.exists()) {
      const data = doctorDoc.data() as UserData
      setUserData(data)
    }

    const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
    let q
    if (branchId) {
      q = query(appointmentsRef, where("doctorId", "==", user.uid), where("branchId", "==", branchId))
    } else {
      q = query(appointmentsRef, where("doctorId", "==", user.uid))
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const appointmentsList = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AppointmentType))
          .filter((appointment) => {
            const appt = appointment as any
            return appt.status !== "whatsapp_pending" && !appt.whatsappPending
          })

        setAppointments(appointmentsList)
      },
      (error) => {}
    )

    return unsubscribe
  }

  useEffect(() => {
    if (!user || hospitalLoading || !activeHospitalId) return

    let unsubscribe: (() => void) | null = null

    const initializeRealtimeData = async () => {
      unsubscribe = await setupRealtimeListeners(selectedBranchId)
    }

    initializeRealtimeData()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeHospitalId, hospitalLoading, selectedBranchId])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, appointments])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      setNotification({
        type: "success",
        message: "Appointments are automatically updated in real-time!",
      })
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

  const toggleAccordion = async (appointmentId: string) => {
    if (expandedAppointment === appointmentId) {
      setExpandedAppointment(null)
      setPatientHistory([])
      setShowHistory({})
      setShowAllDoctorsHistory((prev) => ({ ...prev, [appointmentId]: false }))
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
      setExpandedAppointment(appointmentId)

      const appointment = appointments.find((apt) => apt.id === appointmentId)
      if (appointment && appointment.patientId && activeHospitalId) {
        try {
          const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
          const patientAppointmentsQuery = query(
            appointmentsRef,
            where("patientId", "==", appointment.patientId),
            where("status", "==", "completed")
          )

          const snapshot = await getDocs(patientAppointmentsQuery)
          const history = snapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as AppointmentType))
            .filter((apt: AppointmentType) => apt.id !== appointmentId)
            .sort(
              (a: AppointmentType, b: AppointmentType) =>
                new Date(b.appointmentDate).getTime() -
                new Date(a.appointmentDate).getTime()
            )
          setPatientHistory(history)
          setHistorySearchFilters((prev) => ({
            ...prev,
            [appointmentId]: { text: "", date: "" },
          }))

          if (history.length > 0 && user) {
            fetchHistoryDocuments(
              history.map((h) => h.id),
              appointment.patientUid || appointment.patientId
            )
          }
        } catch (error) {
          console.error("Error fetching patient history:", error)
        }
      }
    }
  }

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
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      if (response.ok && data.documents) {
        const documentsByAppointment: { [appointmentId: string]: DocumentMetadata[] } = {}
        data.documents.forEach((docItem: DocumentMetadata) => {
          if (docItem.appointmentId && appointmentIds.includes(docItem.appointmentId)) {
            if (!documentsByAppointment[docItem.appointmentId]) {
              documentsByAppointment[docItem.appointmentId] = []
            }
            documentsByAppointment[docItem.appointmentId].push(docItem)
          }
        })
        setHistoryDocuments((prev) => ({ ...prev, ...documentsByAppointment }))
      }
    } catch (error) {
      console.error("Error fetching history documents:", error)
    }
  }

  const toggleAllDoctorsHistory = (appointmentId: string) => {
    setShowAllDoctorsHistory((prev) => ({
      ...prev,
      [appointmentId]: !(prev[appointmentId] || false),
    }))
  }

  const _handleHistorySearchChange = (
    appointmentId: string,
    field: "text" | "date",
    value: string
  ) => {
    setHistorySearchFilters((prev) => ({
      ...prev,
      [appointmentId]: {
        ...(prev[appointmentId] || { text: "", date: "" }),
        [field]: value,
      },
    }))
  }

  const _clearHistoryFilters = (appointmentId: string) => {
    setHistorySearchFilters((prev) => ({
      ...prev,
      [appointmentId]: { text: "", date: "" },
    }))
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

  const handleCompleteConsultationClick = (appointmentId: string) => {
    setShowConsultationModeModal({
      open: true,
      appointmentId: appointmentId,
    })
    
    // Auto-scroll to appointment details area to show the modal
    setTimeout(() => {
      if (appointmentDetailsRef.current) {
        appointmentDetailsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        })
      }
    }, 100)
  }

  const handleConsultationModeSelect = (
    mode: "normal" | "anatomy",
    anatomyType?: "ear" | "throat" | "dental"
  ) => {
    const appointmentId = showConsultationModeModal.appointmentId
    if (!appointmentId) return

    setShowConsultationModeModal({ open: false, appointmentId: null })

    setConsultationMode((prev) => ({
      ...prev,
      [appointmentId]: mode,
    }))

    if (mode === "anatomy" && anatomyType) {
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
            notesParts.push(`Examination Notes: ${anatomyData.notes}`)
          }
          initialNotes = notesParts.join("\n")

          sessionStorage.removeItem(anatomyDataKey)
        } catch (error) {}
      }

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

  const getAIDiagnosisSuggestion = async (appointment: AppointmentType) => {
    setLoadingAiDiagnosis({ ...loadingAiDiagnosis, [appointment.id]: true })

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

      const diagnosisText = data?.[0]?.generated_text || "Unable to generate diagnosis"

      setAiDiagnosis({ ...aiDiagnosis, [appointment.id]: diagnosisText })

      setNotification({ type: "success", message: "AI diagnosis suggestion generated!" })
    } catch (error: unknown) {
      const errorResponse = (error as { response?: { data?: unknown; status?: number } }).response

      let errorMessage = "Failed to get AI diagnosis"
      let _errorDetails: any = null

      if (errorResponse?.data) {
        if (typeof errorResponse.data === "object") {
          const data = errorResponse.data as { error?: string; details?: any }
          errorMessage = data.error || errorMessage
          _errorDetails = data.details
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
      setLoadingAiDiagnosis({ ...loadingAiDiagnosis, [appointment.id]: false })
    }
  }

  const handleGenerateAiPrescription = async (appointmentId: string, showNotification: boolean = true) => {
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

      const hasExistingPrescription = !!aiPrescription[appointmentId]?.medicine
      
      setAiPrescription((prev) => ({
        ...prev,
        [appointmentId]: {
          medicine: data.medicine || "",
          notes: data.notes || "",
        },
      }))
      setShowAiPrescriptionSuggestion((prev) => ({ ...prev, [appointmentId]: true }))
      
      // Only show notification if explicitly requested and it's a new generation
      if (showNotification && !hasExistingPrescription) {
        setNotification({ type: "success", message: "AI prescription generated!" })
      }
    } catch (error: unknown) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        (error as Error).message ||
        "Failed to generate AI prescription"
      setNotification({
        type: "error",
        message: `AI Prescription Error: ${errorMessage}`,
      })
    } finally {
      setLoadingAiPrescription((prev) => ({ ...prev, [appointmentId]: false }))
    }
  }

  const parseAiPrescription = parseAiPrescriptionUtil

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
      setShowAiPrescriptionSuggestion({
        ...showAiPrescriptionSuggestion,
        [appointmentId]: false,
      })
      setNotification({
        type: "success",
        message: "AI prescription accepted! You can still edit it.",
      })
    }
  }

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

  const mergeAnatomyData = (appointmentId: string): CompletionFormEntry | null => {
    const allData = anatomyViewerData[appointmentId]
    if (!allData) return null

    const dataEntries = Object.values(allData).filter(
      (d): d is AnatomyViewerData => d !== null
    )
    if (dataEntries.length === 0) return null

    const allMedicines: Array<{
      name: string
      dosage: string
      frequency: string
      duration: string
    }> = []
    const medicineNames = new Set<string>()

    dataEntries.forEach((data) => {
      data.medicines.forEach((med) => {
        const medName = med.name.trim().toLowerCase()
        if (medName && !medicineNames.has(medName)) {
          medicineNames.add(medName)
          allMedicines.push(med)
        }
      })
    })

    const allNotes: string[] = []
    dataEntries.forEach((data) => {
      if (data.notes && data.notes.trim()) {
        allNotes.push(`[${data.anatomyType.toUpperCase()}]: ${data.notes}`)
      }
      if (data.selectedPartInfo) {
        allNotes.push(
          `[${data.anatomyType.toUpperCase()}] Selected Part: ${data.selectedPartInfo.name}`
        )
      }
      if (data.selectedDisease) {
        allNotes.push(
          `[${data.anatomyType.toUpperCase()}] Diagnosis: ${data.selectedDisease.name}`
        )
        if (data.selectedDisease.description) {
          allNotes.push(
            `[${data.anatomyType.toUpperCase()}] Description: ${data.selectedDisease.description}`
          )
        }
        if (
          data.selectedDisease.prescriptions &&
          data.selectedDisease.prescriptions.length > 0
        ) {
          allNotes.push(
            `[${data.anatomyType.toUpperCase()}] Prescriptions: ${data.selectedDisease.prescriptions.join(
              "; "
            )}`
          )
        }
      }
    })

    const allDiagnoses = new Set<string>()
    const customDiagnoses: string[] = []

    dataEntries.forEach((data) => {
      data.diagnoses.forEach((diag) => {
        if (diag && diag.trim()) {
          allDiagnoses.add(diag.trim())
        }
      })
      if (data.customDiagnosis && data.customDiagnosis.trim()) {
        customDiagnoses.push(
          `[${data.anatomyType.toUpperCase()}]: ${data.customDiagnosis.trim()}`
        )
      }
    })

    const finalDiagnoses = Array.from(allDiagnoses)
    if (customDiagnoses.length > 0) {
      finalDiagnoses.push(CUSTOM_DIAGNOSIS_OPTION)
    }

    return {
      medicines: allMedicines,
      notes: allNotes.join("\n\n"),
      recheckupRequired: false,
      finalDiagnosis: finalDiagnoses,
      customDiagnosis:
        customDiagnoses.length > 0 ? customDiagnoses.join("; ") : undefined,
    }
  }

  const handleCombinedAnatomyCompletion = async (appointmentId: string) => {
    const mergedData = mergeAnatomyData(appointmentId)
    if (!mergedData) {
      setNotification({
        type: "error",
        message: "No anatomy data found. Please complete at least one anatomy checkup.",
      })
      return
    }

    if (mergedData.medicines.length === 0) {
      setNotification({
        type: "error",
        message: "Please add at least one medicine before completing the checkup.",
      })
      return
    }

    if (!mergedData.finalDiagnosis || mergedData.finalDiagnosis.length === 0) {
      setNotification({
        type: "error",
        message: "Please select at least one diagnosis before completing the consultation.",
      })
      return
    }

    setShowCombinedCompletionModal((prev) => ({
      ...prev,
      [appointmentId]: false,
    }))

    await runCompletionFlow(appointmentId, mergedData, { showToast: true })

    setAnatomyViewerData((prev) => {
      const updated = { ...prev }
      delete updated[appointmentId]
      return updated
    })
    setSelectedAnatomyTypes((prev) => {
      const updated = { ...prev }
      delete updated[appointmentId]
      return updated
    })
    setConsultationMode((prev) => {
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
        message: "Hospital context is not available. Please refresh the page.",
      })
      return
    }

    if (!formData.finalDiagnosis || formData.finalDiagnosis.length === 0) {
      setNotification({
        type: "error",
        message: "Please select at least one diagnosis before completing the consultation.",
      })
      return
    }

    const appointmentSnapshot = appointments.find((apt) => apt.id === appointmentId)
    const medicineText = formatMedicinesAsText(formData.medicines, formData.notes || "")

    const diagnoses = formData.finalDiagnosis.filter(
      (d) => d !== CUSTOM_DIAGNOSIS_OPTION
    )

    const result = await completeAppointment(
      appointmentId,
      medicineText,
      formData.notes || "", // Ensure notes is never undefined
      activeHospitalId,
      diagnoses,
      formData.customDiagnosis || "",
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
      } catch (error) {
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
            Authorization: `Bearer ${token}`,
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
    } catch (suggestionError) {}

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

  const handleCompleteAppointment = async (
    e: React.FormEvent,
    appointmentId: string
  ) => {
    e.preventDefault()

    if (!appointmentId) return

    const appointment = appointments.find((apt) => apt.id === appointmentId)

    const currentData: CompletionFormEntry = completionData[appointmentId] || {
      medicines: [],
      notes: "",
      recheckupRequired: false,
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

    if (!currentData.finalDiagnosis || currentData.finalDiagnosis.length === 0) {
      setNotification({
        type: "error",
        message: "Please select at least one diagnosis before completing the consultation.",
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
    } finally {
      setAdmitting((prev) => ({ ...prev, [appointmentId]: false }))
    }
  }

  const isToday = isTodayUtil
  const isTomorrow = isTomorrowUtil
  const isThisWeek = isThisWeekUtil
  const isNextWeek = isNextWeekUtil
  const sortByDateTime = sortByDateTimeUtil
  const sortByDateTimeDesc = sortByDateTimeDescUtil

  const confirmedAppointments = appointments.filter(
    (apt) => apt.status === "confirmed"
  )
  const historyAppointments = appointments.filter(
    (apt) => apt.status === "completed"
  )

  const todayAppointments = confirmedAppointments.filter((apt) =>
    isToday(apt.appointmentDate)
  )
  const tomorrowAppointments = confirmedAppointments.filter((apt) =>
    isTomorrow(apt.appointmentDate)
  )
  const thisWeekAppointments = confirmedAppointments.filter((apt) =>
    isThisWeek(apt.appointmentDate)
  )
  const nextWeekAppointments = confirmedAppointments.filter((apt) =>
    isNextWeek(apt.appointmentDate)
  )

  const filteredHistoryAppointments = useMemo(() => {
    const normalizedQuery = historyTabFilters.text.trim().toLowerCase()
    return historyAppointments.filter((apt) => {
      const matchesText = normalizedQuery
        ? [
            apt.patientName,
            apt.patientId,
            apt.id,
            apt.chiefComplaint,
            apt.associatedSymptoms,
            apt.medicalHistory,
            apt.doctorNotes,
          ].some((field) => (field || "").toLowerCase().includes(normalizedQuery))
        : true

      const matchesDate = historyTabFilters.date
        ? new Date(apt.appointmentDate).toISOString().split("T")[0] ===
          historyTabFilters.date
        : true

      return matchesText && matchesDate
    })
  }, [historyAppointments, historyTabFilters])

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredHistoryAppointments.length / historyPageSize)
  )

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
    } else {
      setAppointmentsPage(1)
    }
  }, [historyTabFilters, historyPageSize, activeTab])

  useEffect(() => {
    appointments.forEach((apt) => {
      const isFormOpen = showCompletionForm[apt.id]
      const hasSuggestion = !!aiPrescription[apt.id]?.medicine
      const isLoading = !!loadingAiPrescription[apt.id]
      const explicitlyHidden = showAiPrescriptionSuggestion[apt.id] === false
      const isAnatomyMode = consultationMode[apt.id] === "anatomy"

      if (isFormOpen && !hasSuggestion && !isLoading && !explicitlyHidden) {
        setShowAiPrescriptionSuggestion((prev) => ({ ...prev, [apt.id]: true }))
        // Don't show notification when anatomy mode is active
        handleGenerateAiPrescription(apt.id, !isAnatomyMode)
      }
    })
  }, [
    appointments,
    showCompletionForm,
    aiPrescription,
    loadingAiPrescription,
    showAiPrescriptionSuggestion,
    consultationMode,
  ])

  // Get all appointments for non-history tabs (before pagination)
  const allNonHistoryAppointments = useMemo(() => {
    switch (activeTab) {
      case "today":
        return [...todayAppointments].sort(sortByDateTime)
      case "tomorrow":
        return [...tomorrowAppointments].sort(sortByDateTime)
      case "thisWeek":
        return [...thisWeekAppointments].sort(sortByDateTime)
      case "nextWeek":
        return [...nextWeekAppointments].sort(sortByDateTime)
      default:
        return []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, todayAppointments, tomorrowAppointments, thisWeekAppointments, nextWeekAppointments])

  // Pagination for non-history tabs
  const totalAppointmentsPages = useMemo(() => {
    if (activeTab === "history") return 1
    return Math.max(1, Math.ceil(allNonHistoryAppointments.length / appointmentsPageSize))
  }, [allNonHistoryAppointments.length, appointmentsPageSize, activeTab])

  const paginatedAppointments = useMemo(() => {
    if (activeTab === "history") {
      return paginatedHistoryAppointments
    }
    const startIndex = (appointmentsPage - 1) * appointmentsPageSize
    return allNonHistoryAppointments.slice(startIndex, startIndex + appointmentsPageSize)
  }, [activeTab, allNonHistoryAppointments, appointmentsPage, appointmentsPageSize, paginatedHistoryAppointments])

  const displayedAppointments = paginatedAppointments

  // Reset page if it exceeds total pages (must be after totalAppointmentsPages is defined)
  useEffect(() => {
    if (appointmentsPage > totalAppointmentsPages && activeTab !== "history") {
      setAppointmentsPage(totalAppointmentsPages)
    }
  }, [appointmentsPage, totalAppointmentsPages, activeTab])

  if (loading) {
    return <LoadingSpinner message="Loading appointments..." />
  }

  if (!user || !userData) {
    return null
  }

  const selectedAppointment =
    expandedAppointment
      ? displayedAppointments.find((apt) => apt.id === expandedAppointment) || null
      : null

  const tabItems: { key: TabKey; label: string; count: number }[] = [
    { key: "today", label: "Today", count: todayAppointments.length },
    { key: "tomorrow", label: "Tomorrow", count: tomorrowAppointments.length },
    { key: "thisWeek", label: "This Week", count: thisWeekAppointments.length },
    { key: "nextWeek", label: "Next Week", count: nextWeekAppointments.length },
    { key: "history", label: "History", count: historyAppointments.length },
  ]

  const stats = [
    { label: "Today", value: todayAppointments.length },
    { label: "Tomorrow", value: tomorrowAppointments.length },
    { label: "This Week", value: thisWeekAppointments.length },
    { label: "History", value: historyAppointments.length },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-white pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-fade-in">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-95" />
          <div className="relative">
            <PageHeader
              onGenerateReport={() => setShowReportModal(true)}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
            <StatsBar stats={stats} />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mt-4 overflow-hidden">
          <FilterBar
            activeTab={activeTab}
            tabs={tabItems}
            onTabChange={setActiveTab}
            branches={branches}
            selectedBranchId={selectedBranchId}
            onBranchChange={setSelectedBranchId}
            loadingBranches={loadingBranches}
          />
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
          <main className="px-4 sm:px-6 lg:px-8 py-6">
        {displayedAppointments.length === 0 ? (
          <EmptyState activeTab={activeTab} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px,minmax(0,1fr)] gap-4 lg:gap-6">
            {/* Left: list */}
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <AppointmentsListPane
                  appointments={displayedAppointments}
                  selectedId={selectedAppointment ? selectedAppointment.id : null}
                  onSelect={(id) => toggleAccordion(id)}
                />
              </div>
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

            <div 
              ref={appointmentDetailsRef}
              className="h-full rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-blue-50/20 to-indigo-50/10 shadow-lg overflow-hidden flex flex-col animate-fade-in"
            >
              {selectedAppointment ? (
                <>
                  <PatientSummaryBar appointment={selectedAppointment} />
                  <div className="flex-1 px-4 py-4 space-y-4 animate-fade-in">
                    {/* Dashboard grid */}
                    <div
                      className={`grid grid-cols-1 ${
                        activeTab === "history" ? "" : "lg:grid-cols-2"
                      } gap-4`}
                    >
                      <PatientInfoSection appointment={selectedAppointment} />
                      {activeTab !== "history" && (
                        <AppointmentActionsCard
                          appointment={selectedAppointment}
                          updating={!!updating[selectedAppointment.id]}
                          onStartConsultation={() =>
                            handleCompleteConsultationClick(selectedAppointment.id)
                          }
                          onOpenDocuments={() =>
                            setDocumentsModal({ open: true, appointment: selectedAppointment })
                          }
                          consultationStarted={
                            !!consultationMode[selectedAppointment.id] ||
                            !!showCompletionForm[selectedAppointment.id]
                          }
                        />
                      )}
                    </div>

                    {/* Deep details card */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 shadow-md transition-all duration-300 hover:shadow-lg animate-fade-in card-hover">
                      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 px-4 py-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">
                          {activeTab === "history"
                            ? "Previous checkup details"
                            : "Clinical details"}
                        </span>
                        {activeTab === "history" ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadVisitPdf(selectedAppointment)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transform transition-all duration-300 hover:scale-105 active:scale-95"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4"
                              />
                            </svg>
                            Download PDF
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            Focused view · open sections as needed
                          </span>
                        )}
                      </div>
                      <div className="p-4 space-y-4">
                        {activeTab === "history" ? (
                          <>
                            <div className="space-y-3 text-xs text-slate-800">
                              {selectedAppointment.chiefComplaint && (
                                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Chief complaint
                                  </p>
                                  <p className="mt-1 whitespace-pre-line">
                                    {selectedAppointment.chiefComplaint}
                                  </p>
                                </div>
                              )}

                              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Final diagnosis
                                </p>
                                {Array.isArray((selectedAppointment as any).finalDiagnosis) &&
                                (selectedAppointment as any).finalDiagnosis.length > 0 ? (
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    {(selectedAppointment as any).finalDiagnosis.map(
                                      (diag: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100"
                                        >
                                          {diag}
                                        </span>
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <p className="mt-1 text-slate-400 italic">
                                    No diagnosis recorded.
                                  </p>
                                )}
                              </div>

                              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Prescription
                                </p>
                                {selectedAppointment.medicine ? (
                                  (() => {
                                    const parsed = parsePrescriptionUtil(
                                      selectedAppointment.medicine!
                                    )
                                    if (parsed && parsed.medicines.length > 0) {
                                      return (
                                        <ul className="mt-1 space-y-0.5">
                                          {parsed.medicines.map((med, index) => (
                                            <li
                                              key={index}
                                              className="flex items-center gap-2 text-slate-800"
                                            >
                                              <span className="text-base">{med.emoji}</span>
                                              <span className="truncate">
                                                {med.name}
                                                {med.dosage && (
                                                  <span className="ml-1 text-slate-500 text-[11px]">
                                                    ({med.dosage})
                                                  </span>
                                                )}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      )
                                    }
                                    return (
                                      <p className="mt-1 whitespace-pre-line">
                                        {selectedAppointment.medicine}
                                      </p>
                                    )
                                  })()
                                ) : (
                                  <p className="mt-1 text-slate-400 italic">
                                    No prescription recorded.
                                  </p>
                                )}
                              </div>

                              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Doctor&apos;s notes
                                </p>
                                {selectedAppointment.doctorNotes ? (
                                  <p className="mt-1 whitespace-pre-line">
                                    {selectedAppointment.doctorNotes}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-slate-400 italic">
                                    No notes recorded.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-900">
                                  Documents &amp; reports
                                </span>
                              </div>
                              <div className="px-3 py-3">
                                <AppointmentDocuments
                                  appointmentId={selectedAppointment.id}
                                  patientId={selectedAppointment.patientId}
                                  patientUid={
                                    selectedAppointment.patientUid ||
                                    selectedAppointment.patientId ||
                                    ""
                                  }
                                  appointmentSpecialty={selectedAppointment.doctorSpecialization}
                                  appointmentStatus={selectedAppointment.status}
                                  canUpload={false}
                                  canEdit={false}
                                  canDelete={false}
                                  onlyCurrentAppointment={true}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Last visit + medical information side by side */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <ClinicalSummaryCard
                                appointment={selectedAppointment}
                                latestRecommendation={getLatestCheckupRecommendation(
                                  selectedAppointment
                                )}
                                onClick={() => {
                                  const recommendation = getLatestCheckupRecommendation(selectedAppointment)
                                  if (recommendation) {
                                    setLastVisitModal({
                                      open: true,
                                      appointment: selectedAppointment,
                                      recommendation,
                                    })
                                  }
                                }}
                              />
                              <div className="space-y-3">
                                <MedicalInfoSection appointment={selectedAppointment} />
                                <LifestyleSection appointment={selectedAppointment} />
                              </div>
                            </div>

                            {/* AI diagnosis */}
                            {!aiDiagnosis[selectedAppointment.id] &&
                              selectedAppointment.status === "confirmed" && (
                                <div className="bg-gradient-to-br from-indigo-50 via-purple-50/50 to-pink-50/30 rounded-lg p-4 border border-indigo-200 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-300 animate-fade-in card-hover">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white flex-shrink-0">
                                        <svg
                                          className="w-4 h-4"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                          />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-gray-900 text-sm truncate">
                                          AI Diagnostic Assistant
                                        </h4>
                                        <p className="text-xs text-gray-600 truncate">
                                          Groq Llama 3.3 70B
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        getAIDiagnosisSuggestion(selectedAppointment)
                                      }
                                      disabled={
                                        loadingAiDiagnosis[selectedAppointment.id] || false
                                      }
                                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                                    >
                                      {loadingAiDiagnosis[selectedAppointment.id] ? (
                                        <>
                                          <svg
                                            className="animate-spin h-4 w-4"
                                            viewBox="0 0 24 24"
                                          >
                                            <circle
                                              className="opacity-25"
                                              cx="12"
                                              cy="12"
                                              r="10"
                                              stroke="currentColor"
                                              strokeWidth="4"
                                              fill="none"
                                            />
                                            <path
                                              className="opacity-75"
                                              fill="currentColor"
                                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                          </svg>
                                          Analyzing...
                                        </>
                                      ) : (
                                        <>
                                          <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                            />
                                          </svg>
                                          Get suggestion
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                            {aiDiagnosis[selectedAppointment.id] && (
                              <AIDiagnosisSuggestion
                                appointment={selectedAppointment}
                                aiDiagnosisText={aiDiagnosis[selectedAppointment.id]}
                                isLoading={
                                  loadingAiDiagnosis[selectedAppointment.id] || false
                                }
                                showCompletionForm={
                                  showCompletionForm[selectedAppointment.id] || false
                                }
                                updating={updating[selectedAppointment.id] || false}
                                onClose={() => {
                                  const newDiagnosis = { ...aiDiagnosis }
                                  delete newDiagnosis[selectedAppointment.id]
                                  setAiDiagnosis(newDiagnosis)
                                }}
                                onRegenerate={() =>
                                  getAIDiagnosisSuggestion(selectedAppointment)
                                }
                                onCompleteConsultation={() =>
                                  handleCompleteConsultationClick(selectedAppointment.id)
                                }
                              />
                            )}

                            {/* History timeline */}
                            {patientHistory.length > 0 && (
                              <PatientHistorySection
                                appointment={selectedAppointment}
                                patientHistory={patientHistory}
                                historyDocuments={historyDocuments}
                                historyFilters={
                                  historySearchFilters[selectedAppointment.id] || {
                                    text: "",
                                    date: "",
                                  }
                                }
                                showHistory={showHistory[selectedAppointment.id] || false}
                                onToggleHistory={() =>
                                  setShowHistory((prev) => ({
                                    ...prev,
                                    [selectedAppointment.id]:
                                      !prev[selectedAppointment.id],
                                  }))
                                }
                                onDocumentClick={(doc) => setSelectedHistoryDocument(doc)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Consultation form (focused mode) */}
                    {activeTab !== "history" &&
                      showCompletionForm[selectedAppointment.id] &&
                      selectedAppointment.status === "confirmed" && (
                        <div 
                          ref={completionFormRef}
                          className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/30 shadow-lg transition-all duration-300 hover:shadow-xl animate-fade-in card-hover"
                        >
                          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          {consultationMode[selectedAppointment.id] === "anatomy" ? (
                            <>
                              <svg
                                className="w-4 h-4 text-purple-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                />
                              </svg>
                              3D Anatomy Viewer
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4 text-blue-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              Consultation form
                            </>
                          )}
                        </h4>
                        <button
                          onClick={() => {
                            toggleCompletionForm(selectedAppointment.id)
                            setConsultationMode((prev) => ({
                              ...prev,
                              [selectedAppointment.id]: null,
                            }))
                          }}
                          className="rounded p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        >
                          <svg
                            className="w-4 h-4"
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

                      {consultationMode[selectedAppointment.id] === "anatomy" ? (
                        <div className="space-y-6 p-6">
                          {selectedAnatomyTypes[selectedAppointment.id]?.map(
                            (anatomyType, index) => (
                              <div
                                key={`${anatomyType}-${index}`}
                                className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50"
                              >
                                <div className="flex items-center justify-between mb-4">
                                  <h3 className="text-lg font-bold text-purple-900 capitalize">
                                    {anatomyType} Anatomy
                                  </h3>
                                  {selectedAnatomyTypes[selectedAppointment.id] &&
                                    selectedAnatomyTypes[selectedAppointment.id]
                                      .length > 1 && (
                                      <button
                                        onClick={() => {
                                          setSelectedAnatomyTypes((prev) => {
                                            const current =
                                              prev[selectedAppointment.id] || []
                                            return {
                                              ...prev,
                                              [selectedAppointment.id]:
                                                current.filter(
                                                  (_: any, i: number) =>
                                                    i !== index
                                                ),
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
                                  appointmentId={selectedAppointment.id}
                                  patientName={
                                    selectedAppointment.patientName || "Patient"
                                  }
                                  anatomyType={anatomyType}
                                  onDataChange={(data) => {
                                    setAnatomyViewerData((prev) => {
                                      const currentData =
                                        prev[selectedAppointment.id]?.[
                                          anatomyType
                                        ]
                                      if (
                                        JSON.stringify(currentData) ===
                                        JSON.stringify(data)
                                      ) {
                                        return prev
                                      }
                                      return {
                                        ...prev,
                                        [selectedAppointment.id]: {
                                          ...(prev[selectedAppointment.id] || {}),
                                          [anatomyType]: data,
                                        },
                                      }
                                    })
                                  }}
                                  onComplete={() => {
                                    setShowCombinedCompletionModal((prev) => ({
                                      ...prev,
                                      [selectedAppointment.id]: true,
                                    }))
                                  }}
                                />
                              </div>
                            )
                          )}

                          <button
                            onClick={() =>
                              handleAddAnotherAnatomy(selectedAppointment.id)
                            }
                            className="w-full p-4 border-2 border-dashed border-purple-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all text-center text-purple-700 font-medium"
                          >
                            + Add another anatomy
                          </button>

                          <CombinedCompletionModal
                            appointment={selectedAppointment}
                            isOpen={
                              showCombinedCompletionModal[
                                selectedAppointment.id
                              ] || false
                            }
                            anatomyViewerData={
                              anatomyViewerData[selectedAppointment.id] || {}
                            }
                            mergedData={mergeAnatomyData(selectedAppointment.id)}
                            onClose={() =>
                              setShowCombinedCompletionModal((prev) => ({
                                ...prev,
                                [selectedAppointment.id]: false,
                              }))
                            }
                            onConfirm={() =>
                              handleCombinedAnatomyCompletion(
                                selectedAppointment.id
                              )
                            }
                          />
                        </div>
                      ) : (
                        <CompletionForm
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
                          removedAiMedicines={
                            removedAiMedicines[selectedAppointment.id] || []
                          }
                          showDocumentUpload={
                            showDocumentUpload[selectedAppointment.id] || false
                          }
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
                        />
                      )}
                        </div>
                      )}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-500 animate-fade-in">
                  <div className="text-center px-4">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shadow-md transform transition-all duration-300 hover:scale-110">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <p className="font-medium text-slate-600">Select an appointment from the left to view details.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
        </div>
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
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Documents &amp; Reports
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {documentsModal.appointment.patientName} ·{" "}
                  {new Date(
                    documentsModal.appointment.appointmentDate
                  ).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  at {documentsModal.appointment.appointmentTime}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDocumentsModal({ open: false, appointment: null })}
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Close documents and reports"
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
            <div className="flex-1 px-6 py-4">
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
        />
      )}
      {lastVisitModal.open && lastVisitModal.appointment && lastVisitModal.recommendation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50/50">
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
                        className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-100"
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
    </div>
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