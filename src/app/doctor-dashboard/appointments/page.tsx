"use client"

import { useEffect, useState } from "react"
import { db } from "@/firebase/config"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import Notification from "@/components/Notification"
import { generatePrescriptionPDF } from "@/utils/prescriptionPDF"
import { completeAppointment, getStatusColor } from "@/utils/appointmentHelpers"
import { Appointment as AppointmentType } from "@/types/patient"
import axios from "axios"

interface UserData {
  id: string;
  name: string;
  firstName?: string;
  email: string;
  role: string;
}

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  chiefComplaint: string;
  medicalHistory?: string;
  patientDateOfBirth: string;
  patientGender: string;
  patientBloodGroup: string;
  patientDrinkingHabits: string;
  patientSmokingHabits: string;
  patientVegetarian: boolean;
  patientAllergies?: string;
  patientCurrentMedications?: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialization?: string;
  medicine?: string;
  doctorNotes?: string;
}

export default function DoctorAppointments() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
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
  const [patientHistory, setPatientHistory] = useState<Appointment[]>([])
  const [aiDiagnosis, setAiDiagnosis] = useState<{[key: string]: string}>({})
  const [loadingAiDiagnosis, setLoadingAiDiagnosis] = useState<{[key: string]: boolean}>({})
  const [showHistory, setShowHistory] = useState<{[key: string]: boolean}>({})
  const [refreshing, setRefreshing] = useState(false)

  // Protect route - only allow doctors
  const { user, loading } = useAuth("doctor")

  const fetchData = async () => {
    if (!user) return

      const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
      if (doctorDoc.exists()) {
        const data = doctorDoc.data() as UserData
        setUserData(data)
      }

      // Get appointments for the doctor
      const appointmentsRef = collection(db, "appointments")
      const q = query(appointmentsRef, where("doctorId", "==", user.uid))
      const appointmentsSnapshot = await getDocs(q)
      const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Appointment))
      setAppointments(appointmentsList)
    }

  useEffect(() => {
    fetchData()
  }, [user])

  // Auto-expand appointment if redirected from dashboard
  useEffect(() => {
    const expandAppointmentId = sessionStorage.getItem('expandAppointmentId')
    if (expandAppointmentId) {
      // Clear the stored ID
      sessionStorage.removeItem('expandAppointmentId')
      // Set active tab to "today" since we're coming from today's schedule
      setActiveTab("today")
      // Auto-expand the appointment after a short delay to ensure data is loaded
      setTimeout(() => {
        setExpandedAppointment(expandAppointmentId)
        // Scroll to the appointment
        const element = document.getElementById(`appointment-${expandAppointmentId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500)
    }
  }, [appointments])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchData()
      setNotification({ type: "success", message: "Appointments refreshed successfully!" })
    } catch (error) {
      console.error("Error refreshing appointments:", error)
      setNotification({ type: "error", message: "Failed to refresh appointments" })
    } finally {
      setRefreshing(false)
    }
  }

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
            .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
            .filter(apt => apt.id !== appointmentId)
            .sort((a: Appointment, b: Appointment) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime())
          setPatientHistory(history)
        } catch (error) {
          console.error("Error fetching patient history:", error)
        }
      }
    }
  }

  // Get latest checkup recommendation for same doctor
  const getLatestCheckupRecommendation = (appointment: Appointment) => {
    const sameDoctorHistory = patientHistory.filter((historyItem: Appointment) => 
      historyItem.doctorId === appointment.doctorId && 
      historyItem.id !== appointment.id &&
      (historyItem.medicine || historyItem.doctorNotes)
    )
    
    if (sameDoctorHistory.length > 0) {
      const latest = sameDoctorHistory[0] // Already sorted by date desc
      return {
        doctorName: userData?.name || "Dr. " + (userData?.firstName || "Unknown"),
        date: new Date(latest.appointmentDate).toLocaleDateString(),
        medicine: latest.medicine,
        notes: latest.doctorNotes
      }
    }
    return null
  }

  const openCompletionModal = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId)
    setShowCompletionModal(true)
  }

  // Helper function to calculate age from date of birth
  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  // Parse AI diagnosis into structured format for better display
  const parseAIDiagnosis = (text: string) => {
    const sections: {
      diagnosis: string;
      tests: string[];
      treatment: string;
      urgent: string;
      notes: string;
    } = {
      diagnosis: '',
      tests: [],
      treatment: '',
      urgent: '',
      notes: ''
    }

    // Extract sections using regex - Updated to match new AI format
    const diagnosisMatch = text.match(/\*\*.*?DIAGNOSIS:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
    const testsMatch = text.match(/\*\*.*?TESTS:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
    const treatmentMatch = text.match(/\*\*.*?TREATMENT.*?:\*\*\s*([\s\S]*?)(?=\*\*|$)/i)
    const urgentMatch = text.match(/\*\*.*?(?:WHEN TO SEEK|WARNING SIGNS|RED FLAGS).*?:\*\*\s*([\s\S]*?)(?=\*\*|---|\n\n\*Note|$)/i)
    const notesMatch = text.match(/\*\*.*?(?:NOTES|EDUCATION).*?:\*\*\s*([\s\S]*?)(?=\*\*|---|\n\n\*Note|$)/i)

    if (diagnosisMatch) sections.diagnosis = diagnosisMatch[1].trim()
    if (testsMatch) {
      const testsList = testsMatch[1].match(/\d+\.\s*(.+?)(?=\n\d+\.|\n\n|$)/g)
      if (testsList) {
        sections.tests = testsList.map((t: string) => t.replace(/^\d+\.\s*/, '').trim())
      }
    }
    if (treatmentMatch) sections.treatment = treatmentMatch[1].trim()
    if (urgentMatch) sections.urgent = urgentMatch[1].trim()
    if (notesMatch) sections.notes = notesMatch[1].trim()

    // If parsing fails, return the full text as diagnosis
    if (!sections.diagnosis && !sections.tests.length && !sections.treatment) {
      sections.diagnosis = text.substring(0, 500) + (text.length > 500 ? '...' : '')
    }

    return sections
  }

  // AI Diagnosis Function - Automatically uses patient data from appointment
  const getAIDiagnosisSuggestion = async (appointment: Appointment) => {
    setLoadingAiDiagnosis({...loadingAiDiagnosis, [appointment.id]: true})
    
    try {
      // Automatically build comprehensive patient info from appointment data
      const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : 'Unknown'
      let patientInfo = `Age: ${age}, Gender: ${appointment.patientGender || 'Unknown'}, Blood Group: ${appointment.patientBloodGroup || 'Unknown'}, Drinking Habits: ${appointment.patientDrinkingHabits || 'None'}, Smoking Habits: ${appointment.patientSmokingHabits || 'None'}, Diet: ${appointment.patientVegetarian || 'Unknown'}`
      
      // Add allergies - CRITICAL for prescriptions
      if (appointment.patientAllergies) {
        patientInfo += `, ALLERGIES: ${appointment.patientAllergies} (DO NOT prescribe these)`
      }
      
      // Add current medications - to avoid drug interactions
      if (appointment.patientCurrentMedications) {
        patientInfo += `, Current Medications: ${appointment.patientCurrentMedications}`
      }
      
      // Automatically use chief complaint and medical history
      const symptoms = appointment.chiefComplaint
      const medicalHistory = appointment.medicalHistory || ""
      
      // Call diagnosis API
      console.log("🔍 Sending AI diagnosis request:", { symptoms, patientInfo, medicalHistory })
      const { data } = await axios.post("/api/diagnosis", {
        symptoms,
        patientInfo,
        medicalHistory
      })
      console.log("✅ AI diagnosis response received:", data)
      console.log("📊 Data structure:", {
        dataLength: data?.length,
        firstItem: data?.[0],
        generatedText: data?.[0]?.generated_text,
        appointmentId: appointment.id
      })
      
      const diagnosisText = data?.[0]?.generated_text || "Unable to generate diagnosis"
      console.log("📝 Diagnosis text to set:", diagnosisText.substring(0, 100) + "...")
      
      setAiDiagnosis({...aiDiagnosis, [appointment.id]: diagnosisText})
      console.log("💾 Updated aiDiagnosis state:", {...aiDiagnosis, [appointment.id]: diagnosisText.substring(0, 50) + "..."})
      
      setNotification({ type: "success", message: "AI diagnosis suggestion generated!" })
    } catch (error: unknown) {
      console.error("AI Diagnosis error:", error)
      console.error("Error response:", (error as { response?: { data?: unknown; status?: number } }).response?.data)
      console.error("Error status:", (error as { response?: { data?: unknown; status?: number } }).response?.status)
      
      const errorMessage = (error as { response?: { data?: { error?: string } } }).response?.data?.error || (error as Error).message || "Failed to get AI diagnosis"
      setNotification({ 
        type: "error", 
        message: `AI Diagnosis Error: ${errorMessage}` 
      })
    } finally {
      setLoadingAiDiagnosis({...loadingAiDiagnosis, [appointment.id]: false})
    }
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
    } catch (error: unknown) {
      console.error("Error completing appointment:", error)
      setNotification({ 
        type: "error", 
        message: (error as Error).message || "Failed to complete appointment" 
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
  const sortByDateTime = (a: Appointment, b: Appointment) => {
    const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`)
    const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`)
    return dateA.getTime() - dateB.getTime()
  }
  
  const sortByDateTimeDesc = (a: Appointment, b: Appointment) => {
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
          <div className="flex items-center justify-between">
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
          </div>
          
      
          
          

        {/* Appointments Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">
            All Appointments
          </h2>

          {/* Tabs - Clean Professional Design */}
          <div className="border-b border-slate-200 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex gap-4 sm:gap-6 lg:gap-8 overflow-x-auto pb-px w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("today")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "today"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">Today</span>
                  {todayAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {todayAppointments.length}
                    </div>
                  )}
                  {activeTab === "today" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
                
            <button
              onClick={() => setActiveTab("tomorrow")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "tomorrow"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">Tomorrow</span>
                  {tomorrowAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {tomorrowAppointments.length}
                    </div>
                  )}
                  {activeTab === "tomorrow" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
                
            <button
              onClick={() => setActiveTab("thisWeek")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "thisWeek"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">This Week</span>
                  {thisWeekAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {thisWeekAppointments.length}
                    </div>
                  )}
                  {activeTab === "thisWeek" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
                
            <button
              onClick={() => setActiveTab("nextWeek")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "nextWeek"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">Next Week</span>
                  {nextWeekAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {nextWeekAppointments.length}
                    </div>
                  )}
                  {activeTab === "nextWeek" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
                
            <button
              onClick={() => setActiveTab("history")}
                  className={`relative flex items-center gap-3 py-4 px-1 font-semibold transition-all whitespace-nowrap ${
                activeTab === "history"
                      ? "text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="text-base">History</span>
                  {historyAppointments.length > 0 && (
                    <div className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-bold text-white bg-red-500 rounded-full">
                      {historyAppointments.length}
                    </div>
                  )}
                  {activeTab === "history" && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full animate-slide-in"></span>
                  )}
            </button>
          </div>
              
        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs sm:text-sm"
        >
                {refreshing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <style jsx>{`
            @keyframes slide-in {
              from {
                transform: scaleX(0);
                opacity: 0;
              }
              to {
                transform: scaleX(1);
                opacity: 1;
              }
            }
            
            .animate-slide-in {
              animation: slide-in 0.3s ease-out;
              transform-origin: left;
            }
          `}</style>

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
                <div key={appointment.id} id={`appointment-${appointment.id}`} className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden hover:border-teal-300 hover:shadow-lg transition-all">
                  {/* Accordion Header */}
                  <div 
                    onClick={() => toggleAccordion(appointment.id)}
                    className="p-5 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Patient Avatar */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-teal-700 group-hover:scale-110 transition-transform flex-shrink-0">
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
                        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
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
                      {/* Top Section: Patient Info (Left) + Lifestyle & Appointment (Right) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* LEFT: Patient Information Only */}
                        <div>
                          <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base pb-3 border-b border-slate-200">
                              <span className="text-xl">👤</span>
                              <span>Patient Information</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Patient ID</span>
                                <p className="font-mono text-slate-800 mt-1 text-xs break-all">{appointment.patientId}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Full Name</span>
                                <p className="text-slate-900 mt-1 font-semibold">{appointment.patientName}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Email</span>
                                <p className="text-slate-900 mt-1">{appointment.patientEmail}</p>
                              </div>
                              {appointment.patientPhone && (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold">Phone</span>
                                  <p className="text-slate-900 mt-1 font-semibold">{appointment.patientPhone}</p>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                {appointment.patientGender && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <span className="text-slate-500 text-xs font-semibold">Gender</span>
                                    <p className="text-slate-900 mt-1 font-semibold">{appointment.patientGender}</p>
                                  </div>
                                )}
                                {appointment.patientBloodGroup && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <span className="text-slate-500 text-xs font-semibold">Blood Group</span>
                                    <p className="text-slate-900 mt-1 font-bold text-lg">{appointment.patientBloodGroup}</p>
                                  </div>
                                )}
                              </div>
                              {appointment.patientDateOfBirth && (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  <span className="text-slate-600 text-xs font-semibold uppercase">Date of Birth</span>
                                  <p className="text-slate-900 mt-1 font-semibold">
                                    {new Date(appointment.patientDateOfBirth).toLocaleDateString()}
                                    <span className="text-slate-500 text-xs ml-2">
                                      (Age: {calculateAge(appointment.patientDateOfBirth)} years)
                                    </span>
                                  </p>
                                </div>
                              )}
                              
                              {/* Latest Checkup Recommendation - Only show if available */}
                              {(() => {
                                const latestRecommendation = getLatestCheckupRecommendation(appointment)
                                return latestRecommendation && (
                                  <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 mt-3">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-blue-600 text-lg">🩺</span>
                                      <h5 className="font-bold text-blue-800 text-sm">Latest Recommendation</h5>
                                      <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                        {latestRecommendation.date}
                                      </span>
                            </div>
                                    
                                    {latestRecommendation.medicine && (
                                      <div className="mb-3">
                                        <span className="text-blue-700 text-xs font-semibold block mb-1">💊 Previous Medicine:</span>
                                        <p className="text-blue-900 text-sm font-medium bg-white p-2 rounded border border-blue-200">
                                          {latestRecommendation.medicine}
                                        </p>
                          </div>
                                    )}
                                    
                                    {latestRecommendation.notes && (
                                      <div className="mb-2">
                                        <span className="text-blue-700 text-xs font-semibold block mb-1">📝 Previous Notes:</span>
                                        <p className="text-blue-900 text-sm font-medium bg-white p-2 rounded border border-blue-200">
                                          {latestRecommendation.notes}
                                        </p>
                                      </div>
                                    )}
                                    
                                    <div className="text-xs text-blue-600 font-medium">
                                      Recommended by {latestRecommendation.doctorName}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                            </div>
                          </div>

                        {/* RIGHT: Lifestyle & Appointment Details */}
                        <div className="space-y-4">
                          {/* Social & Lifestyle Information */}
                          {(appointment.patientDrinkingHabits || appointment.patientSmokingHabits || appointment.patientVegetarian) && (
                            <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base pb-3 border-b border-slate-200">
                                <span className="text-xl">🌱</span>
                                <span>Lifestyle</span>
                              </h4>
                              <div className="space-y-3 text-sm">
                                {appointment.patientDrinkingHabits && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                                    <span className="text-slate-600 font-medium">Drinking</span>
                                    <span className="bg-slate-200 px-3 py-1 rounded-full text-slate-800 font-semibold capitalize text-xs">
                                      {appointment.patientDrinkingHabits}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientSmokingHabits && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                                    <span className="text-slate-600 font-medium">Smoking</span>
                                    <span className="bg-slate-200 px-3 py-1 rounded-full text-slate-800 font-semibold capitalize text-xs">
                                      {appointment.patientSmokingHabits}
                                    </span>
                                  </div>
                                )}
                                {appointment.patientVegetarian && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                                    <span className="text-slate-600 font-medium">Diet</span>
                                    <span className="bg-slate-200 px-3 py-1 rounded-full text-slate-800 font-semibold capitalize text-xs">
                                      {appointment.patientVegetarian}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Appointment Details */}
                          <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base pb-3 border-b border-slate-200">
                              <span className="text-xl">📅</span>
                              <span>Appointment Details</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Date</span>
                                <p className="text-slate-900 mt-1 font-bold">{new Date(appointment.appointmentDate).toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold">Time</span>
                                <p className="text-slate-900 mt-1 font-bold text-lg">{appointment.appointmentTime}</p>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold mb-2 block">Status</span>
                                <span className={`px-4 py-2 rounded-lg text-sm font-bold inline-block ${getStatusColor(appointment.status)}`}>
                                  {appointment.status === "confirmed" ? "✓ Confirmed" : 
                                   appointment.status === "completed" ? "✓ Completed" : 
                                   appointment.status}
                                </span>
                              </div>
                              </div>
                            </div>
                          </div>
                        </div>

                      {/* Bottom Section: Medical Info + AI Diagnosis (Full Width) */}
                      <div className="space-y-6">
                        {/* Medical Information */}
                        <div className="bg-white rounded-xl p-5 border-2 border-slate-200 shadow-sm">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-base pb-3 border-b border-slate-200">
                              <span className="text-xl">🩺</span>
                              <span>Medical Information</span>
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Chief Complaint</span>
                                <p className="text-slate-900 font-medium leading-relaxed">
                                  {appointment.chiefComplaint}
                                </p>
                              </div>
                              {appointment.medicalHistory && (
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Medical History</span>
                                  <p className="text-slate-900 font-medium leading-relaxed">
                                    {appointment.medicalHistory}
                                  </p>
                                </div>
                              )}
                              {appointment.patientAllergies && (
                                <div className="bg-red-50 rounded-lg p-4 border-2 border-red-400">
                                  <span className="text-red-700 text-xs font-bold uppercase mb-2 block flex items-center gap-1">
                                    <span>⚠️</span> ALLERGIES - DO NOT PRESCRIBE
                                  </span>
                                  <p className="text-red-900 font-bold leading-relaxed">
                                    {appointment.patientAllergies}
                                  </p>
                                </div>
                              )}
                              {appointment.patientCurrentMedications && (
                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                  <span className="text-slate-500 text-xs font-semibold uppercase mb-2 block">Current Medications</span>
                                  <p className="text-slate-900 font-medium leading-relaxed">
                                    {appointment.patientCurrentMedications}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AI Diagnosis Button - Only show if not already generated */}
                          {!aiDiagnosis[appointment.id] && appointment.status === "confirmed" && (
                            <div className="bg-white rounded-xl p-5 border-2 border-slate-300 shadow-sm">
                              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-base">
                                <span className="text-2xl">🤖</span>
                                <span>AI Diagnostic Assistant</span>
                            </h4>
                              <p className="text-xs text-slate-600 mb-4">
                                Get AI-powered diagnosis suggestions using patient&apos;s symptoms and medical history
                              </p>
                              <button
                                onClick={() => getAIDiagnosisSuggestion(appointment)}
                                disabled={loadingAiDiagnosis[appointment.id]}
                                className="w-full px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-lg hover:from-slate-800 hover:to-slate-900 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-sm flex items-center justify-center gap-2"
                              >
                                {loadingAiDiagnosis[appointment.id] ? (
                                  <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Analyzing Patient Data...
                                  </>
                                ) : (
                                  <>
                                    <span>🔍</span> Get AI Diagnosis Suggestion
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* AI Diagnosis Result - Clean Unified Design */}
                          {aiDiagnosis[appointment.id] && (() => {
                            console.log("🎯 Rendering AI diagnosis for appointment:", appointment.id)
                            console.log("📋 AI diagnosis content:", aiDiagnosis[appointment.id]?.substring(0, 100))
                            const parsed = parseAIDiagnosis(aiDiagnosis[appointment.id])
                            console.log("🔍 Parsed diagnosis result:", parsed)
                            return (
                              <div className="bg-white rounded-xl border-2 border-slate-300 shadow-lg overflow-hidden">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-xl backdrop-blur">
                                        🤖
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-white text-base">AI Diagnosis Suggestion</h4>
                                        <p className="text-slate-300 text-xs">Powered by Groq Llama 3.3 70B</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const newDiagnosis = {...aiDiagnosis}
                                        delete newDiagnosis[appointment.id]
                                        setAiDiagnosis(newDiagnosis)
                                      }}
                                      className="text-white hover:bg-white/10 rounded-lg p-2 transition-all"
                                      title="Close"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>

                                {/* Content */}
                                <div className="p-5 space-y-4">
                                  {/* Diagnosis */}
                                  {parsed.diagnosis && (
                                    <div className="pb-4 border-b border-slate-200">
                                      <div className="flex items-start gap-3 mb-2">
                                        <span className="text-lg">🩺</span>
                                        <h5 className="font-bold text-slate-800 text-sm">PRELIMINARY DIAGNOSIS</h5>
                                      </div>
                                      <div className="ml-8 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                          {parsed.diagnosis}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Tests */}
                                  {parsed.tests.length > 0 && (
                                    <div className="pb-4 border-b border-slate-200">
                                      <div className="flex items-start gap-3 mb-3">
                                        <span className="text-lg">🔬</span>
                                        <h5 className="font-bold text-slate-800 text-sm">RECOMMENDED TESTS</h5>
                                      </div>
                                      <div className="ml-8 space-y-2">
                                        {parsed.tests.map((test: string, idx: number) => (
                                          <div key={idx} className="flex items-start gap-2 text-sm">
                                            <span className="text-slate-500 font-mono mt-0.5">{idx + 1}.</span>
                                            <span className="text-slate-700">{test}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Treatment */}
                                  {parsed.treatment && (
                                    <div className="pb-4 border-b border-slate-200">
                                      <div className="flex items-start gap-3 mb-2">
                                        <span className="text-lg">💊</span>
                                        <h5 className="font-bold text-slate-800 text-sm">TREATMENT RECOMMENDATIONS</h5>
                                      </div>
                                      <div className="ml-8 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                          {parsed.treatment}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Urgent Care */}
                                  {parsed.urgent && (
                                    <div className="pb-4 border-b border-slate-200">
                                      <div className="flex items-start gap-3 mb-2">
                                        <span className="text-lg text-red-600">⚠️</span>
                                        <h5 className="font-bold text-red-700 text-sm">WHEN TO SEEK IMMEDIATE CARE</h5>
                                      </div>
                                      <div className="ml-8 bg-red-50 p-3 rounded-lg border border-red-200">
                                        <p className="text-sm text-red-800 font-medium leading-relaxed">
                                          {parsed.urgent}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Additional Notes */}
                                  {parsed.notes && (
                                    <div className="pb-4 border-b border-slate-200">
                                      <details>
                                        <summary className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors">
                                          <span className="text-lg">📝</span>
                                          <h5 className="font-bold text-slate-800 text-sm">ADDITIONAL NOTES</h5>
                                        </summary>
                                        <div className="ml-8 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                          <p className="text-sm text-slate-700 leading-relaxed">
                                            {parsed.notes}
                                          </p>
                                        </div>
                                      </details>
                                    </div>
                                  )}

                                  {/* Disclaimer */}
                                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                                    <p className="text-xs text-amber-900 leading-relaxed">
                                      <strong className="font-semibold">⚠️ Medical Disclaimer:</strong> This is an AI-generated suggestion. 
                                      Always use your professional judgment and conduct proper examination before final diagnosis.
                                    </p>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      onClick={() => getAIDiagnosisSuggestion(appointment)}
                                      disabled={loadingAiDiagnosis[appointment.id]}
                                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all font-semibold text-sm border border-slate-300 flex items-center justify-center gap-2"
                                    >
                                      <span>🔄</span> Regenerate
                                    </button>
                              {appointment.status === "confirmed" && (
                                      <button
                                        onClick={() => openCompletionModal(appointment.id)}
                                        disabled={updating}
                                        className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-sm flex items-center justify-center gap-2"
                                      >
                                        <span>✓</span> Complete Checkup
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Complete Checkup Button - Show at bottom if AI not shown yet */}
                          {!aiDiagnosis[appointment.id] && appointment.status === "confirmed" && (
                            <div className="mt-4">
                                <button
                                  onClick={() => openCompletionModal(appointment.id)}
                                  disabled={updating}
                                  className="w-full px-5 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-base flex items-center justify-center gap-2"
                                >
                                  <span>✓</span> Complete Checkup
                                </button>
                            </div>
                              )}

                          {/* Completed Status with Prescription */}
                              {appointment.status === "completed" && (
                            <div className="bg-white rounded-xl p-5 border-2 border-green-200 shadow-sm">
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
                                      <p className="text-xs text-gray-600 mb-1 font-semibold">📝 Doctor&apos;s Notes:</p>
                                      <p className="text-sm text-gray-900">{appointment.doctorNotes}</p>
                                    </div>
                                  )}
                                  <button
                                    onClick={() => generatePrescriptionPDF(appointment as unknown as AppointmentType)}
                                    className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Download Prescription PDF
                                  </button>
                                </div>
                            </div>
                          )}

                        {/* Patient History */}
                        {patientHistory.length > 0 && (
                          <div>
                            <div className="bg-white rounded-xl p-4 border-2 border-slate-200 shadow-sm">
                              <button
                                onClick={() => setShowHistory({...showHistory, [appointment.id]: !showHistory[appointment.id]})}
                                className="w-full flex items-center justify-between hover:bg-slate-50 rounded-lg p-2 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">📚</span>
                                  <h4 className="font-semibold text-slate-800 text-base">
                                    Previous Checkup History ({patientHistory.length})
                              </h4>
                                </div>
                                <div className={`transition-transform duration-200 ${showHistory[appointment.id] ? 'rotate-180' : ''}`}>
                                  <span className="text-slate-600 text-lg">▼</span>
                                </div>
                              </button>
                              
                              {showHistory[appointment.id] && (
                                <div className="space-y-3 mt-4">
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
                              )}
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
                    Doctor&apos;s Notes <span className="text-red-500">*</span>
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

