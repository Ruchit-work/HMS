"use client"

import { useState, useEffect } from "react"
import { Doctor, UserData, AppointmentFormData, PaymentData, Appointment } from "@/types/patient"
import { Branch } from "@/types/branch"
import DoctorCard from "@/components/ui/DoctorCard"
import SymptomSelector, { SYMPTOM_CATEGORIES } from "./SymptomSelector"
import SmartQuestions from "./SmartQuestions"
import MedicalHistoryChecklist from "./MedicalHistoryChecklist"
import { isSlotInPast, formatTimeDisplay, isDoctorAvailableOnDate, getDayName, getVisitingHoursText, isDateBlocked, getBlockedDateInfo, generateTimeSlots, isTimeSlotAvailable, DEFAULT_VISITING_HOURS } from "@/utils/timeSlots"
import { isDateBlocked as isDateBlockedFromRaw } from "@/utils/blockedDates"
import PaymentMethodSection, { PaymentData as PPaymentData, PaymentMethodOption } from "@/components/payments/PaymentMethodSection"
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore"
import { db, auth } from "@/firebase/config"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"

interface BookAppointmentFormProps {
  user: { uid: string; email: string | null }
  userData: UserData
  doctors: Doctor[]
  onSubmit: (data: {
    selectedDoctor: string
    appointmentData: AppointmentFormData
    paymentMethod: "card" | "upi" | "cash"
    paymentType: "full" | "partial"
    paymentData: PaymentData
  }) => Promise<void>
  submitting: boolean
  // Reschedule mode: preselect doctor and jump to date/time only
  rescheduleMode?: boolean
  initialDoctorId?: string
}

