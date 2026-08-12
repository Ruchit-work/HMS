"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { createPortal } from "react-dom"
import { doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/firebase/config"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"
import { useDoctors } from "@/shared/hooks/useDoctors"
import { usePatients } from "@/shared/hooks/usePatients"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import PaymentMethodSection, {
  PaymentData as BookingPaymentData,
  PaymentMethodOption as BookingPaymentMethod,
} from "@/features/payments/PaymentMethodSection"
import { AppointmentSuccessModal } from "@/features/patient/appointments/AppointmentModals"
import { bloodGroups } from "@/constants/signup"
import { SYMPTOM_CATEGORIES } from "@/features/patient/SymptomSelector"
import { formatTimeDisplay } from "@/shared/utils/timeSlots"
import { isDateBlocked } from "@/shared/utils/analytics/blockedDates"
import { computeAvailableSlots } from "@/shared/utils/computeAvailableSlots"
import VoiceInput from "@/shared/ui/VoiceInput"
import { Button } from "@/shared/components"
import { assertAppointmentSlotAvailable } from "@/shared/utils/checkAppointmentSlot"
import { useHospitalBillingSettings } from "@/shared/hooks/useHospitalBillingSettings"
import { useHospitalReceptionistSettings } from "@/shared/hooks/useHospitalReceptionistSettings"
import { VISIT_TYPE_OPTIONS, type VisitType } from "@/shared/utils/visitTypes"
import type { BookAppointmentFieldConfig, AddPatientFieldConfig } from "@/types/hospital"
import { uploadPatientDocuments } from "@/shared/utils/documents/uploadPatientDocuments"

interface BookAppointmentPanelProps {
  patientMode?: "existing" | "new"
  onPatientModeChange?: (_mode: "existing" | "new") => void
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
  /** When false, pause doctor realtime subscription (keep-alive tab optimization). Default true. */
  isActive?: boolean
  /** Hospital-specific book appointment field configuration */
  fieldConfig?: BookAppointmentFieldConfig
  /** Hospital-specific add patient field configuration */
  addPatientFieldConfig?: AddPatientFieldConfig
}

interface NewPatientForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: string
  bloodGroup: string
  dateOfBirth: string
  address: string
  heightCm: string
  weightKg: string
}

const initialNewPatient: NewPatientForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: "",
  bloodGroup: "",
  dateOfBirth: "",
  address: "",
  heightCm: "",
  weightKg: "",
}

const emptyBookingPayment: BookingPaymentData = {
  cardNumber: "",
  cardName: "",
  expiryDate: "",
  cvv: "",
  upiId: "",
}

