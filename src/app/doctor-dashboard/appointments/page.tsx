"use client"

import { useEffect, useState } from "react"
import { db } from "@/firebase/config"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import Notification from "@/components/Notification"
import { generatePrescriptionPDF } from "@/utils/prescriptionPDF"
import { completeAppointment, getStatusColor } from "@/utils/appointmentHelpers"

export default function DoctorAppointments() {
  const [userData, setUserData] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "thisWeek" | "nextWeek" | "history">("today")
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [updating, setUpdating] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [completionData, setCompletionData] = useState({
    medicine: "",
    notes: ""
  })
  const [patientHistory, setPatientHistory] = useState<any[]>([])

  // Protect route - only allow doctors
  const { user, loading } = useAuth("doctor")

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
      if (doctorDoc.exists()) {
        const data = doctorDoc.data()
        setUserData(data)
      }

      // Get appointments for the doctor
      const appointmentsRef = collection(db, "appointments")
      const q = query(appointmentsRef, where("doctorId", "==", user.uid))
      const appointmentsSnapshot = await getDocs(q)
      const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      }))
      setAppointments(appointmentsList)
    }

    fetchData()
  }, [user])

  if (loading) {
    return <LoadingSpinner message="Loading appointments..." />
  }

  if (!user || !userData) {
    return null
  }

  // Toggle accordion and fetch patient history
  const toggleAccordion = async (appointmentId: string) => {
    if (expandedAppointment === appointmentId) {
      setExpandedAppointment(null)
      setPatientHistory([])
    } else {
      setExpandedAppointment(appointmentId)
      
      const appointment = appointments.find(apt => apt.id === appointmentId)
      if (appointment && appointment.patientId) {
        try {
          const patientAppointmentsQuery = query(
            collection(db, "appointments"), 
            where("patientId", "==", appointment.patientId),
            where("status", "==", "completed")
          )
          const snapshot = await getDocs(patientAppointmentsQuery)
          const history = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as any))
            .filter(apt => apt.id !== appointmentId)
            .sort((a: any, b: any) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
          setPatientHistory(history)
        } catch (error) {
          console.error("Error fetching patient history:", error)
        }
      }
    }
  }

  const openCompletionModal = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId)
    setShowCompletionModal(true)
  }

  const handleCompleteAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedAppointmentId) return
    
    if (!completionData.medicine.trim() || !completionData.notes.trim()) {
      setNotification({ 
        type: "error", 
        message: "Please fill in both medicine and notes" 
      })
      return
    }

    setUpdating(true)
    try {
      const result = await completeAppointment(
        selectedAppointmentId,
        completionData.medicine,
        completionData.notes
      )

      setAppointments(appointments.map(apt => 
        apt.id === selectedAppointmentId 
          ? { ...apt, ...result.updates } 
          : apt
      ))

      setNotification({ 
        type: "success", 
        message: result.message
      })

      setCompletionData({ medicine: "", notes: "" })
      setShowCompletionModal(false)
      setSelectedAppointmentId(null)
    } catch (error: any) {
      console.error("Error completing appointment:", error)
      setNotification({ 
        type: "error", 
        message: error.message || "Failed to complete appointment" 
      })
    } finally {
      setUpdating(false)
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
  const sortByDateTime = (a: any, b: any) => {
    const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`)
    const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`)
    return dateA.getTime() - dateB.getTime()
  }
  
  const sortByDateTimeDesc = (a: any, b: any) => {
    const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`)
    const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`)
    return dateB.getTime() - dateA.getTime()
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
        return [...historyAppointments].sort(sortByDateTimeDesc)
      default:
        return []
    }
  }
  
  const displayedAppointments = getDisplayedAppointments()

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Page Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl">
              📋
            </div>
            <div>
              <h1 className="text-2xl font-bold">Patient Appointments</h1>
              <p className="text-slate-200 text-sm mt-1">Manage and complete patient consultations</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                <div > 📋</div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Today</p>
                <p className="text-2xl font-bold text-slate-800">{todayAppointments.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                <div >  📋</div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Tomorrow</p>
                <p className="text-2xl font-bold text-slate-800">{tomorrowAppointments.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                <div > 📋</div>
              </div>
              <div>
                <p className="text-sm text-slate-500">This Week</p>
                <p className="text-2xl font-bold text-slate-800">{thisWeekAppointments.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                <div > 📋</div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Next Week</p>
                <p className="text-2xl font-bold text-slate-800">{nextWeekAppointments.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                <div > 📋</div>
              </div>
              <div>
                <p className="text-sm text-slate-500">Completed</p>
                <p className="text-2xl font-bold text-slate-800">{historyAppointments.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Appointments Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">
            All Appointments
          </h2>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab("today")}
              className={`flex-shrink-0 py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === "today"
                  ? "bg-slate-800 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Today ({todayAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab("tomorrow")}
              className={`flex-shrink-0 py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === "tomorrow"
                  ? "bg-slate-800 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tomorrow ({tomorrowAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab("thisWeek")}
              className={`flex-shrink-0 py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === "thisWeek"
                  ? "bg-slate-800 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              This Week ({thisWeekAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab("nextWeek")}
              className={`flex-shrink-0 py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === "nextWeek"
                  ? "bg-slate-800 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Next Week ({nextWeekAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-shrink-0 py-3 px-4 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === "history"
                  ? "bg-slate-800 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              History ({historyAppointments.length})
            </button>
          </div>

          {displayedAppointments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <span className="text-6xl text-slate-300 block mb-3">
                📋
              </span>
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
          ) : (
            <div className="space-y-4">
              {displayedAppointments.map((appointment) => (
                <div key={appointment.id} className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-teal-300 hover:shadow-lg transition-all">
                  {/* Accordion Header */}
                  <div 
                    onClick={() => toggleAccordion(appointment.id)}
                    className="p-5 cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      {/* Patient Avatar */}
                      <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-full flex items-center justify-center text-2xl font-bold text-teal-700 group-hover:scale-110 transition-transform">
                        {appointment.patientName.charAt(0).toUpperCase()}
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-slate-900 group-hover:text-teal-700 transition-colors">
                            {appointment.patientName}
                          </h3>
                          {appointment.patientGender && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                              {appointment.patientGender === "Male" ? "👨" : appointment.patientGender === "Female" ? "👩" : "👤"} {appointment.patientGender}
                            </span>
                          )}
                          {appointment.patientBloodGroup && (
                            <span className="text-xs px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-semibold">
                              🩸 {appointment.patientBloodGroup}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <span>📅</span>
                            {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <span>🕐</span>
                            {appointment.appointmentTime}
                          </span>
                          {appointment.patientPhone && (
                            <span className="flex items-center gap-1">
                              <span>📱</span>
                              {appointment.patientPhone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-3">
                        <span className={`px-4 py-2 rounded-lg text-sm font-bold ${getStatusColor(appointment.status)}`}>
                          {appointment.status === "confirmed" ? "✓ Confirmed" : 
                           appointment.status === "completed" ? "✓ Completed" : 
                           appointment.status}
                        </span>
                        
                        {/* Expand Icon */}
                        <div className={`w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition-transform duration-300 ${expandedAppointment === appointment.id ? 'rotate-180 bg-teal-100' : ''}`}>
                          <span className="text-slate-600 text-sm">▼</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {expandedAppointment === appointment.id && (
                    <div className="p-6 bg-gradient-to-br from-slate-50 to-white border-t-2 border-slate-200">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Patient Details */}
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border-2 border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base">
                              <span className="text-2xl">👤</span>
                              <span>Patient Information</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <span className="text-slate-600 text-xs font-semibold uppercase">Patient ID</span>
                                <p className="font-mono text-slate-900 mt-1 text-xs break-all">{appointment.patientId}</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <span className="text-slate-600 text-xs font-semibold uppercase">Full Name</span>
                                <p className="text-slate-900 mt-1 font-semibold">{appointment.patientName}</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <span className="text-slate-600 text-xs font-semibold uppercase">Email</span>
                                <p className="text-slate-900 mt-1">{appointment.patientEmail}</p>
                              </div>
                              {appointment.patientPhone && (
                                <div className="bg-white rounded-lg p-3 border border-blue-200">
                                  <span className="text-slate-600 text-xs font-semibold uppercase">📱 Phone</span>
                                  <p className="text-slate-900 mt-1 font-semibold">{appointment.patientPhone}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                {appointment.patientGender && (
                                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                                    <span className="text-slate-600 text-xs font-semibold uppercase">Gender</span>
                                    <p className="text-slate-900 mt-1 font-semibold">{appointment.patientGender}</p>
                                  </div>
                                )}
                                {appointment.patientBloodGroup && (
                                  <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-3 border-2 border-red-200">
                                    <span className="text-red-700 text-xs font-bold uppercase">🩸 Blood</span>
                                    <p className="text-red-700 mt-1 font-bold text-lg">{appointment.patientBloodGroup}</p>
                                  </div>
                                )}
                              </div>
                              {appointment.patientDateOfBirth && (
                                <div className="bg-white rounded-lg p-3 border border-blue-200">
                                  <span className="text-slate-600 text-xs font-semibold uppercase">Date of Birth</span>
                                  <p className="text-slate-900 mt-1 font-semibold">{new Date(appointment.patientDateOfBirth).toLocaleDateString()}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Social & Lifestyle Information */}
                          {(appointment.patientDrinkingHabits || appointment.patientSmokingHabits || appointment.patientVegetarian) && (
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border-2 border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base">
                                <span className="text-2xl">🌱</span>
                                <span>Social & Lifestyle</span>
                              </h4>
                              <div className="space-y-3 text-sm">
                                {appointment.patientDrinkingHabits && (
                                  <div className="bg-white rounded-lg p-3 border border-purple-200 flex items-center justify-between">
                                    <span className="text-slate-700 font-semibold flex items-center gap-2">
                                      <span className="text-lg">🍺</span> Drinking
                                    </span>
                                    <span className="bg-purple-100 px-4 py-1.5 rounded-full text-purple-900 font-bold capitalize">
                                      {appointment.patientDrinkingHabits}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientSmokingHabits && (
                                  <div className="bg-white rounded-lg p-3 border border-purple-200 flex items-center justify-between">
                                    <span className="text-slate-700 font-semibold flex items-center gap-2">
                                      <span className="text-lg">🚬</span> Smoking
                                    </span>
                                    <span className="bg-purple-100 px-4 py-1.5 rounded-full text-purple-900 font-bold capitalize">
                                      {appointment.patientSmokingHabits}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientVegetarian && (
                                  <div className="bg-white rounded-lg p-3 border border-purple-200 flex items-center justify-between">
                                    <span className="text-slate-700 font-semibold flex items-center gap-2">
                                      <span className="text-lg">🥗</span> Vegetarian
                                    </span>
                                    <span className="bg-purple-100 px-4 py-1.5 rounded-full text-purple-900 font-bold capitalize">
                                      {appointment.patientVegetarian}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-5 border-2 border-green-100 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base">
                              <span className="text-2xl">📅</span>
                              <span>Appointment Details</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <span className="text-slate-600 text-xs font-semibold uppercase">Date</span>
                                <p className="text-slate-900 mt-1 font-bold">{new Date(appointment.appointmentDate).toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <span className="text-slate-600 text-xs font-semibold uppercase">Time</span>
                                <p className="text-slate-900 mt-1 font-bold text-lg">{appointment.appointmentTime}</p>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <span className="text-slate-600 text-xs font-semibold uppercase mb-2 block">Status</span>
                                <span className={`px-4 py-2 rounded-lg text-sm font-bold inline-block ${getStatusColor(appointment.status)}`}>
                                  {appointment.status === "confirmed" ? "✓ Confirmed" : 
                                   appointment.status === "completed" ? "✓ Completed" : 
                                   appointment.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Medical Information */}
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-5 border-2 border-yellow-100 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base">
                              <span className="text-2xl">🩺</span>
                              <span>Medical Information</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-white rounded-lg p-4 border-2 border-yellow-200">
                                <span className="text-slate-600 text-xs font-bold uppercase mb-2 block">Chief Complaint</span>
                                <p className="text-slate-900 font-medium leading-relaxed">
                                  {appointment.chiefComplaint}
                                </p>
                              </div>
                              {appointment.medicalHistory && (
                                <div className="bg-white rounded-lg p-4 border-2 border-yellow-200">
                                  <span className="text-slate-600 text-xs font-bold uppercase mb-2 block">Medical History</span>
                                  <p className="text-slate-900 font-medium leading-relaxed">
                                    {appointment.medicalHistory}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base">
                              <span className="text-2xl">⚡</span>
                              <span>Actions</span>
                            </h4>
                            <div className="space-y-3">
                              {appointment.status === "confirmed" && (
                                <button
                                  onClick={() => openCompletionModal(appointment.id)}
                                  disabled={updating}
                                  className="w-full px-5 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-base flex items-center justify-center gap-2"
                                >
                                  <span>✓</span> Complete Checkup
                                </button>
                              )}
                              {appointment.status === "completed" && (
                                <div className="space-y-3">
                                  <div className="text-center py-2 text-green-600 font-medium">
                                    ✓ Checkup Completed
                                  </div>
                                  {appointment.medicine && (
                                    <div className="bg-white p-3 rounded border">
                                      <p className="text-xs text-gray-600 mb-1 font-semibold">💊 Prescribed Medicine:</p>
                                      <p className="text-sm text-gray-900">{appointment.medicine}</p>
                                    </div>
                                  )}
                                  {appointment.doctorNotes && (
                                    <div className="bg-white p-3 rounded border">
                                      <p className="text-xs text-gray-600 mb-1 font-semibold">📝 Doctor's Notes:</p>
                                      <p className="text-sm text-gray-900">{appointment.doctorNotes}</p>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => generatePrescriptionPDF(appointment)}
                                    className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Download Prescription PDF
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Patient History */}
                        {patientHistory.length > 0 && (
                          <div className="md:col-span-2 mt-6">
                            <div className="bg-purple-50 rounded-lg p-4">
                              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <span>📚</span>
                                <span>Previous Checkup History ({patientHistory.length})</span>
                              </h4>
                              <div className="space-y-3">
                                {patientHistory.map((historyItem, index) => (
                                  <div key={historyItem.id} className="bg-white p-3 rounded border">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-sm font-semibold text-gray-900">
                                        Visit #{patientHistory.length - index}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        {new Date(historyItem.appointmentDate).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                      <div>
                                        <span className="text-gray-600">Chief Complaint:</span>
                                        <p className="text-gray-900">{historyItem.chiefComplaint}</p>
                                      </div>
                                      {historyItem.medicine && (
                                        <div>
                                          <span className="text-gray-600">💊 Medicine:</span>
                                          <p className="text-gray-900">{historyItem.medicine}</p>
                                        </div>
                                      )}
                                      {historyItem.doctorNotes && (
                                        <div>
                                          <span className="text-gray-600">📝 Notes:</span>
                                          <p className="text-gray-900">{historyItem.doctorNotes}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <h2 className="text-xl font-semibold text-slate-800">Complete Checkup</h2>
                <button 
                  onClick={() => {
                    setShowCompletionModal(false)
                    setSelectedAppointmentId(null)
                    setCompletionData({ medicine: "", notes: "" })
                  }}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCompleteAppointment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prescribed Medicine <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={completionData.medicine}
                    onChange={(e) => setCompletionData({...completionData, medicine: e.target.value})}
                    rows={4}
                    placeholder="Enter medicine names, dosages, and instructions..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Doctor's Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={completionData.notes}
                    onChange={(e) => setCompletionData({...completionData, notes: e.target.value})}
                    rows={4}
                    placeholder="Enter your observations, diagnosis, and recommendations..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? "Completing..." : "Complete Checkup"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompletionModal(false)
                      setSelectedAppointmentId(null)
                      setCompletionData({ medicine: "", notes: "" })
                    }}
                    disabled={updating}
                    className="px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  )
}

