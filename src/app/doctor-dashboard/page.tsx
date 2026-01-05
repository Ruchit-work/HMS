"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/firebase/config"
import { doc, getDoc, query, where, onSnapshot, collection, deleteDoc } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/hospital-queries"
import Link from "next/link"
import { fetchPublishedCampaignsForAudience, type Campaign } from "@/utils/campaigns"
import CampaignCarousel from "@/components/patient/CampaignCarousel"
import LoadingSpinner from "@/components/ui/StatusComponents"
import VisitingHoursEditor from "@/components/doctor/VisitingHoursEditor"
import BlockedDatesManager from "@/components/doctor/BlockedDatesManager"
import { VisitingHours, BlockedDate, Appointment } from "@/types/patient"
import { DEFAULT_VISITING_HOURS } from "@/utils/timeSlots"
import { completeAppointment, getStatusColor } from "@/utils/appointmentHelpers"
import NotificationBadge from "@/components/ui/NotificationBadge"
import Notification from "@/components/ui/Notification"
import type { Branch } from "@/types/branch"

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
  const [, setUpdating] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [, setShowCompletionModal] = useState(false)
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [completionData, setCompletionData] = useState({
    medicine: "",
    notes: ""
  })
  const [visitingHours, setVisitingHours] = useState<VisitingHours>(DEFAULT_VISITING_HOURS)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [blockedDrafts, setBlockedDrafts] = useState<BlockedDate[]>([])
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [rejectedRequests, setRejectedRequests] = useState<any[]>([])
  const [dismissedRequestIds, setDismissedRequestIds] = useState<string[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)

  // Protect route - only allow doctors
  const { user, loading } = useAuth("doctor")
  const { activeHospitalId } = useMultiHospital()

  // Function to set up real-time appointments listener
  const setupAppointmentsListener = (doctorId: string, branchId: string | null) => {
    if (!activeHospitalId) return () => {}
    
    try {
      const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
      // Build query with optional branch filter
      let q
      if (branchId) {
        q = query(
          appointmentsRef, 
          where("doctorId", "==", doctorId),
          where("branchId", "==", branchId)
        )
      } else {
        q = query(appointmentsRef, where("doctorId", "==", doctorId))
      }
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const appointmentsList = snapshot.docs
          .map((doc) => ({ 
            id: doc.id, 
            ...doc.data() 
          } as Appointment))
          // Filter out WhatsApp pending appointments - they should only appear in WhatsApp Bookings Panel
          .filter((appointment) => {
            return appointment.status !== "whatsapp_pending" && !appointment.whatsappPending
          })
        
        setAppointments(appointmentsList)
      }, (error) => {
      })
      
      return unsubscribe
    } catch (error) {
      return () => {} // Return empty function if setup fails
    }
  }

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      // Wait for authentication to complete
      if (loading || !user) return
      if (!activeHospitalId) return

      try {
        setLoadingBranches(true)
        const currentUser = auth.currentUser
        if (!currentUser) {
          // User not authenticated yet, wait for auth to complete
          return
        }
        const token = await currentUser.getIdToken()

        const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        const data = await response.json()

        if (data.success && data.branches) {
          setBranches(data.branches)
        }
      } catch (error) {
      } finally {
        setLoadingBranches(false)
      }
    }

    fetchBranches()
  }, [activeHospitalId, user, loading])

  useEffect(() => {
    if (!user) return

    let unsubscribeAppointments: (() => void) | null = null
    let unsubscribeScheduleRequests: (() => void) | null = null

    const fetchData = async () => {
      // Get doctor data from Firestore
      const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
      if (doctorDoc.exists()) {
        const data = doctorDoc.data() as UserData
        setUserData(data)
        
        // Load visiting hours and blocked dates
        setVisitingHours(data.visitingHours || DEFAULT_VISITING_HOURS)
        setBlockedDates(data.blockedDates || [])
        
        // Set up real-time appointments listener with branch filter
        unsubscribeAppointments = setupAppointmentsListener(user.uid, selectedBranchId)
        
        // Set up real-time listener for schedule requests (pending and rejected)
        const scheduleRequestsQuery = query(
          collection(db, 'doctor_schedule_requests'),
          where('doctorId', '==', user.uid),
          where('status', 'in', ['pending', 'rejected'])
        )
        
        unsubscribeScheduleRequests = onSnapshot(scheduleRequestsQuery, (snapshot) => {
          const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          
          const pending = requests.filter((r: any) => r.status === 'pending')
          const rejected = requests.filter((r: any) => r.status === 'rejected')
          
          setPendingRequests(pending)
          setRejectedRequests(rejected)
        }, (error) => {
        })
      }
    }

    fetchData()

    // Cleanup function to unsubscribe from listeners
    return () => {
      if (unsubscribeAppointments) {
        unsubscribeAppointments()
      }
      if (unsubscribeScheduleRequests) {
        unsubscribeScheduleRequests()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedBranchId])

  // Manual refresh function
  const handleRefreshAppointments = async () => {
    if (user?.uid) {
      // Real-time listeners will automatically update, so just show success message
      setNotification({ type: "success", message: "Appointments are automatically updated in real-time!" })
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

  // Delete rejected leave request from database
  const handleDeleteRejectedRequest = async (requestId: string) => {
    if (!requestId) return

    try {
      // Delete from Firestore
      const requestRef = doc(db, 'doctor_schedule_requests', requestId)
      await deleteDoc(requestRef)
      
      // The real-time listener will automatically update the UI
      setNotification({ type: 'success', message: 'Rejected request removed successfully.' })
    } catch (error: unknown) {
      setNotification({ 
        type: 'error', 
        message: (error as Error).message || 'Failed to delete request' 
      })
    }
  }

  useEffect(() => {
    if (!user || !activeHospitalId) return
    const loadCampaigns = async () => {
      const published = await fetchPublishedCampaignsForAudience('doctors', activeHospitalId)
      setCampaigns(published)
    }
    loadCampaigns()
  }, [user, activeHospitalId])

  if (loading) {
    return <LoadingSpinner message="Loading Doctor Dashboard..." />
  }

  if (!user || !userData) {
    return null
  }

  // Open completion modal
  const _openCompletionModal = (appointmentId: string) => {
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
  const _handleCompleteAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedAppointmentId) return

    if (!activeHospitalId) {
      setNotification({ 
        type: "error", 
        message: "Hospital context is not available. Please refresh the page." 
      })
      return
    }
    
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
        completionData.notes,
        activeHospitalId
      )

      // Update local state
      const updatedAppointments = appointments.map(apt => 
        apt.id === selectedAppointmentId 
          ? { ...apt, ...result.updates } 
          : apt
      )
      setAppointments(updatedAppointments)

      // Find the completed appointment to send WhatsApp message
      const completedAppointment = updatedAppointments.find(apt => apt.id === selectedAppointmentId)

      // Send completion WhatsApp message with Google Review link
      if (completedAppointment) {
        try {
          const currentUser = auth.currentUser
          if (currentUser) {
            const token = await currentUser.getIdToken()
            const completionResponse = await fetch("/api/doctor/send-completion-whatsapp", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({
                appointmentId: selectedAppointmentId,
                patientId: completedAppointment.patientId,
                patientPhone: completedAppointment.patientPhone,
                patientName: completedAppointment.patientName,
                hospitalId: activeHospitalId, // Pass hospitalId to API
              }),
            })

            const responseData = await completionResponse.json().catch(() => ({}))
            
            if (!completionResponse.ok) {
            } else {
            }
          } else {
          }
        } catch (error) {
          // Don't fail the completion if WhatsApp fails
        }
      } else {
      }

      setNotification({ 
        type: "success", 
        message: result.message
      })

      // Reset and close modal
      setCompletionData({ medicine: "", notes: "" })
      setShowCompletionModal(false)
      setSelectedAppointmentId(null)
    } catch (error: unknown) {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-20">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  Welcome back, Dr. {userData.firstName}! 👋
                </h2>
                <p className="text-blue-100 mb-4">
                  Ready to make a difference in your patients' lives today
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>System Online</span>
                  </div>
                  <div className="text-blue-200">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center text-4xl">
                  🩺
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Branch Selection */}
        {branches.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg">🏥</span>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Select Branch</label>
                  <p className="text-xs text-slate-500">View appointments for a specific branch</p>
                </div>
              </div>
              <div className="flex-1 max-w-xs">
                <select
                  value={selectedBranchId || ""}
                  onChange={(e) => setSelectedBranchId(e.target.value || null)}
                  disabled={loadingBranches}
                  className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {campaigns.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">📢 Health Campaigns</h3>
              <span className="text-sm text-slate-500">{campaigns.length} active</span>
            </div>
            <CampaignCarousel campaigns={campaigns} />
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
            style={{ boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Patients</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{totalPatients}</p>
                <p className="text-xs text-slate-500 mt-1">Unique patients</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">👥</span>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
            style={{ boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Today's Schedule</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{todayAppointments}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📅</span>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
            style={{ boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">This Week</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {appointments.filter((apt: Appointment) => {
                    const aptDate = new Date(apt.appointmentDate)
                    const today = new Date()
                    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
                    return aptDate >= today && aptDate <= weekFromNow
                  }).length}
                </p>
                <p className="text-xs text-slate-500 mt-1">Upcoming appointments</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
            </div>
          </div>

          <div 
            className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow"
            style={{ boxShadow: 'rgba(50, 50, 93, 0.25) 0px 13px 27px -5px, rgba(0, 0, 0, 0.3) 0px 8px 16px -8px' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Completed</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{completedAppointments}</p>
                <p className="text-xs text-slate-500 mt-1">Total checkups</p>
              </div>
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">✅</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-lg">📅</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Today's Schedule</h3>
                  <p className="text-sm text-slate-500">
                    {appointments.filter((apt: Appointment) => 
                      new Date(apt.appointmentDate).toDateString() === new Date().toDateString() && 
                      apt.status === "confirmed"
                    ).length} appointments scheduled
                  </p>
                </div>
              </div>
              <button
                onClick={handleRefreshAppointments}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
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
                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">🎉</span>
                    </div>
                    <p className="text-slate-600 font-medium">No appointments today</p>
                    <p className="text-sm text-slate-500 mt-1">Enjoy your free time!</p>
                  </div>
                )
              }

              return (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {todayAppts.map((apt: Appointment) => {
                    const [hours, minutes] = apt.appointmentTime.split(':').map(Number)
                    const time12hr = `${hours > 12 ? hours - 12 : hours}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`
                    const isPast = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime() < Date.now()
                    
                    return (
                      <div 
                        key={apt.id}
                        className={`p-4 rounded-lg border transition-all hover:shadow-sm ${
                          isPast 
                            ? 'bg-slate-50 border-slate-200' 
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold ${
                              isPast ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white'
                            }`}>
                              {time12hr.split(' ')[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{apt.patientName}</p>
                              <p className="text-sm text-slate-600">{apt.chiefComplaint}</p>
                              {isPast && (
                                <span className="inline-flex items-center text-xs text-slate-500 mt-1">
                                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                          {!isPast && (
                            <button 
                              onClick={() => viewAppointmentDetails(apt)}
                              className="btn-modern btn-modern-sm"
                            >
                              View Details
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Quick Actions & Info */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  href="/doctor-dashboard/appointments"
                  className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
                >
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                    📋
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">All Appointments</p>
                    <p className="text-sm text-slate-600">Manage patient visits</p>
                  </div>
                </Link>

                <Link
                  href="/doctor-dashboard/profile"
                  className="flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group"
                >
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                    👤
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">My Profile</p>
                    <p className="text-sm text-slate-600">Update information</p>
                  </div>
                </Link>

                <Link
                  href="/doctor-dashboard/analytics"
                  className="flex items-center gap-3 p-3 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors group"
                >
                  <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                    📊
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">Analytics</p>
                    <p className="text-sm text-slate-600">View performance insights</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Schedule Management */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Schedule Management</h3>
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-medium text-amber-800">Blocked Dates</p>
                  <p className="text-xs text-amber-700 mt-1">
                    {blockedDates.length} dates blocked
                  </p>
                </div>
                {blockedDrafts.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm font-medium text-yellow-800">Pending Approval</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      {blockedDrafts.length} requests waiting
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Leave Request Status */}
            {(pendingRequests.length > 0 || rejectedRequests.length > 0) && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Leave Request Status</h3>
                <div className="space-y-3">
                  {/* Pending Requests */}
                  {pendingRequests.map((req: any) => {
                    const blockedDates = Array.isArray(req.blockedDates) ? req.blockedDates : []
                    const dateStrings = blockedDates.map((bd: any) => {
                      return typeof bd === 'string' ? bd : bd?.date || ''
                    }).filter(Boolean)
                    const reasons = blockedDates.map((bd: any) => {
                      return typeof bd === 'object' && bd?.reason ? bd.reason : ''
                    }).filter(Boolean)
                    const uniqueReasons = [...new Set(reasons)]
                    
                    return (
                      <div key={req.id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-sm text-yellow-800">
                          Your leave {dateStrings.length > 0 && (
                            <>
                              <span className="font-semibold">{dateStrings.join(', ')}</span>
                            </>
                          )} {uniqueReasons.length > 0 && `(${uniqueReasons.join(', ')})`} is still pending
                        </p>
                      </div>
                    )
                  })}

                  {/* Rejected Requests */}
                  {rejectedRequests
                    .filter((req: any) => !dismissedRequestIds.includes(req.id))
                    .map((req: any) => {
                      const blockedDates = Array.isArray(req.blockedDates) ? req.blockedDates : []
                      const dateStrings = blockedDates.map((bd: any) => {
                        return typeof bd === 'string' ? bd : bd?.date || ''
                      }).filter(Boolean)
                      
                      return (
                        <div key={req.id} className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-center justify-between">
                          <p className="text-sm text-red-800">
                            Your request for leave {dateStrings.length > 0 && (
                              <span className="font-semibold">{dateStrings.join(', ')}</span>
                            )} is rejected
                          </p>
                          <button
                            onClick={() => {
                              handleDeleteRejectedRequest(req.id)
                            }}
                            className="ml-3 px-2 py-1 text-xs font-medium text-red-700 hover:text-red-900 hover:bg-red-100 rounded transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Schedule Configuration */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visiting Hours */}
          <div className="lg:col-span-2 relative bg-white rounded-xl p-6 shadow-sm border border-slate-200 overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500"></div>
              <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="schedule-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="20" cy="20" r="1.5" fill="currentColor" className="text-indigo-600" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#schedule-pattern)" />
              </svg>
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-lg">🕐</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Weekly Schedule</h3>
                    <p className="text-sm text-slate-500">Configure your availability</p>
                  </div>
                </div>
                <button
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule}
                  className="btn-modern btn-modern-purple inline-flex items-center justify-center gap-2"
                >
                  {savingSchedule ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
              
              <VisitingHoursEditor 
                value={visitingHours}
                onChange={setVisitingHours}
              />
            </div>
          </div>

          {/* Blocked Dates */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-lg">🚫</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Blocked Dates</h3>
                <p className="text-sm text-slate-500">Manage unavailable days</p>
              </div>
            </div>
            
            <BlockedDatesManager 
              blockedDates={blockedDates}
              onChange={setBlockedDates}
              autosave={false}
              draftDates={blockedDrafts}
              onDraftChange={setBlockedDrafts}
            />

            {blockedDrafts.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Pending Approval</p>
                    <p className="text-xs text-yellow-700">{blockedDrafts.length} date(s) waiting</p>
                  </div>
                  <button
                    onClick={handleSubmitBlockedDrafts}
                    disabled={savingSchedule}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Submit for Approval
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Appointments */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-lg">📋</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Recent Appointments</h3>
                <p className="text-sm text-slate-500">{appointments.length} total appointments</p>
              </div>
            </div>
            <div className="relative">
              <Link 
                href="/doctor-dashboard/appointments"
                className="btn-modern btn-modern-sm flex items-center gap-2"
              >
                <span>View All</span>
              </Link>
              <NotificationBadge 
                count={appointments.filter(apt => apt.status === "confirmed").length}
                position="top-right"
              />
            </div>
          </div>

          {appointments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📅</span>
              </div>
              <p className="text-slate-600 font-medium">No appointments yet</p>
              <p className="text-sm text-slate-500 mt-1">Patient appointments will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments
                .sort(compareAppointmentsByDateTime)
                .slice(0, 5)
                .map((appointment) => (
                <div key={appointment.id} className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-lg font-semibold text-blue-600">
                        {appointment.patientName?.[0]?.toUpperCase() || "👤"}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{appointment.patientName || "Unknown patient"}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-600 mt-1">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {appointment.appointmentTime}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{appointment.chiefComplaint}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                      </span>
                      <button
                        onClick={() => viewAppointmentDetails(appointment)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {appointments.length > 5 && (
                <div className="text-center pt-4">
                  <Link 
                    href="/doctor-dashboard/appointments"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View {appointments.length - 5} more appointments →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      
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


