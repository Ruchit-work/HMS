"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react"
import { createPortal } from "react-dom"
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/firebase/config"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import { useDoctors } from "@/hooks/useDoctors"
import { usePatients } from "@/hooks/usePatients"
import { authedFetchJson } from "@/utils/client/authedFetch"
import PaymentMethodSection, {
  PaymentData as BookingPaymentData,
  PaymentMethodOption as BookingPaymentMethod,
} from "@/features/payments/PaymentMethodSection"
import { AppointmentSuccessModal } from "@/features/patient/appointments/AppointmentModals"
import { bloodGroups } from "@/constants/signup"
import { SYMPTOM_CATEGORIES } from "@/features/patient/symptoms/SymptomSelector"
import { getAvailableTimeSlots, isSlotInPast, formatTimeDisplay, normalizeTime } from "@/utils/timeSlots"
import { isDateBlocked } from "@/utils/analytics/blockedDates"
import VoiceInput from "@/components/ui/VoiceInput"
import PatientConsentVideo from "@/features/consent/PatientConsentVideo"
import { Button } from '@/shared/components'
import { assertAppointmentSlotAvailable } from "@/utils/booking/checkAppointmentSlot"

interface BookAppointmentPanelProps {
  patientMode: "existing" | "new"
  onPatientModeChange: (_mode: "existing" | "new") => void
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
  /** When false, pause doctor realtime subscription (keep-alive tab optimization). Default true. */
  isActive?: boolean
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
}

const emptyBookingPayment: BookingPaymentData = {
  cardNumber: "",
  cardName: "",
  expiryDate: "",
  cvv: "",
  upiId: "",
}

