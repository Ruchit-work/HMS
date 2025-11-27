'use client'

import { useEffect, useState, useCallback } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore"
import { signOut } from "firebase/auth"
import NotificationBadge from "@/components/ui/NotificationBadge"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import Notification from "@/components/ui/Notification"
import PatientManagement from "@/app/admin-dashboard/Tabs/PatientManagement"
import DoctorManagement from "@/app/admin-dashboard/Tabs/DoctorManagement"
import AppoinmentManagement from "@/app/admin-dashboard/Tabs/AppoinmentManagement"
import AdmitRequestsPanel from "@/app/receptionist-dashboard/Tabs/AdmitRequestsPanel"
import BillingHistoryPanel from "@/app/receptionist-dashboard/Tabs/BillingHistoryPanel"
import BookAppointmentPanel from "@/app/receptionist-dashboard/Tabs/BookAppointmentPanel"
import WhatsAppBookingsPanel from "@/app/receptionist-dashboard/Tabs/WhatsAppBookingsPanel"
import DashboardOverview from "@/app/receptionist-dashboard/Tabs/DashboardOverview"
import ConfirmDialog from "@/components/ui/ConfirmDialog"

export default function ReceptionistDashboard() {
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"dashboard" | "patients" | "doctors" | "appointments" | "book-appointment" | "admit-requests" | "billing" | "whatsapp-bookings">("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState<string>("")
  // Booking state
  const [bookSubOpen, setBookSubOpen] = useState(false)
  const [patientMode, setPatientMode] = useState<'existing'|'new'>('existing')
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [newAppointmentsCount, setNewAppointmentsCount] = useState(0)
  const [newPatientsCount, setNewPatientsCount] = useState(0)
  const [pendingBillingCount, setPendingBillingCount] = useState(0)
  const [admitRequestsCount, setAdmitRequestsCount] = useState(0)
  const [whatsappPendingCount, setWhatsappPendingCount] = useState(0)

  const router = useRouter()
  const { user, loading: authLoading } = useAuth("receptionist")

  useEffect(() => {
      if (!user) return
    const load = async () => {
      try {
        const recepDoc = await getDoc(doc(db, "receptionists", user.uid))
        if (recepDoc.exists()) {
          const data = recepDoc.data() as any
          setUserName(data.firstName || "Receptionist")
        } else {
          setUserName("Receptionist")
        }
      } catch (error) {
        console.error("Failed to load receptionist profile", error)
        setUserName("Receptionist")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const refreshWhatsappPendingCount = useCallback(async () => {
    try {
      const currentUser = auth.currentUser
      if (!currentUser) return
      const token = await currentUser.getIdToken()
      const res = await fetch("/api/receptionist/whatsapp-bookings", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        throw new Error("Failed to load WhatsApp bookings")
      }
      const data = await res.json().catch(() => ({}))
      const appointments = Array.isArray(data?.appointments) ? data.appointments : []
      setWhatsappPendingCount(appointments.length)
    } catch (error) {
      console.error("[ReceptionistDashboard] Failed to refresh WhatsApp badge:", error)
    }
  }, [])

  useEffect(() => {
    refreshWhatsappPendingCount()
    setupRealtimeBadgeListeners()
    const interval = setInterval(refreshWhatsappPendingCount, 30000)
    return () => clearInterval(interval)
  }, [refreshWhatsappPendingCount])

  // Setup real-time listeners for badge counts
  const setupRealtimeBadgeListeners = () => {
    // Listen for new appointments (today's appointments)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("appointmentDate", ">=", todayStart.toISOString().split('T')[0]),
      where("appointmentDate", "<", todayEnd.toISOString().split('T')[0])
    )

    const unsubscribeAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
      const todayAppointments = snapshot.docs.filter(doc => {
        const data = doc.data()
        return data.status === "confirmed" || data.status === "whatsapp_pending"
      })
      setNewAppointmentsCount(todayAppointments.length)
    })

    // Listen for new patients (created in last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const patientsQuery = query(
      collection(db, "patients"),
      where("createdAt", ">=", sevenDaysAgo)
    )

    const unsubscribePatients = onSnapshot(patientsQuery, (snapshot) => {
      setNewPatientsCount(snapshot.size)
    })

    // Listen for pending billing (unpaid appointments)
    const billingQuery = query(
      collection(db, "appointments"),
      where("status", "==", "completed"),
      where("paymentStatus", "in", ["pending", "unpaid"])
    )

    const unsubscribeBilling = onSnapshot(billingQuery, (snapshot) => {
      setPendingBillingCount(snapshot.size)
    })

    // Listen for admit requests
    const admitRequestsQuery = query(
      collection(db, "admission_requests"),
      where("status", "==", "pending")
    )

    const unsubscribeAdmitRequests = onSnapshot(admitRequestsQuery, (snapshot) => {
      setAdmitRequestsCount(snapshot.size)
    })

    // Return cleanup function
    return () => {
      unsubscribeAppointments()
      unsubscribePatients()
      unsubscribeBilling()
      unsubscribeAdmitRequests()
    }
  }


  useEffect(() => {
    if (!authLoading && !user) {
      setLoading(false)
      router.replace("/auth/login?role=receptionist")
    }
  }, [authLoading, router, user])

  const handleLogout = async () => {
    try {
      setLogoutLoading(true)
      await signOut(auth)
      // Clear any cached data
      localStorage.clear()
      sessionStorage.clear()
      // Force redirect after sign out
      window.location.href = "/auth/login?role=receptionist"
    } catch (error) {
      console.error("Logout error:", error)
      setNotification({ type: "error", message: "Failed to logout. Please try again." })
      setLogoutLoading(false)
      setLogoutConfirmOpen(false)
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading receptionist dashboard..." />
  }

  if (!user) return null

    return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] lg:hidden bg-white/95 backdrop-blur-xl p-2.5 rounded-lg shadow-lg border border-slate-200/50 hover:shadow-xl hover:bg-white transition-all duration-200"
        >
          <div className="flex flex-col items-center justify-center w-5 h-5">
            <span className="block w-5 h-0.5 bg-slate-700 rounded-full"></span>
            <span className="block w-5 h-0.5 bg-slate-700 rounded-full mt-1"></span>
            <span className="block w-5 h-0.5 bg-slate-700 rounded-full mt-1"></span>
          </div>
        </button>
      )}

      {sidebarOpen && (<div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />)}

      {/* Professional Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-white/95 backdrop-blur-xl shadow-2xl border-r border-slate-200/50 transform transition-all duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col`}>
        {/* Header */}
        <div className="relative h-20 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-between overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 to-purple-600/90"></div>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full"></div>
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full"></div>
          
          <div className="relative flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-white text-lg font-bold">HMS Reception</h1>
              <p className="text-white/80 text-xs font-medium">Front Desk Portal</p>
            </div>
          </div>
          
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 flex flex-col mt-4 px-3">
          <div className="flex-1 space-y-1">
            {/* Dashboard */}
            <button 
              onClick={() => { setActiveTab("dashboard"); setSidebarOpen(false) }} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                activeTab === "dashboard" 
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className={`p-1.5 rounded-md ${activeTab === "dashboard" ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v4m8-4v4" />
                </svg>
              </div>
              <span className="font-medium text-sm">Dashboard</span>
            </button>
            {/* Patients */}
            <button 
              onClick={() => { setActiveTab("patients"); setSidebarOpen(false) }} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                activeTab === "patients" 
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className={`p-1.5 rounded-md ${activeTab === "patients" ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="font-medium text-sm">Patients</span>
            </button>

            {/* Doctors */}
            <button 
              onClick={() => { setActiveTab("doctors"); setSidebarOpen(false) }} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                activeTab === "doctors" 
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className={`p-1.5 rounded-md ${activeTab === "doctors" ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-medium text-sm">Doctors</span>
            </button>

            {/* Appointments */}
            <div className="relative">
              <button 
                onClick={() => { setActiveTab("appointments"); setSidebarOpen(false) }} 
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                  activeTab === "appointments" 
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className={`p-1.5 rounded-md ${activeTab === "appointments" ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-medium text-sm">Appointments</span>
              </button>
              <NotificationBadge 
                count={newAppointmentsCount} 
                position="top-right" 
                size="sm" 
                color="orange" 
                animate 
              />
            </div>

            {/* Admit Requests */}
            <div className="relative">
              <button 
                onClick={() => { setActiveTab("admit-requests"); setSidebarOpen(false) }} 
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                  activeTab === "admit-requests" 
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className={`p-1.5 rounded-md ${activeTab === "admit-requests" ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14z" />
                  </svg>
                </div>
                <span className="font-medium text-sm">Admit Requests</span>
              </button>
              <NotificationBadge 
                count={admitRequestsCount} 
                position="top-right" 
                size="sm" 
                color="purple" 
                animate 
              />
            </div>

            {/* Billing History */}
            <div className="relative">
              <button 
                onClick={() => { setActiveTab("billing"); setSidebarOpen(false) }} 
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                  activeTab === "billing" 
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className={`p-1.5 rounded-md ${activeTab === "billing" ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2-2 4 4m0 0l4-4m-4 4V3m-5 5H5a2 2 0 00-2 2v9a2 2 0 002 2h6" />
                  </svg>
                </div>
                <span className="font-medium text-sm">Billing History</span>
            </button>
              <NotificationBadge 
                count={pendingBillingCount} 
                position="top-right" 
                size="sm" 
                color="red" 
                animate 
              />
            </div>
            {/* WhatsApp Bookings */}
            <button 
              onClick={() => { setActiveTab("whatsapp-bookings"); setSidebarOpen(false) }} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                activeTab === "whatsapp-bookings" 
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className={`relative p-1.5 rounded-md ${activeTab === "whatsapp-bookings" ? "bg-white/20" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <NotificationBadge 
                  count={whatsappPendingCount}
                  position="top-right"
                  color="orange"
                  size="sm"
                />
              </div>
              <span className="font-medium text-sm">WhatsApp Bookings</span>
            </button>

            {/* Section Divider */}
            <div className="my-3">
              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mx-2"></div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2 mb-1 px-2">Quick Actions</p>
            </div>

            {/* Book Appointment */}
            <button 
              onClick={() => { if (!bookSubOpen){ setActiveTab("book-appointment") }; setBookSubOpen(!bookSubOpen) }} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                activeTab === "book-appointment" 
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md" 
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-emerald-200/50"
              }`}
            >
              <div className={`p-1.5 rounded-md ${activeTab === "book-appointment" ? "bg-white/20" : "bg-emerald-100 group-hover:bg-emerald-200"}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="font-medium text-sm">Book Appointment</span>
            </button>
            {bookSubOpen && (
              <div className="ml-4 pl-2 mt-1 mb-1 space-y-1 border-l-2 border-emerald-200">
                <button
                  onClick={() => { setActiveTab("book-appointment"); setPatientMode('existing'); setSidebarOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${activeTab === 'book-appointment' && patientMode==='existing' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >Existing Patient</button>
                <button
                  onClick={() => { setActiveTab("book-appointment"); setPatientMode('new'); setSidebarOpen(false) }}
                  className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${activeTab === 'book-appointment' && patientMode==='new' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >New Patient</button>
              </div>
            )}
          </div>

          {/* Logout Section - Fixed at Bottom */}
          <div className="px-3 pb-3 mt-2">
            <div className="border-t border-slate-200 pt-2">
              {/* User Info */}
              <div className="flex items-center gap-2 px-1 py-1 mb-2">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-xs">{userName.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{userName}</p>
                  <p className="text-xs text-slate-500">Receptionist</p>
                </div>
              </div>
              
              {/* Logout Button */}
              <button 
                onClick={() => setLogoutConfirmOpen(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 text-red-600 hover:bg-red-50 border border-red-200/50 hover:border-red-300"
              >
                <div className="p-1 bg-red-100 rounded-md">
                  <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <span className="font-medium text-xs">Logout</span>
              </button>
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="lg:ml-72">
        <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-200/50">
          <div className={`py-6 px-6 sm:px-8 lg:px-6 ${!sidebarOpen ? 'pl-16 sm:pl-20 lg:pl-6' : ''}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent capitalize">
                  {activeTab === "patients"
                    ? "Patient Management"
                    : activeTab === "doctors"
                    ? "Doctor Management"
                    : activeTab === "appointments"
                    ? "Appointment Management"
                    : activeTab === "admit-requests"
                    ? "Admit Requests"
                    : activeTab === "billing"
                    ? "Billing History"
                    : activeTab === "whatsapp-bookings"
                    ? "WhatsApp Bookings"
                    : "Book Appointment"}
                </h1>
                <p className="text-slate-600 mt-2 text-sm sm:text-base">
                  {activeTab === "dashboard"
                    ? "Overview of daily operations and key metrics"
                    : activeTab === "patients"
                    ? "Manage patient records and information"
                    : activeTab === "doctors"
                    ? "Manage doctor profiles and schedules"
                    : activeTab === "appointments"
                    ? "Monitor and manage all appointments"
                    : activeTab === "admit-requests"
                    ? "Review hospitalization requests and assign rooms"
                    : activeTab === "billing"
                    ? "Track recent hospitalization billing activity"
                    : activeTab === "whatsapp-bookings"
                    ? "Manage WhatsApp booking requests and assign doctors"
                    : "Book a new appointment for a patient"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 sm:p-8 space-y-6">
          {activeTab === "dashboard" && (
            <DashboardOverview onTabChange={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === "patients" && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 p-8">
              <PatientManagement canDelete={true} disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "doctors" && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 p-8">
              <DoctorManagement canDelete={false} canAdd={false} disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "appointments" && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 p-8">
              <AppoinmentManagement disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "admit-requests" && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 p-8">
              <AdmitRequestsPanel
                onNotification={(payload) => setNotification(payload)}
              />
                  </div>
                )}
          {activeTab === "billing" && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 p-8">
              <BillingHistoryPanel onNotification={(payload) => setNotification(payload)} />
            </div>
          )}
          {activeTab === "book-appointment" && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 p-8">
              <BookAppointmentPanel
                patientMode={patientMode}
                onPatientModeChange={setPatientMode}
                onNotification={(payload) => setNotification(payload)}
              />
            </div>
          )}
          {activeTab === "whatsapp-bookings" && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 p-8">
              <WhatsAppBookingsPanel
                onNotification={(payload) => setNotification(payload)}
                onPendingCountChange={setWhatsappPendingCount}
              />
            </div>
          )}
        </main>
        </div>

      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Sign out?"
        message="Logging out will return you to the receptionist login screen."
        confirmText="Logout"
        cancelText="Stay signed in"
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
        confirmLoading={logoutLoading}
      />
              </div>
    )
}