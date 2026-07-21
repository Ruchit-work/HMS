"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { onSnapshot } from "firebase/firestore"
import { Appointment } from "@/types/patient"
import { SYMPTOM_CATEGORIES } from "@/features/patient/SymptomSelector"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"
import { useDoctors } from "@/shared/hooks/useDoctors"
import { Button, ConfirmDialog } from '@/shared/components'
import { authedFetchJson } from "@/shared/utils/authedFetch"
import { DataTable, StatusPill, AvatarCell } from '@/shared/components'
import type { DTColumn, DTRowAction } from '@/shared/components'

interface WhatsAppBookingsPanelProps {
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
  onPendingCountChange?: (_count: number) => void
  receptionistBranchId?: string | null
  /** When false, pause appointments listener and doctor fetch (keep-alive tab). Default true. */
  isActive?: boolean
}

export default function WhatsAppBookingsPanel({
  onNotification,
  onPendingCountChange,
  receptionistBranchId,
  isActive = true,
}: WhatsAppBookingsPanelProps) {
  const { activeHospitalId } = useMultiHospital()
  const [bookings, setBookings] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Appointment | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const { doctors, loading: doctorsLoading } = useDoctors(activeHospitalId, {
    activeOnly: true,
    realtime: false,
    enabled: Boolean(isActive && activeHospitalId),
  })
  const [updateLoading, setUpdateLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null)

  // Form state
  const [formDoctorId, setFormDoctorId] = useState("")
  const [formPatientName, setFormPatientName] = useState("")
  const [formPatientPhone, setFormPatientPhone] = useState("")
  const [formPatientEmail, setFormPatientEmail] = useState("")
  const [formAppointmentDate, setFormAppointmentDate] = useState("")
  const [formAppointmentTime, setFormAppointmentTime] = useState("")
  const [formChiefComplaint, setFormChiefComplaint] = useState("")
  const [formMedicalHistory, setFormMedicalHistory] = useState("")
  const [chiefComplaintSuggestions, setChiefComplaintSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Common chief complaint suggestions
  const commonComplaints = [
    "Fever",
    "Cough",
    "Headache",
    "Body pain",
    "Chest pain",
    "Stomach pain",
    "Back pain",
    "Joint pain",
    "Breathing difficulty",
    "Nausea",
    "Vomiting",
    "Diarrhea",
    "Constipation",
    "Dizziness",
    "Weakness",
    "High blood pressure",
    "Diabetes checkup",
    "Thyroid problem",
    "Skin rash",
    "Eye problem",
    "Ear pain",
    "Throat pain",
    "Cold",
    "General checkup",
    "Follow-up",
    "Routine consultation",
  ]
  const [formPaymentMethod, setFormPaymentMethod] = useState<"card" | "upi" | "cash">("cash")
  /** When true, confirmation marks appointment + billing as paid (same as receptionist book). */
  const [formCollectPayment, setFormCollectPayment] = useState(true)

  const notify = useCallback(
    (payload: { type: "success" | "error"; message: string } | null) => {
      onNotification?.(payload)
    },
    [onNotification]
  )

  const setupRealtimeListener = useCallback(() => {
    if (!isActive || !activeHospitalId) {
      if (!isActive) {
        setLoading(false)
        return () => {}
      }
      setBookings([])
      onPendingCountChange?.(0)
      return () => {}
    }

    try {
      setLoading(true)
      setError(null)

      // Debug: Log receptionist branch ID
      // Set up real-time listener for WhatsApp pending appointments in the active hospital
      const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
      
      // Fetch all appointments and filter in memory to catch both whatsappPending field and status field
      // This ensures we don't miss any WhatsApp bookings
      const unsubscribe = onSnapshot(
        appointmentsRef,
        (snapshot) => {
          let bookingsList = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Appointment[]
          // Filter for WhatsApp pending appointments (check both whatsappPending field and status)
          bookingsList = bookingsList.filter((apt) => {
            const data = apt as any
            const isWhatsAppPending = data.whatsappPending === true || data.status === "whatsapp_pending"
            return isWhatsAppPending
          })
          // Log each appointment's branchId for debugging
         // At this point, bookingsList contains all pending WhatsApp bookings for this hospital.

          // Filter by branch - STRICT filtering
          // Only show appointments that match the receptionist's branch OR have no branch assigned
          if (receptionistBranchId) {
            const receptionistBranchIdStr = String(receptionistBranchId).trim().toLowerCase()
            
           bookingsList = bookingsList.filter((apt) => {
              const aptBranchId = (apt as any).branchId
              
              // If appointment has no branch assigned (null, undefined, or empty string), show to all receptionists
              // BUT we should NOT show appointments with no branch to receptionists who have a branch assigned
              // Only show unassigned appointments to receptionists who can assign them
              const hasNoBranch = !aptBranchId || aptBranchId === null || aptBranchId === undefined || String(aptBranchId).trim() === ""
              
             if (hasNoBranch) {
               // Do NOT show unassigned appointments to branch-specific receptionists
               // They should only see appointments for their branch
               return false
             }
              
              // Convert both to strings, trim, and compare case-insensitively
              const aptBranchIdStr = String(aptBranchId).trim().toLowerCase()
              
              // If appointment has a branch, ONLY show to that branch's receptionist
              // Must match exactly (case-insensitive)
             return aptBranchIdStr === receptionistBranchIdStr
            })
          } else {
            // If receptionist has no branchId, ONLY show appointments with no branchId
            // Do NOT show branch-specific appointments
            bookingsList = bookingsList.filter((apt) => {
              const aptBranchId = (apt as any).branchId
              const hasNoBranch = !aptBranchId || aptBranchId === null || aptBranchId === undefined || String(aptBranchId).trim() === ""
              return hasNoBranch
            })
          }

          setBookings(bookingsList)
          onPendingCountChange?.(bookingsList.length)
          setLoading(false)
        },
        (error) => {
          setError(error.message)
          setBookings([])
          onPendingCountChange?.(0)
          setLoading(false)
        }
      )

      return unsubscribe
    } catch (error: any) {
      setError(error?.message || "Failed to set up real-time updates")
      setBookings([])
      onPendingCountChange?.(0)
      setLoading(false)
      return () => {}
    }
  }, [activeHospitalId, onPendingCountChange, receptionistBranchId, isActive])

  useEffect(() => {
    const unsubscribeBookings = setupRealtimeListener()
    return () => {
      unsubscribeBookings()
    }
  }, [setupRealtimeListener])

  const handleOpenEditModal = useCallback((booking: Appointment) => {
    setSelectedBooking(booking)
    setFormDoctorId(booking.doctorId || "")
    setFormPatientName(booking.patientName || "")
    setFormPatientPhone(booking.patientPhone || "")
    setFormPatientEmail(booking.patientEmail || "")
    setFormAppointmentDate(booking.appointmentDate || "")
    setFormAppointmentTime(booking.appointmentTime || "")
    setFormChiefComplaint(booking.chiefComplaint || "")
    setFormMedicalHistory(booking.medicalHistory || "")
    setFormPaymentMethod((booking.paymentMethod as "card" | "upi" | "cash") || "cash")
    setFormCollectPayment(true)
    setEditModalOpen(true)
  }, [])

  const handleCloseEditModal = useCallback(() => {
    setEditModalOpen(false)
    setSelectedBooking(null)
  }, [])

  const allowPatientInfoEdit = useMemo(() => {
    if (!selectedBooking) return false
    const name = (selectedBooking.patientName || "").trim().toLowerCase()
    const email = (selectedBooking.patientEmail || "").trim()
    const phone = (selectedBooking.patientPhone || "").trim()
    return (
      !email ||
      !phone ||
      name.length === 0 ||
      name === "unknown" ||
      name.includes("whatsapp patient")
    )
  }, [selectedBooking])

  const selectedDoctor = useMemo(() => {
    if (!formDoctorId) return null
    return doctors.find((d) => d.id === formDoctorId) || null
  }, [doctors, formDoctorId])

  // Match chief complaint to symptom category for doctor recommendations
  const matchedSymptomCategory = useMemo(() => {
    if (!formChiefComplaint || formChiefComplaint.trim().length < 2) return null
    
    const complaint = formChiefComplaint.toLowerCase().trim()
    
    // Check each symptom category to find matches
    for (const category of SYMPTOM_CATEGORIES) {
      const categoryKeywords = category.label.toLowerCase()
      // Check if complaint contains category keywords or vice versa
      if (complaint.includes(categoryKeywords.split(' ')[0]) || 
          categoryKeywords.includes(complaint.split(' ')[0])) {
        return category
      }
      
      // Check keywords that might match
      const keywordMatches: Record<string, string> = {
        'fever': 'monsoon_diseases',
        'cough': 'respiratory_asthma',
        'breathing': 'respiratory_asthma',
        'chest': 'cardiac_issues',
        'heart': 'cardiac_issues',
        'stomach': 'gastrointestinal',
        'pain': 'joint_arthritis',
        'joint': 'joint_arthritis',
        'diabetes': 'diabetes_complications',
        'thyroid': 'thyroid_problems',
        'skin': 'skin_allergies',
        'rash': 'skin_allergies',
        'eye': 'eye_problems',
        'kidney': 'kidney_uti',
        'uti': 'kidney_uti',
        'checkup': 'general_checkup',
        'routine': 'general_checkup',
        'cancer': 'cancer_oncology',
      }
      
      for (const [keyword, categoryId] of Object.entries(keywordMatches)) {
        if (complaint.includes(keyword) && category.id === categoryId) {
          return category
        }
      }
    }
    
    return null
  }, [formChiefComplaint])

  // Filter doctors based on matched symptom category
  const { recommendedDoctors, otherDoctors } = useMemo(() => {
    if (!matchedSymptomCategory || doctors.length === 0) {
      return { recommendedDoctors: [], otherDoctors: doctors }
    }

    const normalize = (str: string) => str.toLowerCase().replace(/[()\/]/g, " ").replace(/\s+/g, " ").trim()
    
    const specializationMappings: Record<string, string[]> = {
      "general physician": ["family medicine", "family physician", "family medicine specialist", "general practitioner", "gp", "general practice"],
      "gynecology": ["gynecologist", "obstetrician", "ob gyn", "obstetrician ob gyn", "gynecologist obstetrician", "women's health"],
      "psychology": ["psychologist"],
      "psychiatry": ["psychiatrist"],
      "gastroenterology": ["gastroenterologist"],
      "endocrinology": ["endocrinologist"],
      "cardiology": ["cardiologist"],
      "orthopedic surgery": ["orthopedic", "orthopedics", "orthopedic surgeon"],
      "dermatology": ["dermatologist"],
      "ophthalmology": ["ophthalmologist", "eye specialist"],
      "pulmonology": ["pulmonologist", "chest specialist", "respiratory"],
      "nephrology": ["nephrologist", "kidney specialist"],
      "urology": ["urologist"],
      "internal medicine": ["internal medicine", "internal medicine specialist"],
      "hematology": ["hematologist"],
      "rheumatology": ["rheumatologist"],
      "allergy specialist": ["allergy specialist", "allergist"],
      "pediatrics": ["pediatrician", "child specialist"],
      "geriatrics": ["geriatrician"],
      "oncology": ["oncologist", "medical oncologist", "surgical oncologist", "radiation oncologist", "cancer specialist"]
    }

    const recommended = doctors.filter(doc => {
      const docSpecialization = normalize(doc.specialization || "")
      if (!docSpecialization) return false

      return matchedSymptomCategory.relatedSpecializations.some(categorySpec => {
        const categorySpecLower = normalize(categorySpec)
        
        if (docSpecialization.includes(categorySpecLower) || categorySpecLower.includes(docSpecialization)) {
          return true
        }
        
        const variations = specializationMappings[categorySpecLower] || []
        for (const variation of variations) {
          const variationNormalized = normalize(variation)
          if (docSpecialization.includes(variationNormalized) || variationNormalized.includes(docSpecialization)) {
            return true
          }
          const docWords = docSpecialization.split(/\s+/)
          const varWords = variationNormalized.split(/\s+/)
          if (varWords.some(word => docWords.includes(word) && word.length > 3)) {
            return true
          }
        }
        
        return false
      })
    })

    const other = doctors.filter(doc => !recommended.some(rec => rec.id === doc.id))

    return { recommendedDoctors: recommended, otherDoctors: other }
  }, [matchedSymptomCategory, doctors])


  const handleUpdateBooking = async () => {
    if (!selectedBooking) return

    if (!formDoctorId) {
      notify({ type: "error", message: "Please select a doctor" })
      return
    }

    if (!formPatientName.trim()) {
      notify({ type: "error", message: "Patient name is required" })
      return
    }

    if (!formAppointmentDate || !formAppointmentTime) {
      notify({ type: "error", message: "Appointment date and time are required" })
      return
    }

    setUpdateLoading(true)
    try {
      const consultationFee = Number(selectedDoctor?.consultationFee || 0)
      const updateData: Record<string, unknown> = {
        doctorId: formDoctorId,
        patientName: formPatientName.trim(),
        patientPhone: formPatientPhone.trim(),
        patientEmail: formPatientEmail.trim(),
        appointmentDate: formAppointmentDate,
        appointmentTime: formAppointmentTime,
        chiefComplaint: formChiefComplaint.trim() || "General consultation",
        medicalHistory: formMedicalHistory.trim(),
        paymentMethod: formPaymentMethod,
        // Ensure API knows which hospital subcollection the appointment lives in
        hospitalId: (selectedBooking as any).hospitalId,
        markConfirmed: true,
        // Same payment sync as receptionist create-appointment when collected now
        collectPayment: formCollectPayment,
        paymentStatus: formCollectPayment ? "paid" : "pending",
        paymentType: "full",
      }

      if (formCollectPayment) {
        updateData.paymentAmount = consultationFee > 0 ? consultationFee : undefined
      } else {
        updateData.paymentAmount = 0
      }

      await authedFetchJson(
        `/api/receptionist/whatsapp-bookings/${selectedBooking.id}`,
        {
          method: "PUT",
          body: JSON.stringify(updateData),
        },
        "Failed to update booking"
      )

      notify({
        type: "success",
        message: formCollectPayment
          ? "Booking confirmed and payment recorded in billing."
          : "Booking confirmed. Payment left pending for billing.",
      })
      handleCloseEditModal()
      // Real-time listener will automatically update the list
    } catch (error: any) {
      notify({ type: "error", message: error?.message || "Failed to update booking" })
    } finally {
      setUpdateLoading(false)
    }
  }

  const handleDeleteBooking = useCallback(
    async (booking: Appointment) => {
      const previousBookings = [...bookings]
      const deletedBookingId = booking.id

      setBookings((prev) => prev.filter((b) => b.id !== deletedBookingId))
      setDeleteLoading(true)

      try {
        await authedFetchJson(
          `/api/receptionist/whatsapp-bookings/${deletedBookingId}`,
          {
            method: "DELETE",
            body: JSON.stringify({
              hospitalId: (booking as any).hospitalId,
            }),
          },
          "Failed to delete booking"
        )

        notify({ type: "success", message: "WhatsApp booking deleted successfully!" })
        setDeleteTarget(null)
      } catch (error: any) {
        setBookings(previousBookings)
        notify({ type: "error", message: error?.message || "Failed to delete booking" })
      } finally {
        setDeleteLoading(false)
      }
    },
    [bookings, notify]
  )

  const bookingColumns = useMemo(
    () =>
      [
        {
          key: "patient",
          header: "Patient",
          width: "w-[26%]",
          render: (booking: Appointment) => (
            <AvatarCell
              name={booking.patientName || "Unknown"}
              sub={booking.patientEmail || "No email"}
              color="cyan"
            />
          ),
        },
        {
          key: "datetime",
          header: "Date & Time",
          width: "w-[18%]",
          render: (booking: Appointment) => (
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {booking.appointmentDate
                  ? new Date(booking.appointmentDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </p>
              <p className="text-xs text-slate-400">{booking.appointmentTime || "—"}</p>
            </div>
          ),
        },
        {
          key: "phone",
          header: "Phone",
          width: "w-[15%]",
          hideBelow: "md" as const,
          render: (booking: Appointment) => (
            <span className="text-sm text-slate-700">{booking.patientPhone || "—"}</span>
          ),
        },
        {
          key: "fee",
          header: "Doctor Fee",
          width: "w-[12%]",
          hideBelow: "md" as const,
          render: (booking: Appointment) =>
            booking.doctorId && booking.totalConsultationFee ? (
              <span className="text-sm font-bold text-slate-900">
                ₹{booking.totalConsultationFee}
              </span>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            ),
        },
        {
          key: "status",
          header: "Status",
          width: "w-[10%]",
          render: () => <StatusPill label="Pending" variant="warning" />,
        },
      ] satisfies DTColumn<Appointment>[],
    []
  )

  const bookingPrimaryAction = useMemo(
    () => ({
      label: "Add Details",
      icon: (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: handleOpenEditModal,
    }),
    [handleOpenEditModal]
  )

  const bookingRowActions = useMemo(
    () =>
      [
        {
          label: "Delete booking",
          variant: "danger" as const,
          icon: (
            <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ),
          onClick: (booking) => setDeleteTarget(booking),
        },
      ] satisfies DTRowAction<Appointment>[],
    []
  )

  const pendingCount = bookings.length

  return (
    <div className="space-y-5">
      {/* ── Header + KPI Cards ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="rx-section-title">WhatsApp Bookings</p>
            <p className="rx-section-subtitle">Real-time bookings received through your WhatsApp channel</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 shrink-0">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Updates
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
          {/* Pending */}
          <div className="flex items-start gap-3 bg-white px-5 py-4 border-t-2 border-t-amber-400 transition-colors hover:bg-slate-50/60">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-amber-600">{pendingCount}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-500">Pending Bookings</p>
              <p className="text-[10px] text-slate-400">Awaiting doctor assignment</p>
            </div>
          </div>

          {/* Doctor assigned */}
          <div className="flex items-start gap-3 bg-white px-5 py-4 border-t-2 border-t-cyan-500 transition-colors hover:bg-slate-50/60">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50">
              <svg className="h-4 w-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-cyan-600">
                {bookings.filter((b) => b.doctorId).length}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-500">Doctor Assigned</p>
              <p className="text-[10px] text-slate-400">Ready to confirm</p>
            </div>
          </div>

          {/* Today */}
          <div className="hidden sm:flex items-start gap-3 bg-white px-5 py-4 border-t-2 border-t-slate-400 transition-colors hover:bg-slate-50/60">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <svg className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-slate-700">
                {bookings.filter((b) => b.appointmentDate === new Date().toISOString().split("T")[0]).length}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-500">Today's Bookings</p>
              <p className="text-[10px] text-slate-400">Scheduled for today</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bookings table via DataTable ── */}
      <DataTable<Appointment>
        data={bookings}
        loading={loading && bookings.length === 0}
        loadingMessage="Loading WhatsApp bookings…"
        error={error}
        emptyTitle="No pending WhatsApp bookings"
        emptyDescription="New bookings received through WhatsApp will appear here automatically."
        emptyIcon={
          <svg className="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        }
        columns={bookingColumns}
        primaryAction={bookingPrimaryAction}
        rowActions={bookingRowActions}
        minWidth="min-w-[580px]"
      />

      {/* ── Edit Modal ── */}
      {editModalOpen && selectedBooking && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={handleCloseEditModal} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Details &amp; Assign Doctor</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedBooking.patientName || "Patient"} · WhatsApp booking
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* ── Modal body with sections ── */}
              <div className="px-6 pb-2">

                {/* ── Section 1: Clinical Information ── */}
                <div className="rx-form-section">
                  <div className="rx-form-section-header">
                    <div className="rx-form-section-icon">
                      <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="rx-form-section-title">Clinical Information</p>
                      <p className="rx-form-section-desc">Describe why the patient is visiting — helps recommend the right doctor</p>
                    </div>
                  </div>
                  <div className="rx-form-field relative">
                    <label className="rx-form-label">Chief Complaint</label>
                    <textarea
                      value={formChiefComplaint}
                      onChange={(e) => {
                        const value = e.target.value
                        setFormChiefComplaint(value)
                        if (value.trim().length >= 1 && value.trim().length <= 2) {
                          const searchTerm = value.trim().toLowerCase()
                          const filtered = commonComplaints.filter(complaint =>
                            complaint.toLowerCase().startsWith(searchTerm)
                          )
                          setChiefComplaintSuggestions(filtered.slice(0, 5))
                          setShowSuggestions(filtered.length > 0)
                        } else {
                          setShowSuggestions(false)
                          setChiefComplaintSuggestions([])
                        }
                      }}
                      onFocus={(e) => {
                        const value = e.target.value
                        if (value.trim().length >= 1 && value.trim().length <= 2) {
                          const searchTerm = value.trim().toLowerCase()
                          const filtered = commonComplaints.filter(complaint =>
                            complaint.toLowerCase().startsWith(searchTerm)
                          )
                          setChiefComplaintSuggestions(filtered.slice(0, 5))
                          setShowSuggestions(filtered.length > 0)
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      rows={2}
                      className="rx-form-textarea"
                      placeholder="e.g. Fever, Chest pain, Follow-up checkup…"
                    />
                    {showSuggestions && chiefComplaintSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                        {chiefComplaintSuggestions.map((suggestion, index) => (
                          <button key={index} type="button"
                            onClick={() => { setFormChiefComplaint(suggestion); setShowSuggestions(false); setChiefComplaintSuggestions([]) }}
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 transition-colors">
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                    {matchedSymptomCategory ? (
                      <p className="rx-form-helper flex items-center gap-1 text-cyan-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Detected: {matchedSymptomCategory.label} — showing recommended doctors below
                      </p>
                    ) : (
                      <p className="rx-form-helper">Type 1–2 letters to see quick suggestions</p>
                    )}
                  </div>
                </div>

                {/* ── Section 2: Doctor Assignment ── */}
                <div className="rx-form-section">
                  <div className="rx-form-section-header">
                    <div className="rx-form-section-icon">
                      <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="rx-form-section-title">Doctor Assignment</p>
                      <p className="rx-form-section-desc">Assign a doctor before confirming the booking</p>
                    </div>
                  </div>
                  <div className="rx-form-field">
                    <label className="rx-form-label">
                      Attending Doctor <span className="rx-required">*</span>
                    </label>
                    <select value={formDoctorId}
                      onChange={(e) => setFormDoctorId(e.target.value)}
                      className="rx-form-select"
                      disabled={doctorsLoading}>
                      <option value="">Select a doctor…</option>
                      {recommendedDoctors.length > 0 && (
                        <optgroup label={`★ Recommended for complaint (${recommendedDoctors.length})`}>
                          {recommendedDoctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>
                              {doctor.firstName} {doctor.lastName} — {doctor.specialization}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherDoctors.length > 0 && (
                        <optgroup label={recommendedDoctors.length > 0 ? `Other doctors (${otherDoctors.length})` : `All doctors (${otherDoctors.length})`}>
                          {otherDoctors.map((doctor) => (
                            <option key={doctor.id} value={doctor.id}>
                              {doctor.firstName} {doctor.lastName} — {doctor.specialization}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {doctors.length === 0 && <option value="" disabled>No doctors available</option>}
                    </select>
                    {recommendedDoctors.length > 0 ? (
                      <p className="rx-form-helper flex items-center gap-1 text-cyan-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        {recommendedDoctors.length} doctor(s) recommended based on the complaint
                      </p>
                    ) : (
                      <p className="rx-form-helper">Enter a chief complaint above to see specialist recommendations</p>
                    )}
                  </div>
                </div>

                {/* ── Section 3: Patient Information ── */}
                <div className="rx-form-section">
                  <div className="rx-form-section-header">
                    <div className="rx-form-section-icon">
                      <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="rx-form-section-title">Patient Information</p>
                      <p className="rx-form-section-desc">
                        {allowPatientInfoEdit ? "Verify or update the patient's contact details" : "Patient details from existing records — read only"}
                      </p>
                    </div>
                  </div>
                  {!allowPatientInfoEdit && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <p className="text-[11px] text-slate-500">Existing patient — details locked to prevent accidental changes</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rx-form-field">
                      <label className="rx-form-label">
                        Patient Name <span className="rx-required">*</span>
                      </label>
                      <input type="text" value={formPatientName}
                        readOnly={!allowPatientInfoEdit}
                        onChange={(e) => { if (allowPatientInfoEdit) setFormPatientName(e.target.value) }}
                        className={`rx-form-input ${!allowPatientInfoEdit ? 'rx-form-input--readonly' : ''}`}
                      />
                    </div>
                    <div className="rx-form-field">
                      <label className="rx-form-label">Phone Number</label>
                      <input type="tel" value={formPatientPhone}
                        readOnly={!allowPatientInfoEdit}
                        onChange={(e) => { if (allowPatientInfoEdit) setFormPatientPhone(e.target.value) }}
                        className={`rx-form-input ${!allowPatientInfoEdit ? 'rx-form-input--readonly' : ''}`}
                        placeholder="Mobile number"
                      />
                    </div>
                    <div className="rx-form-field md:col-span-2">
                      <label className="rx-form-label">Email Address</label>
                      <input type="email" value={formPatientEmail}
                        readOnly={!allowPatientInfoEdit}
                        onChange={(e) => { if (allowPatientInfoEdit) setFormPatientEmail(e.target.value) }}
                        className={`rx-form-input ${!allowPatientInfoEdit ? 'rx-form-input--readonly' : ''}`}
                        placeholder="patient@example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Section 4: Appointment Schedule ── */}
                <div className="rx-form-section">
                  <div className="rx-form-section-header">
                    <div className="rx-form-section-icon">
                      <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="rx-form-section-title">Appointment Schedule</p>
                      <p className="rx-form-section-desc">When should this appointment be booked?</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rx-form-field">
                      <label className="rx-form-label">
                        Date <span className="rx-required">*</span>
                      </label>
                      <input type="date" value={formAppointmentDate}
                        onChange={(e) => setFormAppointmentDate(e.target.value)}
                        className="rx-form-input"
                      />
                      <p className="rx-form-helper">Select the consultation date</p>
                    </div>
                    <div className="rx-form-field">
                      <label className="rx-form-label">
                        Time <span className="rx-required">*</span>
                      </label>
                      <input type="time" value={formAppointmentTime}
                        onChange={(e) => setFormAppointmentTime(e.target.value)}
                        className="rx-form-input"
                      />
                      <p className="rx-form-helper">Preferred appointment time</p>
                    </div>
                  </div>
                </div>

                {/* ── Section 5: Medical Notes & Billing ── */}
                <div className="rx-form-section">
                  <div className="rx-form-section-header">
                    <div className="rx-form-section-icon">
                      <svg className="h-3.5 w-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="rx-form-section-title">Medical Notes &amp; Billing</p>
                      <p className="rx-form-section-desc">Background medical context and payment preference</p>
                    </div>
                  </div>

                  <div className="rx-form-field">
                    <label className="rx-form-label">
                      Medical History <span className="text-[11px] font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea value={formMedicalHistory}
                      onChange={(e) => setFormMedicalHistory(e.target.value)}
                      rows={2}
                      className="rx-form-textarea"
                      placeholder="Previous conditions, known allergies, current medications, surgeries…"
                    />
                    <p className="rx-form-helper">Helps the doctor prepare for the consultation</p>
                  </div>

                  {selectedDoctor && selectedDoctor.consultationFee != null && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold text-cyan-800">Consultation Fee</p>
                        <p className="mt-0.5 text-[11px] text-cyan-700">
                          {formCollectPayment
                            ? "Will be marked paid in Billing on confirm"
                            : "Will stay pending until collected in Billing"}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-cyan-800">
                        ₹{selectedDoctor.consultationFee}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        checked={formCollectPayment}
                        onChange={(e) => setFormCollectPayment(e.target.checked)}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">
                          Collect payment now
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          Same as receptionist booking — marks appointment and invoice as Paid.
                          Uncheck to confirm without payment (Billing can collect later).
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="rx-form-field mt-4">
                    <label className="rx-form-label">
                      Payment Method
                      {formCollectPayment ? <span className="rx-required"> *</span> : null}
                    </label>
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value as "card" | "upi" | "cash")}
                      className="rx-form-select"
                      disabled={!formCollectPayment}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card / Debit / Credit</option>
                      <option value="upi">UPI / QR Code</option>
                    </select>
                    <p className="rx-form-helper">
                      {formCollectPayment
                        ? "Payment will sync to Billing, revenue, and cash/UPI/card collection"
                        : "No payment recorded — invoice stays Pending in Billing"}
                    </p>
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <Button variant="outline" onClick={handleCloseEditModal} disabled={updateLoading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateBooking}
                  loading={updateLoading}
                  loadingText="Updating…"
                  disabled={!formDoctorId || !formPatientName.trim()}
                >
                  Confirm Booking
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete WhatsApp booking"
        message={
          deleteTarget ? (
            <>
              <p>Are you sure you want to delete this WhatsApp booking?</p>
              <ul>
                <li>Patient: {deleteTarget.patientName}</li>
                <li>Date: {deleteTarget.appointmentDate}</li>
                <li>Time: {deleteTarget.appointmentTime}</li>
              </ul>
              <p>This action cannot be undone.</p>
            </>
          ) : (
            ""
          )
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmLoading={deleteLoading}
        onCancel={() => {
          if (deleteLoading) return
          setDeleteTarget(null)
        }}
        onConfirm={async () => {
          if (deleteTarget) await handleDeleteBooking(deleteTarget)
        }}
      />
    </div>
  )
}