export default function BookAppointmentPanel({
  patientMode,
  onPatientModeChange,
  onNotification,
  isActive = true,
}: BookAppointmentPanelProps) {
  const scrollYBeforeModeChange = useRef(0)
  const patientPanelRef = useRef<HTMLDivElement>(null)
  const { activeHospitalId } = useMultiHospital()
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

  const handlePatientModeChange = useCallback(
    (mode: "existing" | "new") => {
      if (mode === patientMode) return
      scrollYBeforeModeChange.current = window.scrollY
      onPatientModeChange(mode)
    },
    [patientMode, onPatientModeChange]
  )

  useLayoutEffect(() => {
    window.scrollTo({ top: scrollYBeforeModeChange.current, behavior: "auto" })
  }, [patientMode])

  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookErrorFade, setBookErrorFade] = useState(false)

  const [searchPatient, setSearchPatient] = useState("")
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState("")
  const [selectedPatientInfo, setSelectedPatientInfo] = useState<any | null>(null)
  const [patientInfoLoading, setPatientInfoLoading] = useState(false)
  const [patientInfoError, setPatientInfoError] = useState<string | null>(null)

  const [newPatient, setNewPatient] = useState<NewPatientForm>(initialNewPatient)
  const RECEPTIONIST_DEFAULT_PASSWORD = "123456"
  const [newPatientPassword, setNewPatientPassword] = useState(RECEPTIONIST_DEFAULT_PASSWORD)
  const [newPatientPasswordConfirm, setNewPatientPasswordConfirm] = useState(RECEPTIONIST_DEFAULT_PASSWORD)

  const [selectedDoctorId, setSelectedDoctorId] = useState("")
  const [searchDoctor, setSearchDoctor] = useState("")
  const [appointmentDate, setAppointmentDate] = useState("")
  const [appointmentTime, setAppointmentTime] = useState("")

  const [symptomCategory, setSymptomCategory] = useState("")
  const [customSymptom, setCustomSymptom] = useState("")
  const [symptomSearch, setSymptomSearch] = useState("")
  const [showSymptomDropdown, setShowSymptomDropdown] = useState(false)
  const symptomDropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 400 })

  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod | null>(null)
  const [paymentData, setPaymentData] = useState<BookingPaymentData>(emptyBookingPayment)

  // Additional fees/services
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

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])

  const selectedDoctor = useMemo(() => {
    if (!selectedDoctorId) return null
    return doctors.find((d: any) => d.id === selectedDoctorId) || null
  }, [doctors, selectedDoctorId])

  const selectedDoctorFee =
    selectedDoctor?.consultationFee != null ? Number(selectedDoctor.consultationFee) : null
  
  // Calculate total payment amount: consultation fee + additional fees
  const totalAdditionalFees = useMemo(() => {
    return additionalFees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
  }, [additionalFees])
  
  const paymentAmount = useMemo(() => {
    return (selectedDoctorFee || 0) + totalAdditionalFees
  }, [selectedDoctorFee, totalAdditionalFees])

  const selectedPatientSnapshot = useMemo(() => {
    if (patientMode === "existing") {
      if (selectedPatientInfo) return selectedPatientInfo
      if (selectedPatientId) {
        return patients.find((p: any) => p.id === selectedPatientId) || null
      }
      return null
    }

    if (
      !newPatient.firstName &&
      !newPatient.lastName &&
      !newPatient.email &&
      !newPatient.phone &&
      !newPatient.address
    ) {
      return null
    }

    return {
      firstName: newPatient.firstName,
      lastName: newPatient.lastName,
      email: newPatient.email,
      phone: newPatient.phone,
      bloodGroup: newPatient.bloodGroup,
      gender: newPatient.gender,
      patientId: null,
      dateOfBirth: newPatient.dateOfBirth,
      address: newPatient.address,
    }
  }, [
    patientMode,
    selectedPatientInfo,
    selectedPatientId,
    patients,
    newPatient.firstName,
    newPatient.lastName,
    newPatient.email,
    newPatient.phone,
    newPatient.address,
    newPatient.bloodGroup,
    newPatient.gender,
    newPatient.dateOfBirth,
  ])

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
    if (!appointmentTime) return readableDate
    return `${readableDate} • ${formatTimeDisplay(appointmentTime)}`
  }, [appointmentDate, appointmentTime])

  const patientSummaryLabel = useMemo(() => {
    if (!selectedPatientSnapshot) return patientMode === "existing" ? "Select a patient" : "Fill patient details"
    const fullName = [selectedPatientSnapshot.firstName, selectedPatientSnapshot.lastName]
      .filter(Boolean)
      .join(" ")
    return fullName || selectedPatientSnapshot.email || "Patient details"
  }, [patientMode, selectedPatientSnapshot])

  const contactSummaryLabel = useMemo(() => {
    if (!selectedPatientSnapshot) return patientMode === "existing" ? "Not selected" : "Add contact info"
    return selectedPatientSnapshot.phone || selectedPatientSnapshot.email || "Contact not provided"
  }, [patientMode, selectedPatientSnapshot])

  const doctorSummaryLabel = useMemo(() => {
    if (!selectedDoctor) return "Pick a doctor"
    const name = `${selectedDoctor.firstName || ""} ${selectedDoctor.lastName || ""}`.trim()
    const specialization = selectedDoctor.specialization ? ` — ${selectedDoctor.specialization}` : ""
    return `${name}${specialization}`
  }, [selectedDoctor])

  const symptomSummary = useMemo(() => {
    if (!symptomCategory) return customSymptom ? customSymptom : "Optional"
    if (symptomCategory === "custom") return customSymptom || "Custom details pending"
    const category = SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)
    return category ? category.label : "Symptoms recorded"
  }, [symptomCategory, customSymptom])

  // Filter symptoms based on search
  const filteredSymptoms = useMemo(() => {
    if (!symptomSearch.trim()) return SYMPTOM_CATEGORIES
    const searchTerm = symptomSearch.toLowerCase()
    return SYMPTOM_CATEGORIES.filter((cat) =>
      cat.label.toLowerCase().includes(searchTerm)
    )
  }, [symptomSearch])

  const paymentMethods = useMemo<BookingPaymentMethod[]>(() => {
    return ["card", "upi", "cash"]
  }, [])

  const isSelectedDateBlocked = useMemo(() => {
    if (!selectedDoctorId || !appointmentDate) return false
    const docObj: any = doctors.find((d: any) => d.id === selectedDoctorId)
    if (!docObj) return false
    const blockedDates: any[] = Array.isArray(docObj?.blockedDates) ? docObj.blockedDates : []
    return isDateBlocked(appointmentDate, blockedDates)
  }, [selectedDoctorId, appointmentDate, doctors])

  const filteredPatients = useMemo(() => {
    if (!searchPatient) return patients
    const s = searchPatient.toLowerCase()
    return patients.filter((p: any) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.phone?.toLowerCase().includes(s) ||
      (p.patientId ? String(p.patientId).toLowerCase().includes(s) : false)
    )
  }, [patients, searchPatient])

  // Filter doctors based on symptom category (same logic as patient side)
  const filteredDoctors = useMemo(() => {
    if (!symptomCategory || symptomCategory === "custom") return doctors
    const category = SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)
    if (!category) return doctors
    
    // Normalize doctor specialization - remove special chars and convert to lowercase
    const normalize = (str: string) => str.toLowerCase().replace(/[()\/]/g, " ").replace(/\s+/g, " ").trim()
    
    return doctors.filter((doc: any) => {
      const docSpecialization = normalize(doc.specialization || "")
      if (!docSpecialization) return true // If doctor has no specialization, show them
      
      // Specialization mappings: category specialization -> doctor specialization variations
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
      
      // Check if any category specialization matches the doctor's specialization
      return category.relatedSpecializations.some(categorySpec => {
        const categorySpecLower = normalize(categorySpec)
        
        // Direct match - check if doctor specialization contains category spec or vice versa
        if (docSpecialization.includes(categorySpecLower) || categorySpecLower.includes(docSpecialization)) {
          return true
        }
        
        // Check if doctor specialization matches any variation of the category specialization
        const variations = specializationMappings[categorySpecLower] || []
        for (const variation of variations) {
          const variationNormalized = normalize(variation)
          // Check if doctor specialization contains variation or variation contains doctor specialization
          if (docSpecialization.includes(variationNormalized) || variationNormalized.includes(docSpecialization)) {
            return true
          }
          // Also check word-by-word matching for better accuracy
          const docWords = docSpecialization.split(/\s+/)
          const varWords = variationNormalized.split(/\s+/)
          if (varWords.some(word => docWords.includes(word) && word.length > 3)) {
            return true
          }
        }
        
        return false
      })
    })
  }, [symptomCategory, doctors])

  // Calculate which doctors are recommended vs all others
  const recommendedDoctors = filteredDoctors.length > 0 ? filteredDoctors : (symptomCategory && symptomCategory !== "custom" ? [] : doctors)
  const otherDoctors = symptomCategory && symptomCategory !== "custom" && recommendedDoctors.length > 0
    ? doctors.filter((doc: any) => !recommendedDoctors.some((filtered: any) => filtered.id === doc.id))
    : []

  // Doctor search: applied on top of symptom-filtered list for the card grid
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

  // Clear additional fees when doctor is deselected
  useEffect(() => {
    if (!selectedDoctorId) {
      setAdditionalFees([])
    }
  }, [selectedDoctorId])

  // Handle doctor selection with confirmation for non-recommended doctors
  const handleDoctorSelect = (doctorId: string) => {
    const isRecommended = recommendedDoctors.some((doc: any) => doc.id === doctorId)
    
    if (isRecommended || !symptomCategory || symptomCategory === "custom") {
      setSelectedDoctorId(doctorId)
    } else {
      setPendingDoctorId(doctorId)
      setShowDoctorConfirmModal(true)
    }
  }

  // Confirm selection of non-recommended doctor
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
    if (patientMode === "new") {
      setNewPatient(initialNewPatient)
      setNewPatientPassword(RECEPTIONIST_DEFAULT_PASSWORD)
      setNewPatientPasswordConfirm(RECEPTIONIST_DEFAULT_PASSWORD)
    } else {
      setSearchPatient("")
      setSelectedPatientId("")
      setSelectedPatientInfo(null)
    }
  }, [patientMode])

  useEffect(() => {
    if (!patientMode || patientMode !== "existing") return
    if (!selectedPatientId) {
      setSelectedPatientInfo(null)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        setPatientInfoLoading(true)
        setPatientInfoError(null)
        const snap = await getDoc(doc(db, "patients", selectedPatientId))
        if (!cancelled) {
          if (snap.exists()) {
            setSelectedPatientInfo({ id: snap.id, ...snap.data() })
          } else {
            setPatientInfoError("Patient not found")
          }
        }
      } catch (error) {
        if (!cancelled) {
          setPatientInfoError(error instanceof Error ? error.message : "Failed to load patient")
        }
      } finally {
        if (!cancelled) {
          setPatientInfoLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId, patientMode])

  // Recompute slots when doctor schedule fields change — not on every doctors[] identity update
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
      if (!selectedDoctorId || !appointmentDate) return

      const doctor = selectedDoctor || {}
      const blockedDates: any[] = Array.isArray((doctor as any)?.blockedDates) ? (doctor as any).blockedDates : []
      if (isDateBlocked(appointmentDate, blockedDates)) {
        setAvailableSlots([])
        return
      }

      try {
        if (!activeHospitalId) return
        const aptQuery = query(
          getHospitalCollection(activeHospitalId, "appointments"),
          where("doctorId", "==", selectedDoctorId),
          where("appointmentDate", "==", appointmentDate)
        )
        const aptSnap = await getDocs(aptQuery)
        const existing = aptSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        
        const slotsQuery = query(
          collection(db, "appointmentSlots"),
          where("doctorId", "==", selectedDoctorId),
          where("appointmentDate", "==", appointmentDate)
        )
        const slotsSnap = await getDocs(slotsQuery)
        const bookedSlots = new Set<string>()
        slotsSnap.docs.forEach((docSnap) => {
          const slotData = docSnap.data()
          if (slotData.appointmentTime) {
            bookedSlots.add(normalizeTime(slotData.appointmentTime))
          }
        })
        
        const dateObj = new Date(`${appointmentDate}T00:00:00`)
        const slots = getAvailableTimeSlots(doctor as any, dateObj, existing as any)
        
        const filtered = slots.filter((s) => {
          if (isSlotInPast(s, appointmentDate)) return false
          if (bookedSlots.has(normalizeTime(s))) return false
          return true
        })
        
        setAvailableSlots(filtered)
      } catch {
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

  // Calculate dropdown position and close when clicking outside
  useEffect(() => {
    const updateDropdownPosition = () => {
      if (symptomDropdownRef.current && showSymptomDropdown) {
        const rect = symptomDropdownRef.current.getBoundingClientRect()
        setDropdownPosition({
          top: rect.bottom + 4, // For fixed positioning, use getBoundingClientRect directly
          left: rect.left,
          width: rect.width
        })
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showSymptomDropdown) {
        // Check if click is outside both the container and the portal dropdown
        const isOutsideContainer = !target.closest('.symptom-dropdown-container')
        const isOutsideDropdown = !target.closest('[data-symptom-dropdown]')
        if (isOutsideContainer && isOutsideDropdown) {
          setShowSymptomDropdown(false)
        }
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showSymptomDropdown) {
        setShowSymptomDropdown(false)
      }
    }

    if (showSymptomDropdown) {
      // Update position immediately and after a tiny delay to ensure DOM is ready
      updateDropdownPosition()
      const timeoutId = setTimeout(updateDropdownPosition, 0)
      window.addEventListener('resize', updateDropdownPosition)
      window.addEventListener('scroll', updateDropdownPosition, true)
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      
      return () => {
        clearTimeout(timeoutId)
        window.removeEventListener('resize', updateDropdownPosition)
        window.removeEventListener('scroll', updateDropdownPosition, true)
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [showSymptomDropdown])

  const handleExistingPatientSearch = (value: string) => {
    setSearchPatient(value)
    setShowPatientSuggestions(value.trim().length > 0)
    // Immediate match for exact matches
    const valLower = value.toLowerCase()
    const match = patients.find((p: any) => {
      const label = `${p.firstName} ${p.lastName} — ${p.email}`
      if (label.toLowerCase() === valLower) return true
      if (p.patientId && String(p.patientId).toLowerCase() === valLower) return true
      return false
    })
    setSelectedPatientId(match ? match.id : "")
  }

  const resetBookingForm = useCallback(() => {
    onPatientModeChange("existing")
    setSearchPatient("")
    setSelectedPatientId("")
    setSelectedPatientInfo(null)
    setNewPatient(initialNewPatient)
    setNewPatientPassword(RECEPTIONIST_DEFAULT_PASSWORD)
    setNewPatientPasswordConfirm(RECEPTIONIST_DEFAULT_PASSWORD)
    setSelectedDoctorId("")
    setSearchDoctor("")
    setAppointmentDate("")
    setAppointmentTime("")
    setSymptomCategory("")
    setCustomSymptom("")
    setSymptomSearch("")
    setShowSymptomDropdown(false)
    setPaymentMethod(null)
    setAdditionalFees([])
    setPaymentData(emptyBookingPayment)
    setAvailableSlots([])
  }, [onPatientModeChange])

  const createPatientForBooking = useCallback(async () => {
    return authedFetchJson<{ id: string; patientId?: string }>(
      "/api/receptionist/create-patient",
      {
        method: "POST",
        body: JSON.stringify({
        patientData: {
          ...newPatient,
          status: "active",
          createdBy: "receptionist",
          createdAt: new Date().toISOString(),
        },
        password: newPatientPassword,
      }),
      },
      "Failed to create patient"
    )
  }, [newPatient, newPatientPassword])

  const createAppointment = useCallback(
    async (patientId: string, patientPayload: any) => {
      const doctor = doctors.find((x: any) => x.id === selectedDoctorId)
      
      // Try multiple phone number fields from patient data
      const patientPhone = patientPayload.phone || 
                          patientPayload.phoneNumber || 
                          patientPayload.contact ||
                          patientPayload.mobile ||
                          ""
      
      // Generate chiefComplaint from symptomCategory or customSymptom
      let chiefComplaint = ""
      if (customSymptom && customSymptom.trim().length > 0) {
        // Use custom symptom if provided
        chiefComplaint = customSymptom.trim()
      } else if (symptomCategory && symptomCategory !== "custom" && symptomCategory.trim().length > 0) {
        // Find the symptom category label
        const category = SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)
        if (category) {
          chiefComplaint = category.label
        }
      }
      // If neither is provided, chiefComplaint will be empty string (API will handle it)
      
      // Generate medical history from patient data
      let medicalHistory = ""
      const historyParts: string[] = []
      if (patientPayload.allergies && patientPayload.allergies.trim().length > 0) {
        historyParts.push(`Allergies: ${patientPayload.allergies.trim()}`)
      }
      if (patientPayload.currentMedications && patientPayload.currentMedications.trim().length > 0) {
        historyParts.push(`Current medications: ${patientPayload.currentMedications.trim()}`)
      }
      medicalHistory = historyParts.join(". ")
      
      const appointmentData = {
        patientId,
        patientName: `${patientPayload.firstName || ""} ${patientPayload.lastName || ""}`.trim(),
        patientEmail: patientPayload.email || "",
        patientPhone: patientPhone,
        // Also include alternative phone fields for fallback
        patientPhoneNumber: patientPayload.phoneNumber || patientPayload.phone || "",
        patientContact: patientPayload.contact || patientPayload.mobile || "",
        doctorId: doctor?.id,
        doctorName: `${doctor?.firstName || ""} ${doctor?.lastName || ""}`.trim(),
        doctorSpecialization: doctor?.specialization || "",
        appointmentDate,
        appointmentTime,
        chiefComplaint: chiefComplaint || "General consultation",
        medicalHistory: medicalHistory || "",
        status: "confirmed",
        paymentAmount: paymentAmount,
        paymentMethod: paymentMethod,
        paymentType: "full",
        // Include additional fees if any
        additionalFees: additionalFees.length > 0 ? additionalFees.map(fee => ({
          description: fee.description,
          amount: fee.amount,
        })) : undefined,
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
    [appointmentDate, appointmentTime, doctors, paymentAmount, paymentMethod, selectedDoctorId, symptomCategory, customSymptom, additionalFees]
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
      if (!appointmentDate || !appointmentTime) throw new Error("Please select date and time")
      if (!availableSlots.includes(appointmentTime)) throw new Error("Selected time is not available")
      if (isSelectedDateBlocked) throw new Error("Doctor is not available on the selected date")
      if (!paymentMethod) throw new Error("Please select a payment method")
      if (paymentMethod === "card") {
        if (!paymentData.cardNumber || !paymentData.cardName || !paymentData.expiryDate || !paymentData.cvv) {
          throw new Error("Enter complete card details")
        }
      }
      if (paymentMethod === "upi" && !paymentData.upiId) {
        throw new Error("Enter UPI ID")
      }

      let patientId = selectedPatientId
      let patientPayload: any = null

      await assertAppointmentSlotAvailable(selectedDoctorId, appointmentDate, appointmentTime)

      if (patientMode === "new") {
        if (!newPatient.firstName || !newPatient.lastName || !newPatient.email) {
          throw new Error("Fill first name, last name, email")
        }
        if (newPatientPassword.length < 6) {
          throw new Error("Password must be at least 6 characters")
        }
        if (newPatientPassword !== newPatientPasswordConfirm) {
          throw new Error("Passwords do not match")
        }
        // Create patient directly without OTP verification (receptionist flow)
        const result = await createPatientForBooking()
        patientId = result.id
        patientPayload = { ...newPatient, patientId: result.patientId }
      } else {
        if (!patientId) {
          throw new Error("Please select an existing patient")
        }
        const patient = selectedPatientInfo || patients.find((x: any) => x.id === patientId)
        patientPayload = patient
      }

      await preventDuplicateAppointment(patientId)
      const appointmentData = await createAppointment(patientId, patientPayload)

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

  return (
    <div className="space-y-4 min-w-0 overflow-x-hidden [overflow-anchor:none]">

      {/* ── Compact page header ── */}
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
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => handlePatientModeChange("existing")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  patientMode === "existing"
                    ? "bg-white text-cyan-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Existing Patient
              </button>
              <button
                type="button"
                onClick={() => handlePatientModeChange("new")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  patientMode === "new"
                    ? "bg-white text-cyan-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                New Patient
              </button>
            </div>
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

      {/* ── Main workspace: guided steps (left) + live summary (right) ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_300px] min-w-0 items-start">

        {/* ── LEFT: Step-by-step booking ── */}
        <div className="space-y-4 min-w-0">

          {/* ── STEP 1: Patient ── */}
          <div className="rx-section-card">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                selectedPatientSnapshot ? "bg-emerald-500 text-white" : "bg-cyan-600 text-white"
              }`}>
                {selectedPatientSnapshot ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                ) : "1"}
              </span>
              <p className="text-sm font-semibold text-slate-900">Patient</p>
              {selectedPatientSnapshot && (
                <span className="ml-auto text-xs text-emerald-600 font-medium truncate max-w-[200px]">
                  {patientSummaryLabel}
                </span>
              )}
            </div>

            <div ref={patientPanelRef} className="p-4">
              <div className="relative min-h-[20rem]">
                {/* Existing patient panel */}
                <div
                  className={`absolute inset-0 space-y-3 overflow-y-auto pr-1 transition-opacity duration-150 ${
                    patientMode === "existing" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                  }`}
                  aria-hidden={patientMode !== "existing"}
                >
                  <div className="relative flex items-center">
                    <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      value={searchPatient}
                      onChange={(e) => handleExistingPatientSearch(e.target.value)}
                      placeholder="Name, email, phone, or patient ID…"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-12 py-2.5 text-sm shadow-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                      <div className="pointer-events-auto">
                        <VoiceInput
                          onTranscript={(text) => {
                            handleExistingPatientSearch(text)
                            setShowPatientSuggestions(true)
                          }}
                          language="en-IN"
                          useMedicalModel={false}
                          allowGujarati
                          variant="inline"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full">
                    {showPatientSuggestions && searchPatient.trim().length > 0 && (
                      <div
                        className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                        onMouseDown={(e) => e.preventDefault()}
                        onBlur={() => setShowPatientSuggestions(false)}
                      >
                        {filteredPatients.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-500">No results found</div>
                        ) : (
                          filteredPatients.slice(0, 10).map((p: any) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50 border-b border-slate-100 last:border-0"
                              onClick={() => {
                                setSelectedPatientId(p.id)
                                setSearchPatient(`${p.firstName} ${p.lastName} — ${p.email}`)
                                setShowPatientSuggestions(false)
                              }}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                                  {p.firstName?.charAt(0)}{p.lastName?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate">{p.firstName} {p.lastName}</p>
                                  <p className="text-xs text-slate-500 truncate">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                                  {p.patientId && <p className="text-[10px] font-mono text-slate-400">#{p.patientId}</p>}
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {selectedPatientId && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      {patientInfoLoading && <p className="text-xs text-slate-500">Loading patient details…</p>}
                      {patientInfoError && <p className="text-xs text-red-600">{patientInfoError}</p>}
                      {selectedPatientInfo && !patientInfoLoading && !patientInfoError && (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center text-sm font-bold text-cyan-700 flex-shrink-0">
                              {selectedPatientInfo.firstName?.charAt(0)}{selectedPatientInfo.lastName?.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">{selectedPatientInfo.firstName} {selectedPatientInfo.lastName}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {selectedPatientInfo.bloodGroup && (
                                  <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-1.5 py-0.5">{selectedPatientInfo.bloodGroup}</span>
                                )}
                                {selectedPatientInfo.gender && (
                                  <span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-md px-1.5 py-0.5 capitalize">{selectedPatientInfo.gender}</span>
                                )}
                                {selectedPatientInfo.phone && (
                                  <span className="text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">{selectedPatientInfo.phone}</span>
                                )}
                                {selectedPatientInfo.patientId && (
                                  <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">#{selectedPatientInfo.patientId}</span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSelectedPatientId(""); setSearchPatient(""); setSelectedPatientInfo(null) }}
                              className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                              title="Clear patient"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {(selectedPatientInfo.allergies || selectedPatientInfo.currentMedications) && (
                            <div className="flex flex-wrap gap-2">
                              {selectedPatientInfo.allergies && (
                                <span className="inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-md px-2 py-0.5">
                                  <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  Allergies: {selectedPatientInfo.allergies}
                                </span>
                              )}
                              {selectedPatientInfo.currentMedications && (
                                <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-md px-2 py-0.5">
                                  Meds: {selectedPatientInfo.currentMedications}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="pt-3 border-t border-slate-200">
                            <PatientConsentVideo
                              patientId={selectedPatientInfo.patientId || selectedPatientId}
                              patientUid={selectedPatientId}
                              patientName={`${selectedPatientInfo.firstName || ""} ${selectedPatientInfo.lastName || ""}`.trim()}
                              optional={true}
                              compact={true}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* New patient panel */}
                <div
                  className={`absolute inset-0 space-y-3 overflow-y-auto pr-1 transition-opacity duration-150 ${
                    patientMode === "new" ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                  }`}
                  aria-hidden={patientMode !== "new"}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      placeholder="First name"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      value={newPatient.firstName}
                      onChange={(e) => setNewPatient((v) => ({ ...v, firstName: e.target.value }))}
                    />
                    <input
                      placeholder="Last name"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      value={newPatient.lastName}
                      onChange={(e) => setNewPatient((v) => ({ ...v, lastName: e.target.value }))}
                    />
                    <input
                      placeholder="Email"
                      type="email"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      value={newPatient.email}
                      onChange={(e) => setNewPatient((v) => ({ ...v, email: e.target.value }))}
                    />
                    <input
                      placeholder="Phone"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient((v) => ({ ...v, phone: e.target.value }))}
                    />
                    <div className="space-y-1">
                      <input
                        placeholder="Password (default: 123456)"
                        type="password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        value={newPatientPassword}
                        onChange={(e) => setNewPatientPassword(e.target.value)}
                      />
                      <p className="text-[10px] text-slate-400">Min 6 chars. Patient can change later.</p>
                    </div>
                    <input
                      placeholder="Confirm password"
                      type="password"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      value={newPatientPasswordConfirm}
                      onChange={(e) => setNewPatientPasswordConfirm(e.target.value)}
                    />
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient((v) => ({ ...v, gender: e.target.value }))}
                    >
                      <option value="">Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      value={newPatient.bloodGroup}
                      onChange={(e) => setNewPatient((v) => ({ ...v, bloodGroup: e.target.value }))}
                    >
                      <option value="">Blood group</option>
                      {bloodGroups.map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">Date of Birth</label>
                      <input
                        type="date"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        max={todayStr}
                        value={newPatient.dateOfBirth}
                        onChange={(e) => setNewPatient((v) => ({ ...v, dateOfBirth: e.target.value }))}
                      />
                    </div>
                    <input
                      placeholder="Address"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100 sm:col-span-2"
                      value={newPatient.address}
                      onChange={(e) => setNewPatient((v) => ({ ...v, address: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── STEP 2: Visit Setup ── */}
          <div className="rx-section-card">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                selectedDoctorId && appointmentDate && appointmentTime ? "bg-emerald-500 text-white" : "bg-cyan-600 text-white"
              }`}>
                {selectedDoctorId && appointmentDate && appointmentTime ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                ) : "2"}
              </span>
              <p className="text-sm font-semibold text-slate-900">Visit Setup</p>
              {selectedDoctorId && appointmentDate && appointmentTime && (
                <span className="ml-auto text-xs text-emerald-600 font-medium">{appointmentSummaryLabel}</span>
              )}
            </div>

            <div className="p-4 space-y-5 overflow-visible">
              <div className="relative">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chief Complaint / Symptoms</label>
                <div className="mt-2 relative symptom-dropdown-container">
                  {/* Searchable Dropdown */}
                  <div
                    ref={symptomDropdownRef}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus-within:border-cyan-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-cyan-100 cursor-pointer"
                    onClick={() => {
                      if (!showSymptomDropdown && symptomDropdownRef.current) {
                        // Calculate position before opening
                        const rect = symptomDropdownRef.current.getBoundingClientRect()
                        setDropdownPosition({
                          top: rect.bottom + 4,
                          left: rect.left,
                          width: rect.width
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

                  {/* Dropdown Menu - Using Portal for proper z-index */}
                  {showSymptomDropdown && typeof window !== 'undefined' && createPortal(
                    <div 
                      data-symptom-dropdown
                      className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-hidden"
                      style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width || 400}px`
                      }}
                    >
                      {/* Search Input */}
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
                            onChange={(e) => {
                              setSymptomSearch(e.target.value)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Search symptoms..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-600"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Options List */}
                      <div className="max-h-64 overflow-y-auto">
                        {/* Clear/None Option */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSymptomCategory("")
                            setCustomSymptom("")
                            setSymptomSearch("")
                            setShowSymptomDropdown(false)
                            setSelectedDoctorId("")
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-600"
                        >
                          Clear selection
                        </button>

                        {/* Filtered Symptoms */}
                        {filteredSymptoms.length > 0 ? (
                          filteredSymptoms.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSymptomCategory(cat.id)
                                setSelectedDoctorId("")
                                setCustomSymptom("")
                                setSymptomSearch("")
                                setShowSymptomDropdown(false)
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cyan-50 ${
                                symptomCategory === cat.id ? "bg-cyan-100 font-semibold" : ""
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{cat.icon}</span>
                                <span>{cat.label}</span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-500 text-center">
                            No symptoms found
                          </div>
                        )}

                        {/* Custom Option */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSymptomCategory("custom")
                            setSelectedDoctorId("")
                            setCustomSymptom("")
                            setSymptomSearch("")
                            setShowSymptomDropdown(false)
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-cyan-50 border-t border-slate-200 ${
                            symptomCategory === "custom" ? "bg-cyan-100 font-semibold" : ""
                          }`}
                        >
                          Custom...
                        </button>
                      </div>
                    </div>
                    , document.body
                  )}
                </div>

                {symptomCategory === "custom" && (
                  <div className="mt-3 space-y-2">
                    <input
                      value={customSymptom}
                      onChange={(e) => setCustomSymptom(e.target.value)}
                      placeholder="Describe patient symptom (e.g., severe back pain)"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    />
                    <p className="text-xs text-slate-500">
                      Doctor list is not auto-filtered for custom notes. Please pick a doctor manually.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Doctor cards ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {symptomCategory && symptomCategory !== "custom" && recommendedDoctors.length > 0
                      ? `Recommended Doctors (${visibleDoctors.length})`
                      : `Select Doctor (${visibleDoctors.length}${searchDoctor ? ` of ${doctors.length}` : ""})`}
                  </label>
                  {selectedDoctorFee !== null && (
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2 py-0.5">
                      ₹{new Intl.NumberFormat("en-IN").format(selectedDoctorFee)} fee
                    </span>
                  )}
                </div>

                {/* Doctor search — only shown when 6+ doctors to avoid clutter */}
                {doctors.length >= 6 && (
                  <div className="relative mb-3">
                    <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchDoctor}
                      onChange={(e) => setSearchDoctor(e.target.value)}
                      placeholder="Search by name or specialization…"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-xs focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    />
                    {searchDoctor && (
                      <button
                        type="button"
                        onClick={() => setSearchDoctor("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {symptomCategory && symptomCategory !== "custom" && recommendedDoctors.length === 0 && doctors.length > 0 && (
                  <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    No doctors matched these symptoms — showing all available.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {visibleDoctors.length === 0 && searchDoctor ? (
                    <p className="sm:col-span-2 text-xs text-slate-400 py-4 text-center">
                      No doctors match &ldquo;{searchDoctor}&rdquo;
                    </p>
                  ) : visibleDoctors.map((doc: any) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleDoctorSelect(doc.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selectedDoctorId === doc.id
                          ? "border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          selectedDoctorId === doc.id ? "bg-cyan-200 text-cyan-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          {doc.firstName?.charAt(0)}{doc.lastName?.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            Dr. {doc.firstName} {doc.lastName}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{doc.specialization || "General"}</p>
                          {doc.consultationFee && (
                            <p className="text-[10px] font-bold text-teal-600 mt-0.5">
                              ₹{new Intl.NumberFormat("en-IN").format(doc.consultationFee)}
                            </p>
                          )}
                        </div>
                        {selectedDoctorId === doc.id && (
                          <svg className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Other (non-recommended) doctors */}
                {symptomCategory && symptomCategory !== "custom" && visibleOtherDoctors.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none list-none flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 py-1">
                      <svg className="h-3 w-3 transition-transform [[open]_&]:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {visibleOtherDoctors.length} other doctor{visibleOtherDoctors.length > 1 ? "s" : ""} (not specifically recommended)
                    </summary>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {visibleOtherDoctors.map((doc: any) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => handleDoctorSelect(doc.id)}
                          className={`text-left p-3 rounded-xl border transition-all opacity-70 hover:opacity-100 ${
                            selectedDoctorId === doc.id
                              ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200 opacity-100"
                              : "border-slate-200 bg-white hover:border-amber-200"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                              {doc.firstName?.charAt(0)}{doc.lastName?.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">Dr. {doc.firstName} {doc.lastName}</p>
                              <p className="text-[10px] text-slate-400 truncate">{doc.specialization || "General"}</p>
                              {doc.consultationFee && (
                                <p className="text-[10px] font-bold text-teal-600 mt-0.5">₹{new Intl.NumberFormat("en-IN").format(doc.consultationFee)}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </details>
                )}

                {selectedDoctorId && symptomCategory && symptomCategory !== "custom" && !recommendedDoctors.some((d: any) => d.id === selectedDoctorId) && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Not specifically recommended for these symptoms
                  </div>
                )}
              </div>

              {/* ── Date + visual time slot picker ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className={`mt-2 w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 ${
                      isSelectedDateBlocked
                        ? "border-red-400 bg-red-50 text-red-700"
                        : "border-slate-200 bg-white focus:border-cyan-600"
                    }`}
                  />
                  {isSelectedDateBlocked && (
                    <p className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      Doctor unavailable on this date — pick another.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Time Slot
                    {availableSlots.length > 0 && (
                      <span className="ml-1 normal-case font-normal text-slate-400">({availableSlots.length} open)</span>
                    )}
                  </label>
                  <div className="mt-2">
                    {!selectedDoctorId || !appointmentDate ? (
                      <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                        Select doctor &amp; date first
                      </p>
                    ) : isSelectedDateBlocked ? (
                      <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                        Doctor unavailable
                      </p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                        No slots available for this date
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                        {availableSlots.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setAppointmentTime(s)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                              appointmentTime === s
                                ? "bg-cyan-600 text-white border-cyan-600"
                                : "bg-white text-slate-700 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50"
                            }`}
                          >
                            {formatTimeDisplay(s)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── STEP 3: Payment ── */}
          <div className="rx-section-card">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                paymentMethod ? "bg-emerald-500 text-white" : "bg-cyan-600 text-white"
              }`}>
                {paymentMethod ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                ) : "3"}
              </span>
              <p className="text-sm font-semibold text-slate-900">Payment</p>
              {paymentMethod && (
                <span className="ml-auto text-xs text-emerald-600 font-medium">
                  {paymentMethodLabel} · ₹{new Intl.NumberFormat("en-IN").format(paymentAmount)}
                </span>
              )}
            </div>
            <div className="p-4 space-y-4">
              {selectedDoctorFee === null ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-400">
                  Select a doctor to see the consultation fee
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-sm font-medium text-slate-700">Consultation Fee</span>
                    <span className="text-base font-semibold text-slate-900">
                      ₹{new Intl.NumberFormat("en-IN").format(selectedDoctorFee)}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Additional Fees</h4>
                        <p className="text-xs text-slate-400 mt-0.5">File charges, reports, etc.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newFee: AdditionalFee = {
                            id: `fee-${Date.now()}-${Math.random()}`,
                            description: "",
                            amount: 0,
                          }
                          setAdditionalFees([...additionalFees, newFee])
                        }}
                      >
                        + Add
                      </Button>
                    </div>
                    {additionalFees.length > 0 && (
                      <div className="space-y-2">
                        {additionalFees.map((fee, index) => (
                          <div key={fee.id} className="flex gap-2 items-start p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                placeholder="Description (e.g., File Charges)"
                                value={fee.description}
                                onChange={(e) => {
                                  const updated = [...additionalFees]
                                  updated[index] = { ...fee, description: e.target.value }
                                  setAdditionalFees(updated)
                                }}
                                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100"
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">₹</span>
                                <input
                                  type="number"
                                  placeholder="Amount"
                                  value={fee.amount || ""}
                                  onChange={(e) => {
                                    const value = e.target.value === "" ? 0 : parseFloat(e.target.value)
                                    const updated = [...additionalFees]
                                    updated[index] = { ...fee, amount: isNaN(value) ? 0 : value }
                                    setAdditionalFees(updated)
                                  }}
                                  min="0"
                                  step="0.01"
                                  className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAdditionalFees(additionalFees.filter((_, i) => i !== index))}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {totalAdditionalFees > 0 && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className="text-xs font-medium text-slate-600">Additional Total</span>
                            <span className="text-sm font-semibold text-slate-900">
                              ₹{new Intl.NumberFormat("en-IN").format(totalAdditionalFees)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <PaymentMethodSection
                    paymentMethod={paymentMethod}
                    setPaymentMethod={setPaymentMethod}
                    paymentData={paymentData}
                    setPaymentData={(data) => setPaymentData(data as BookingPaymentData)}
                    amountToPay={paymentAmount}
                    title="Payment Mode"
                    methods={paymentMethods}
                  />
                </>
              )}

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-700">Total Due</span>
                <span className="text-xl font-bold text-slate-900">
                  {paymentAmount ? `₹${new Intl.NumberFormat("en-IN").format(paymentAmount)}` : "—"}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ── RIGHT: Sticky booking summary ── */}
        <div className="xl:sticky xl:top-4 space-y-3">
          <div className="rx-section-card">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Booking Summary</p>
            </div>
            <div className="p-4">
              <dl className="space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium shrink-0">Patient</dt>
                  <dd className={`text-right font-semibold truncate max-w-[160px] ${selectedPatientSnapshot ? "text-slate-900" : "text-slate-400"}`}>
                    {patientSummaryLabel}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium shrink-0">Contact</dt>
                  <dd className={`text-right truncate max-w-[160px] ${selectedPatientSnapshot ? "text-slate-700" : "text-slate-400"}`}>
                    {contactSummaryLabel}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium shrink-0">Doctor</dt>
                  <dd className={`text-right font-semibold truncate max-w-[160px] ${selectedDoctor ? "text-slate-900" : "text-slate-400"}`}>
                    {doctorSummaryLabel}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium shrink-0">Schedule</dt>
                  <dd className={`text-right truncate max-w-[160px] ${appointmentDate ? "text-slate-700" : "text-slate-400"}`}>
                    {appointmentSummaryLabel}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <dt className="text-slate-500 font-medium shrink-0">Symptoms</dt>
                  <dd className="text-right text-slate-600 truncate max-w-[160px]">{symptomSummary}</dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-slate-500 font-medium shrink-0">Payment</dt>
                  <dd className={`text-right font-semibold ${paymentMethod ? "text-slate-900" : "text-slate-400"}`}>
                    {paymentMethod
                      ? `${paymentMethodLabel} · ₹${new Intl.NumberFormat("en-IN").format(paymentAmount)}`
                      : paymentMethodLabel}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 pt-4 border-t border-slate-200">
                <Button
                  onClick={handleBookAppointment}
                  loading={bookLoading}
                  loadingText="Booking…"
                  size="lg"
                  className="w-full"
                >
                  Confirm Booking
                </Button>
              </div>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rx-metric-card">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Doctors</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{doctors.length}</p>
              <p className="text-[10px] text-slate-400">active</p>
            </div>
            <div className="rx-metric-card">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Open Slots</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {appointmentDate && selectedDoctorId ? availableSlots.length : "—"}
              </p>
              <p className="text-[10px] text-slate-400">
                {appointmentDate && selectedDoctorId ? "for selected date" : "select doctor & date"}
              </p>
            </div>
          </div>
        </div>

      </div>

      <AppointmentSuccessModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} appointmentData={successData} />

      {/* Doctor confirmation modal */}
      {showDoctorConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">Confirm Doctor Selection</h3>
              <p className="text-xs text-slate-500 mt-0.5">Not specifically recommended for these symptoms</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <svg className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-amber-800">
                  Symptoms: <strong>{symptomCategory && SYMPTOM_CATEGORIES.find(c => c.id === symptomCategory)?.label}</strong>
                </p>
              </div>
              {(() => {
                const doctorToConfirm = doctors.find((d: any) => d.id === pendingDoctorId)
                return doctorToConfirm ? (
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                      {doctorToConfirm.firstName?.charAt(0)}{doctorToConfirm.lastName?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Dr. {doctorToConfirm.firstName} {doctorToConfirm.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{doctorToConfirm.specialization}</p>
                      {doctorToConfirm.consultationFee && (
                        <p className="text-xs font-bold text-teal-700 mt-1">
                          ₹{new Intl.NumberFormat("en-IN").format(doctorToConfirm.consultationFee)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null
              })()}
            </div>
            <div className="px-5 py-4 flex justify-end gap-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDoctorConfirmModal(false)
                  setPendingDoctorId(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmDoctorSelection}>
                Select Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
