'use client'

import { useEffect, useState, useCallback } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
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
import ConfirmDialog from "@/components/ui/ConfirmDialog"

export default function ReceptionistDashboard() {
  const [notification, setNotification] = useState<{type: "success" | "error", message: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"patients" | "doctors" | "appointments" | "book-appointment" | "admit-requests" | "billing" | "whatsapp-bookings">("patients")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [userName, setUserName] = useState<string>("")
  // Booking state
  const [bookSubOpen, setBookSubOpen] = useState(false)
  const [patientMode, setPatientMode] = useState<'existing'|'new'>('existing')
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
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
    const interval = setInterval(refreshWhatsappPendingCount, 30000)
    return () => clearInterval(interval)
  }, [refreshWhatsappPendingCount])

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
      router.replace("/auth/login?role=receptionist")
    } catch {
      setNotification({ type: "error", message: "Failed to logout. Please try again." })
    } finally {
      setLogoutLoading(false)
      setLogoutConfirmOpen(false)
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading receptionist dashboard..." />
  }

  if (!user) return null

    return (
    <div className="min-h-screen bg-gray-50">
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-[60] lg:hidden bg-white p-2.5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg hover:bg-gray-50 transition-all duration-200"
        >
          <div className="flex flex-col items-center justify-center w-5 h-5">
            <span className="block w-4 h-0.5 bg-gray-600"></span>
            <span className="block w-4 h-0.5 bg-gray-600 mt-1"></span>
            <span className="block w-4 h-0.5 bg-gray-600 mt-1"></span>
          </div>
        </button>
      )}

      {sidebarOpen && (<div className="fixed inset-0" onClick={() => setSidebarOpen(false)} />)}

      {/* Sidebar (same style as admin) */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-center h-16 px-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-bold text-lg">H</span>
            </div>
            <h1 className="text-white text-xl font-bold">HMS Receptionist</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-white hover:text-purple-200 transition-colors p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <nav className="mt-8 px-4">
          <div className="space-y-2">
            <button onClick={() => { setActiveTab("patients"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "patients" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Patients
            </button>
            <button onClick={() => { setActiveTab("doctors"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "doctors" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Doctors
            </button>
            <button onClick={() => { setActiveTab("appointments"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "appointments" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Appointments
            </button>
            <button onClick={() => { setActiveTab("admit-requests"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "admit-requests" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14z" /></svg>
              Admit Requests
            </button>
            <button onClick={() => { setActiveTab("billing"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "billing" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2-2 4 4m0 0l4-4m-4 4V3m-5 5H5a2 2 0 00-2 2v9a2 2 0 002 2h6" /></svg>
              Billing History
            </button>
            <button onClick={() => { setActiveTab("whatsapp-bookings"); setSidebarOpen(false) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors relative ${activeTab === "whatsapp-bookings" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <div className="relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                {whatsappPendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 inline-flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-full min-w-[18px] h-[18px] px-1 shadow-lg border-2 border-white animate-pulse">
                    {whatsappPendingCount > 99 ? '99+' : whatsappPendingCount}
                  </span>
                )}
              </div>
              <span className="flex-1 text-left">WhatsApp Bookings</span>
            </button>
            <button onClick={() => { if (!bookSubOpen){ setActiveTab("book-appointment") }; setBookSubOpen(!bookSubOpen) }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === "book-appointment" ? "bg-purple-100 text-purple-700 border-r-2 border-purple-600" : "text-gray-600 hover:bg-gray-100"}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Book Appointment
            </button>
            {bookSubOpen && (
              <div className="ml-6 pl-3 mt-1 mb-2 space-y-1 border-l border-gray-200">
                <button
                  onClick={() => { setActiveTab("book-appointment"); setPatientMode('existing'); setSidebarOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'book-appointment' && patientMode==='existing' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >Existing Patient</button>
                <button
                  onClick={() => { setActiveTab("book-appointment"); setPatientMode('new'); setSidebarOpen(false) }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeTab === 'book-appointment' && patientMode==='new' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >New Patient</button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Main Content (same container and header classes) */}
      <div className="lg:ml-64">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize">
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
                <p className="text-sm sm:text-base text-gray-600 mt-1">
                  {activeTab === "patients"
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
              <div className="flex items-center gap-2 sm:gap-4">
                <button className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base" onClick={() => setNotification({ type: 'success', message: 'Refreshed!' })}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <div className="relative">
                  <button onClick={() => setShowUserDropdown(!showUserDropdown)} className="flex items-center gap-2 sm:gap-3 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition-colors">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center"><span className="text-purple-600 font-semibold text-sm">{userName.charAt(0)}</span></div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-500">Receptionist</p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showUserDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserDropdown(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900">{userName}</p>
                </div>
                        <button onClick={() => setLogoutConfirmOpen(true)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                          <span>Logout</span>
                        </button>
            </div>
                    </>
                  )}
        </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {activeTab === "patients" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <PatientManagement canDelete={true} disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "doctors" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <DoctorManagement canDelete={false} canAdd={false} disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "appointments" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <AppoinmentManagement disableAdminGuard={true} />
            </div>
          )}
          {activeTab === "admit-requests" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <AdmitRequestsPanel
                onNotification={(payload) => setNotification(payload)}
              />
                  </div>
                )}
          {activeTab === "billing" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <BillingHistoryPanel onNotification={(payload) => setNotification(payload)} />
            </div>
          )}
          {activeTab === "book-appointment" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <BookAppointmentPanel
                patientMode={patientMode}
                onPatientModeChange={setPatientMode}
                onNotification={(payload) => setNotification(payload)}
              />
            </div>
          )}
          {activeTab === "whatsapp-bookings" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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