export default function BookAppointmentPanel({
  onNotification,
  isActive = true,
  fieldConfig: propFieldConfig,
  addPatientFieldConfig: propAddPatientFieldConfig,
}: BookAppointmentPanelProps) {
  const patientPanelRef = useRef<HTMLDivElement>(null)
  const { activeHospitalId } = useMultiHospital()
  const { frontDeskPaymentMethods } = useHospitalBillingSettings()
  const {
    bookAppointmentFields: hookFieldConfig,
    addPatientFields: hookAddPatientConfig,
  } = useHospitalReceptionistSettings()
  const fieldConfig = propFieldConfig ?? hookFieldConfig
  const addPatientConfig = propAddPatientFieldConfig ?? hookAddPatientConfig

  const { doctors } = useDoctors(activeHospitalId, {
    activeOnly: true,
    realtime: true,
    enabled: Boolean(isActive && activeHospitalId),
  })
  const { patients } = usePatients(activeHospitalId, {
    bookable: true,
    realtime: false,
    enabled: Boolean(isActive && activeHospitalId),
  })

  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookErrorFade, setBookErrorFade] = useState(false)

  // ── Unified Patient Search & Shared Phone Detection State ──
  const [phoneSearch, setPhoneSearch] = useState("")
  const [debouncedPhoneSearch, setDebouncedPhoneSearch] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  const [selectedPatient, setSelectedPatient] = useState<any | null>(null)
  const [selectedPatientId, setSelectedPatientId] = useState("")
  const [selectedPatientInfo, setSelectedPatientInfo] = useState<any | null>(null)

  const [newPatient, setNewPatient] = useState<NewPatientForm>(initialNewPatient)
  const RECEPTIONIST_DEFAULT_PASSWORD = "123456"
  const [newPatientPassword, setNewPatientPassword] = useState(RECEPTIONIST_DEFAULT_PASSWORD)
  const [newPatientPasswordConfirm, setNewPatientPasswordConfirm] = useState(RECEPTIONIST_DEFAULT_PASSWORD)

  // ── Appointment Setup State ──
  const [selectedDoctorId, setSelectedDoctorId] = useState("")
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  const [searchDoctor, setSearchDoctor] = useState("")
  const [appointmentDate, setAppointmentDate] = useState(todayStr)
  const [appointmentTime, setAppointmentTime] = useState("")
  const [visitType, setVisitType] = useState<VisitType>("opd")

  const [symptomCategory, setSymptomCategory] = useState("")
  const [customSymptom, setCustomSymptom] = useState("")
  const [symptomSearch, setSymptomSearch] = useState("")
  const [showSymptomDropdown, setShowSymptomDropdown] = useState(false)
  const symptomDropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 400 })

  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod | null>(null)
  const [paymentData, setPaymentData] = useState<BookingPaymentData>(emptyBookingPayment)

  interface AdditionalFee {
    id: string
    description: string
    amount: number
  }
  const [additionalFees, setAdditionalFees] = useState<AdditionalFee[]>([])

  const [successOpen, setSuccessOpen] = useState(false)
  const [successData, setSuccessData] = useState<any>(null)
  const [pendingDoctorId, setPendingDoctorId] = useState<string | null>(null)
  const [showDoctorConfirmModal, setShowDoctorConfirmModal] = useState(false)
  const [newPatientAttachedFiles, setNewPatientAttachedFiles] = useState<File[]>([])
  const [newPatientDocumentNames, setNewPatientDocumentNames] = useState<string[]>([])

  // Debounce phone search to avoid premature triggers and unnecessary lag
  useEffect(() => {
    if (!phoneSearch.trim()) {
      setDebouncedPhoneSearch("")
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    const timer = setTimeout(() => {
      setDebouncedPhoneSearch(phoneSearch)
      setIsSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [phoneSearch])

  // Sync date to today's date if appointmentDate feature is disabled or empty
  useEffect(() => {
    if (!appointmentDate || (fieldConfig?.appointmentDate === false && appointmentDate !== todayStr)) {
      setAppointmentDate(todayStr)
    }
  }, [fieldConfig?.appointmentDate, todayStr, appointmentDate])

  const selectedDoctor = useMemo(() => {
    if (!selectedDoctorId) return null
    return doctors.find((d: any) => d.id === selectedDoctorId) || null
  }, [doctors, selectedDoctorId])

  const selectedDoctorFee =
    selectedDoctor?.consultationFee != null ? Number(selectedDoctor.consultationFee) : null

  const totalAdditionalFees = useMemo(() => {
    return additionalFees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
  }, [additionalFees])

  const paymentAmount = useMemo(() => {
    return (selectedDoctorFee || 0) + totalAdditionalFees
  }, [selectedDoctorFee, totalAdditionalFees])

  // Filter existing patients matching debounced search input (by phone, name, email, or patient ID)
  const matchingPatients = useMemo(() => {
    const q = debouncedPhoneSearch.trim().toLowerCase()
    if (!q) return []
    const searchDigits = q.replace(/\D/g, "")

    return patients.filter((p: any) => {
      const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim().toLowerCase()
      const pPhoneDigits = (p.phone || p.phoneNumber || p.contact || "").replace(/\D/g, "")
      const pId = p.patientId ? String(p.patientId).toLowerCase() : ""
      const pEmail = (p.email || "").toLowerCase()

      const phoneMatch = searchDigits.length >= 2 && pPhoneDigits.includes(searchDigits)
      const nameMatch = fullName.includes(q)
      const idMatch = pId.includes(q)
      const emailMatch = pEmail.includes(q)

      return phoneMatch || nameMatch || idMatch || emailMatch
    })
  }, [patients, debouncedPhoneSearch])

  // Handle typing in primary phone search input
  const handlePhoneSearchChange = (val: string) => {
    setPhoneSearch(val)
    setNewPatient((prev) => ({ ...prev, phone: val }))

    // If an existing patient was selected and user changes phone number, clear selection to avoid stale data
    if (selectedPatientId || selectedPatient) {
      setSelectedPatient(null)
      setSelectedPatientId("")
      setSelectedPatientInfo(null)
      setNewPatient({
        ...initialNewPatient,
        phone: val,
      })
    }
  }

  // Handle explicit patient selection from optional suggestions
  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient)
    setSelectedPatientId(patient.id)
    setSelectedPatientInfo(patient)

    // Populate patient form fields with selected patient's information
    setNewPatient({
      firstName: patient.firstName || "",
      lastName: patient.lastName || "",
      email: patient.email || "",
      phone: patient.phone || patient.phoneNumber || patient.contact || phoneSearch.trim(),
      gender: patient.gender || "",
      bloodGroup: patient.bloodGroup || "",
      dateOfBirth: patient.dateOfBirth || "",
      address: patient.address || "",
      heightCm: patient.heightCm || "",
      weightKg: patient.weightKg || "",
    })
  }

  // Clear selected patient to return to new patient registration state
  const handleClearPatient = () => {
    setSelectedPatient(null)
    setSelectedPatientId("")
    setSelectedPatientInfo(null)
    setNewPatient({
      ...initialNewPatient,
      phone: phoneSearch.trim(),
    })
  }

  const selectedPatientSnapshot = useMemo(() => {
    if (selectedPatientInfo) return selectedPatientInfo
    if (selectedPatient) return selectedPatient
    if (selectedPatientId) {
      return patients.find((p: any) => p.id === selectedPatientId) || null
    }
    return null
  }, [selectedPatientInfo, selectedPatient, selectedPatientId, patients])

  const paymentMethodLabel = useMemo(() => {
    if (!paymentMethod) return "Not selected"
    switch (paymentMethod) {
      case "upi":
        return "UPI"
      case "cash":
        return "Cash"
      default:
        return "Card"
    }
  }, [paymentMethod])

  const appointmentSummaryLabel = useMemo(() => {
    if (!appointmentDate) return "Select date"
    const readableDate = new Date(`${appointmentDate}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    if (fieldConfig?.appointmentTime === false) return `${readableDate} • First-Come-First-Serve`
    if (!appointmentTime) return readableDate
    return `${readableDate} • ${formatTimeDisplay(appointmentTime)}`
  }, [appointmentDate, appointmentTime, fieldConfig?.appointmentTime])

  const patientSummaryLabel = useMemo(() => {
    if (selectedPatientSnapshot) {
      const fullName = [selectedPatientSnapshot.firstName, selectedPatientSnapshot.lastName]
        .filter(Boolean)
        .join(" ")
      return `${fullName || selectedPatientSnapshot.email || "Patient"} (Existing Patient)`
    }
    const fullName = [newPatient.firstName, newPatient.lastName].filter(Boolean).join(" ")
    return fullName || newPatient.email || "New Patient"
  }, [selectedPatientSnapshot, newPatient.firstName, newPatient.lastName, newPatient.email])

  const filteredSymptoms = useMemo(() => {
    if (!symptomSearch.trim()) return SYMPTOM_CATEGORIES
    const searchTerm = symptomSearch.toLowerCase()
    return SYMPTOM_CATEGORIES.filter((cat) =>
      cat.label.toLowerCase().includes(searchTerm)
    )
  }, [symptomSearch])

  const paymentMethods = frontDeskPaymentMethods

  const isSelectedDateBlocked = useMemo(() => {
    if (!selectedDoctorId || !appointmentDate) return false
    const docObj: any = doctors.find((d: any) => d.id === selectedDoctorId)
    if (!docObj) return false
    const blockedDates: any[] = Array.isArray(docObj?.blockedDates) ? docObj.blockedDates : []
    return isDateBlocked(appointmentDate, blockedDates)
  }, [selectedDoctorId, appointmentDate, doctors])

  // Filter doctors based on symptom category
  const filteredDoctors = useMemo(() => {
    if (!symptomCategory || symptomCategory === "custom") return doctors
    const category = SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)
    if (!category) return doctors

    const normalize = (str: string) => str.toLowerCase().replace(/[()\/]/g, " ").replace(/\s+/g, " ").trim()

    return doctors.filter((doc: any) => {
      const docSpecialization = normalize(doc.specialization || "")
      if (!docSpecialization) return true

      const specializationMappings: Record<string, string[]> = {
        "general physician": ["family medicine", "family physician", "general practitioner", "gp", "general practice"],
        "gynecology": ["gynecologist", "obstetrician", "ob gyn", "women's health"],
        "psychology": ["psychologist"],
        "psychiatry": ["psychiatrist"],
        "gastroenterology": ["gastroenterologist"],
        "endocrinology": ["endocrinologist"],
        "cardiology": ["cardiologist"],
        "orthopedic surgery": ["orthopedic", "orthopedics", "orthopedic surgeon"],
        "dermatology": ["dermatologist"],
        "ophthalmology": ["ophthalmologist", "eye specialist"],
        "pulmonology": ["pulmonologist", "chest specialist"],
        "nephrology": ["nephrologist", "kidney specialist"],
        "urology": ["urologist"],
        "internal medicine": ["internal medicine"],
        "pediatrics": ["pediatrician", "child specialist"],
        "oncology": ["oncologist", "cancer specialist"],
      }

      return category.relatedSpecializations.some((categorySpec) => {
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
          if (varWords.some((word) => docWords.includes(word) && word.length > 3)) {
            return true
          }
        }
        return false
      })
    })
  }, [symptomCategory, doctors])

  const recommendedDoctors = filteredDoctors.length > 0 ? filteredDoctors : (symptomCategory && symptomCategory !== "custom" ? [] : doctors)
  const otherDoctors = symptomCategory && symptomCategory !== "custom" && recommendedDoctors.length > 0
    ? doctors.filter((doc: any) => !recommendedDoctors.some((filtered: any) => filtered.id === doc.id))
    : []

  const visibleDoctors = useMemo(() => {
    const base = symptomCategory && symptomCategory !== "custom" && recommendedDoctors.length > 0
      ? recommendedDoctors
      : doctors
    if (!searchDoctor.trim()) return base
    const q = searchDoctor.toLowerCase()
    return base.filter((d: any) =>
      `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
      (d.specialization || "").toLowerCase().includes(q)
    )
  }, [searchDoctor, recommendedDoctors, doctors, symptomCategory])

  const visibleOtherDoctors = useMemo(() => {
    if (!searchDoctor.trim()) return otherDoctors
    const q = searchDoctor.toLowerCase()
    return otherDoctors.filter((d: any) =>
      `${d.firstName} ${d.lastName}`.toLowerCase().includes(q) ||
      (d.specialization || "").toLowerCase().includes(q)
    )
  }, [searchDoctor, otherDoctors])

  useEffect(() => {
    if (!selectedDoctorId) {
      setAdditionalFees([])
    }
  }, [selectedDoctorId])

  const handleDoctorSelect = (doctorId: string) => {
    const isRecommended = recommendedDoctors.some((doc: any) => doc.id === doctorId)

    if (isRecommended || !symptomCategory || symptomCategory === "custom") {
      setSelectedDoctorId(doctorId)
    } else {
      setPendingDoctorId(doctorId)
      setShowDoctorConfirmModal(true)
    }
  }

  const handleConfirmDoctorSelection = () => {
    if (pendingDoctorId) {
      setSelectedDoctorId(pendingDoctorId)
      setShowDoctorConfirmModal(false)
      setPendingDoctorId(null)
    }
  }

  const notify = useCallback(
    (payload: { type: "success" | "error"; message: string } | null) => {
      onNotification?.(payload)
    },
    [onNotification]
  )

  useEffect(() => {
    if (!selectedPatientId) return
    let cancelled = false
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "patients", selectedPatientId))
        if (!cancelled) {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() }
            setSelectedPatientInfo(data)
            setSelectedPatient(data)
          }
        }
      } catch (error) {
        console.error("Failed to load patient info:", error)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId])

  const selectedDoctorScheduleKey = useMemo(() => {
    if (!selectedDoctor) return ""
    const d = selectedDoctor as any
    return JSON.stringify({
      id: d.id,
      consultationFee: d.consultationFee,
      availableDays: d.availableDays,
      availableHours: d.availableHours,
      slotDuration: d.slotDuration,
      blockedDates: d.blockedDates,
      schedule: d.schedule,
    })
  }, [selectedDoctor])

  useEffect(() => {
    const computeSlots = async () => {
      setAvailableSlots([])
      setAppointmentTime("")
      if (!selectedDoctorId || !appointmentDate || !activeHospitalId) return

      try {
        const result = await computeAvailableSlots({
          hospitalId: activeHospitalId,
          doctorId: selectedDoctorId,
          appointmentDate,
          doctor: (selectedDoctor || { id: selectedDoctorId }) as any,
        })
        setAvailableSlots(result.available)
      } catch (error) {
        console.error("[BookAppointmentPanel] Failed to compute available slots:", error)
        setAvailableSlots([])
      }
    }

    void computeSlots()
  }, [selectedDoctorId, appointmentDate, selectedDoctorScheduleKey, selectedDoctor, activeHospitalId])

  useEffect(() => {
    if (!bookError) return
    setBookErrorFade(false)
    const fadeTimer = setTimeout(() => setBookErrorFade(true), 4000)
    const clearTimer = setTimeout(() => setBookError(null), 5000)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(clearTimer)
    }
  }, [bookError])

  useEffect(() => {
    const updateDropdownPosition = () => {
      if (symptomDropdownRef.current && showSymptomDropdown) {
        const rect = symptomDropdownRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        })
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showSymptomDropdown) {
        const isOutsideContainer = !target.closest(".symptom-dropdown-container")
        const isOutsideDropdown = !target.closest("[data-symptom-dropdown]")
        if (isOutsideContainer && isOutsideDropdown) {
          setShowSymptomDropdown(false)
        }
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && showSymptomDropdown) {
        setShowSymptomDropdown(false)
      }
    }

    if (showSymptomDropdown) {
      updateDropdownPosition()
      const timeoutId = setTimeout(updateDropdownPosition, 0)
      window.addEventListener("resize", updateDropdownPosition)
      window.addEventListener("scroll", updateDropdownPosition, true)
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscape)

      return () => {
        clearTimeout(timeoutId)
        window.removeEventListener("resize", updateDropdownPosition)
        window.removeEventListener("scroll", updateDropdownPosition, true)
        document.removeEventListener("mousedown", handleClickOutside)
        document.removeEventListener("keydown", handleEscape)
      }
    }
  }, [showSymptomDropdown])

  const resetBookingForm = useCallback(() => {
    setSelectedPatient(null)
    setSelectedPatientId("")
    setSelectedPatientInfo(null)
    setPhoneSearch("")
    setDebouncedPhoneSearch("")
    setNewPatient(initialNewPatient)
    setNewPatientPassword(RECEPTIONIST_DEFAULT_PASSWORD)
    setNewPatientPasswordConfirm(RECEPTIONIST_DEFAULT_PASSWORD)
    setNewPatientAttachedFiles([])
    setNewPatientDocumentNames([])
    setSelectedDoctorId("")
    setSearchDoctor("")
    setAppointmentDate(todayStr)
    setAppointmentTime("")
    setSymptomCategory("")
    setCustomSymptom("")
    setSymptomSearch("")
    setShowSymptomDropdown(false)
    setPaymentMethod(null)
    setAdditionalFees([])
    setPaymentData(emptyBookingPayment)
    setAvailableSlots([])
  }, [todayStr])

  const createPatientForBooking = useCallback(async () => {
    return authedFetchJson<{ id: string; patientId?: string }>(
      "/api/receptionist/create-patient",
      {
        method: "POST",
        body: JSON.stringify({
          patientData: {
            ...newPatient,
            phone: newPatient.phone || phoneSearch.trim(),
            status: "active",
            createdBy: "receptionist",
            createdAt: new Date().toISOString(),
          },
          password: newPatientPassword,
        }),
      },
      "Failed to create patient"
    )
  }, [newPatient, newPatientPassword, phoneSearch])

  const createAppointment = useCallback(
    async (patientId: string, patientPayload: any) => {
      const doctor = doctors.find((x: any) => x.id === selectedDoctorId)

      const patientPhone =
        patientPayload?.phone ||
        patientPayload?.phoneNumber ||
        patientPayload?.contact ||
        patientPayload?.mobile ||
        phoneSearch.trim() ||
        ""

      let chiefComplaint = ""
      if (customSymptom && customSymptom.trim().length > 0) {
        chiefComplaint = customSymptom.trim()
      } else if (symptomCategory && symptomCategory !== "custom" && symptomCategory.trim().length > 0) {
        const category = SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)
        if (category) {
          chiefComplaint = category.label
        }
      }

      let medicalHistory = ""
      const historyParts: string[] = []
      if (patientPayload?.allergies && patientPayload.allergies.trim().length > 0) {
        historyParts.push(`Allergies: ${patientPayload.allergies.trim()}`)
      }
      if (patientPayload?.currentMedications && patientPayload.currentMedications.trim().length > 0) {
        historyParts.push(`Current medications: ${patientPayload.currentMedications.trim()}`)
      }
      medicalHistory = historyParts.join(". ")

      const appointmentData = {
        patientId,
        patientName: `${patientPayload?.firstName || ""} ${patientPayload?.lastName || ""}`.trim(),
        patientEmail: patientPayload?.email || "",
        patientPhone: patientPhone,
        patientPhoneNumber: patientPayload?.phoneNumber || patientPayload?.phone || patientPhone,
        patientContact: patientPayload?.contact || patientPayload?.mobile || patientPhone,
        doctorId: doctor?.id,
        doctorName: `${doctor?.firstName || ""} ${doctor?.lastName || ""}`.trim(),
        doctorSpecialization: doctor?.specialization || "",
        appointmentDate,
        appointmentTime: fieldConfig?.appointmentTime === false ? "FCFS" : appointmentTime,
        isFcfs: fieldConfig?.appointmentTime === false,
        chiefComplaint: chiefComplaint || "General consultation",
        medicalHistory: medicalHistory || "",
        status: "confirmed",
        visitType: visitType,
        paymentAmount: paymentAmount,
        paymentMethod: paymentMethod,
        paymentType: "full",
        additionalFees:
          additionalFees.length > 0
            ? additionalFees.map((fee) => ({
                description: fee.description,
                amount: fee.amount,
              }))
            : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "receptionist",
      }

      await authedFetchJson(
        "/api/receptionist/create-appointment",
        {
          method: "POST",
          body: JSON.stringify({ appointmentData }),
        },
        "Failed to create appointment"
      )
      return appointmentData
    },
    [
      appointmentDate,
      appointmentTime,
      doctors,
      paymentAmount,
      paymentMethod,
      selectedDoctorId,
      symptomCategory,
      customSymptom,
      additionalFees,
      visitType,
      fieldConfig?.appointmentTime,
      phoneSearch,
    ]
  )

  const preventDuplicateAppointment = useCallback(
    async (patientId: string) => {
      if (!activeHospitalId) return
      try {
        const dupQuery = query(
          getHospitalCollection(activeHospitalId, "appointments"),
          where("patientId", "==", patientId),
          where("appointmentDate", "==", appointmentDate),
          where("status", "==", "confirmed")
        )
        const dupSnap = await getDocs(dupQuery)
        if (!dupSnap.empty) {
          throw new Error("This patient already has an appointment on this date")
        }
      } catch (error) {
        if (error instanceof Error) throw error
      }
    },
    [appointmentDate, activeHospitalId]
  )

  const handleBookAppointment = async () => {
    try {
      setBookLoading(true)
      setBookError(null)

      if (!selectedDoctorId) throw new Error("Please select a doctor")

      if (fieldConfig?.appointmentTime === false) {
        if (fieldConfig?.appointmentDate !== false && !appointmentDate) {
          throw new Error("Please select an appointment date")
        }
      } else {
        if (fieldConfig?.appointmentDate === false) {
          if (!appointmentTime) throw new Error("Please select a time slot")
        } else {
          if (!appointmentDate || !appointmentTime) throw new Error("Please select date and time")
        }
        if (!availableSlots.includes(appointmentTime)) throw new Error("Selected time is not available")
        await assertAppointmentSlotAvailable(selectedDoctorId, appointmentDate, appointmentTime)
      }

      if (isSelectedDateBlocked) throw new Error("Doctor is not available on the selected date")
      if (!paymentMethod) throw new Error("Please select a payment method")

      let finalPatientId = ""
      let finalPatientPayload: any = null

      // ── STRICT SUBMIT SEPARATION ──
      if (selectedPatientId) {
        // PATH 1: Existing Patient selected
        // SKIP createPatient API completely!
        finalPatientId = selectedPatientId
        finalPatientPayload = selectedPatientInfo || selectedPatient || patients.find((x: any) => x.id === selectedPatientId)
      } else {
        // PATH 2: New Patient (either 0 matches or receptionist didn't select existing suggestion)
        // EXECUTE createPatient API
        if (!newPatient.firstName || !newPatient.lastName) {
          throw new Error("Please enter first name and last name for the patient")
        }
        if (!newPatient.phone && !phoneSearch.trim()) {
          throw new Error("Please enter phone number")
        }
        if (newPatient.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPatient.email.trim())) {
          throw new Error("Please enter a valid email address")
        }
        if (addPatientConfig?.passwordFields !== false) {
          if (newPatientPassword.length < 6) {
            throw new Error("Password must be at least 6 characters")
          }
          if (newPatientPassword !== newPatientPasswordConfirm) {
            throw new Error("Passwords do not match")
          }
        }

        const result = await createPatientForBooking()
        finalPatientId = result.id
        finalPatientPayload = {
          ...newPatient,
          phone: newPatient.phone || phoneSearch.trim(),
          patientId: result.patientId || result.id,
        }
      }

      // Handle attached documents for either existing or new patient UID
      if (newPatientAttachedFiles.length > 0 && finalPatientId) {
        const uploadRes = await uploadPatientDocuments({
          files: newPatientAttachedFiles,
          patientUid: finalPatientId,
          patientId: finalPatientPayload?.patientId || finalPatientId,
        })
        if (uploadRes.errors.length > 0) {
          console.warn("[BookAppointmentPanel] Patient documents upload result:", uploadRes)
        }
      }

      await preventDuplicateAppointment(finalPatientId)
      const appointmentData = await createAppointment(finalPatientId, finalPatientPayload)

      const txnId = `RCPT${Date.now()}`
      setSuccessData({
        doctorName: appointmentData.doctorName,
        doctorSpecialization: appointmentData.doctorSpecialization,
        appointmentDate,
        appointmentTime,
        transactionId: txnId,
        paymentAmount: appointmentData.paymentAmount,
        paymentType: "full",
        patientName: appointmentData.patientName,
      })
      setSuccessOpen(true)
      resetBookingForm()
      notify({ type: "success", message: "Appointment booked successfully." })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to book appointment"
      setBookError(message)
      notify({ type: "error", message })
    } finally {
      setBookLoading(false)
    }
  }

  if (fieldConfig === null || addPatientConfig === null) {
    return (
      <div className="rx-section-card p-6 space-y-6 animate-pulse bg-white rounded-xl">
        <div className="space-y-2">
          <div className="h-5 w-48 bg-slate-200 rounded-lg" />
          <div className="h-3.5 w-72 bg-slate-100 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-10 bg-slate-200 rounded-xl" />
          <div className="h-10 bg-slate-200 rounded-xl" />
          <div className="h-10 bg-slate-200 rounded-xl" />
          <div className="h-10 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-28 bg-slate-100 rounded-xl mt-4" />
      </div>
    )
  }

  return (
    <div className="space-y-4 min-w-0 overflow-x-hidden [overflow-anchor:none]">
      {/* Header Banner */}
      <div className="rx-section-card">
        <div className="rx-section-header flex-wrap gap-y-3">
          <div className="min-w-0">
            <p className="rx-section-title">Book Appointment</p>
            <p className="rx-section-subtitle">
              {doctors.length} doctors · {patients.length} patients on file
              {appointmentDate && selectedDoctorId && availableSlots.length > 0 && ` · ${availableSlots.length} slots open`}
              {paymentAmount > 0 && ` · ₹${new Intl.NumberFormat("en-IN").format(paymentAmount)} due`}
            </p>
          </div>
        </div>
      </div>

      {bookError && (
        <div
          className={`flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-opacity duration-700 ${
            bookErrorFade ? "opacity-0" : "opacity-100"
          }`}
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          {bookError}
        </div>
      )}

      {/* Main Workspace */}
      <div className="space-y-4 min-w-0">
        {/* Visit Type */}
        {fieldConfig?.visitType !== false && (
          <div className="rx-section-card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Visit Type
                </label>
                <p className="text-xs text-slate-400 mt-0.5">Select Outpatient or Inpatient visit</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-64">
                {VISIT_TYPE_OPTIONS.map((vt) => {
                  const isSelected = visitType === vt.value
                  return (
                    <button
                      key={vt.value}
                      type="button"
                      onClick={() => setVisitType(vt.value)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? "border-cyan-600 bg-cyan-50/90 text-cyan-900 ring-2 ring-cyan-500/20 font-bold shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-xs font-bold">{vt.shortLabel}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{vt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Unified Patient Identification & Selection */}
        <div className="rx-section-card">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <span
              className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                selectedPatientSnapshot ? "bg-emerald-500 text-white" : "bg-cyan-600 text-white"
              }`}
            >
              {selectedPatientSnapshot ? (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                "1"
              )}
            </span>
            <p className="text-sm font-semibold text-slate-900">Patient Identification</p>
            {selectedPatientSnapshot && (
              <span className="ml-auto text-xs text-emerald-600 font-medium truncate max-w-[260px]">
                {patientSummaryLabel}
              </span>
            )}
          </div>

          <div ref={patientPanelRef} className="p-4 space-y-4">
            {/* Primary Contact / Phone Number Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <input
                  type="text"
                  value={phoneSearch}
                  onChange={(e) => handlePhoneSearchChange(e.target.value)}
                  placeholder="Enter patient phone number (e.g. 7359057367)…"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-20 py-2.5 text-sm shadow-xs focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100 font-medium"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {isSearching && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
                  )}
                  <VoiceInput
                    onTranscript={(text) => handlePhoneSearchChange(text)}
                    language="en-IN"
                    useMedicalModel={false}
                    allowGujarati
                    variant="inline"
                  />
                </div>
              </div>

              {/* Optional Selectable Suggestions if matching patients exist */}
              {debouncedPhoneSearch.trim().length >= 2 && matchingPatients.length > 0 && !selectedPatientId && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden divide-y divide-slate-100 my-3">
                  <div className="px-3 py-2 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Existing patients with this contact number ({matchingPatients.length}):</span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional — click to select existing patient</span>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                    {matchingPatients.map((p: any) => {
                      const pName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unnamed Patient"
                      const pId = p.patientId ? `#${p.patientId}` : `#${p.id.slice(0, 6)}`
                      const pPhone = p.phone || p.phoneNumber || p.contact || phoneSearch
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPatient(p)}
                          className="w-full px-4 py-2.5 text-left transition hover:bg-cyan-50/70 flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-cyan-600 group-hover:scale-125 transition-transform" />
                            <span className="text-xs font-bold text-slate-900 group-hover:text-cyan-800">
                              {pName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              Patient ID: {pId}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-slate-600">{pPhone}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Selected Existing Patient Compact Indicator */}
              {selectedPatientId && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3.5 flex items-center justify-between my-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      ✓
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-700">Existing Patient</span>
                        {selectedPatientSnapshot?.patientId && (
                          <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                            Patient ID: #{selectedPatientSnapshot.patientId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {selectedPatientSnapshot?.firstName} {selectedPatientSnapshot?.lastName}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPatient}
                    className="text-xs font-semibold text-cyan-700 bg-white border border-cyan-200 hover:bg-cyan-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Change Patient
                  </button>
                </div>
              )}
            </div>

            {/* Patient Details Form (Always Visible by Default) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4 mt-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  {selectedPatientId ? "Existing Patient Record" : "Patient Profile Details"}
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedPatientId ? "Selected existing patient profile" : "Complete details below if registering a new patient"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">First Name *</label>
                  <input
                    placeholder="First name *"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                    value={newPatient.firstName}
                    onChange={(e) => setNewPatient((v) => ({ ...v, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Last Name *</label>
                  <input
                    placeholder="Last name *"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                    value={newPatient.lastName}
                    onChange={(e) => setNewPatient((v) => ({ ...v, lastName: e.target.value }))}
                  />
                </div>

                {!selectedPatientId && addPatientConfig?.passwordFields !== false && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 block">Password</label>
                      <input
                        placeholder="Password"
                        type="password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                        value={newPatientPassword}
                        onChange={(e) => setNewPatientPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 block">Confirm Password</label>
                      <input
                        placeholder="Confirm password"
                        type="password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                        value={newPatientPasswordConfirm}
                        onChange={(e) => setNewPatientPasswordConfirm(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {addPatientConfig?.email !== false && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Email Address</label>
                    <input
                      placeholder="Email (optional)"
                      type="email"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                      value={newPatient.email}
                      onChange={(e) => setNewPatient((v) => ({ ...v, email: e.target.value }))}
                    />
                  </div>
                )}
                {addPatientConfig?.gender !== false && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Gender</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient((v) => ({ ...v, gender: e.target.value }))}
                    >
                      <option value="">Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}
                {addPatientConfig?.dateOfBirth !== false && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Date of Birth</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                      max={todayStr}
                      value={newPatient.dateOfBirth}
                      onChange={(e) => setNewPatient((v) => ({ ...v, dateOfBirth: e.target.value }))}
                    />
                  </div>
                )}
                {addPatientConfig?.bloodGroup !== false && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Blood Group</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                      value={newPatient.bloodGroup}
                      onChange={(e) => setNewPatient((v) => ({ ...v, bloodGroup: e.target.value }))}
                    >
                      <option value="">Blood group</option>
                      {bloodGroups.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {addPatientConfig?.heightWeight !== false && (
                  <>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Height (cm)</label>
                      <input
                        placeholder="Height (cm) — e.g. 170"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                        value={newPatient.heightCm}
                        onChange={(e) => setNewPatient((v) => ({ ...v, heightCm: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">Weight (kg)</label>
                      <input
                        placeholder="Weight (kg) — e.g. 65"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                        value={newPatient.weightKg}
                        onChange={(e) => setNewPatient((v) => ({ ...v, weightKg: e.target.value }))}
                      />
                    </div>
                  </>
                )}
                {addPatientConfig?.address !== false && (
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-500 block mb-1">Address</label>
                    <input
                      placeholder="Address"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none"
                      value={newPatient.address}
                      onChange={(e) => setNewPatient((v) => ({ ...v, address: e.target.value }))}
                    />
                  </div>
                )}
                {addPatientConfig?.documents !== false && (
                  <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-200">
                    <label className="block text-xs font-medium text-slate-600">Patient Documents & ID Proof</label>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={(e) => {
                        const files = e.target.files
                        if (files && files.length > 0) {
                          const fileArray = Array.from(files)
                          setNewPatientAttachedFiles((prev) => [...prev, ...fileArray])
                          setNewPatientDocumentNames((prev) => [...prev, ...fileArray.map((f) => f.name)])
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer rounded-xl border border-slate-200 bg-white p-2"
                    />
                    {newPatientDocumentNames.length > 0 && (
                      <ul className="space-y-1 mt-2">
                        {newPatientDocumentNames.map((name, idx) => (
                          <li
                            key={idx}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
                          >
                            <span className="truncate max-w-[240px]">📄 {name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setNewPatientAttachedFiles((prev) => prev.filter((_, i) => i !== idx))
                                setNewPatientDocumentNames((prev) => prev.filter((_, i) => i !== idx))
                              }}
                              className="text-slate-400 hover:text-red-500 font-bold ml-2"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STEP 2: Visit Setup */}
        <div className="rx-section-card">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <span
              className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                selectedDoctorId && appointmentDate && (fieldConfig?.appointmentTime === false || appointmentTime)
                  ? "bg-emerald-500 text-white"
                  : "bg-cyan-600 text-white"
              }`}
            >
              {selectedDoctorId && appointmentDate && (fieldConfig?.appointmentTime === false || appointmentTime) ? (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                "2"
              )}
            </span>
            <p className="text-sm font-semibold text-slate-900">Visit Setup</p>
            {selectedDoctorId && appointmentDate && (fieldConfig?.appointmentTime === false || appointmentTime) && (
              <span className="ml-auto text-xs text-emerald-600 font-medium">{appointmentSummaryLabel}</span>
            )}
          </div>

          <div className="p-4 space-y-5 overflow-visible">
            {fieldConfig?.symptoms !== false && (
              <div className="relative">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chief Complaint / Symptoms</label>
                <div className="mt-2 relative symptom-dropdown-container">
                  <div
                    ref={symptomDropdownRef}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus-within:border-cyan-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-cyan-100 cursor-pointer"
                    onClick={() => {
                      if (!showSymptomDropdown && symptomDropdownRef.current) {
                        const rect = symptomDropdownRef.current.getBoundingClientRect()
                        setDropdownPosition({
                          top: rect.bottom + 4,
                          left: rect.left,
                          width: rect.width,
                        })
                      }
                      setShowSymptomDropdown(!showSymptomDropdown)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={symptomCategory ? "text-slate-900" : "text-slate-400"}>
                        {symptomCategory === "custom"
                          ? "Custom…"
                          : symptomCategory
                          ? SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)?.label || "Select symptoms"
                          : "Select symptoms — filters recommended doctors"}
                      </span>
                      <svg
                        className={`w-4 h-4 text-slate-500 transition-transform ${showSymptomDropdown ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {showSymptomDropdown &&
                    typeof window !== "undefined" &&
                    createPortal(
                      <div
                        data-symptom-dropdown
                        className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-hidden"
                        style={{
                          top: `${dropdownPosition.top}px`,
                          left: `${dropdownPosition.left}px`,
                          width: `${dropdownPosition.width || 400}px`,
                        }}
                      >
                        <div className="p-2 border-b border-slate-200">
                          <div className="relative">
                            <svg
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              type="text"
                              value={symptomSearch}
                              onChange={(e) => setSymptomSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Search symptoms..."
                              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-600"
                              autoFocus
                            />
                          </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSymptomCategory("")
                              setCustomSymptom("")
                              setShowSymptomDropdown(false)
                              setSymptomSearch("")
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100 font-medium"
                          >
                            None / Clear Symptoms
                          </button>
                          {filteredSymptoms.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSymptomCategory(cat.id)
                                setCustomSymptom("")
                                setShowSymptomDropdown(false)
                                setSymptomSearch("")
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-cyan-50 transition-colors flex items-center justify-between ${
                                symptomCategory === cat.id ? "bg-cyan-50 text-cyan-900 font-bold" : "text-slate-700"
                              }`}
                            >
                              <span>{cat.label}</span>
                              {symptomCategory === cat.id && (
                                <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSymptomCategory("custom")
                              setShowSymptomDropdown(false)
                              setSymptomSearch("")
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-cyan-50 transition-colors font-medium ${
                              symptomCategory === "custom" ? "bg-cyan-50 text-cyan-900 font-bold" : "text-slate-700"
                            }`}
                          >
                            + Other / Custom Symptom
                          </button>
                        </div>
                      </div>,
                      document.body
                    )}

                  {symptomCategory === "custom" && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-slate-500">Custom Symptom / Notes</label>
                        <VoiceInput
                          onTranscript={(text) => setCustomSymptom((prev) => (prev ? `${prev} ${text}` : text))}
                          language="en-IN"
                          useMedicalModel={true}
                          allowGujarati
                          variant="inline"
                        />
                      </div>
                      <textarea
                        placeholder="Describe symptoms or chief complaint…"
                        value={customSymptom}
                        onChange={(e) => setCustomSymptom(e.target.value)}
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Doctor Picker */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Select Doctor <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={searchDoctor}
                  onChange={(e) => setSearchDoctor(e.target.value)}
                  placeholder="Search doctor or specialty…"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-100 w-full sm:w-52"
                />
              </div>

              {doctors.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No active doctors registered for this hospital</p>
              ) : (
                <div className="space-y-3">
                  {symptomCategory && symptomCategory !== "custom" && (
                    <div className="flex items-center gap-2 py-1 px-2.5 bg-cyan-50/70 border border-cyan-100 rounded-lg text-xs text-cyan-900 font-medium">
                      <svg className="w-3.5 h-3.5 text-cyan-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        {recommendedDoctors.length > 0
                          ? `Showing recommended doctors for ${SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)?.label || symptomCategory}`
                          : `No direct specialization match found for ${SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)?.label || symptomCategory}. Showing all available doctors below.`}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {visibleDoctors.map((docObj: any) => {
                      const isSelected = selectedDoctorId === docObj.id
                      const fee = docObj.consultationFee != null ? Number(docObj.consultationFee) : null

                      return (
                        <div
                          key={docObj.id}
                          onClick={() => handleDoctorSelect(docObj.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "border-cyan-600 bg-cyan-50/90 ring-2 ring-cyan-500/20 shadow-xs"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                isSelected ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {(docObj.firstName || "D").charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-bold truncate ${isSelected ? "text-cyan-900" : "text-slate-900"}`}>
                                Dr. {docObj.firstName} {docObj.lastName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{docObj.specialization || "General"}</p>
                              {fee != null && (
                                <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                                  ₹{new Intl.NumberFormat("en-IN").format(fee)} fee
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <svg className="w-4 h-4 text-cyan-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {symptomCategory && symptomCategory !== "custom" && visibleOtherDoctors.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Other Doctors</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                        {visibleOtherDoctors.map((docObj: any) => {
                          const isSelected = selectedDoctorId === docObj.id
                          const fee = docObj.consultationFee != null ? Number(docObj.consultationFee) : null

                          return (
                            <div
                              key={docObj.id}
                              onClick={() => handleDoctorSelect(docObj.id)}
                              className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                                isSelected
                                  ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20 shadow-xs"
                                  : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50 opacity-80"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 truncate">
                                    Dr. {docObj.firstName} {docObj.lastName}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate">{docObj.specialization || "General"}</p>
                                </div>
                                {fee != null && (
                                  <span className="text-[10px] font-bold text-slate-600 shrink-0">₹{fee}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date & Slot selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              {fieldConfig?.appointmentDate !== false && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    min={todayStr}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
              )}

              {fieldConfig?.appointmentTime !== false ? (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-1">
                    Time Slot ({availableSlots.length} available)
                  </label>
                  {availableSlots.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      {selectedDoctorId ? "No slots available for date" : "Select doctor & date first"}
                    </p>
                  ) : (
                    <select
                      value={appointmentTime}
                      onChange={(e) => setAppointmentTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    >
                      <option value="">Select time slot…</option>
                      {availableSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {formatTimeDisplay(slot)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-50 border border-cyan-100 text-xs text-cyan-800 font-semibold sm:col-span-2">
                  <svg className="w-4 h-4 text-cyan-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>First-Come-First-Serve (FCFS) mode enabled — no specific slot required.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* STEP 3: Payment & Final Submit */}
        <div className="rx-section-card">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <span
              className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                paymentMethod ? "bg-emerald-500 text-white" : "bg-cyan-600 text-white"
              }`}
            >
              {paymentMethod ? (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                "3"
              )}
            </span>
            <p className="text-sm font-semibold text-slate-900">Payment Collection</p>
            {paymentMethod && (
              <span className="ml-auto text-xs text-emerald-600 font-medium">{paymentMethodLabel}</span>
            )}
          </div>

          <div className="p-4 space-y-4">
            <PaymentMethodSection
              amountToPay={paymentAmount}
              paymentMethod={paymentMethod}
              setPaymentMethod={(m) => setPaymentMethod(m)}
              paymentData={paymentData}
              setPaymentData={setPaymentData}
              methods={paymentMethods}
            />

            {fieldConfig?.additionalFees !== false && selectedDoctorId && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Additional Services & Fees</label>
                  <button
                    type="button"
                    onClick={() =>
                      setAdditionalFees((prev) => [
                        ...prev,
                        { id: `fee-${Date.now()}`, description: "", amount: 0 },
                      ])
                    }
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                  >
                    + Add Service Fee
                  </button>
                </div>
                {additionalFees.length > 0 && (
                  <div className="space-y-2">
                    {additionalFees.map((fee, idx) => (
                      <div key={fee.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Service description (e.g. ECG, Lab test)"
                          value={fee.description}
                          onChange={(e) => {
                            const val = e.target.value
                            setAdditionalFees((prev) => prev.map((f, i) => (i === idx ? { ...f, description: val } : f)))
                          }}
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-cyan-600 focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Amount (₹)"
                          value={fee.amount || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setAdditionalFees((prev) => prev.map((f, i) => (i === idx ? { ...f, amount: val } : f)))
                          }}
                          className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-cyan-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setAdditionalFees((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-500 text-xs font-bold p-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Payable Amount</p>
                <p className="text-lg font-extrabold text-slate-900">
                  ₹{new Intl.NumberFormat("en-IN").format(paymentAmount)}
                </p>
              </div>
              <Button
                type="button"
                onClick={handleBookAppointment}
                disabled={bookLoading}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition-all"
              >
                {bookLoading ? "Booking Appointment…" : "Confirm & Book Appointment"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for non-recommended doctor */}
      {showDoctorConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Confirm Doctor Selection</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This doctor is not in the recommended list for the selected symptom category ({symptomCategory}). Would you like to proceed with this doctor anyway?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDoctorConfirmModal(false)
                  setPendingDoctorId(null)
                }}
                className="text-xs"
              >
                Choose Recommended Doctor
              </Button>
              <Button
                type="button"
                onClick={handleConfirmDoctorSelection}
                className="bg-cyan-600 text-xs font-bold text-white hover:bg-cyan-700"
              >
                Proceed with Selected Doctor
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successOpen && successData && (
        <AppointmentSuccessModal
          isOpen={successOpen}
          onClose={() => {
            setSuccessOpen(false)
            setSuccessData(null)
          }}
          appointmentData={successData}
        />
      )}
    </div>
  )
}
