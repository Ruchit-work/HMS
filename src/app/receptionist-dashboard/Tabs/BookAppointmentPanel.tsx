"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import { createPortal } from "react-dom"
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore"
import { db, auth } from "@/firebase/config"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import PaymentMethodSection, {
  PaymentData as BookingPaymentData,
  PaymentMethodOption as BookingPaymentMethod,
} from "@/components/payments/PaymentMethodSection"
import PasswordRequirements, { isPasswordValid } from "@/components/forms/PasswordComponents"
import { AppointmentSuccessModal } from "@/components/patient/appointments/AppointmentModals"
import OTPVerificationModal from "@/components/forms/OTPVerificationModal"
import { bloodGroups } from "@/constants/signup"
import { SYMPTOM_CATEGORIES } from "@/components/patient/symptoms/SymptomSelector"
import { getAvailableTimeSlots, isSlotInPast, formatTimeDisplay, normalizeTime } from "@/utils/timeSlots"
import { isDateBlocked } from "@/utils/analytics/blockedDates"
import VoiceInput from "@/components/ui/VoiceInput"
import PatientConsentVideo from "@/components/consent/PatientConsentVideo"

interface BookAppointmentPanelProps {
  patientMode: "existing" | "new"
  onPatientModeChange: (_mode: "existing" | "new") => void
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
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

export default function BookAppointmentPanel({ patientMode, onPatientModeChange, onNotification }: BookAppointmentPanelProps) {
  const [bookLoading, setBookLoading] = useState(false)
  const [bookError, setBookError] = useState<string | null>(null)
  const [bookErrorFade, setBookErrorFade] = useState(false)

  const [doctors, setDoctors] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])

  const [searchPatient, setSearchPatient] = useState("")
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState("")
  const [selectedPatientInfo, setSelectedPatientInfo] = useState<any | null>(null)
  const [patientInfoLoading, setPatientInfoLoading] = useState(false)
  const [patientInfoError, setPatientInfoError] = useState<string | null>(null)

  const [newPatient, setNewPatient] = useState<NewPatientForm>(initialNewPatient)
  const [newPatientPassword, setNewPatientPassword] = useState("")
  const [newPatientPasswordConfirm, setNewPatientPasswordConfirm] = useState("")

  const [selectedDoctorId, setSelectedDoctorId] = useState("")
  const [selectedDoctorFee, setSelectedDoctorFee] = useState<number | null>(null)
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

  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [successData, setSuccessData] = useState<any>(null)
  const [pendingDoctorId, setPendingDoctorId] = useState<string | null>(null)
  const [showDoctorConfirmModal, setShowDoctorConfirmModal] = useState(false)

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  
  // Calculate total payment amount: consultation fee + additional fees
  const totalAdditionalFees = useMemo(() => {
    return additionalFees.reduce((sum, fee) => sum + (fee.amount || 0), 0)
  }, [additionalFees])
  
  const paymentAmount = useMemo(() => {
    return (selectedDoctorFee || 0) + totalAdditionalFees
  }, [selectedDoctorFee, totalAdditionalFees])


  const selectedDoctor = useMemo(() => {
    if (!selectedDoctorId) return null
    return doctors.find((d: any) => d.id === selectedDoctorId) || null
  }, [doctors, selectedDoctorId])

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

  const summaryStats = useMemo(
    () => {
      const doctorsValue = new Intl.NumberFormat("en-US").format(doctors.length)
      const patientsModeCount = patientMode === "existing" ? filteredPatients.length : patients.length
      const patientsValue = new Intl.NumberFormat("en-US").format(patientsModeCount)
      const openSlots = appointmentDate && selectedDoctorId ? availableSlots.length : 0
      const slotsValue = appointmentDate && selectedDoctorId ? `${openSlots}` : "—"
      const slotsCaption = appointmentDate && selectedDoctorId ? "Slots ready for this doctor" : "Select doctor & date"
      const paymentValue = paymentAmount ? `₹${new Intl.NumberFormat("en-IN").format(paymentAmount)}` : "₹0"
      const paymentCaption = selectedDoctorFee ? "Estimated consultation fee" : "Select doctor to estimate"

      return [
        {
          title: "Active Doctors",
          value: doctorsValue,
          caption: "Available to schedule",
          iconPath: "M19 11H5m7-7v14",
          iconBg: "bg-emerald-100 text-emerald-600",
        },
        {
          title: patientMode === "existing" ? "Patients Loaded" : "New Patient Form",
          value: patientsValue,
          caption:
            patientMode === "existing" ? "Searchable across active records" : "Fill details to create profile",
          iconPath: "M12 12c2.21 0 4-1.79 4-4S14.21 4 12 4 8 5.79 8 8s1.79 4 4 4zm0 0c-3.33 0-6 2.24-6 5v1h12v-1c0-2.76-2.67-5-6-5z",
          iconBg: "bg-amber-100 text-amber-600",
        },
        {
          title: "Open Slots",
          value: slotsValue,
          caption: slotsCaption,
          iconPath: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
          iconBg: "bg-sky-100 text-sky-600",
        },
        {
          title: "Payment Preview",
          value: paymentValue,
          caption: paymentCaption,
          iconPath: "M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0-6C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z",
          iconBg: "bg-rose-100 text-rose-600",
        },
      ]
    },
    [
      doctors.length,
      patients.length,
      filteredPatients.length,
      patientMode,
      appointmentDate,
      selectedDoctorId,
      availableSlots.length,
      paymentAmount,
      selectedDoctorFee,
    ]
  )

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

  // Reset additional fees when doctor changes
  useEffect(() => {
    if (selectedDoctorId) {
      // Keep additional fees when doctor changes (optional - you can remove this if you want to reset)
      // setAdditionalFees([])
    } else {
      setAdditionalFees([])
    }
  }, [selectedDoctorId])

  // Handle doctor selection with confirmation for non-recommended doctors
  const handleDoctorSelect = (doctorId: string) => {
    const isRecommended = recommendedDoctors.some((doc: any) => doc.id === doctorId)
    
    if (isRecommended || !symptomCategory || symptomCategory === "custom") {
      // Direct selection for recommended doctors or when no category selected
      setSelectedDoctorId(doctorId)
      const selected = doctors.find((d: any) => d.id === doctorId)
      setSelectedDoctorFee(selected?.consultationFee || null)
    } else {
      // Show confirmation for non-recommended doctors
      setPendingDoctorId(doctorId)
      setShowDoctorConfirmModal(true)
    }
  }

  // Confirm selection of non-recommended doctor
  const handleConfirmDoctorSelection = () => {
    if (pendingDoctorId) {
      setSelectedDoctorId(pendingDoctorId)
      const selected = doctors.find((d: any) => d.id === pendingDoctorId)
      setSelectedDoctorFee(selected?.consultationFee || null)
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

  const { activeHospitalId } = useMultiHospital()

  useEffect(() => {
    if (!activeHospitalId) return
    
    const doctorsQuery = query(getHospitalCollection(activeHospitalId, "doctors"), where("status", "==", "active"))
    const unsubscribe = onSnapshot(doctorsQuery, (snap) => {
      setDoctors(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })

    ;(async () => {
      try {
        const patientsQuery = query(getHospitalCollection(activeHospitalId, "patients"), where("status", "in", ["active", "inactive"]))
        const patientSnap = await getDocs(patientsQuery)
        setPatients(patientSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch {

      }
    })()

    return () => unsubscribe()
  }, [activeHospitalId])

  useEffect(() => {
    if (patientMode === "new") {
      setNewPatient(initialNewPatient)
      setNewPatientPassword("")
      setNewPatientPasswordConfirm("")
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

  useEffect(() => {
    const computeSlots = async () => {
      setAvailableSlots([])
      setAppointmentTime("")
      if (!selectedDoctorId || !appointmentDate) return

      const doctor = doctors.find((d: any) => d.id === selectedDoctorId) || {}
      const blockedDates: any[] = Array.isArray((doctor as any)?.blockedDates) ? (doctor as any).blockedDates : []
      if (isDateBlocked(appointmentDate, blockedDates)) {
        setAvailableSlots([])
        return
      }

      try {
        if (!activeHospitalId) return
        // Fetch existing appointments - use hospital-scoped collection
        const aptQuery = query(
          getHospitalCollection(activeHospitalId, "appointments"),
          where("doctorId", "==", selectedDoctorId),
          where("appointmentDate", "==", appointmentDate)
        )
        const aptSnap = await getDocs(aptQuery)
        const existing = aptSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        
        // Fetch booked slots from appointmentSlots collection (prevents double booking)
        const slotsQuery = query(
          collection(db, "appointmentSlots"),
          where("doctorId", "==", selectedDoctorId),
          where("appointmentDate", "==", appointmentDate)
        )
        const slotsSnap = await getDocs(slotsQuery)
        const bookedSlots = new Set<string>()
        slotsSnap.docs.forEach((doc) => {
          const slotData = doc.data()
          if (slotData.appointmentTime) {
            // Normalize time format to 24-hour HH:MM format (handles all formats)
            const normalizedTime = normalizeTime(slotData.appointmentTime)
            bookedSlots.add(normalizedTime)
          }
        })
        
        const dateObj = new Date(`${appointmentDate}T00:00:00`)
        const slots = getAvailableTimeSlots(doctor as any, dateObj, existing as any)
        
        // Filter out slots that are booked in appointmentSlots collection AND past slots
        const filtered = slots.filter((s) => {
          // Remove past slots
          if (isSlotInPast(s, appointmentDate)) return false
          // Normalize slot time for comparison (should already be in 24-hour format, but ensure it)
          const normalizedSlot = normalizeTime(s)
          // Remove slots that are booked in appointmentSlots collection
          if (bookedSlots.has(normalizedSlot)) return false
          return true
        })
        
        setAvailableSlots(filtered)
      } catch {

        setAvailableSlots([])
      }
    }

    computeSlots()
  }, [selectedDoctorId, appointmentDate, doctors, activeHospitalId])

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
    setNewPatientPassword("")
    setNewPatientPasswordConfirm("")
    setSelectedDoctorId("")
    setSelectedDoctorFee(null)
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
    // Get Firebase Auth token
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error("You must be logged in to create patients")
    }

    const token = await currentUser.getIdToken()

    const res = await fetch("/api/receptionist/create-patient", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        patientData: {
          ...newPatient,
          status: "active",
          createdBy: "receptionist",
          createdAt: new Date().toISOString(),
        },
        password: newPatientPassword,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.error || "Failed to create patient")
    }
    return res.json()
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
      
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to create appointments")
      }

      const token = await currentUser.getIdToken()

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
      const res = await fetch("/api/receptionist/create-appointment", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ appointmentData }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to create appointment")
      }
      return appointmentData
    },
    [appointmentDate, appointmentTime, doctors, paymentAmount, paymentMethod, selectedDoctorId, symptomCategory, customSymptom, additionalFees]
  )

  const preventDuplicateAppointment = useCallback(
    async (patientId: string) => {
      try {
        const dupQuery = query(
          collection(db, "appointments"),
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
    [appointmentDate]
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

      // Check slot availability FIRST (before patient creation or payment)
      const slotCheckResponse = await fetch(
        `/api/appointments/check-slot?doctorId=${selectedDoctorId}&date=${appointmentDate}&time=${appointmentTime}`
      )
      if (!slotCheckResponse.ok) {
        const slotData = await slotCheckResponse.json().catch(() => ({}))
        throw new Error(slotData?.error || "This slot is already booked. Please choose another time.")
      }
      const slotData = await slotCheckResponse.json().catch(() => ({}))
      if (!slotData?.available) {
        throw new Error(slotData?.error || "This slot is already booked. Please choose another time.")
      }

      if (patientMode === "new") {
        if (!newPatient.firstName || !newPatient.lastName || !newPatient.email) {
          throw new Error("Fill first name, last name, email")
        }
        if (!isPasswordValid(newPatientPassword)) {
          throw new Error("Password does not meet requirements")
        }
        if (newPatientPassword !== newPatientPasswordConfirm) {
          throw new Error("Passwords do not match")
        }
        if ((newPatient.phone || "").trim()) {
          // Slot already checked above, safe to proceed to OTP
          setOtpModalOpen(true)
          return
        }
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

  const handleOtpVerified = async () => {
    try {
      setBookLoading(true)
      setBookError(null)

      // Check slot availability FIRST (before patient creation - prevents wasting time/money)
      const slotCheckResponse = await fetch(
        `/api/appointments/check-slot?doctorId=${selectedDoctorId}&date=${appointmentDate}&time=${appointmentTime}`
      )
      if (!slotCheckResponse.ok) {
        const slotData = await slotCheckResponse.json().catch(() => ({}))
        throw new Error(slotData?.error || "This slot is already booked. Please choose another time.")
      }
      const slotData = await slotCheckResponse.json().catch(() => ({}))
      if (!slotData?.available) {
        throw new Error(slotData?.error || "This slot is already booked. Please choose another time.")
      }

      const result = await createPatientForBooking()
      const patientId = result.id
      const patientPayload: any = { ...newPatient, patientId: result.patientId }

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
      setOtpModalOpen(false)
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
    <div className="space-y-8">
      <section className="relative overflow-visible rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-6 py-8 shadow-sm">
        <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-emerald-100 opacity-30" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-sky-200 opacity-20" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Appointment Desk</span>
            <h2 className="text-3xl font-semibold text-slate-900">Book Appointment</h2>
            <p className="text-sm text-slate-600">
              Coordinate patient visits with guided steps, live doctor availability, and payment clarity in one view.
            </p>
          </div>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            {summaryStats.map((stat) => (
              <div
                key={stat.title}
                className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={stat.iconPath} />
                    </svg>
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{stat.title}</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-500">{stat.caption}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Booking for</span>
          <div className="flex rounded-2xl bg-white/90 p-1 shadow-inner backdrop-blur">
            <button
              type="button"
              onClick={() => onPatientModeChange("existing")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                patientMode === "existing"
                  ? "bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-200"
                  : "text-slate-500 hover:text-emerald-600"
              }`}
            >
              Existing patient
            </button>
            <button
              type="button"
              onClick={() => onPatientModeChange("new")}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                patientMode === "new"
                  ? "bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-200"
                  : "text-slate-500 hover:text-emerald-600"
              }`}
            >
              New patient
            </button>
          </div>
        </div>
      </section>

      {bookError && (
        <div
          className={`rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700 shadow-sm transition-opacity duration-700 ${
            bookErrorFade ? "opacity-0" : "opacity-100"
          }`}
        >
          {bookError}
        </div>
      )}

      <section className="grid gap-8 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Patient Details</h3>
                <p className="text-sm text-slate-600">
                  Switch between searching existing records or onboarding a brand-new patient profile.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {patientMode === "existing" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search patient</label>
                    <VoiceInput
                      onTranscript={(text) => {
                        handleExistingPatientSearch(text)
                        setShowPatientSuggestions(true)
                      }}
                      language="en-IN"
                      useMedicalModel={false}
                      className="shrink-0"
                    />
                  </div>
                  <div className="relative">
                    <input
                      value={searchPatient}
                      onChange={(e) => handleExistingPatientSearch(e.target.value)}
                      placeholder="Search by name, email, phone, or patient ID — or use voice"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    {showPatientSuggestions && searchPatient.trim().length > 0 && (
                      <div
                        className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white/90 shadow-lg backdrop-blur-sm"
                        onMouseDown={(e) => e.preventDefault()}
                        onBlur={() => setShowPatientSuggestions(false)}
                      >
                        {filteredPatients.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-slate-500">No results found</div>
                        ) : (
                          filteredPatients.slice(0, 10).map((p: any) => {
                            const label = `${p.firstName} ${p.lastName} — ${p.email}`
                            return (
                              <button
                                key={p.id}
                                type="button"
                                className="w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50"
                                onClick={() => {
                                  setSelectedPatientId(p.id)
                                  setSearchPatient(label)
                                  setShowPatientSuggestions(false)
                                }}
                              >
                                <div className="font-medium text-slate-900">
                                  {p.firstName} {p.lastName}
                                </div>
                                <div className="text-xs text-slate-600">
                                  {p.email}
                                  {p.phone ? ` • ${p.phone}` : ""}
                                </div>
                                {p.patientId && (
                                  <div className="text-[11px] font-mono text-slate-500">ID: {p.patientId}</div>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {selectedPatientId && (
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                      {patientInfoLoading && <div className="text-xs text-slate-500">Loading patient details…</div>}
                      {patientInfoError && <div className="text-xs text-red-600">{patientInfoError}</div>}
                      {selectedPatientInfo && !patientInfoLoading && !patientInfoError && (
                        <div className="space-y-4 text-sm text-slate-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Linked patient</p>
                              <p className="mt-1 text-lg font-semibold text-slate-900">
                                {selectedPatientInfo.firstName} {selectedPatientInfo.lastName}
                              </p>
                            </div>
                            {selectedPatientInfo.bloodGroup && (
                              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                {selectedPatientInfo.bloodGroup}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                              {selectedPatientInfo.email || "—"}
                            </div>
                            <div>
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
                              {selectedPatientInfo.phone || "—"}
                            </div>
                            <div>
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Patient ID</span>
                              {selectedPatientInfo.patientId || "—"}
                            </div>
                            <div>
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Gender</span>
                              {selectedPatientInfo.gender || "—"}
                            </div>
                            <div>
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">DOB</span>
                              {selectedPatientInfo.dateOfBirth || "—"}
                            </div>
                            {selectedPatientInfo.address && (
                              <div className="sm:col-span-2">
                                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Address</span>
                                {selectedPatientInfo.address}
                              </div>
                            )}
                          </div>

                          {(selectedPatientInfo.allergies || selectedPatientInfo.currentMedications) && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {selectedPatientInfo.allergies && (
                                <div>
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Allergies</span>
                                  {selectedPatientInfo.allergies}
                                </div>
                              )}
                              {selectedPatientInfo.currentMedications && (
                                <div>
                                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Medications</span>
                                  {selectedPatientInfo.currentMedications}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="pt-4 border-t border-slate-200">
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
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input
                      placeholder="First name"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      value={newPatient.firstName}
                      onChange={(e) => setNewPatient((v) => ({ ...v, firstName: e.target.value }))}
                    />
                    <input
                      placeholder="Last name"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      value={newPatient.lastName}
                      onChange={(e) => setNewPatient((v) => ({ ...v, lastName: e.target.value }))}
                    />
                    <input
                      placeholder="Email"
                      type="email"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      value={newPatient.email}
                      onChange={(e) => setNewPatient((v) => ({ ...v, email: e.target.value }))}
                    />
                    <input
                      placeholder="Phone"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient((v) => ({ ...v, phone: e.target.value }))}
                    />
                    <div className="space-y-2">
                      <input
                        placeholder="Password"
                        type="password"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        value={newPatientPassword}
                        onChange={(e) => setNewPatientPassword(e.target.value)}
                      />
                      <PasswordRequirements password={newPatientPassword} />
                    </div>
                    <input
                      placeholder="Confirm password"
                      type="password"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      value={newPatientPasswordConfirm}
                      onChange={(e) => setNewPatientPasswordConfirm(e.target.value)}
                    />
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient((v) => ({ ...v, gender: e.target.value }))}
                    >
                      <option value="">Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <select
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Birthday</label>
                      <input
                        type="date"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        max={todayStr}
                        value={newPatient.dateOfBirth}
                        onChange={(e) => setNewPatient((v) => ({ ...v, dateOfBirth: e.target.value }))}
                      />
                    </div>
                    <input
                      placeholder="Address"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:col-span-2"
                      value={newPatient.address}
                      onChange={(e) => setNewPatient((v) => ({ ...v, address: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 shadow-inner">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Booking summary</h4>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                    {patientMode === "existing" ? "Existing" : "New"}
                  </span>
                </div>
                <dl className="mt-4 space-y-3 text-xs text-slate-600">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <dt className="font-semibold text-slate-500">Patient</dt>
                    <dd className="text-right font-medium text-slate-900">{patientSummaryLabel}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <dt className="font-semibold text-slate-500">Contact</dt>
                    <dd className="text-right">{contactSummaryLabel}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <dt className="font-semibold text-slate-500">Doctor</dt>
                    <dd className="text-right">{doctorSummaryLabel}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <dt className="font-semibold text-slate-500">Schedule</dt>
                    <dd className="text-right">{appointmentSummaryLabel}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                    <dt className="font-semibold text-slate-500">Symptoms</dt>
                    <dd className="text-right">{symptomSummary}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="font-semibold text-slate-500">Payment</dt>
                    <dd className="text-right">{paymentMethodLabel}</dd>
                  </div>
                </dl>
              </div>

            </div>
          </div>

        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur overflow-visible">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Visit Setup</h3>
                <p className="text-sm text-slate-600">Define the symptoms, doctor, and time slot for this appointment.</p>
              </div>
            </div>

            <div className="mt-6 space-y-6 overflow-visible">
              <div className="relative">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Symptoms (suggest doctor)</label>
                <div className="mt-2 relative symptom-dropdown-container">
                  {/* Searchable Dropdown */}
                  <div
                    ref={symptomDropdownRef}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus-within:border-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-100 cursor-pointer"
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
                          ? "Custom..."
                          : symptomCategory
                          ? SYMPTOM_CATEGORIES.find((c) => c.id === symptomCategory)?.label || "Select symptoms (optional)"
                          : "Select symptoms (optional)"}
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
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
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
                            setSelectedDoctorFee(null)
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
                                setSelectedDoctorFee(null)
                                setCustomSymptom("")
                                setSymptomSearch("")
                                setShowSymptomDropdown(false)
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 ${
                                symptomCategory === cat.id ? "bg-emerald-100 font-semibold" : ""
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
                            setSelectedDoctorFee(null)
                            setCustomSymptom("")
                            setSymptomSearch("")
                            setShowSymptomDropdown(false)
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 border-t border-slate-200 ${
                            symptomCategory === "custom" ? "bg-emerald-100 font-semibold" : ""
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    />
                    <p className="text-xs text-slate-500">
                      Doctor list is not auto-filtered for custom notes. Please pick a doctor manually.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor</label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => {
                      const doctorId = e.target.value
                      if (doctorId) {
                        handleDoctorSelect(doctorId)
                      } else {
                        setSelectedDoctorId("")
                        setSelectedDoctorFee(null)
                      }
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Select doctor</option>
                    {/* Recommended Doctors Section */}
                    {symptomCategory && symptomCategory !== "custom" && recommendedDoctors.length > 0 && (
                      <>
                        <optgroup label={`⭐ Recommended for Symptoms (${recommendedDoctors.length})`}>
                          {recommendedDoctors.map((d: any) => (
                            <option key={d.id} value={d.id}>
                              {d.firstName} {d.lastName} — {d.specialization}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    )}
                    {/* Other Doctors Section */}
                    {symptomCategory && symptomCategory !== "custom" && otherDoctors.length > 0 && (
                      <>
                        <optgroup label={`👨‍⚕️ Other Doctors (${otherDoctors.length}) ⚠️ Not specifically recommended`}>
                          {otherDoctors.map((d: any) => (
                            <option key={d.id} value={d.id}>
                              {d.firstName} {d.lastName} — {d.specialization}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    )}
                    {/* Show all doctors if no category selected or no recommendations */}
                    {(!symptomCategory || symptomCategory === "custom" || recommendedDoctors.length === 0) && doctors.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.firstName} {d.lastName} — {d.specialization}
                      </option>
                    ))}
                  </select>
                  {symptomCategory && symptomCategory !== "custom" && recommendedDoctors.length === 0 && doctors.length > 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      ⚠️ No matching doctors found for selected symptoms. Showing all available doctors.
                    </p>
                  )}
                  {selectedDoctorFee !== null && (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-emerald-700">Consultation Fee</span>
                        <span className="text-lg font-semibold text-emerald-700">
                          ₹{new Intl.NumberFormat("en-IN").format(selectedDoctorFee)}
                        </span>
                      </div>
                      {symptomCategory && symptomCategory !== "custom" && selectedDoctorId && !recommendedDoctors.some((d: any) => d.id === selectedDoctorId) && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-xs text-amber-700 font-medium">
                            ⚠️ This doctor is not specifically recommended for the selected symptoms.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className={`mt-2 w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 ${
                      isSelectedDateBlocked
                        ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-100"
                        : "border-slate-200 bg-white focus:border-emerald-500"
                    }`}
                  />
                  {isSelectedDateBlocked && (
                    <div className="mt-2 text-sm bg-red-50 border-l-4 border-red-400 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="font-semibold text-red-800 text-xs mb-1">Date Not Available</p>
                          <p className="text-red-700 text-xs">Please select another date to continue.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available time</label>
                  <select
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    disabled={!selectedDoctorId || !appointmentDate || isSelectedDateBlocked}
                  >
                    <option value="">
                      {!selectedDoctorId || !appointmentDate
                        ? "Select doctor and date first"
                        : isSelectedDateBlocked
                        ? "Sorry, doctor not available"
                        : availableSlots.length
                        ? "Select time"
                        : "No slots available"}
                    </option>
                    {availableSlots.map((s) => (
                      <option key={s} value={s}>
                        {formatTimeDisplay(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Payment & Confirmation</h3>
                <p className="text-sm text-slate-600">Capture payment preference and finalize the booking.</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {selectedDoctorFee === null ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Select a doctor to preview consultation fee and available payment methods.
                </div>
              ) : (
                <>
                  {/* Consultation Fee Display */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">Consultation Fee</span>
                      <span className="text-base font-semibold text-slate-900">
                        ₹{new Intl.NumberFormat("en-IN").format(selectedDoctorFee)}
                      </span>
                    </div>
                  </div>

                  {/* Additional Fees Section */}
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Additional Fees</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Add file charges, blood reports, etc.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newFee: AdditionalFee = {
                            id: `fee-${Date.now()}-${Math.random()}`,
                            description: "",
                            amount: 0,
                          }
                          setAdditionalFees([...additionalFees, newFee])
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        + Add Fee
                      </button>
                    </div>

                    {additionalFees.length > 0 && (
                      <div className="space-y-2">
                        {additionalFees.map((fee, index) => (
                          <div key={fee.id} className="flex gap-2 items-start p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                placeholder="Description (e.g., File Charges, Blood Report)"
                                value={fee.description}
                                onChange={(e) => {
                                  const updated = [...additionalFees]
                                  updated[index] = { ...fee, description: e.target.value }
                                  setAdditionalFees(updated)
                                }}
                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600">₹</span>
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
                                  className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAdditionalFees(additionalFees.filter((_, i) => i !== index))
                              }}
                              className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        {totalAdditionalFees > 0 && (
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className="text-sm font-medium text-slate-700">Total Additional Fees</span>
                            <span className="text-base font-semibold text-slate-900">
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

              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Total Amount due</span>
                <span className="text-lg font-semibold text-slate-900">
                  {paymentAmount ? `₹${new Intl.NumberFormat("en-IN").format(paymentAmount)}` : "Not set"}
                </span>
              </div>

              <div className="flex justify-end">
                <button
                  disabled={bookLoading}
                  onClick={handleBookAppointment}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bookLoading ? "Booking..." : "Book Appointment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AppointmentSuccessModal isOpen={successOpen} onClose={() => setSuccessOpen(false)} appointmentData={successData} />

      {/* Doctor Selection Confirmation Modal */}
      {showDoctorConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            {/* Modal Header */}
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Confirm Doctor Selection</h3>
              <p className="text-xs text-slate-500 mt-1">You're selecting a doctor that's not specifically recommended</p>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 font-semibold mb-2 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>This doctor is not specifically recommended for the selected symptoms.</span>
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    You selected: <strong>{symptomCategory && SYMPTOM_CATEGORIES.find(c => c.id === symptomCategory)?.label}</strong>
                  </p>
                </div>

                {/* Doctor Information */}
                {(() => {
                  const doctorToConfirm = doctors.find((d: any) => d.id === pendingDoctorId)
                  return doctorToConfirm ? (
                    <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-100">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">👨‍⚕️</div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 mb-1">Selected Doctor</h4>
                          <p className="text-lg font-bold text-blue-700">
                            Dr. {doctorToConfirm.firstName} {doctorToConfirm.lastName}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {doctorToConfirm.specialization}
                          </p>
                          {doctorToConfirm.consultationFee && (
                            <p className="text-sm text-gray-500 mt-1">
                              Consultation Fee: ₹{doctorToConfirm.consultationFee}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null
                })()}

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-600">
                    <strong>Note:</strong> You can still select this doctor, but we recommend choosing from the suggested doctors above for better treatment of the specific symptoms.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowDoctorConfirmModal(false)
                  setPendingDoctorId(null)
                }}
                className="px-6 py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-all font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDoctorSelection}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <span>✓</span>
                <span>Yes, Select This Doctor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {otpModalOpen && (
        <OTPVerificationModal
          isOpen={otpModalOpen}
          onClose={() => setOtpModalOpen(false)}
          phone={newPatient.phone || ""}
          onChangePhone={() => setOtpModalOpen(false)}
          onVerified={handleOtpVerified}
        />
      )}
    </div>
  )
}
