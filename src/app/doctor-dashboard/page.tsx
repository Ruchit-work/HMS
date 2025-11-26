"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/firebase/config"
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { fetchPublishedCampaignsForAudience, type Campaign } from "@/utils/campaigns"
import CampaignCarousel from "@/components/patient/CampaignCarousel"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import Notification from "@/components/ui/Notification"
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
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [completionData, setCompletionData] = useState({
    medicine: "",
    notes: ""
  })
  const [visitingHours, setVisitingHours] = useState<VisitingHours>(DEFAULT_VISITING_HOURS)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [blockedDrafts, setBlockedDrafts] = useState<BlockedDate[]>([])
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

  // Save visiting hours and blocked dates -> submit for admin approval
  const handleSaveSchedule = async () => {
    if (!user?.uid) return

    setSavingSchedule(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to submit schedule requests")
      }
      const token = await currentUser.getIdToken()

      const res = await fetch('/api/doctor/schedule-request', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: user.uid,
          requestType: 'both',
          visitingHours,
          blockedDates: blockedDrafts,
        })
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        throw new Error(j?.error || 'Failed to submit request')
      }
      setNotification({ type: 'success', message: 'Sent to admin for approval. Changes will apply after approval.' })
      setBlockedDrafts([])
    } catch (error: unknown) {
      console.error('Error submitting schedule request:', error)
      setNotification({ type: 'error', message: (error as Error).message || 'Failed to submit request' })
    } finally {
      setSavingSchedule(false)
    }
  }

  // Submit only blocked date drafts for approval
  const handleSubmitBlockedDrafts = async () => {
    if (!user?.uid || blockedDrafts.length === 0) return

    setSavingSchedule(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to submit schedule requests")
      }
      const token = await currentUser.getIdToken()

      const res = await fetch('/api/doctor/schedule-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: user.uid,
          requestType: 'blockedDates',
          blockedDates: blockedDrafts,
        })
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        throw new Error(j?.error || 'Failed to submit request')
      }
      setNotification({ type: 'success', message: 'Blocked dates sent to admin for approval.' })
      setBlockedDrafts([])
    } catch (e: any) {
      setNotification({ type: 'error', message: e?.message || 'Failed to submit request' })
    } finally {
      setSavingSchedule(false)
    }
  }

  useEffect(() => {
    if (!user) return
    const loadCampaigns = async () => {
      const published = await fetchPublishedCampaignsForAudience('doctors')
      setCampaigns(published)
    }
    loadCampaigns()
  }, [user])

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

  // Shared comparator to sort appointments by combined date and time (earliest first)
  const compareAppointmentsByDateTime = (a: Appointment, b: Appointment) => {
    const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`).getTime()
    const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`).getTime()
    return dateA - dateB
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
        {campaigns.length > 0 && (
          <section className="relative mb-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
            <div className="absolute inset-y-0 left-[-25%] w-1/2 rounded-full bg-indigo-600/40 blur-3xl" />
            <div className="absolute inset-y-0 right-[-30%] w-1/2 rounded-full bg-teal-500/40 blur-3xl" />

            <div className="relative flex flex-col gap-10 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl text-white">
                <p className="text-xs uppercase tracking-[0.6em] text-white/60">Clinical pulse</p>
                <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                  Strategic highlights to engage and inform your patients
                </h2>
                <p className="mt-3 max-w-lg text-sm text-white/75 sm:text-base">
                  Campaigns crafted by the admin team to align with today's health priorities. Share them across your channels or use them during consultations.
                </p>
                {campaigns.length > 1 && (
                  <p className="mt-2 text-xs text-white/60 sm:text-sm">
                    Swipe or use arrows to view all {campaigns.length} campaigns
                  </p>
                )}
              </div>

              <div className="w-full lg:w-[520px]">
                <CampaignCarousel campaigns={campaigns} />
              </div>
            </div>
          </section>
        )}
        
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
                .sort(compareAppointmentsByDateTime)

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
              autosave={false}
              draftDates={blockedDrafts}
              onDraftChange={setBlockedDrafts}
            />

            {blockedDrafts.length > 0 && (
              <div className="mt-4 flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800 font-medium">{blockedDrafts.length} draft date(s) pending approval</p>
                <button
                  onClick={handleSubmitBlockedDrafts}
                  disabled={savingSchedule}
                  className="px-3 py-1.5 bg-yellow-600 text-white rounded-md text-xs hover:bg-yellow-700 disabled:opacity-50"
                >
                  Submit for Approval
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Appointments Section with Preview Link */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="flex items-center gap-2">
                <span>📋</span>
                <span>Recent Patient Appointments</span>
              </span>
              <span className="text-sm font-normal text-slate-500 sm:ml-2">({appointments.length} total)</span>
            </h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleRefreshAppointments}
                className="text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <Link 
                href="/doctor-dashboard/appointments"
                className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors text-center sm:text-left relative inline-flex items-center gap-2"
              >
                <div className="relative">
                  <span>View All</span>
                  {appointments.filter(apt => apt.status === "confirmed").length > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-full min-w-[18px] h-[18px] px-1 shadow-lg border-2 border-white animate-pulse">
                      {appointments.filter(apt => apt.status === "confirmed").length > 99 ? '99+' : appointments.filter(apt => apt.status === "confirmed").length}
                    </span>
                  )}
                </div>
                <span>→</span>
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
                .sort(compareAppointmentsByDateTime)
                .slice(0, 5)
                .map((appointment) => (
                <div key={appointment.id} className="border border-slate-200 rounded-lg p-4 hover:border-teal-300 hover:shadow-md transition-all">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex w-full items-start gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-lg font-semibold text-blue-600 uppercase">
                        {appointment.patientName?.[0] || "👤"}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-col gap-1">
                          <div>
                            <p className="font-semibold text-slate-800 text-base leading-tight capitalize">
                              {appointment.patientName || "Unknown patient"}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {appointment.patientGender && (
                                <span className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5 gap-1">
                                  <span>{appointment.patientGender === "male" ? "👨" : appointment.patientGender === "female" ? "👩" : "🧑"}</span>
                                  {appointment.patientGender}
                                </span>
                              )}
                              {appointment.patientBloodGroup && (
                                <span className="inline-flex items-center text-[10px] font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5 gap-1">
                                  <span>🩸</span>
                                  {appointment.patientBloodGroup}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {appointment.appointmentTime}
                            </span>
                            {appointment.patientPhone && (
                              <span className="inline-flex items-center gap-1">
                                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28c.597 0 1.123.335 1.385.894l1.498 3.206a1.5 1.5 0 01-.415 1.745l-1.12.933c-.128.106-.177.278-.122.433a11.04 11.04 0 005.516 5.516c.155.055.327.006.433-.122l.933-1.12a1.5 1.5 0 011.745-.415l3.206 1.498c.559.262.894.788.894 1.385V19a2 2 0 01-2 2h-1C9.82 21 3 14.18 3 5V5z" />
                                </svg>
                                {appointment.patientPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(appointment.status)}`}>
                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                      </span>
                      <button
                        onClick={() => viewAppointmentDetails(appointment)}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                      >
                        Details
                      </button>
                    </div>
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

