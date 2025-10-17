"use client"

import { useState, useEffect } from "react"
import { Doctor, UserData, AppointmentFormData, PaymentData, Appointment } from "@/types/patient"
import DoctorCard from "@/components/ui/DoctorCard"
import SymptomSelector, { SYMPTOM_CATEGORIES } from "./SymptomSelector"
import SmartQuestions from "./SmartQuestions"
import MedicalHistoryChecklist from "./MedicalHistoryChecklist"
import { getAvailableTimeSlots, isSlotInPast, formatTimeDisplay, isDoctorAvailableOnDate, getDayName, getVisitingHoursText, isDateBlocked, getBlockedDateInfo, generateTimeSlots, isTimeSlotAvailable, timeToMinutes, DEFAULT_VISITING_HOURS } from "@/utils/timeSlots"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/firebase/config"

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
}

export default function BookAppointmentForm({
  user,
  userData,
  doctors,
  onSubmit,
  submitting
}: BookAppointmentFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedDoctor, setSelectedDoctor] = useState("")
  const [appointmentData, setAppointmentData] = useState<AppointmentFormData>({
    date: "",
    time: "",
    problem: "",
    medicalHistory: ""
  })
  const [paymentMethod, setPaymentMethod] = useState<"card" | "upi" | "cash">("card")
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
  // Symptom selection state
  const [selectedSymptomCategory, setSelectedSymptomCategory] = useState<string | null>(null)
  const [symptomAnswers, setSymptomAnswers] = useState<any>({})
  const [medicalConditions, setMedicalConditions] = useState<string[]>([])
  const [allergies, setAllergies] = useState(userData?.allergies || "")
  const [currentMedications, setCurrentMedications] = useState(userData?.currentMedications || "")

  // Animation direction state
  const [slideDirection, setSlideDirection] = useState<'right' | 'left'>('right')

  const totalSteps = 5

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
        // Fetch all confirmed appointments for this doctor on this date
        const appointmentsQuery = query(
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
        const  patientAppointmentsQuery = query(
          collection(db, "appointments"),
          where("patientId", "==", user.uid),
          where("doctorId", "==", selectedDoctor),
          where("appointmentDate", "==", appointmentData.date),
          where("status", "==", "confirmed")
        )
        const patientAppointments = await getDocs(patientAppointmentsQuery)
        const patientAppointmentsList = patientAppointments.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Appointment))

        if (patientAppointmentsList.length > 0) {
          setHasDuplicateAppointment(true)
          setDuplicateAppointmentTime(patientAppointmentsList[0].appointmentTime)
        }else{
          setHasDuplicateAppointment(false)
          setDuplicateAppointmentTime("")
        }


        // Get doctor's visiting hours for the selected date
        const selectedDate = new Date(appointmentData.date)
        const visitingHours = selectedDoctorData.visitingHours || DEFAULT_VISITING_HOURS
        const dayName = getDayName(selectedDate)
        const daySchedule = visitingHours[dayName]

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
  }, [selectedDoctor, appointmentData.date, selectedDoctorData])

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setSlideDirection('right') // Slide from right when going forward
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setSlideDirection('left') // Slide from left when going backward
      setCurrentStep(currentStep - 1)
    }
  }

  // Auto-generate chief complaint from structured data
  useEffect(() => {
    if (!selectedSymptomCategory) return

    const category = SYMPTOM_CATEGORIES.find(c => c.id === selectedSymptomCategory)
    if (!category) return

    // Build complaint text from answers
    let complaint = category.label
    
    if (symptomAnswers.duration) {
      complaint += ` for ${symptomAnswers.duration}`
    }
    if (symptomAnswers.symptoms && symptomAnswers.symptoms.length > 0) {
      complaint += ` with ${symptomAnswers.symptoms.join(', ')}`
    }
    if (symptomAnswers.severity) {
      complaint += ` (${symptomAnswers.severity} severity)`
    }
    if (symptomAnswers.reason) {
      complaint = symptomAnswers.reason
    }
    if (symptomAnswers.description) {
      complaint = symptomAnswers.description
    }

    setAppointmentData(prev => ({ ...prev, problem: complaint }))
  }, [selectedSymptomCategory, symptomAnswers])

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

  // Filter doctors based on symptom category
  const filteredDoctors = selectedSymptomCategory 
    ? doctors.filter(doc => {
        const category = SYMPTOM_CATEGORIES.find(c => c.id === selectedSymptomCategory)
        return category?.relatedSpecializations.some(spec => 
          doc.specialization.toLowerCase().includes(spec.toLowerCase())
        )
      })
    : doctors

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1: return true // Patient info is auto-filled
      case 2: return selectedSymptomCategory !== null // Must select symptom category
      case 3: return selectedDoctor !== ""
      case 4: return appointmentData.date !== "" && appointmentData.time !== "" && !hasDuplicateAppointment
      case 5: return true // Payment step
      default: return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Only allow submission if we're on the final step
    if (currentStep !== totalSteps) {
      return
    }
    
    await onSubmit({
      selectedDoctor,
      appointmentData,
      paymentMethod,
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
              <h2 className="text-2xl font-bold text-white">Book New Appointment</h2>
              <p className="text-slate-100 text-sm mt-0.5">Step {currentStep} of {totalSteps}: {steps[currentStep - 1].title}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
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
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded transition-all ${
                  currentStep > step.number ? "bg-green-500" : "bg-slate-200"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Container */}
      <div className="p-6 overflow-hidden">
        <form onSubmit={handleSubmit} onKeyDown={(e) => {
          // Prevent Enter key from submitting form unless on final step
          if (e.key === 'Enter' && currentStep !== totalSteps) {
            e.preventDefault()
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
                  
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Email</p>
                    <p className="text-base text-slate-700 bg-slate-50 px-4 py-3 rounded-lg border border-slate-200">
                      {userData?.email || ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Symptoms & Medical Information */}
          {currentStep === 2 && (
            <div className={`space-y-3 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
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
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-300 rounded-lg p-2 animate-fade-in">
                  <p className="text-xs text-teal-700 font-semibold mb-1 flex items-center gap-1">
                    <span>✓</span>
                    <span>Summary:</span>
                  </p>
                  <p className="text-xs font-semibold text-slate-800">{appointmentData.problem}</p>
                  {appointmentData.medicalHistory && (
                    <p className="text-xs text-slate-600 mt-1">{appointmentData.medicalHistory}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Doctor Selection (moved from step 2) */}
          {currentStep === 3 && (
            <div className={`space-y-4 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
              <div className="bg-white border-2 border-teal-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="text-2xl">👨‍⚕️</span>
                  <span>Select Your Doctor</span>
                  {filteredDoctors.length < doctors.length && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full font-medium">
                      Recommended for your symptoms
                    </span>
                  )}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredDoctors.map((doctor) => (
                    <DoctorCard
                      key={doctor.id}
                      doctor={doctor}
                      isSelected={selectedDoctor === doctor.id}
                      onSelect={() => setSelectedDoctor(doctor.id)}
                    />
                  ))}
                </div>

                {filteredDoctors.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-5xl block mb-3">👨‍⚕️</span>
                    <p className="font-medium">No matching doctors found for your symptoms</p>
                    <p className="text-sm mt-1">Showing all doctors...</p>
                  </div>
                )}
                
                {filteredDoctors.length === 0 && doctors.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {doctors.map((doctor) => (
                      <DoctorCard
                        key={doctor.id}
                        doctor={doctor}
                        isSelected={selectedDoctor === doctor.id}
                        onSelect={() => setSelectedDoctor(doctor.id)}
                      />
                    ))}
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                  
                  {appointmentData.date && selectedDoctorData && (
                    <>
                      {/* Check if date is blocked */}
                      {isDateBlocked(selectedDoctorData, new Date(appointmentData.date)) ? (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="font-semibold flex items-center gap-2 mb-1">
                            <span>🚫</span>
                            <span>Doctor Not Available</span>
                          </p>
                          <p className="text-xs">
                            Reason: {getBlockedDateInfo(selectedDoctorData, new Date(appointmentData.date))?.reason}
                          </p>
                          <p className="text-xs mt-1 text-red-500">
                            Please select another date.
                          </p>
                        </div>
                      ) : !isDoctorAvailableOnDate(selectedDoctorData, new Date(appointmentData.date)) && (
                        <p className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                          <span>⚠️</span>
                          <span>Doctor is not available on this day of the week. Please select another date.</span>
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Time Slots Selection */}
                {appointmentData.date && selectedDoctorData && isDoctorAvailableOnDate(selectedDoctorData, new Date(appointmentData.date)) && !isDateBlocked(selectedDoctorData, new Date(appointmentData.date)) && (
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
                        <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-emerald-200 border border-emerald-300"></div>
                            <span className="text-xs text-slate-600">Available ({availableTimeSlots.length})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-rose-200 border border-rose-300"></div>
                            <span className="text-xs text-slate-600">Booked ({bookedTimeSlots.length})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gray-200 border border-gray-300"></div>
                            <span className="text-xs text-slate-600">Past ({pastTimeSlots.length})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-purple-500 border border-purple-600"></div>
                            <span className="text-xs text-slate-600">Your Selection</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
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
          {currentStep === 5 && (
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

                {/* Payment Method Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Payment Method <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("card")}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === "card"
                          ? "border-green-600 bg-green-50 shadow-md"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-3xl mb-1 block">💳</span>
                        <span className="text-sm font-semibold">Card</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("upi")}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === "upi"
                          ? "border-green-600 bg-green-50 shadow-md"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-3xl mb-1 block">📱</span>
                        <span className="text-sm font-semibold">UPI</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === "cash"
                          ? "border-green-600 bg-green-50 shadow-md"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <div className="text-center">
                        <span className="text-3xl mb-1 block">💵</span>
                        <span className="text-sm font-semibold">Cash</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Payment Method Details */}
                <div className="mt-4">
                  {paymentMethod === "card" && (
                    <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-semibold text-blue-800 mb-3">💳 Card Payment</p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                        <input
                          type="text"
                          value={paymentData.cardNumber}
                          onChange={(e) => setPaymentData({...paymentData, cardNumber: e.target.value})}
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          className="w-full px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
                        <input
                          type="text"
                          value={paymentData.cardName}
                          onChange={(e) => setPaymentData({...paymentData, cardName: e.target.value})}
                          placeholder="JOHN DOE"
                          className="w-full px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry (MM/YY)</label>
                          <input
                            type="text"
                            value={paymentData.expiryDate}
                            onChange={(e) => setPaymentData({...paymentData, expiryDate: e.target.value})}
                            placeholder="12/25"
                            maxLength={5}
                            className="w-full px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                          <input
                            type="text"
                            value={paymentData.cvv}
                            onChange={(e) => setPaymentData({...paymentData, cvv: e.target.value})}
                            placeholder="123"
                            maxLength={3}
                            className="w-full px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "upi" && (
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm font-semibold text-purple-800 mb-3">📱 UPI Payment</p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                        <input
                          type="text"
                          value={paymentData.upiId}
                          onChange={(e) => setPaymentData({...paymentData, upiId: e.target.value})}
                          placeholder="yourname@upi"
                          className="w-full px-4 py-2 text-sm border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">e.g., 9876543210@paytm</p>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "cash" && (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <p className="text-sm font-semibold text-amber-800 mb-2">💵 Cash Payment</p>
                      <p className="text-sm text-gray-700">
                        You can pay <strong>₹{CONSULTATION_FEE}</strong> in cash at the hospital reception before your appointment.
                      </p>
                      {paymentType === "partial" && (
                        <p className="text-xs text-orange-600 mt-2 font-semibold">
                          Note: With partial payment, you don't need to pay online. Pay full ₹{CONSULTATION_FEE} at hospital.
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
                disabled={submitting}
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
                  : paymentMethod === "cash" 
                    ? `Confirm Appointment` 
                    : paymentType === "partial"
                      ? `Pay ₹${AMOUNT_TO_PAY} & Book`
                      : `Book & Pay ₹${AMOUNT_TO_PAY}`}
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
    </div>
  )
}
