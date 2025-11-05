"use client"

import { useEffect, useState } from "react"
import { db } from "@/firebase/config"
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import Notification from "@/components/ui/Notification"
import AppointmentsList from "@/components/patient/AppointmentsList"
import CancelAppointmentModal from "@/components/patient/CancelAppointmentModal"
import PageHeader from "@/components/ui/PageHeader"
import { UserData, Appointment, NotificationData } from "@/types/patient"
import { getHoursUntilAppointment, cancelAppointment } from "@/utils/appointmentHelpers"
import Footer from "@/components/ui/Footer"
import Link from "next/link"

export default function PatientAppointments() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [notification, setNotification] = useState<NotificationData | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [activeTab, setActiveTab] = useState<"confirmed" | "completed" | "cancelled">("confirmed")

  // Protect route - only allow patients
  const { user, loading } = useAuth("patient")

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const patientDoc = await getDoc(doc(db, "patients", user.uid))
      if (patientDoc.exists()) {
        const data = patientDoc.data() as UserData
        setUserData(data)
      }

      // Fetch patient appointments
      const appointmentsQuery = query(collection(db, "appointments"), where("patientId", "==", user.uid))
      const appointmentsSnapshot = await getDocs(appointmentsQuery)
      const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Appointment))
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

  // Open cancel confirmation modal
  const openCancelModal = (appointment: Appointment) => {
    setAppointmentToCancel(appointment)
    setShowCancelModal(true)
  }

  // Handle appointment cancellation
  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return

    setCancelling(true)
    try {
      const result = await cancelAppointment(appointmentToCancel)

      // Update local state
      setAppointments(appointments.map(apt =>
        apt.id === appointmentToCancel.id ? result.updatedAppointment : apt
      ))

      setNotification({
        type: "success",
        message: result.message
      })

      setShowCancelModal(false)
      setAppointmentToCancel(null)
    } catch (error: unknown) {
      console.error("Error cancelling appointment:", error)
      setNotification({
        type: "error",
        message: (error as Error).message || "Failed to cancel appointment"
      })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Page Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 mb-8 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-4xl">
                  📋
                </div>
                <div>
                  <h1 className="text-3xl font-bold">My Appointments</h1>
                  <p className="text-indigo-100 text-sm mt-1">View and manage all your appointments</p>
                </div>
              </div>
              <div>
                <Link href="/patient-dashboard/book-appointment">
                  <button className="group inline-flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:scale-95">
                    <svg className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-sm sm:text-base">Book New Appointment</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Confirmed</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {appointments.filter(apt => apt.status === "confirmed").length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">📅</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Completed</p>
                  <p className="text-3xl font-bold text-green-600">
                    {appointments.filter(apt => apt.status === "completed").length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">✅</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Cancelled</p>
                  <p className="text-3xl font-bold text-red-600">
                    {appointments.filter(apt => apt.status === "cancelled").length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center">
                  <span className="text-3xl">❌</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6 shadow-sm">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab("confirmed")}
                className={`flex-1 px-4 sm:px-6 py-4 font-semibold transition-all text-sm sm:text-base ${activeTab === "confirmed"
                    ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                    : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                📅 Confirmed ({appointments.filter(apt => apt.status === "confirmed").length})
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`flex-1 px-4 sm:px-6 py-4 font-semibold transition-all text-sm sm:text-base ${activeTab === "completed"
                    ? "bg-green-50 text-green-600 border-b-2 border-green-600"
                    : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                ✅ Completed ({appointments.filter(apt => apt.status === "completed").length})
              </button>
              <button
                onClick={() => setActiveTab("cancelled")}
                className={`flex-1 px-4 sm:px-6 py-4 font-semibold transition-all text-sm sm:text-base ${activeTab === "cancelled"
                    ? "bg-red-50 text-red-600 border-b-2 border-red-600"
                    : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                ❌ Cancelled ({appointments.filter(apt => apt.status === "cancelled").length})
              </button>
            </div>
          </div>

          {/* Appointments List */}
          <AppointmentsList
            appointments={appointments
              .filter(apt => apt.status === activeTab)
              .sort((a, b) => {
                const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`).getTime()
                const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`).getTime()
                return dateA - dateB // Earlier appointments first
              })
            }
            onCancelAppointment={openCancelModal}
          />
        </main>

        {/* Cancellation Confirmation Modal */}
        <CancelAppointmentModal
          appointment={appointmentToCancel}
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false)
            setAppointmentToCancel(null)
          }}
          onConfirm={handleCancelAppointment}
          cancelling={cancelling}
          getHoursUntilAppointment={getHoursUntilAppointment}
        />

        {/* Notification Toast */}
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
      <Footer />
    </>
  )
}

