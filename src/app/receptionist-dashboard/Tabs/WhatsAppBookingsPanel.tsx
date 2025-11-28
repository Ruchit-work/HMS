"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore"
import { db, auth } from "@/firebase/config"
import { Appointment } from "@/types/patient"
import LoadingSpinner from "@/components/ui/StatusComponents"
import { SYMPTOM_CATEGORIES } from "@/components/patient/SymptomSelector"

interface WhatsAppBookingsPanelProps {
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
  onPendingCountChange?: (_count: number) => void
}

interface Doctor {
  id: string
  firstName: string
  lastName: string
  specialization: string
  consultationFee?: number
}

export default function WhatsAppBookingsPanel({ onNotification, onPendingCountChange }: WhatsAppBookingsPanelProps) {
  const [bookings, setBookings] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Appointment | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)

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

  const notify = useCallback(
    (payload: { type: "success" | "error"; message: string } | null) => {
      onNotification?.(payload)
    },
    [onNotification]
  )

  const setupRealtimeListener = useCallback(() => {
    try {
      setLoading(true)
      setError(null)

      // Set up real-time listener for WhatsApp pending appointments
      const appointmentsRef = collection(db, 'appointments')
      const whatsappQuery = query(
        appointmentsRef,
        where('whatsappPending', '==', true)
      )
      
      const unsubscribe = onSnapshot(whatsappQuery, (snapshot) => {
        console.log(`[WhatsApp Bookings] Real-time update: ${snapshot.docs.length} pending bookings`)
        
        const bookingsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Appointment[]
        
        setBookings(bookingsList)
        onPendingCountChange?.(bookingsList.length)
        setLoading(false)
      }, (error) => {
        console.error('Error in WhatsApp bookings listener:', error)
        setError(error.message)
        setBookings([])
        onPendingCountChange?.(0)
        setLoading(false)
      })
      
      return unsubscribe
    } catch (error: any) {
      console.error("Error setting up WhatsApp bookings listener:", error)
      setError(error?.message || "Failed to set up real-time updates")
      setBookings([])
      onPendingCountChange?.(0)
      setLoading(false)
      return () => {}
    }
  }, [onPendingCountChange])

  const fetchDoctors = useCallback(async () => {
    try {
      setDoctorsLoading(true)
      const doctorsQuery = query(collection(db, "doctors"), where("status", "==", "active"))
      const snapshot = await getDocs(doctorsQuery)
      const doctorsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Doctor[]
      setDoctors(doctorsList)
    } catch (error) {
      console.error("Failed to load doctors", error)
    } finally {
      setDoctorsLoading(false)
    }
  }, [])

  useEffect(() => {
    let unsubscribeBookings: (() => void) | null = null

    // Set up real-time listener for bookings
    unsubscribeBookings = setupRealtimeListener()
    
    // Fetch doctors (one-time)
    fetchDoctors()

    // Cleanup function
    return () => {
      if (unsubscribeBookings) {
        unsubscribeBookings()
      }
    }
  }, [setupRealtimeListener, fetchDoctors])

  const handleOpenEditModal = (booking: Appointment) => {
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
    setEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setEditModalOpen(false)
    setSelectedBooking(null)
  }

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
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in")
      }

      const token = await currentUser.getIdToken()

      const updateData: any = {
        doctorId: formDoctorId,
        patientName: formPatientName.trim(),
        patientPhone: formPatientPhone.trim(),
        patientEmail: formPatientEmail.trim(),
        appointmentDate: formAppointmentDate,
        appointmentTime: formAppointmentTime,
        chiefComplaint: formChiefComplaint.trim() || "General consultation",
        medicalHistory: formMedicalHistory.trim(),
        paymentMethod: formPaymentMethod,
        // Payment amount will be handled separately in billing section
        markConfirmed: true,
      }

      const res = await fetch(`/api/receptionist/whatsapp-bookings/${selectedBooking.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to update booking")
      }

      notify({ type: "success", message: "Booking updated successfully!" })
      handleCloseEditModal()
      // Real-time listener will automatically update the list
    } catch (error: any) {
      console.error("Failed to update booking", error)
      notify({ type: "error", message: error?.message || "Failed to update booking" })
    } finally {
      setUpdateLoading(false)
    }
  }

  const pendingCount = bookings.length

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Pending Bookings",
        value: pendingCount,
        caption: "Awaiting doctor assignment",
        tone: "from-amber-500 to-amber-600",
        icon: "📱",
      },
    ]
  }, [pendingCount])

  if (loading && bookings.length === 0) {
    return <LoadingSpinner message="Loading WhatsApp bookings..." />
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, idx) => (
          <div
            key={idx}
            className={`bg-gradient-to-br ${card.tone} rounded-xl p-5 text-white shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">{card.label}</p>
                <p className="text-3xl font-bold mt-1">{card.value}</p>
                <p className="text-white/70 text-xs mt-1">{card.caption}</p>
              </div>
              <div className="text-4xl opacity-80">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">WhatsApp Bookings</h2>
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-700">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live Updates</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <span className="text-5xl block mb-3">📱</span>
          <p className="text-gray-600 font-medium">No pending WhatsApp bookings</p>
          <p className="text-sm text-gray-400 mt-1">New bookings from WhatsApp will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Doctor Fee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{booking.patientName}</div>
                      <div className="text-sm text-gray-500">{booking.patientEmail || "No email"}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(booking.appointmentDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-sm text-gray-500">{booking.appointmentTime}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {booking.patientPhone || "—"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {booking.doctorId && booking.totalConsultationFee ? (
                        <span>₹{booking.totalConsultationFee}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                        Pending
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleOpenEditModal(booking)}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        Add Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && selectedBooking && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity" onClick={handleCloseEditModal} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Add Details & Assign Doctor</h3>
                <p className="text-sm text-gray-500 mt-1">Complete patient details and assign a doctor before confirming</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Chief Complaint - Moved to top */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
                  <textarea
                    value={formChiefComplaint}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormChiefComplaint(value)
                      
                      // Show suggestions when user types 1-2 letters
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
                    onBlur={() => {
                      // Delay hiding suggestions to allow clicking on them
                      setTimeout(() => setShowSuggestions(false), 200)
                    }}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Start typing to see suggestions..."
                  />
                  {showSuggestions && chiefComplaintSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {chiefComplaintSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setFormChiefComplaint(suggestion)
                            setShowSuggestions(false)
                            setChiefComplaintSuggestions([])
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedSymptomCategory && (
                    <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                      💡 Detected: {matchedSymptomCategory.label} - Showing recommended doctors below
                    </p>
                  )}
                </div>

                {/* Doctor Selection - Now shows recommended doctors based on chief complaint */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Doctor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formDoctorId}
                    onChange={(e) => setFormDoctorId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={doctorsLoading}
                  >
                    <option value="">Select a doctor</option>
                    {recommendedDoctors.length > 0 && (
                      <optgroup label={`⭐ Recommended for Complaint (${recommendedDoctors.length})`}>
                        {recommendedDoctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.firstName} {doctor.lastName} - {doctor.specialization}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {otherDoctors.length > 0 && (
                      <optgroup label={recommendedDoctors.length > 0 ? `Other Doctors (${otherDoctors.length})` : `All Doctors (${otherDoctors.length})`}>
                        {otherDoctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.firstName} {doctor.lastName} - {doctor.specialization}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {doctors.length === 0 && (
                      <option value="" disabled>No doctors available</option>
                    )}
                  </select>
                  {recommendedDoctors.length > 0 && (
                    <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                      ⭐ {recommendedDoctors.length} doctor(s) recommended based on chief complaint
                    </p>
                  )}
                </div>

                {/* Patient Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Patient Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formPatientName}
                      readOnly={!allowPatientInfoEdit}
                      onChange={(e) => {
                        if (allowPatientInfoEdit) setFormPatientName(e.target.value)
                      }}
                      className={
                        allowPatientInfoEdit
                          ? "w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          : "w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                      }
                    />
                    {!allowPatientInfoEdit && (
                      <p className="text-xs text-gray-500 mt-1">Existing patient info cannot be edited.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formPatientPhone}
                      readOnly={!allowPatientInfoEdit}
                      onChange={(e) => {
                        if (allowPatientInfoEdit) setFormPatientPhone(e.target.value)
                      }}
                      className={
                        allowPatientInfoEdit
                          ? "w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          : "w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formPatientEmail}
                      readOnly={!allowPatientInfoEdit}
                      onChange={(e) => {
                        if (allowPatientInfoEdit) setFormPatientEmail(e.target.value)
                      }}
                      className={
                        allowPatientInfoEdit
                          ? "w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          : "w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                      }
                    />
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formAppointmentDate}
                      onChange={(e) => setFormAppointmentDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formAppointmentTime}
                      onChange={(e) => setFormAppointmentTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Medical Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medical History <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={formMedicalHistory}
                    onChange={(e) => setFormMedicalHistory(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Previous medical conditions, allergies, medications, etc."
                  />
                </div>

                {/* Payment Details */}
                {selectedDoctor && selectedDoctor.consultationFee && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-900">Doctor Fee:</span>
                      <span className="text-lg font-semibold text-blue-900">₹{selectedDoctor.consultationFee}</span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">Fee will be automatically set from doctor's profile</p>
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Payment amount will be handled in the billing section</p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={handleCloseEditModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={updateLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateBooking}
                  disabled={updateLoading || !formDoctorId || !formPatientName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateLoading ? "Updating..." : "Update Booking"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