export default function BookAppointmentForm({
  user,
  userData,
  doctors,
  onSubmit,
  submitting,
  rescheduleMode = false,
  initialDoctorId
}: BookAppointmentFormProps) {
  const { activeHospitalId } = useMultiHospital()
  const [currentStep, setCurrentStep] = useState(rescheduleMode ? 4 : 1)
  const [selectedDoctor, setSelectedDoctor] = useState(initialDoctorId || "")
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>("")
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [showBranchConfirm, setShowBranchConfirm] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [appointmentData, setAppointmentData] = useState<AppointmentFormData>({
    date: "",
    time: "",
    problem: "",
    medicalHistory: ""
  })
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodOption | null>(null)
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full")
  const [paymentData, setPaymentData] = useState<PaymentData>({
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
    upiId: ""
  })
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([])
  const [bookedTimeSlots, setBookedTimeSlots] = useState<string[]>([])
  const [allTimeSlots, setAllTimeSlots] = useState<string[]>([])
  const [pastTimeSlots, setPastTimeSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [hasDuplicateAppointment, setHasDuplicateAppointment] = useState(false)
  const [duplicateAppointmentTime, setDuplicateAppointmentTime] = useState("")
  // Inline editable profile state
  const [editingField, setEditingField] = useState<string | null>(null)
  const [profileDraft, setProfileDraft] = useState<Record<string, unknown>>({})
  const [localUserData, setLocalUserData] = useState<UserData>(userData)
  // Symptom selection state
  const [selectedSymptomCategory, setSelectedSymptomCategory] = useState<string | null>(null)
  const [previousSymptomCategory, setPreviousSymptomCategory] = useState<string | null>(null)
  const [symptomAnswers, setSymptomAnswers] = useState<any>({})
  const [medicalConditions, setMedicalConditions] = useState<string[]>([])
  const [allergies, setAllergies] = useState(userData?.allergies || "")
  const [currentMedications, setCurrentMedications] = useState(userData?.currentMedications || "")

  // Animation direction state
  const [slideDirection, setSlideDirection] = useState<'right' | 'left'>('right')

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  // Doctor selection confirmation modal (for non-recommended doctors)
  const [showDoctorConfirmModal, setShowDoctorConfirmModal] = useState(false)
  const [pendingDoctorId, setPendingDoctorId] = useState<string | null>(null)

  const totalSteps = rescheduleMode ? 4 : 5

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      if (!activeHospitalId) return
      
      try {
        setLoadingBranches(true)

        const currentUser = auth.currentUser
        if (!currentUser) {
          console.error("Error fetching branches: user not authenticated")
          setBranches([])
          return
        }

        const token = await currentUser.getIdToken()
        if (!token) {
          console.error("Error fetching branches: authentication token not found")
          setBranches([])
          return
        }

        const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        const data = await response.json()
        
        if (data.success && data.branches) {
          setBranches(data.branches)
          
          // Set default branch from patient's defaultBranchId if available
          if (userData?.defaultBranchId) {
            const defaultBranch = data.branches.find((b: Branch) => b.id === userData.defaultBranchId)
            if (defaultBranch) {
              setSelectedBranchId(defaultBranch.id)
              setSelectedBranch(defaultBranch)
            }
          } else if (data.branches.length > 0) {
            // If no default branch, select first branch
            setSelectedBranchId(data.branches[0].id)
            setSelectedBranch(data.branches[0])
          }
        }
      } catch (error) {
        console.error("Error fetching branches:", error)
      } finally {
        setLoadingBranches(false)
      }
    }

    fetchBranches()
  }, [activeHospitalId, userData?.defaultBranchId])

  // Ensure doctor stays preselected if provided later (doctors load async)
  useEffect(() => {
    if (initialDoctorId && !selectedDoctor) {
      setSelectedDoctor(initialDoctorId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDoctorId, selectedDoctor])

  // Keep local view in sync if parent sends fresh data
  useEffect(() => {
    setLocalUserData(userData)
  }, [userData])

  // Dynamic consultation fee based on selected doctor
  const selectedDoctorData = doctors.find(doc => doc.id === selectedDoctor)
  const CONSULTATION_FEE = selectedDoctorData?.consultationFee || 500
  
  // Calculate payment amounts based on payment type
  const PARTIAL_PAYMENT_AMOUNT = Math.ceil(CONSULTATION_FEE * 0.1) // 10% upfront
  const REMAINING_AMOUNT = CONSULTATION_FEE - PARTIAL_PAYMENT_AMOUNT // 90% at hospital
  const AMOUNT_TO_PAY = paymentType === "partial" ? PARTIAL_PAYMENT_AMOUNT : CONSULTATION_FEE

  // Fetch available time slots when doctor and date are selected
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!selectedDoctor || !appointmentData.date || !selectedDoctorData) {
        setAvailableTimeSlots([])
        setBookedTimeSlots([])
        setAllTimeSlots([])
        setPastTimeSlots([])
        setHasDuplicateAppointment(false)
        setDuplicateAppointmentTime("")
        return
      }

      setLoadingSlots(true)
      try {
        // Fetch all confirmed appointments for this doctor on this date (and branch if selected)
        const appointmentsQuery = selectedBranchId
          ? query(
              collection(db, "appointments"),
              where("doctorId", "==", selectedDoctor),
              where("appointmentDate", "==", appointmentData.date),
              where("branchId", "==", selectedBranchId),
              where("status", "==", "confirmed")
            )
          : query(
              collection(db, "appointments"),
              where("doctorId", "==", selectedDoctor),
              where("appointmentDate", "==", appointmentData.date),
              where("status", "==", "confirmed")
            )
        
        const snapshot = await getDocs(appointmentsQuery)
        const existingAppointments: Appointment[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Appointment))

        // Fetch all confirmed appointments for this patient on this date   
        const baseCollection = collection(db, "appointments")
        const patientAppointmentsByUidQuery = query(
          baseCollection,
          where("patientUid", "==", user.uid),
          where("doctorId", "==", selectedDoctor),
          where("appointmentDate", "==", appointmentData.date),
          where("status", "==", "confirmed")
        )
        const patientAppointmentsLegacyQuery = query(
          baseCollection,
          where("patientId", "==", user.uid),
          where("doctorId", "==", selectedDoctor),
          where("appointmentDate", "==", appointmentData.date),
          where("status", "==", "confirmed")
        )

        const [patientAppointmentsByUid, patientAppointmentsLegacy] = await Promise.all([
          getDocs(patientAppointmentsByUidQuery),
          getDocs(patientAppointmentsLegacyQuery)
        ])

        const patientAppointmentsMap = new Map<string, Appointment>()
        ;[...patientAppointmentsByUid.docs, ...patientAppointmentsLegacy.docs].forEach(docSnap => {
          patientAppointmentsMap.set(
            docSnap.id,
            { id: docSnap.id, ...docSnap.data() } as Appointment
          )
        })
        const patientAppointmentsList = Array.from(patientAppointmentsMap.values())

        if (patientAppointmentsList.length > 0) {
          setHasDuplicateAppointment(true)
          setDuplicateAppointmentTime(patientAppointmentsList[0].appointmentTime)
        }else{
          setHasDuplicateAppointment(false)
          setDuplicateAppointmentTime("")
        }


        // Get doctor's visiting hours for the selected date (use branch timings if available)
        const selectedDate = new Date(appointmentData.date)
        // Use branch timings if branch is selected, otherwise use doctor's visiting hours
        let visitingHours = selectedDoctorData.visitingHours || DEFAULT_VISITING_HOURS
        if (selectedBranch && selectedBranch.timings) {
          // Convert branch timings to VisitingHours format
          const branchVisitingHours = {
            monday: selectedBranch.timings.monday 
              ? { isAvailable: true, slots: [{ start: selectedBranch.timings.monday.start, end: selectedBranch.timings.monday.end }] }
              : { isAvailable: false, slots: [] },
            tuesday: selectedBranch.timings.tuesday 
              ? { isAvailable: true, slots: [{ start: selectedBranch.timings.tuesday.start, end: selectedBranch.timings.tuesday.end }] }
              : { isAvailable: false, slots: [] },
            wednesday: selectedBranch.timings.wednesday 
              ? { isAvailable: true, slots: [{ start: selectedBranch.timings.wednesday.start, end: selectedBranch.timings.wednesday.end }] }
              : { isAvailable: false, slots: [] },
            thursday: selectedBranch.timings.thursday 
              ? { isAvailable: true, slots: [{ start: selectedBranch.timings.thursday.start, end: selectedBranch.timings.thursday.end }] }
              : { isAvailable: false, slots: [] },
            friday: selectedBranch.timings.friday 
              ? { isAvailable: true, slots: [{ start: selectedBranch.timings.friday.start, end: selectedBranch.timings.friday.end }] }
              : { isAvailable: false, slots: [] },
            saturday: selectedBranch.timings.saturday 
              ? { isAvailable: true, slots: [{ start: selectedBranch.timings.saturday.start, end: selectedBranch.timings.saturday.end }] }
              : { isAvailable: false, slots: [] },
            sunday: selectedBranch.timings.sunday 
              ? { isAvailable: true, slots: [{ start: selectedBranch.timings.sunday.start, end: selectedBranch.timings.sunday.end }] }
              : { isAvailable: false, slots: [] },
          }
          // Check if doctor has branch-specific timings for this branch
          if (selectedDoctorData.branchTimings && selectedBranchId && selectedDoctorData.branchTimings[selectedBranchId]) {
            visitingHours = selectedDoctorData.branchTimings[selectedBranchId]
          } else {
            visitingHours = branchVisitingHours
          }
        }
        const dayName = getDayName(selectedDate)
        const daySchedule = visitingHours[dayName]

        // Respect blocked dates (normalize to YYYY-MM-DD; support string/Timestamp/object with date)
        const blockedDates: any[] = Array.isArray((selectedDoctorData as any)?.blockedDates) ? (selectedDoctorData as any).blockedDates : []
        if (blockedDates.length > 0 && isDateBlockedFromRaw(appointmentData.date, blockedDates)) {
          // Date is blocked - clear all slots
          setAllTimeSlots([])
          setBookedTimeSlots([])
          setPastTimeSlots([])
          setAvailableTimeSlots([])
          setHasDuplicateAppointment(false)
          setDuplicateAppointmentTime("")
          return
        }

        // Generate ALL possible time slots for this day
        if (daySchedule && daySchedule.isAvailable && daySchedule.slots.length > 0) {
          const allSlots = generateTimeSlots(daySchedule)
          setAllTimeSlots(allSlots)

          // Identify which slots are booked
          const booked = allSlots.filter(slot => {
            return existingAppointments.some(apt => apt.appointmentTime === slot)
          })
          setBookedTimeSlots(booked)

          // Identify which slots are in the past
          const past = allSlots.filter(slot => {
            return isSlotInPast(slot, appointmentData.date)
          })
          setPastTimeSlots(past)

          // Identify available slots (NOT booked AND NOT in past)
          const available = allSlots.filter(slot => {
            const notBooked = isTimeSlotAvailable(slot, existingAppointments)
            const notPast = !isSlotInPast(slot, appointmentData.date)
            return notBooked && notPast
          })
          setAvailableTimeSlots(available)
        } else {
          setAllTimeSlots([])
          setBookedTimeSlots([])
          setPastTimeSlots([])
          setAvailableTimeSlots([])
           setHasDuplicateAppointment(false)
           setDuplicateAppointmentTime("")
        }
      } catch (error) {
        console.error("Error fetching time slots:", error)
        setAvailableTimeSlots([])
        setBookedTimeSlots([])
        setAllTimeSlots([])
        setPastTimeSlots([])
        setHasDuplicateAppointment(false)
        setDuplicateAppointmentTime("")
      } finally {
        setLoadingSlots(false)
      }
    }

    fetchAvailableSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctor, appointmentData.date, selectedDoctorData, selectedBranchId, selectedBranch])

  const nextStep = () => {
    if (currentStep < totalSteps && canProceedToNextStep()) {
      // If moving from step 1, show branch confirmation
      if (currentStep === 1 && selectedBranchId) {
        setShowBranchConfirm(true)
        return
      }
      
      setSlideDirection('right') // Slide from right when going forward
      const newStep = currentStep + 1
      setCurrentStep(newStep)
      // Reset payment method when entering step 5 to require explicit selection
      if (!rescheduleMode && newStep === 5) {
        setPaymentMethod(null)
        setPaymentData({
          cardNumber: "",
          cardName: "",
          expiryDate: "",
          cvv: "",
          upiId: ""
        })
      }
    }
  }

  const handleConfirmBranch = () => {
    setShowBranchConfirm(false)
    setSlideDirection('right')
    const newStep = currentStep + 1
    setCurrentStep(newStep)
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setSlideDirection('left') // Slide from left when going backward
      setCurrentStep(currentStep - 1)
    }
  }

  // Inline profile edit helpers
  const startEdit = (field: string, initial: unknown) => {
    setEditingField(field)
    setProfileDraft({ [field]: initial ?? "" })
  }

  const cancelEdit = () => {
    setEditingField(null)
    setProfileDraft({})
  }

  const saveField = async (field: string) => {
    if (!user) return
    try {
      await updateDoc(doc(db, "patients", user.uid), { [field]: profileDraft[field], updatedAt: new Date().toISOString() })
      // Reflect immediately in local view
      setLocalUserData(prev => ({ ...prev, [field]: profileDraft[field] as never }))
      if (field === 'allergies') setAllergies(String(profileDraft[field] || ''))
      if (field === 'currentMedications') setCurrentMedications(String(profileDraft[field] || ''))
    } catch (e) {
      console.error("Inline profile update error:", e)
    } finally {
      setEditingField(null)
      setProfileDraft({})
    }
  }

  // Auto-generate chief complaint from structured data
  useEffect(() => {
    if (!selectedSymptomCategory) {
      // If category is cleared, also clear previous category tracking
      if (previousSymptomCategory) {
        setPreviousSymptomCategory(null)
      }
      return
    }

    const category = SYMPTOM_CATEGORIES.find(c => c.id === selectedSymptomCategory)
    if (!category) return

    const categoryLabel = category.label
    const currentProblem = (appointmentData.problem || '').trim()

    // If category changed (not first selection), reset problem to new category only
    if (previousSymptomCategory && previousSymptomCategory !== selectedSymptomCategory) {
      // Category changed - reset to just the new category label (user is changing their selection)
      setAppointmentData(prev => ({ ...prev, problem: categoryLabel }))
      setPreviousSymptomCategory(selectedSymptomCategory)
      return
    }

    // First time selecting this category
    if (!previousSymptomCategory) {
      setPreviousSymptomCategory(selectedSymptomCategory)
    }

    // If user already typed a free-text complaint, preserve it and prefix with the category (once)
    if (currentProblem.length > 0) {
      const alreadyPrefixed = currentProblem.toLowerCase().startsWith(categoryLabel.toLowerCase() + ':') || 
                              currentProblem.toLowerCase().startsWith(categoryLabel.toLowerCase() + ' :')
      if (!alreadyPrefixed) {
        const nextProblem = `${categoryLabel}: ${currentProblem}`
        if (nextProblem !== appointmentData.problem) {
          setAppointmentData(prev => ({ ...prev, problem: nextProblem }))
        }
      }
      return
    }

    // For cancer category, skip auto-generation here (handled by the other useEffect)
    if (selectedSymptomCategory === "cancer_oncology") {
      return
    }

    // Otherwise, build a helpful default from category + quick answers
    const parts: string[] = []
    if (symptomAnswers.description) {
      parts.push(String(symptomAnswers.description))
    } else if (symptomAnswers.reason) {
      parts.push(String(symptomAnswers.reason))
    } else {
      if (symptomAnswers.duration) parts.push(`for ${symptomAnswers.duration}`)
      if (symptomAnswers.symptoms && (symptomAnswers.symptoms as string[]).length > 0) {
        parts.push(`with ${(symptomAnswers.symptoms as string[]).join(', ')}`)
      }
    }

    // Persist additional concern for downstream (summary + doctor view)
    const additional = (symptomAnswers.description as string) || (symptomAnswers.concerns as string) || ''
    if (additional && additional !== appointmentData.additionalConcern) {
      setAppointmentData(prev => ({ ...prev, additionalConcern: additional }))
    }

    const detail = parts.join(' ')
    const complaint = detail ? `${categoryLabel}: ${detail}` : categoryLabel

    setAppointmentData(prev => ({ ...prev, problem: complaint }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymptomCategory, symptomAnswers, appointmentData.problem, appointmentData.additionalConcern, previousSymptomCategory])

  // Auto-generate medical history from selections
  useEffect(() => {
    let history = ''
    
    if (medicalConditions.length > 0) {
      history += `Existing conditions: ${medicalConditions.join(', ')}. `
    }
    if (allergies) {
      history += `Allergies: ${allergies}. `
    }
    if (currentMedications) {
      history += `Current medications: ${currentMedications}.`
    }
    
    setAppointmentData(prev => ({ ...prev, medicalHistory: history.trim() }))
  }, [medicalConditions, allergies, currentMedications])

  // When SmartQuestions updates, persist "Tell us more" free-text into appointment data
  useEffect(() => {
    // For cancer category, build comprehensive summary from all selected fields
    if (selectedSymptomCategory === "cancer_oncology") {
      const cancerParts: string[] = []
      
      if (symptomAnswers.cancerType) {
        cancerParts.push(`Type: ${symptomAnswers.cancerType}`)
      }
      if (symptomAnswers.visitType) {
        cancerParts.push(`Visit Type: ${symptomAnswers.visitType}`)
      }
      if (symptomAnswers.treatmentStatus) {
        cancerParts.push(`Status: ${symptomAnswers.treatmentStatus}`)
      }
      if (symptomAnswers.symptoms && Array.isArray(symptomAnswers.symptoms) && symptomAnswers.symptoms.length > 0) {
        const treatments = (symptomAnswers.symptoms as string[]).filter(s => s !== 'None / I don\'t know')
        if (treatments.length > 0) {
          cancerParts.push(`Current Treatments: ${treatments.join(', ')}`)
        }
      }
      if (symptomAnswers.additionalConcerns) {
        cancerParts.push(`Additional Concerns: ${symptomAnswers.additionalConcerns}`)
      }
      
      if (cancerParts.length > 0) {
        const cancerSummary = cancerParts.join(' | ')
        if (cancerSummary !== appointmentData.problem) {
          setAppointmentData(prev => ({ ...prev, problem: cancerSummary }))
        }
      }
    } else {
      // For other categories, use existing logic
      const additional = (symptomAnswers.description as string) || (symptomAnswers.concerns as string) || ''
      if (additional && additional !== appointmentData.additionalConcern) {
        setAppointmentData(prev => ({ ...prev, additionalConcern: additional }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symptomAnswers, selectedSymptomCategory, appointmentData.additionalConcern, appointmentData.problem])

  // Reset payment method to null whenever step 5 becomes active
  useEffect(() => {
    if (!rescheduleMode && currentStep === 5) {
      setPaymentMethod(null)
      setPaymentData({
        cardNumber: "",
        cardName: "",
        expiryDate: "",
        cvv: "",
        upiId: ""
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, rescheduleMode])

  // Filter doctors based on symptom category
  const filteredDoctors = selectedSymptomCategory 
    ? doctors.filter(doc => {
        const category = SYMPTOM_CATEGORIES.find(c => c.id === selectedSymptomCategory)
        if (!category) return true // If category not found, show all doctors
        
        // Normalize doctor specialization - remove special chars and convert to lowercase
        const normalize = (str: string) => str.toLowerCase().replace(/[()\/]/g, " ").replace(/\s+/g, " ").trim()
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
    : doctors

  // Calculate which doctors are recommended vs all others
  const recommendedDoctors = filteredDoctors
  const otherDoctors = selectedSymptomCategory && filteredDoctors.length > 0
    ? doctors.filter(doc => !filteredDoctors.some(filtered => filtered.id === doc.id))
    : []

  // Handle doctor selection with confirmation for non-recommended doctors
  const handleDoctorSelect = (doctorId: string) => {
    const isRecommended = recommendedDoctors.some(doc => doc.id === doctorId)
    
    if (isRecommended || !selectedSymptomCategory) {
      // Direct selection for recommended doctors or when no category selected
      setSelectedDoctor(doctorId)
    } else {
      // Show confirmation for non-recommended doctors
      setPendingDoctorId(doctorId)
      setShowDoctorConfirmModal(true)
    }
  }

  // Confirm selection of non-recommended doctor
  const handleConfirmDoctorSelection = () => {
    if (pendingDoctorId) {
      setSelectedDoctor(pendingDoctorId)
      setShowDoctorConfirmModal(false)
      setPendingDoctorId(null)
    }
  }

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1: return selectedBranchId !== "" // Require branch selection
      case 2: return (appointmentData.problem?.trim().length ?? 0) > 0 // Require free-text only
      case 3: return selectedDoctor !== ""
      case 4: return appointmentData.date !== "" && appointmentData.time !== "" && !hasDuplicateAppointment
      case 5: 
        // Payment step - require payment method selection
        if (!paymentMethod) return false
        // If card payment, require all card fields
        if (paymentMethod === "card") {
          return !!(paymentData.cardNumber && paymentData.cardName && paymentData.expiryDate && paymentData.cvv)
        }
        // If UPI payment, require UPI ID
        if (paymentMethod === "upi") {
          return !!paymentData.upiId
        }
        return true
      default: return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Only allow submission if we're on the final step
    if (currentStep !== totalSteps) {
      return
    }
    if (rescheduleMode) {
      // Directly submit without payment flow
      await onSubmit({
        selectedDoctor,
        appointmentData: {
          ...appointmentData,
          branchId: selectedBranchId
        },
        paymentMethod: "cash",
        paymentType: "full",
        paymentData: { cardNumber: "", cardName: "", expiryDate: "", cvv: "", upiId: "" }
      })
      return
    }

    // Normal flow shows confirmation modal
    // Validate payment method is selected
    if (!paymentMethod || paymentMethod === null) {
      return
    }
    if (paymentMethod === "card" && (!paymentData.cardNumber || !paymentData.cardName || !paymentData.expiryDate || !paymentData.cvv)) {
      return
    }
    if (paymentMethod === "upi" && !paymentData.upiId) {
      return
    }
    setShowConfirmModal(true)
  }

  const handleConfirmSubmit = async () => {
    if (!paymentMethod) return
    
    setShowConfirmModal(false)
    
    await onSubmit({
      selectedDoctor,
      appointmentData: {
        ...appointmentData,
        branchId: selectedBranchId
      },
      paymentMethod: paymentMethod as "card" | "upi" | "cash",
      paymentType,
      paymentData
    })

    // Reset form
    setCurrentStep(1)
    setAppointmentData({
      date: "",
      time: "",
      problem: "",
      medicalHistory: ""
    })
    setSelectedDoctor("")
    setPaymentData({
      cardNumber: "",
      cardName: "",
      expiryDate: "",
      cvv: "",
      upiId: ""
    })
    setPaymentMethod(null)
  }

  const handleClear = () => {
    setCurrentStep(1)
    setAppointmentData({
      date: "",
      time: "",
      problem: "",
      medicalHistory: ""
    })
    setSelectedDoctor("")
    setPaymentData({
      cardNumber: "",
      cardName: "",
      expiryDate: "",
      cvv: "",
      upiId: ""
    })
  }

  const steps = [
    { number: 1, title: "Patient Info", icon: "👤" },
    { number: 2, title: "Symptoms", icon: "🩺" },
    { number: 3, title: "Select Doctor", icon: "👨‍⚕️" },
    { number: 4, title: "Date & Time", icon: "📅" },
    { number: 5, title: "Payment", icon: "💳" }
  ]

  return (
    <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl shadow-lg overflow-hidden mb-6">
      {/* Modern Header with Gradient */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white text-2xl shadow-lg">
              📋
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Book New Appointment</h2>
              <p className="text-slate-100 text-xs sm:text-sm mt-0.5">Step {currentStep} of {totalSteps}: {steps[currentStep - 1].title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      {/* Mobile compact stepper */}
      <div className="bg-white px-4 py-3 border-b border-slate-200 sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-700">{steps[currentStep - 1].title}</span>
          <span className="text-xs text-slate-500">Step {currentStep} of {totalSteps}</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-2 bg-slate-700 rounded-full" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
        </div>
      </div>

      {/* Desktop/tablet full stepper */}
      <div className="bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 hidden sm:block">
        <div className="flex items-center justify-between">
          {steps.filter(s => rescheduleMode ? s.number <= 4 : true).map((step, index, arr) => (
            <div key={step.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
                  currentStep > step.number 
                    ? "bg-green-500 text-white" 
                    : currentStep === step.number 
                    ? "bg-slate-700 text-white ring-4 ring-slate-300" 
                    : "bg-slate-200 text-slate-400"
                }`}>
                  {currentStep > step.number ? "✓" : step.icon}
                </div>
                <p className={`text-xs mt-2 font-medium hidden sm:block ${
                  currentStep >= step.number ? "text-slate-800" : "text-slate-400"
                }`}>
                  {step.title}
                </p>
              </div>
              {index < arr.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded transition-all ${
                  currentStep > step.number ? "bg-green-500" : "bg-slate-200"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Container */}
      <div className="p-4 sm:p-6 overflow-hidden">
        <form onSubmit={handleSubmit} onKeyDown={(e) => {
          // Prevent Enter key from submitting form automatically
          // Only allow submission via explicit button click
          if (e.key === 'Enter') {
            e.preventDefault()
            // Only proceed if Enter is pressed on the submit button itself
            const target = e.target as HTMLButtonElement | HTMLInputElement
            if (currentStep === totalSteps && target.type === 'submit') {
              // Allow submission only if explicitly clicking submit button
              return
            }
          }
        }}>
          {/* Step 1: Patient Information */}
          {currentStep === 1 && (
            <div className={`space-y-4 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
              <div className="bg-white border-2 border-slate-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">👤</span>
                  <span>Patient Information</span>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium ml-2">Auto-filled</span>
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Patient ID</p>
                    <p className="text-sm font-mono text-slate-700 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                      {user?.uid || ""}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">First Name</p>
                      <p className="text-base font-medium text-slate-800 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                        {userData?.firstName || ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Last Name</p>
                      <p className="text-base font-medium text-slate-800 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                        {userData?.lastName || ""}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1 flex items-center gap-2">Phone {userData?.phoneNumber && (<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">From Profile</span>)}</p>
                      {editingField === 'phoneNumber' ? (
                        <div className="flex gap-2">
                          <input type="tel" defaultValue={String(userData?.phoneNumber || "")} onChange={(e)=>setProfileDraft({ phoneNumber: e.target.value })} className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                          <button type="button" onClick={()=>saveField('phoneNumber')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs">Save</button>
                          <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                          <span className="text-base text-slate-800">{userData?.phoneNumber || "Not provided"}</span>
                          <button type="button" onClick={()=>startEdit('phoneNumber', userData?.phoneNumber)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">Edit</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Email</p>
                      <p className="text-base text-slate-700 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                        {userData?.email || ""}
                      </p>
                    </div>
                  </div>
                  {/* Quick optional profile edits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Allergies</p>
                      {editingField === 'allergies' ? (
                        <div className="flex gap-2">
                          <input type="text" defaultValue={String(userData?.allergies || "")} onChange={(e)=>setProfileDraft({ allergies: e.target.value })} className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                          <button type="button" onClick={()=>saveField('allergies')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs">Save</button>
                          <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                          <span className="text-base text-slate-800">{userData?.allergies || "None reported"}</span>
                          <button type="button" onClick={()=>startEdit('allergies', userData?.allergies)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">Edit</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Current Medications</p>
                      {editingField === 'currentMedications' ? (
                        <div className="flex gap-2">
                          <input type="text" defaultValue={String(userData?.currentMedications || "")} onChange={(e)=>setProfileDraft({ currentMedications: e.target.value })} className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                          <button type="button" onClick={()=>saveField('currentMedications')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs">Save</button>
                          <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                          <span className="text-base text-slate-800">{userData?.currentMedications || "None"}</span>
                          <button type="button" onClick={()=>startEdit('currentMedications', userData?.currentMedications)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">Edit</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Smoking</p>
                      {editingField === 'smokingHabits' ? (
                        <div className="flex gap-2">
                          <select value={String((profileDraft.smokingHabits ?? localUserData?.smokingHabits) || "")} onChange={(e)=>setProfileDraft({ smokingHabits: e.target.value })} className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                            <option value="">Select</option>
                            <option value="Never">Never</option>
                            <option value="Occasionally">Occasionally</option>
                            <option value="Regularly">Regularly</option>
                          </select>
                          <button type="button" onClick={()=>saveField('smokingHabits')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs">Save</button>
                          <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                          <span className="text-base text-slate-800">{localUserData?.smokingHabits || "Not provided"}</span>
                          <button type="button" onClick={()=>startEdit('smokingHabits', userData?.smokingHabits)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">Edit</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Drinking</p>
                      {editingField === 'drinkingHabits' ? (
                        <div className="flex gap-2">
                          <select value={String((profileDraft.drinkingHabits ?? localUserData?.drinkingHabits) || "")} onChange={(e)=>setProfileDraft({ drinkingHabits: e.target.value })} className="flex-1 px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                            <option value="">Select</option>
                            <option value="Never">Never</option>
                            <option value="Occasionally">Occasionally</option>
                            <option value="Regularly">Regularly</option>
                          </select>
                          <button type="button" onClick={()=>saveField('drinkingHabits')} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs">Save</button>
                          <button type="button" onClick={cancelEdit} className="px-3 py-2 border border-slate-300 rounded-lg text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                          <span className="text-base text-slate-800">{localUserData?.drinkingHabits || "Not provided"}</span>
                          <button type="button" onClick={()=>startEdit('drinkingHabits', userData?.drinkingHabits)} className="text-xs text-purple-600 hover:text-purple-800 font-semibold">Edit</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Branch Selection */}
                  <div className="mt-6 pt-6 border-t-2 border-slate-300">
                    <label className="block text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="text-xl">🏥</span>
                      <span>Select Branch <span className="text-red-500">*</span></span>
                    </label>
                    {loadingBranches ? (
                      <div className="text-center py-4">
                        <svg className="animate-spin h-6 w-6 mx-auto text-slate-600" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-xs text-slate-500 mt-2">Loading branches...</p>
                      </div>
                    ) : branches.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {branches.map((branch) => {
                          const isSelected = selectedBranchId === branch.id
                          const isDefault = userData?.defaultBranchId === branch.id
                          return (
                            <button
                              key={branch.id}
                              type="button"
                              onClick={() => {
                                setSelectedBranchId(branch.id)
                                setSelectedBranch(branch)
                              }}
                              className={`p-4 rounded-xl border-2 transition-all text-left ${
                                isSelected
                                  ? "border-teal-600 bg-teal-50 shadow-md ring-2 ring-teal-200"
                                  : "border-slate-300 hover:border-slate-400 bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-lg font-bold text-slate-800">{branch.name}</span>
                                {isSelected && (
                                  <span className="text-teal-600 text-xl">✓</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mb-2">{branch.location}</p>
                              {isDefault && (
                                <span className="inline-block text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                  Your Default Branch
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-600">No branches available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Symptoms & Medical Information */}
          {!rescheduleMode && currentStep === 2 && (
            <div className={`space-y-3 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
              {/* Reset Button */}
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => {
                    // Reset all step 2 data
                    setSelectedSymptomCategory(null)
                    setSymptomAnswers({})
                    setMedicalConditions([])
                    setAllergies(userData?.allergies || "")
                    setCurrentMedications(userData?.currentMedications || "")
                    setAppointmentData(prev => ({
                      ...prev,
                      problem: "",
                      symptomDuration: "",
                      symptomProgression: "",
                      symptomTriggers: "",
                      associatedSymptoms: "",
                      additionalConcern: "",
                      medicalHistory: ""
                    }))
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border-2 border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset All
                </button>
              </div>

              {/* Required Free-text */}
              <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  What brings you here? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={appointmentData.problem}
                  onChange={(e) => setAppointmentData({ ...appointmentData, problem: e.target.value })}
                  rows={4}
                  placeholder="Describe your main concern in your own words"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 whitespace-pre-wrap break-words resize-y min-h-[110px] sm:min-h-[130px]"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Short is fine. Examples: “Fever and body pain since 2 days”, “Cough and cold”, “Stomach ache”.</p>
              </div>
              {/* Symptom Category Selection */}
              <div className="bg-white border-2 border-teal-200 rounded-xl p-4">
                <SymptomSelector
                  selectedCategory={selectedSymptomCategory}
                  onSelect={setSelectedSymptomCategory}
                />
              </div>

              {/* Smart Follow-up Questions (appears after category selected) */}
              {selectedSymptomCategory && (
                <div className="animate-fade-in">
                  <SmartQuestions
                    category={selectedSymptomCategory}
                    onComplete={setSymptomAnswers}
                  />
                </div>
              )}

              {/* Structured Symptom Details - Hide for cancer category */}
              {selectedSymptomCategory && selectedSymptomCategory !== "cancer_oncology" && (
                <div className="bg-white border-2 border-slate-200 rounded-xl p-4 animate-fade-in">
                  <h4 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <span>📝</span>
                    <span>Symptom Details</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Duration</label>
                      <input
                        type="text"
                        placeholder="e.g., 3 days / 2 weeks"
                        value={appointmentData.symptomDuration || ''}
                        onChange={(e) => setAppointmentData({ ...appointmentData, symptomDuration: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Progression</label>
                      <input
                        type="text"
                        placeholder="e.g., worsening / improving / unchanged"
                        value={appointmentData.symptomProgression || ''}
                        onChange={(e) => setAppointmentData({ ...appointmentData, symptomProgression: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Triggers / Relievers</label>
                      <input
                        type="text"
                        placeholder="e.g., worse on exertion; better with rest"
                        value={appointmentData.symptomTriggers || ''}
                        onChange={(e) => setAppointmentData({ ...appointmentData, symptomTriggers: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Associated Symptoms</label>
                      <input
                        type="text"
                        placeholder="e.g., fever, cough, nausea"
                        value={appointmentData.associatedSymptoms || ''}
                        onChange={(e) => setAppointmentData({ ...appointmentData, associatedSymptoms: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Medical History Checklist */}
              {selectedSymptomCategory && (
                <div className="animate-fade-in">
                  <MedicalHistoryChecklist
                    selectedConditions={medicalConditions}
                    allergies={allergies}
                    currentMedications={currentMedications}
                    onConditionsChange={setMedicalConditions}
                    onAllergiesChange={setAllergies}
                    onMedicationsChange={setCurrentMedications}
                  />
                </div>
              )}

              {/* Generated Summary */}
              {selectedSymptomCategory && appointmentData.problem && (
                <div className={`border rounded-lg p-2 animate-fade-in ${
                  selectedSymptomCategory === "cancer_oncology" 
                    ? "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300" 
                    : "bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-300"
                }`}>
                  <p className={`text-xs font-semibold mb-1 flex items-center gap-1 ${
                    selectedSymptomCategory === "cancer_oncology" ? "text-purple-700" : "text-teal-700"
                  }`}>
                    <span>✓</span>
                    <span>Summary:</span>
                  </p>
                  {selectedSymptomCategory === "cancer_oncology" ? (
                    <div className="space-y-1">
                      {symptomAnswers.cancerType && (
                        <p className="text-xs font-semibold text-slate-800">
                          <span className="text-purple-600">Type of Cancer:</span> {symptomAnswers.cancerType}
                        </p>
                      )}
                      {symptomAnswers.visitType && (
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold text-purple-600">Visit Type:</span> {symptomAnswers.visitType}
                        </p>
                      )}
                      {symptomAnswers.treatmentStatus && (
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold text-purple-600">Treatment Status:</span> {symptomAnswers.treatmentStatus}
                        </p>
                      )}
                      {symptomAnswers.symptoms && Array.isArray(symptomAnswers.symptoms) && symptomAnswers.symptoms.length > 0 && (
                        <p className="text-xs text-slate-700">
                          <span className="font-semibold text-purple-600">Current Treatments:</span> {
                            (symptomAnswers.symptoms as string[]).filter(s => s !== 'None / I don\'t know').join(', ') || 'None'
                          }
                        </p>
                      )}
                      {symptomAnswers.additionalConcerns && (
                        <p className="text-xs text-slate-700 mt-2 break-words whitespace-pre-wrap">
                          <span className="font-semibold text-purple-600">Additional Concerns:</span> {symptomAnswers.additionalConcerns}
                        </p>
                      )}
                      {appointmentData.medicalHistory && (
                        <p className="text-xs text-slate-600 mt-2 break-words whitespace-pre-wrap border-t border-purple-200 pt-2">
                          <span className="font-semibold">Medical History:</span> {appointmentData.medicalHistory}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-slate-800 break-words whitespace-pre-wrap">{appointmentData.problem}</p>
                      
                      {/* Symptom Details */}
                      {(appointmentData.symptomDuration || appointmentData.symptomProgression || appointmentData.symptomTriggers || appointmentData.associatedSymptoms) && (
                        <div className="mt-2 pt-2 border-t border-teal-200 space-y-1">
                          {appointmentData.symptomDuration && (
                            <p className="text-xs text-slate-700">
                              <span className="font-semibold text-teal-600">Duration:</span> {appointmentData.symptomDuration}
                            </p>
                          )}
                          {appointmentData.symptomProgression && (
                            <p className="text-xs text-slate-700">
                              <span className="font-semibold text-teal-600">Progression:</span> {appointmentData.symptomProgression}
                            </p>
                          )}
                          {appointmentData.symptomTriggers && (
                            <p className="text-xs text-slate-700">
                              <span className="font-semibold text-teal-600">Triggers/Relievers:</span> {appointmentData.symptomTriggers}
                            </p>
                          )}
                          {appointmentData.associatedSymptoms && (
                            <p className="text-xs text-slate-700">
                              <span className="font-semibold text-teal-600">Associated Symptoms:</span> {appointmentData.associatedSymptoms}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {appointmentData.medicalHistory && (
                        <p className="text-xs text-slate-600 mt-1 break-words whitespace-pre-wrap">{appointmentData.medicalHistory}</p>
                      )}
                      {appointmentData.additionalConcern && (
                        <p className="text-xs text-slate-700 mt-1 break-words whitespace-pre-wrap"><span className="font-semibold">Additional:</span> {appointmentData.additionalConcern}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Doctor Selection (moved from step 2) */}
          {!rescheduleMode && currentStep === 3 && (
            <div className={`space-y-4 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
              <div className="bg-white border-2 border-teal-200 rounded-xl p-4 sm:p-6">
                <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">👨‍⚕️</span>
                  <span>Select Your Doctor</span>
                  </h3>
                  {filteredDoctors.length < doctors.length && (
                    <span className="text-[10px] sm:text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Recommended</span>
                  )}
                </div>
                
                {/* Recommended Doctors Section */}
                {selectedSymptomCategory && recommendedDoctors.length > 0 && (
                  <>
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-sm font-semibold text-teal-700">⭐ Recommended for Your Symptoms</span>
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                        {recommendedDoctors.length} {recommendedDoctors.length === 1 ? 'doctor' : 'doctors'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
                      {recommendedDoctors.map((doctor) => (
                        <DoctorCard
                          key={doctor.id}
                          doctor={doctor}
                          isSelected={selectedDoctor === doctor.id}
                          onSelect={() => handleDoctorSelect(doctor.id)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Other Doctors Section */}
                {selectedSymptomCategory && recommendedDoctors.length > 0 && otherDoctors.length > 0 && (
                  <>
                    <div className="mb-4 flex items-center gap-2 border-t border-slate-200 pt-4">
                      <span className="text-sm font-semibold text-slate-600">👨‍⚕️ All Other Doctors</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        {otherDoctors.length} {otherDoctors.length === 1 ? 'doctor' : 'doctors'}
                      </span>
                      <span className="text-xs text-amber-600 font-medium ml-auto">⚠️ Not specifically recommended</span>
                    </div>
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      {otherDoctors.map((doctor) => (
                        <DoctorCard
                          key={doctor.id}
                          doctor={doctor}
                          isSelected={selectedDoctor === doctor.id}
                          onSelect={() => handleDoctorSelect(doctor.id)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Show all doctors if no category selected or no recommendations */}
                {(!selectedSymptomCategory || recommendedDoctors.length === 0) && doctors.length > 0 && (
                  <>
                    {selectedSymptomCategory && recommendedDoctors.length === 0 && (
                      <div className="text-center py-4 text-slate-500 mb-4">
                        <p className="text-sm font-medium">No matching doctors found for your symptoms</p>
                        <p className="text-xs mt-1">Showing all available doctors…</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                      {doctors.map((doctor) => (
                        <DoctorCard
                          key={doctor.id}
                          doctor={doctor}
                          isSelected={selectedDoctor === doctor.id}
                          onSelect={() => handleDoctorSelect(doctor.id)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* No doctors available */}
                {doctors.length === 0 && (
                  <div className="text-center py-10 sm:py-12 text-slate-500">
                    <span className="text-4xl sm:text-5xl block mb-2 sm:mb-3">👨‍⚕️</span>
                    <p className="font-medium">No doctors available</p>
                    <p className="text-xs sm:text-sm mt-1">Please contact reception for assistance</p>
                  </div>
                )}

                {/* Selection summary pill */}
                {selectedDoctor && (
                  <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-center justify-between">
                    <p className="text-xs sm:text-sm text-teal-800 font-semibold">Selected: {selectedDoctorData?.firstName} {selectedDoctorData?.lastName} • {selectedDoctorData?.specialization}</p>
                    <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">Fee ₹{selectedDoctorData?.consultationFee || 500}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Date & Time (moved from step 3) */}
          {currentStep === 4 && (
            <div className={`space-y-4 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
              <div className="bg-white border-2 border-purple-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">📅</span>
                  <span>Choose Date & Time</span>
                </h3>
                
                {/* Date Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appointment Date <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="date" 
                    name="appointmentDate"
                    value={appointmentData.date}
                    onChange={(e) => {
                      setAppointmentData({...appointmentData, date: e.target.value, time: ""})
                      setAvailableTimeSlots([])
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                  
                  {appointmentData.date && selectedDoctorData && (
                    <>
                      {/* Check if date is blocked */}
                      {(() => {
                        const blockedDates: any[] = Array.isArray((selectedDoctorData as any)?.blockedDates) ? (selectedDoctorData as any).blockedDates : []
                        const isBlocked = isDateBlockedFromRaw(appointmentData.date, blockedDates)
                        const isNotAvailableOnDay = !isDoctorAvailableOnDate(
                          selectedDoctorData, 
                          new Date(appointmentData.date),
                          selectedBranchId,
                          selectedBranch?.timings || null
                        )
                        
                        if (isBlocked) {
                          // Find the reason for blocked date
                          const blockedDateInfo = blockedDates.find((bd: any) => {
                            const normalizedDate = bd?.date ? String(bd.date).slice(0, 10) : ""
                            return normalizedDate === appointmentData.date
                          })
                          const reason = blockedDateInfo?.reason || "Doctor is not available"
                          
                          return (
                            <div className="mt-2 text-sm bg-red-50 border-l-4 border-red-400 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0">
                                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-red-800 mb-1">
                                    Date Not Available
                                  </p>
                                  <p className="text-red-700 text-xs mb-2">
                                    {reason}
                                  </p>
                                  <p className="text-red-600 text-xs">
                                    Please select another date to continue booking.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        
                        if (isNotAvailableOnDay) {
                          return (
                            <div className="mt-2 text-sm bg-amber-50 border-l-4 border-amber-400 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0">
                                  <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-amber-800 mb-1">
                                    Doctor Not Available on This Day
                                  </p>
                                  <p className="text-amber-700 text-xs">
                                    The doctor does not have visiting hours on {new Date(appointmentData.date).toLocaleDateString('en-US', { weekday: 'long' })}. Please select another date.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        
                        return null
                      })()}
                    </>
                  )}
                </div>

                {/* Time Slots Selection */}
                {appointmentData.date && selectedDoctorData && (() => {
                  const blockedDates: any[] = Array.isArray((selectedDoctorData as any)?.blockedDates) ? (selectedDoctorData as any).blockedDates : []
                  const isBlocked = isDateBlockedFromRaw(appointmentData.date, blockedDates)
                  const isAvailableOnDay = isDoctorAvailableOnDate(
                    selectedDoctorData, 
                    new Date(appointmentData.date),
                    selectedBranchId,
                    selectedBranch?.timings || null
                  )
                  return isAvailableOnDay && !isBlocked
                })() && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Available Time Slots <span className="text-red-500">*</span>
                      <span className="text-xs text-slate-500 ml-2">(15 min per appointment)</span>
                    </label>
                    {hasDuplicateAppointment && (
                      <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-xl p-5 shadow-lg animate-shake-fade-in">
                        <div className="flex items-start gap-3">
                          <div className="text-3xl">⚠️</div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-red-800 mb-2">
                              Appointment Already Exists!
                            </h4>
                            <p className="text-sm text-red-700 mb-2">
                              You already have an appointment with <strong>Dr. {selectedDoctorData?.firstName} {selectedDoctorData?.lastName}</strong> on{' '}
                              <strong>{new Date(appointmentData.date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                month: 'long', 
                                day: 'numeric',
                                year: 'numeric'
                              })}</strong> at{' '}
                              <strong className="text-red-900">{formatTimeDisplay(duplicateAppointmentTime)}</strong>
                            </p>
                            <div className="bg-white/60 rounded-lg p-3 mt-3 border border-red-200">
                              <p className="text-xs text-red-800 font-semibold mb-1">
                                💡 What you can do:
                              </p>
                              <ul className="text-xs text-red-700 space-y-1 ml-4 list-disc">
                                <li>Select a <strong>different date</strong></li>
                                <li>Select a <strong>different doctor</strong></li>
                                <li>Cancel your existing appointment and rebook</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Doctor's visiting hours for selected day */}
                    {selectedDoctorData.visitingHours && (
                      <div className="mb-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-xs text-slate-600 font-medium">
                          Doctor's hours on {new Date(appointmentData.date).toLocaleDateString('en-US', { weekday: 'long' })}:
                        </p>
                        <p className="text-sm text-slate-800 font-semibold mt-1">
                          {getVisitingHoursText(selectedDoctorData.visitingHours[getDayName(new Date(appointmentData.date))])}
                        </p>
                      </div>
                    )}

                    {loadingSlots ? (
                      <div className="text-center py-8">
                        <svg className="animate-spin h-8 w-8 mx-auto text-purple-600" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-sm text-slate-500 mt-2">Checking availability...</p>
                      </div>
                    ) : hasDuplicateAppointment ? (
                      <div className="text-center py-8 bg-red-50 rounded-lg border-2 border-red-200">
                        <span className="text-4xl block mb-2">🚫</span>
                        <p className="text-sm text-red-600 font-bold">Time slots hidden</p>
                        <p className="text-xs text-red-500 mt-1">Please resolve the duplicate appointment above</p>
                      </div>
                    ) : allTimeSlots.length > 0 ? (
                      <>
                        {/* Availability Legend */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-emerald-200 border border-emerald-300"></div>
                            <span className="text-[11px] sm:text-xs text-slate-600">Available ({availableTimeSlots.length})</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-rose-200 border border-rose-300"></div>
                            <span className="text-[11px] sm:text-xs text-slate-600">Booked ({bookedTimeSlots.length})</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-gray-200 border border-gray-300"></div>
                            <span className="text-[11px] sm:text-xs text-slate-600">Past ({pastTimeSlots.length})</span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-purple-500 border border-purple-600"></div>
                            <span className="text-[11px] sm:text-xs text-slate-600">Your Selection</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {allTimeSlots.map((slot) => {
                            const isBooked = bookedTimeSlots.includes(slot)
                            const isAvailable = availableTimeSlots.includes(slot)
                            const isPast = pastTimeSlots.includes(slot)
                            const isSelected = appointmentData.time === slot

                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                  if (isAvailable && !isPast) {
                                    setAppointmentData({...appointmentData, time: slot})
                                  }
                                }}
                                disabled={isBooked || isPast}
                                className={`
                                  px-2 py-2 sm:px-3 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all
                                  ${isSelected
                                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300 transform scale-105'
                                    : isPast
                                    ? 'bg-gray-100 border-2 border-gray-300 text-gray-400 cursor-not-allowed opacity-60'
                                    : isBooked
                                    ? 'bg-rose-50 border-2 border-rose-300 text-rose-600 cursor-not-allowed opacity-70'
                                    : 'bg-emerald-50 border-2 border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-sm cursor-pointer'
                                  }
                                `}
                              >
                                {formatTimeDisplay(slot)}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 bg-slate-50 rounded-lg">
                        <span className="text-4xl block mb-2">📅</span>
                        <p className="text-sm text-slate-600 font-medium">No slots available</p>
                        <p className="text-xs text-slate-500 mt-1">Doctor is not available on this day</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Selected Appointment Summary */}
                {appointmentData.date && appointmentData.time && (
                  <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl p-4 animate-fade-in">
                    <p className="text-xs text-purple-700 font-semibold mb-2">✓ Appointment Confirmed</p>
                    <p className="text-lg font-bold text-slate-800">
                      {new Date(appointmentData.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">
                      {formatTimeDisplay(appointmentData.time)}
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                      Duration: 15 minutes
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Payment */}
          {!rescheduleMode && currentStep === 5 && (
            <div className={`space-y-4 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
              <div className="bg-white border-2 border-green-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">💳</span>
                  <span>Payment</span>
                </h3>

                {/* Demo Notice */}
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
                  <p className="text-xs text-yellow-800 font-semibold flex items-center gap-2">
                    <span>⚠️</span>
                    <span>DEMO MODE - No real payment will be processed</span>
                  </p>
                </div>

                {/* Fee Display */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 mb-4 border-2 border-green-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-700 font-medium">Consultation Fee:</span>
                      {selectedDoctor && selectedDoctorData && (
                        <p className="text-xs text-slate-500 mt-1">
                          Dr. {selectedDoctorData.firstName} {selectedDoctorData.lastName}
                        </p>
                      )}
                    </div>
                    <span className="text-3xl font-bold text-green-600">₹{CONSULTATION_FEE}</span>
                  </div>
                </div>

                {/* Payment Type Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Payment Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentType("full")}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        paymentType === "full"
                          ? "border-green-600 bg-green-50 shadow-md ring-2 ring-green-200"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-3xl mb-2 block">💰</span>
                        <p className="text-sm font-semibold mb-1">Full Payment</p>
                        <p className="text-xl font-bold text-green-600">₹{CONSULTATION_FEE}</p>
                        <p className="text-xs text-gray-500 mt-1">Pay complete amount now</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType("partial")}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        paymentType === "partial"
                          ? "border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-3xl mb-2 block">📊</span>
                        <p className="text-sm font-semibold mb-1">Partial Payment (10%)</p>
                        <p className="text-xl font-bold text-blue-600">₹{PARTIAL_PAYMENT_AMOUNT}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Pay ₹{REMAINING_AMOUNT} at hospital
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Reusable Payment Section */}
                <PaymentMethodSection
                  title="Payment Mode"
                  paymentMethod={paymentMethod}
                  setPaymentMethod={(m)=>setPaymentMethod(m)}
                  paymentData={paymentData as PPaymentData}
                  setPaymentData={(d)=>setPaymentData(d as any)}
                  amountToPay={AMOUNT_TO_PAY}
                  showPartialNote={paymentType === 'partial'}
                  methods={["card", "upi"]}
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-slate-200">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="px-4 sm:px-6 py-3 sm:py-3.5 border-2 border-slate-300 rounded-xl hover:bg-slate-100 hover:border-slate-400 transition-all font-semibold text-slate-700 shadow-sm hover:shadow-md text-sm sm:text-base"
              >
                ← Previous
              </button>
            )}
            
            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceedToNextStep()}
                className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || !canProceedToNextStep()}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
              >
                {submitting 
                  ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  )
                  : rescheduleMode
                    ? "Confirm Reschedule"
                    : !paymentMethod
                    ? "Select Payment Method"
                  : paymentType === "partial"
                      ? `Pay ₹${AMOUNT_TO_PAY} & Book`
                      : `Pay ₹${AMOUNT_TO_PAY} & Book`}
              </button>
            )}

            <button
              type="button"
              onClick={handleClear}
              className="px-4 sm:px-6 py-3 sm:py-3.5 border-2 border-red-300 rounded-xl hover:bg-red-50 hover:border-red-400 transition-all font-semibold text-red-700 shadow-sm hover:shadow-md text-sm sm:text-base"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      {/* Branch Confirmation Modal */}
      {showBranchConfirm && selectedBranchId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-fade-in">
            <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white text-2xl">
                  🏥
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Confirm Branch Selection</h3>
                  <p className="text-sm text-teal-100">Please confirm your branch choice</p>
                </div>
              </div>
              <button
                onClick={() => setShowBranchConfirm(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                {(() => {
                  const selectedBranch = branches.find(b => b.id === selectedBranchId)
                  return selectedBranch ? (
                    <div className="bg-teal-50 rounded-xl p-4 border-2 border-teal-100">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">🏥</div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 mb-1">Selected Branch</h4>
                          <p className="text-lg font-bold text-teal-700">
                            {selectedBranch.name}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedBranch.location}
                          </p>
                          {userData?.defaultBranchId === selectedBranchId && (
                            <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              Your Default Branch
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null
                })()}

                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-600">
                    <strong>Note:</strong> You can change the branch by going back to Step 1. The selected branch will be used for this appointment.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200 rounded-b-2xl">
              <button
                onClick={() => setShowBranchConfirm(false)}
                className="px-6 py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-all font-semibold text-gray-700"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmBranch}
                className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <span>✓</span>
                <span>Yes, Continue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden transform transition-all animate-fade-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white text-2xl">
                  ✅
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Confirm Appointment</h3>
                  <p className="text-sm text-green-100">Please review your details before confirming</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                disabled={submitting}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-4">
                {/* Doctor Information */}
                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-100">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">👨‍⚕️</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 mb-1">Doctor</h4>
                      <p className="text-lg font-bold text-blue-700">
                        {selectedDoctorData ? `${selectedDoctorData.firstName} ${selectedDoctorData.lastName}` : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedDoctorData?.specialization || 'N/A'}
                      </p>
                      {selectedDoctorData?.consultationFee && (
                        <p className="text-sm text-gray-500 mt-1">
                          Consultation Fee: ₹{selectedDoctorData.consultationFee}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Appointment Date & Time */}
                <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-100">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">📅</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 mb-1">Date & Time</h4>
                      <p className="text-lg font-bold text-purple-700">
                        {appointmentData.date ? new Date(appointmentData.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        }) : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        Time: {appointmentData.time || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Symptoms/Chief Complaint */}
                <div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-100">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">🩺</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 mb-1">Chief Complaint</h4>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {appointmentData.problem || 'N/A'}
                      </p>
                      {appointmentData.additionalConcern && (
                        <div className="mt-2 pt-2 border-t border-orange-200">
                          <p className="text-sm font-medium text-gray-600 mb-1">Additional Concerns:</p>
                          <p className="text-sm text-gray-700">{appointmentData.additionalConcern}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Medical History */}
                {appointmentData.medicalHistory && (
                  <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">📋</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 mb-1">Medical History</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {appointmentData.medicalHistory}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Information */}
                <div className="bg-green-50 rounded-xl p-4 border-2 border-green-100">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">💳</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 mb-1">Payment Details</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Payment Method:</span>
                          <span className="font-semibold text-green-700 capitalize">
                            {paymentMethod === 'card' ? '💳 Card' : paymentMethod === 'upi' ? '📱 UPI' : '💵 Cash'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Payment Type:</span>
                          <span className="font-semibold text-green-700 capitalize">
                            {paymentType === 'full' ? 'Full Payment' : 'Partial Payment (10%)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-green-200">
                          <span className="text-lg font-semibold text-gray-800">Amount to Pay:</span>
                          <span className="text-2xl font-bold text-green-700">₹{AMOUNT_TO_PAY}</span>
                        </div>
                        {paymentType === 'partial' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Remaining ₹{REMAINING_AMOUNT} to be paid at hospital
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="px-6 py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition-all font-semibold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    ✅ Confirm & Book Appointment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Selection Confirmation Modal (for non-recommended doctors) */}
      {showDoctorConfirmModal && pendingDoctorId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-fade-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white text-2xl">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Select Non-Recommended Doctor?</h3>
                  <p className="text-sm text-orange-100">Please confirm your selection</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDoctorConfirmModal(false)
                  setPendingDoctorId(null)
                }}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-4">
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 font-semibold mb-2 flex items-center gap-2">
                    <span>⚠️</span>
                    <span>This doctor is not specifically recommended for your symptoms.</span>
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    You selected: <strong>{selectedSymptomCategory && SYMPTOM_CATEGORIES.find(c => c.id === selectedSymptomCategory)?.label}</strong>
                  </p>
                </div>

                {/* Doctor Information */}
                {(() => {
                  const doctorToConfirm = doctors.find(d => d.id === pendingDoctorId)
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
                    <strong>Note:</strong> You can still select this doctor, but we recommend choosing from the suggested doctors above for better treatment of your specific symptoms.
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
    </div>
  )
}
