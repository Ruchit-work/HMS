"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { db } from "@/firebase/config"
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import Notification from "@/components/Notification"
import DashboardCard from "@/components/ui/DashboardCard"
import PageHeader from "@/components/ui/PageHeader"
import VisitingHoursEditor from "@/components/doctor/VisitingHoursEditor"
import BlockedDatesManager from "@/components/doctor/BlockedDatesManager"
import { VisitingHours, BlockedDate, Appointment } from "@/types/patient"
import { DEFAULT_VISITING_HOURS } from "@/utils/timeSlots"
import { completeAppointment, getStatusColor } from "@/utils/appointmentHelpers"

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  specialization: string;
  email: string;
  role: string;
  visitingHours?: VisitingHours;
  blockedDates?: BlockedDate[];
}

export default function DoctorDashboard() {
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [updating, setUpdating] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [completionData, setCompletionData] = useState({
    medicine: "",
    notes: ""
  })
  const [visitingHours, setVisitingHours] = useState<VisitingHours>(DEFAULT_VISITING_HOURS)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Protect route - only allow doctors
  const { user, loading } = useAuth("doctor")

  // Function to fetch appointments
  const fetchAppointments = async (doctorId: string) => {
    try {
      const appointmentsRef = collection(db, "appointments")
      const q = query(appointmentsRef, where("doctorId", "==", doctorId))
      const appointmentsSnapshot = await getDocs(q)
      const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Appointment))
      console.log("Fetched appointments for doctor:", doctorId, "Count:", appointmentsList.length)
      setAppointments(appointmentsList)
    } catch (error) {
      console.error("Error fetching appointments:", error)
    }
  }

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      // Get doctor data from Firestore
      const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
      if (doctorDoc.exists()) {
        const data = doctorDoc.data() as UserData
        setUserData(data)
        
        // Load visiting hours and blocked dates
        setVisitingHours(data.visitingHours || DEFAULT_VISITING_HOURS)
        setBlockedDates(data.blockedDates || [])
        
        // Fetch appointments
        await fetchAppointments(user.uid)
      }

    }

    fetchData()
  }, [user])

  // Manual refresh function
  const handleRefreshAppointments = async () => {
    if (user?.uid) {
      await fetchAppointments(user.uid)
      setNotification({ type: "success", message: "Appointments refreshed!" })
    }
  }

  // Save visiting hours and blocked dates
  const handleSaveSchedule = async () => {
    if (!user?.uid) return

    setSavingSchedule(true)
    try {
      await updateDoc(doc(db, "doctors", user.uid), {
        visitingHours: visitingHours,
        blockedDates: blockedDates,
        updatedAt: new Date().toISOString()
      })

      setNotification({ 
        type: "success", 
        message: "Schedule and blocked dates saved successfully!" 
      })
    } catch (error: unknown) {
      console.error("Error saving schedule:", error)
      setNotification({ 
        type: "error", 
        message: (error as Error).message || "Failed to save schedule" 
      })
    } finally {
      setSavingSchedule(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Loading Doctor Dashboard..." />
  }

  if (!user || !userData) {
    return null
  }

  // Open completion modal
  const openCompletionModal = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId)
    setShowCompletionModal(true)
  }

  const viewAppointmentDetails = (appointment: Appointment) => {
    // Store the appointment ID in sessionStorage to auto-expand it on the appointments page
    sessionStorage.setItem('expandAppointmentId', appointment.id)
    // Navigate to appointments page using Next.js router
    router.push('/doctor-dashboard/appointments')
  }

  // Complete appointment with medicine and notes
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

      // Update local state
      setAppointments(appointments.map(apt => 
        apt.id === selectedAppointmentId 
          ? { ...apt, ...result.updates } 
          : apt
      ))

      setNotification({ 
        type: "success", 
        message: result.message
      })

      // Reset and close modal
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

  // Calculate stats
  const totalPatients = new Set(appointments.map(apt => apt.patientId)).size
  const todayAppointments = appointments.filter((appointment: Appointment) => 
    new Date(appointment.appointmentDate).toDateString() === new Date().toDateString()
  ).length
  const completedAppointments = appointments.filter((appointment: Appointment) => appointment.status === "completed").length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Welcome Banner */}
        <PageHeader
          title={`Welcome, Dr. ${userData.firstName} ${userData.lastName}`}
          subtitle={userData.specialization}
          icon="👨‍⚕️"
          gradient="from-teal-600 to-cyan-700"
        />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <DashboardCard
            title="Total Patients"
            value={totalPatients}
            icon="👥"
            iconBgColor="bg-blue-100"
            subtitle="Unique patients"
          />
          
          <DashboardCard
            title="Today's Appointments"
            value={todayAppointments}
            icon="📅"
            iconBgColor="bg-green-100"
            subtitle={new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          
          <DashboardCard
            title="This Week"
            value={appointments.filter((apt: Appointment) => {
              const aptDate = new Date(apt.appointmentDate)
              const today = new Date()
              const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
              return aptDate >= today && aptDate <= weekFromNow
            }).length}
            icon="📊"
            iconBgColor="bg-purple-100"
            subtitle="Upcoming appointments"
          />

          <DashboardCard
            title="Completed"
            value={completedAppointments}
            icon="✅"
            iconBgColor="bg-teal-100"
            subtitle="Total checkups"
          />
        </div>

        {/* Today's Schedule & Quick Actions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Today's Schedule Timeline */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span>📅</span>
                <span>Today's Schedule</span>
              </h2>
              <span className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                {appointments.filter((apt: Appointment) => 
                  new Date(apt.appointmentDate).toDateString() === new Date().toDateString() && 
                  apt.status === "confirmed"
                ).length} appointments
              </span>
            </div>

            {(() => {
              const todayAppts = appointments
                .filter((apt: Appointment) => 
                  new Date(apt.appointmentDate).toDateString() === new Date().toDateString() && 
                  apt.status === "confirmed"
                )
                .sort((a: Appointment, b: Appointment) => {
                  const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`).getTime()
                  const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`).getTime()
                  return dateA - dateB // Earlier appointments first
                })

              if (todayAppts.length === 0) {
                return (
                  <div className="text-center py-12 bg-slate-50 rounded-xl">
                    <span className="text-5xl block mb-3">🎉</span>
                    <p className="text-slate-600 font-medium">No appointments scheduled for today</p>
                    <p className="text-sm text-slate-400 mt-1">Enjoy your day off!</p>
                  </div>
                )
              }

              return (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {todayAppts.map((apt: Appointment, index: number) => {
                    const [hours, minutes] = apt.appointmentTime.split(':').map(Number)
                    const time12hr = `${hours > 12 ? hours - 12 : hours}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
                    const isPast = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime() < Date.now()
                    
                    return (
                      <div 
                        key={apt.id}
                        className={`relative pl-8 pb-4 ${index !== todayAppts.length - 1 ? 'border-l-2 border-slate-200' : ''}`}
                      >
                        
                        <div className={`bg-gradient-to-r ${
                          isPast ? 'from-slate-50 to-slate-100' : 'from-teal-50 to-cyan-50'
                        } border ${
                          isPast ? 'border-slate-200' : 'border-teal-200'
                        } rounded-lg p-4 hover:shadow-md transition-all`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`text-lg font-bold ${
                                  isPast ? 'text-slate-600' : 'text-teal-700'
                                }`}>
                                  {time12hr}
                                </span>
                                {isPast && (
                                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                                    Completed
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-slate-800 flex items-center gap-2">
                                <span>👤</span>
                                {apt.patientName}
                              </p>
                              <p className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                                <span>🏥</span>
                                {apt.chiefComplaint}
                              </p>
                            </div>
                            {!isPast && (
                              <button 
                                onClick={() => viewAppointmentDetails(apt)}
                                className="px-3 py-1 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors font-semibold"
                              >
                                View
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Quick Actions Panel */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>⚡</span>
                <span>Quick Actions</span>
              </h2>

              <div className="space-y-2">
                <Link
                  href="/doctor-dashboard/appointments"
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                    📋
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-sm">View All Appointments</p>
                    <p className="text-xs text-slate-600">Manage patient visits</p>
                  </div>
                </Link>

                <Link
                  href="/doctor-dashboard/profile"
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                    👤
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 text-sm">My Profile</p>
                    <p className="text-xs text-slate-600">Update information</p>
                  </div>
                </Link>

                <button
                  onClick={handleRefreshAppointments}
                  className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-lg group-hover:scale-110 transition-transform">
                    🔄
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-slate-800 text-sm">Refresh Data</p>
                    <p className="text-xs text-slate-600">Update appointments</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>


        {/* Availability Management Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Visiting Hours Schedule */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span>🕐</span>
                <span>Weekly Schedule</span>
              </h2>
              <button
                onClick={handleSaveSchedule}
                disabled={savingSchedule}
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-sm"
              >
                {savingSchedule ? "Saving..." : "💾 Save All"}
              </button>
            </div>
            
            <VisitingHoursEditor 
              value={visitingHours}
              onChange={setVisitingHours}
            />
          </div>

          {/* Blocked Dates Section */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>🚫</span>
              <span>Blocked Dates</span>
            </h2>
            
            <BlockedDatesManager 
              blockedDates={blockedDates}
              onChange={setBlockedDates}
            />
          </div>
        </div>

        {/* Appointments Section with Preview Link */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span>📋</span>
              <span>Recent Patient Appointments</span>
              <span className="text-sm font-normal text-slate-500">({appointments.length} total)</span>
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefreshAppointments}
                className="text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <Link 
                href="/doctor-dashboard/appointments"
                className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                View All →
              </Link>
            </div>
          </div>

          {/* Quick Preview of Today's Appointments */}
          {appointments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl">
              <span className="text-5xl block mb-3 text-slate-300">📅</span>
              <p className="text-slate-600 font-medium">No appointments yet</p>
              <p className="text-sm text-slate-400 mt-1">Appointments from patients will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments
                .sort((a, b) => {
                  const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`).getTime()
                  const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`).getTime()
                  return dateA - dateB // Earlier appointments first
                })
                .slice(0, 5)
                .map((appointment) => (
                <div key={appointment.id} className="border border-slate-200 rounded-lg p-4 hover:border-teal-300 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        👤
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{appointment.patientName}</p>
                        <p className="text-sm text-slate-500">
                          {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })} at {appointment.appointmentTime}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(appointment.status)}`}>
                      {appointment.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
              {appointments.length > 5 && (
                <Link 
                  href="/doctor-dashboard/appointments"
                  className="block text-center py-3 text-sm font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                >
                  View {appointments.length - 5} more appointments →
                </Link>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Complete Checkup</h2>
                <button 
                  onClick={() => {
                    setShowCompletionModal(false)
                    setCompletionData({ medicine: "", notes: "" })
                    setSelectedAppointmentId(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCompleteAppointment} className="space-y-4">
                {/* Medicine */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💊 Prescribed Medicine <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={completionData.medicine}
                    onChange={(e) => setCompletionData({...completionData, medicine: e.target.value})}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Paracetamol 500mg - 1 tablet twice daily for 3 days&#10;Amoxicillin 250mg - 1 capsule three times daily for 5 days"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">List all medications with dosage and duration</p>
                </div>

                {/* Doctor Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📝 Doctor's Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={completionData.notes}
                    onChange={(e) => setCompletionData({...completionData, notes: e.target.value})}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Patient diagnosed with mild viral fever. Advised rest and plenty of fluids. Follow-up if symptoms persist beyond 3 days."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Include diagnosis, observations, and follow-up recommendations</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 bg-green-600 text-white py-3 rounded-md hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? "⏳ Saving..." : "✓ Complete Checkup"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompletionModal(false)
                      setCompletionData({ medicine: "", notes: "" })
                      setSelectedAppointmentId(null)
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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

