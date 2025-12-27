"use client"

import { useEffect, useState } from "react"
import { db } from "@/firebase/config"
import { doc, getDoc, getDocs, collection, query, where, addDoc, updateDoc } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/hospital-queries"
import LoadingSpinner from "@/components/ui/StatusComponents"
import Notification from "@/components/ui/Notification"
import { CancelAppointmentModal } from "@/components/patient/AppointmentModals"
import HeroCarousel from "@/components/patient/HeroCarousel"
import HealthInformationSection from "@/components/patient/HealthInformationSection"
import PageHeader from "@/components/ui/PageHeader"
import Footer from "@/components/ui/Footer"
import Link from "next/link"
import { fetchPublishedCampaignsForAudience, type Campaign } from "@/utils/campaigns"
import { UserData, Doctor, Appointment, NotificationData } from "@/types/patient"
import { getHoursUntilAppointment, cancelAppointment } from "@/utils/appointmentHelpers"
import CampaignCarousel from "@/components/patient/CampaignCarousel"

export default function PatientDashboard() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [notification, setNotification] = useState<NotificationData | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  // Protect route - only allow patients
  const { user, loading } = useAuth("patient")
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()

  useEffect(() => {
    if (!user || !activeHospitalId) return

    const fetchData = async () => {
      // For patients, we still check the legacy patients collection for user data
      // but data will be stored in hospital-scoped subcollections
      const patientDocRef = doc(db, "patients", user.uid)
      const patientDoc = await getDoc(patientDocRef)
      let patientRecord: UserData | null = null
      if (patientDoc.exists()) {
        patientRecord = patientDoc.data() as UserData
        setUserData(patientRecord)
      }

      // Get doctors from active hospital
      const doctorsQuery = query(getHospitalCollection(activeHospitalId, "doctors"), where("status", "==", "active"))
      const doctorsSnapshot = await getDocs(doctorsQuery)
      const doctorsList = doctorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Doctor))
      setDoctors(doctorsList)

      // Get appointments from active hospital
      const appointmentsCollection = getHospitalCollection(activeHospitalId, "appointments")
      const appointmentQueries: Promise<any>[] = [
        getDocs(query(appointmentsCollection, where("patientUid", "==", user.uid)))
      ]

      if (patientRecord?.patientId) {
        appointmentQueries.push(
          getDocs(query(appointmentsCollection, where("patientId", "==", patientRecord.patientId)))
        )
      }

      appointmentQueries.push(
        getDocs(query(appointmentsCollection, where("patientId", "==", user.uid)))
      )

      const appointmentSnapshots = await Promise.all(appointmentQueries)
      const appointmentMap = new Map<string, Appointment>()
      appointmentSnapshots.forEach((snapshot) => {
        snapshot?.docs.forEach((docSnap: any) => {
          appointmentMap.set(
            docSnap.id,
            { id: docSnap.id, ...docSnap.data() } as Appointment
          )
        })
      })
      setAppointments(Array.from(appointmentMap.values()))

      const published = await fetchPublishedCampaignsForAudience("patients", activeHospitalId)
      setCampaigns(published)
    }

    fetchData()
  }, [user, activeHospitalId])

  if (loading || hospitalLoading) {
    return <LoadingSpinner message="Loading Patient Portal..." />
  }

  if (!activeHospitalId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">No hospital selected. Please select a hospital to continue.</p>
          <Link href="/hospital-selection" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block">
            Select Hospital
          </Link>
        </div>
      </div>
    )
  }

  if (!user || !userData) {
    return null
  }


  // Open cancel confirmation modal
  const _openCancelModal = (appointment: Appointment) => {
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
  // Calculate stats and sort by appointment date/time
  const ACTIVE_STATUSES = new Set([
    "confirmed",
    "resrescheduled",
    "awaiting_reschedule",
    "awaiting_admission",
    "admitted"
  ])

  const activeAppointments = appointments
    .filter(apt => ACTIVE_STATUSES.has(String(apt.status || "").toLowerCase()))
    .sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`).getTime()
      const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`).getTime()
      return dateA - dateB // Earlier appointments first
    })
  
  const _completedAppointments = appointments.filter(apt => String(apt.status || "").toLowerCase() === "completed")
  const _upcomingAppointments = activeAppointments
    .filter(apt => new Date(`${apt.appointmentDate} ${apt.appointmentTime}`).getTime() > Date.now())
    .length
  const awaitingReschedule = appointments.filter(
    apt => String(apt.status || "").toLowerCase() === "awaiting_reschedule"
  )

  const handleRequestRefund = async (apt: Appointment) => {
    try {
      await addDoc(collection(db, 'refund_requests'), {
        appointmentId: apt.id,
        patientId: apt.patientId,
        doctorId: apt.doctorId,
        paymentAmount: apt.paymentAmount || apt.totalConsultationFee || 0,
        paymentMethod: apt.paymentMethod || 'cash',
        paymentType: apt.paymentType || 'full',
        reason: 'doctor_unavailable',
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
      await updateDoc(doc(db, 'appointments', apt.id), {
        status: 'refund_requested',
        refundRequested: true,
        updatedAt: new Date().toISOString(),
      })
      setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, status: 'refund_requested' as any, refundRequested: true } : a))
      setNotification({ type: 'success', message: 'Refund request submitted. We will process it shortly.' })
    } catch (e) {
      console.error('Refund request failed', e)
      setNotification({ type: 'error', message: 'Failed to submit refund request. Please try again.' })
    }
  }

  return (

    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30 pt-20">
      {/* Hero Carousel - Full Width */}
      <div className="w-full mb-8">
        <HeroCarousel />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Campaigns Section */}
          {campaigns.length > 0 && (
            <section className="relative mb-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
              <div className="absolute inset-y-0 right-0 hidden w-1/2 translate-x-16 transform bg-gradient-to-br from-teal-400/60 via-transparent to-transparent blur-3xl lg:block" />

              <div className="relative flex flex-col gap-10 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl text-white">
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.4em]"/>
                  <p className="text-xs uppercase tracking-[0.6em] text-white/70">
                    Stories of care
                  </p>
                  <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                    Featured wellness campaigns curated for you
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-white/75 sm:text-base">
                    Daily inspiration on preventive care, screenings, and healthier living. Stay on top of seasonal guidance from your care team.
                  </p>
                  {campaigns.length > 1 && (
                    <p className="mt-2 text-xs text-white/60 sm:text-sm">
                      Swipe or use arrows to view all {campaigns.length} campaigns
                    </p>
                  )}
                </div>

                <div className="w-full lg:w-[480px]">
                  <CampaignCarousel campaigns={campaigns} />
                </div>
              </div>
            </section>
          )}
          {/* Welcome Banner */}
        <PageHeader
          title={`Welcome back, ${userData.firstName}!`}
          subtitle="Manage your health appointments and medical records"
          icon="🏥"
          gradient="from-teal-600 to-cyan-700"
        />

        


        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 sm:mb-8">
          <Link 
            href="/patient-dashboard/book-appointment" 
            className="bg-white border-2 border-teal-200 rounded-xl p-4 hover:border-teal-400 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">📋</span>
                </div>
                  <div>
                <p className="font-semibold text-slate-800">Book Appointment</p>
                <p className="text-xs text-slate-500">Schedule a new visit</p>
                  </div>
                  </div>
          </Link>
          
          <Link 
            href="/patient-dashboard/tutorials" 
            className="bg-white border-2 border-indigo-200 rounded-xl p-4 hover:border-indigo-400 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">📚</span>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Tutorials</p>
                <p className="text-xs text-slate-500">Patient portal guide</p>
              </div>
            </div>
          </Link>
          
          <Link 
            href="/patient-dashboard/appointments" 
            className="bg-white border-2 border-blue-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">📝</span>
                </div>
                    <div>
                <p className="font-semibold text-slate-800">My Appointments</p>
                <p className="text-xs text-slate-500">View all appointments</p>
                    </div>
                  </div>
          </Link>
          
          <Link 
            href="/patient-dashboard/doctors" 
            className="bg-white border-2 border-green-200 rounded-xl p-4 hover:border-green-400 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">👨‍⚕️</span>
                      </div>
                <div>
                <p className="font-semibold text-slate-800">Browse Doctors</p>
                <p className="text-xs text-slate-500">Find specialists</p>
                      </div>
                      </div>
          </Link>
          
          <Link 
            href="/patient-dashboard/services" 
            className="bg-white border-2 border-blue-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">🏥</span>
                      </div>
                <div>
                <p className="font-semibold text-slate-800">Our Services</p>
                <p className="text-xs text-slate-500">Hospital services</p>
                      </div>
                      </div>
          </Link>
          
          <Link 
            href="/patient-dashboard/facilities" 
            className="bg-white border-2 border-purple-200 rounded-xl p-4 hover:border-purple-400 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">🏢</span>
                      </div>
                <div>
                <p className="font-semibold text-slate-800">Facilities</p>
                <p className="text-xs text-slate-500">Infrastructure</p>
                      </div>
                      </div>
          </Link>
          
          <Link 
            href="/patient-dashboard/profile" 
            className="bg-white border-2 border-purple-200 rounded-xl p-4 hover:border-purple-400 hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">👤</span>
                      </div>
                <div>
                <p className="font-semibold text-slate-800">My Profile</p>
                <p className="text-xs text-slate-500">View & edit profile</p>
                      </div>
                      </div>
          </Link>
                </div>

        {/* Medical Specialties Section */}
        <div className="bg-white rounded-xl p-5 sm:p-6 mb-6 shadow-sm border border-slate-200">
          <div className="text-center mb-5">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
              Our Medical Specialties
            </h2>
            <p className="text-slate-600 text-sm">
              Comprehensive healthcare across 30+ specializations
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Link href="/patient-dashboard/doctors?specialization=Cardiology" className="block">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
                <div className="text-center">
                  <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">❤️</span>
                  <h3 className="font-medium text-slate-800 text-xs group-hover:text-teal-700 transition-colors">Cardiology</h3>
                </div>
              </div>
            </Link>

            <Link href="/patient-dashboard/doctors?specialization=Orthopedics" className="block">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
                <div className="text-center">
                  <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">🦴</span>
                  <h3 className="font-medium text-slate-800 text-xs group-hover:text-teal-700 transition-colors">Orthopedics</h3>
                </div>
              </div>
            </Link>

            <Link href="/patient-dashboard/doctors?specialization=Pediatrics" className="block">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
                <div className="text-center">
                  <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">👶</span>
                  <h3 className="font-medium text-slate-800 text-xs group-hover:text-teal-700 transition-colors">Pediatrics</h3>
                </div>
              </div>
            </Link>

            <Link href="/patient-dashboard/doctors?specialization=Neurology" className="block">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
                <div className="text-center">
                  <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">🧠</span>
                  <h3 className="font-medium text-slate-800 text-xs group-hover:text-teal-700 transition-colors">Neurology</h3>
                </div>
              </div>
            </Link>

            <Link href="/patient-dashboard/doctors?specialization=Gynecology" className="block">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
                <div className="text-center">
                  <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">🤰</span>
                  <h3 className="font-medium text-slate-800 text-xs group-hover:text-teal-700 transition-colors">Gynecology</h3>
                </div>
              </div>
            </Link>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
              <div className="text-center">
                <span className="text-2xl block mb-1">✨</span>
                <h3 className="font-medium text-slate-800 text-xs">Dermatology</h3>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
              <div className="text-center">
                <span className="text-2xl block mb-1">👂</span>
                <h3 className="font-medium text-slate-800 text-xs">ENT</h3>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
              <div className="text-center">
                <span className="text-2xl block mb-1">👁️</span>
                <h3 className="font-medium text-slate-800 text-xs">Ophthalmology</h3>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
              <div className="text-center">
                <span className="text-2xl block mb-1">🫁</span>
                <h3 className="font-medium text-slate-800 text-xs">Gastroenterology</h3>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
              <div className="text-center">
                <span className="text-2xl block mb-1">🦷</span>
                <h3 className="font-medium text-slate-800 text-xs">Dentistry</h3>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
              <div className="text-center">
                <span className="text-2xl block mb-1">🫀</span>
                <h3 className="font-medium text-slate-800 text-xs">Pulmonology</h3>
              </div>
            </div>

            <Link href="/patient-dashboard/doctors" className="block">
              <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 hover:bg-teal-50 hover:border-teal-300 transition-all cursor-pointer group">
                <div className="text-center flex flex-col items-center justify-center h-full">
                  <span className="text-2xl block mb-1 group-hover:scale-110 transition-transform">🔍</span>
                  <h3 className="font-medium text-slate-800 text-xs group-hover:text-teal-700 transition-colors">Browse All</h3>
                </div>
              </div>
            </Link>
          </div>

          {/* <div className="text-center mt-5">
            <Link 
              href="/patient-dashboard/doctors" 
              className="inline-block bg-teal-600 text-white px-6 py-2 rounded-lg font-semibold text-sm hover:bg-teal-700 transition-all shadow-sm hover:shadow-md"
            >
              Browse All Doctors →
            </Link>
          </div> */}
        </div>


        {/* Affected Appointments (Doctor Leave) */}
        {awaitingReschedule.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 sm:p-5 shadow-sm mb-6">
            <h3 className="text-base sm:text-lg font-bold text-yellow-900 mb-2 flex items-center gap-2">
              <span>⚠️</span>
              <span>Action needed: Reschedule your appointment(s)</span>
            </h3>
            <div className="space-y-2">
              {awaitingReschedule.slice(0,3).map(apt => (
                <div key={apt.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-200">
                  <div className="text-sm text-slate-800">
                    <span className="font-semibold">Dr. {apt.doctorName}</span> • {new Date(apt.appointmentDate).toLocaleDateString()} at {apt.appointmentTime}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={{ pathname: "/patient-dashboard/book-appointment", query: { reschedule: '1', aptId: apt.id, doctorId: apt.doctorId } }} className="text-xs px-3 py-1.5 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">
                      Reschedule
                    </Link>
                    {String((apt as any)?.paymentStatus) === 'paid' && !Boolean((apt as any)?.refundRequested) && (
                      <button onClick={() => handleRequestRefund(apt)} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700">
                        Request Refund
                      </button>
                    )}
                    {Boolean((apt as any)?.refundRequested) && (
                      <span className="text-[11px] px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded">
                        Refund requested
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {awaitingReschedule.length > 3 && (
                <p className="text-xs text-yellow-800">And {awaitingReschedule.length - 3} more…</p>
              )}
            </div>
          </div>
        )}

        {/* Recent Appointments Preview */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span>📋</span>
              <span>Recent Appointments</span>
            </h2>
            <Link 
              href="/patient-dashboard/appointments"
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              View All →
            </Link>
          </div>

          {activeAppointments.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl">
              <span className="text-5xl block mb-3 text-slate-300">📅</span>
              <p className="text-slate-600 font-medium">No active appointments</p>
              <p className="text-sm text-slate-400 mt-1">Book your first appointment above</p>
              </div>
            ) : (
              <div className="space-y-3">
              {activeAppointments.slice(0, 3).map((apt) => (
                <div key={apt.id} className="border border-slate-200 rounded-lg p-4 hover:border-teal-300 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                        👨‍⚕️
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Dr. {apt.doctorName}</p>
                          <p className="text-sm text-slate-500">
                          {new Date(apt.appointmentDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                            day: 'numeric' 
                          })} at {apt.appointmentTime}
                          </p>
                        </div>
                      </div>
                    <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-semibold">
                      Confirmed
                                  </span>
                              </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        {/* Why Choose Us Section */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl p-5 sm:p-6 mb-6 shadow-md mt-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-5">
            Why Choose HMS Hospital?
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center text-white">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-all hover:scale-105">
                <span className="text-3xl sm:text-4xl font-bold block mb-1">25+</span>
                <p className="text-sm sm:text-base font-semibold">Years of Excellence</p>
              </div>
            </div>
            <div className="text-center text-white">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-all hover:scale-105">
                <span className="text-3xl sm:text-4xl font-bold block mb-1">150+</span>
                <p className="text-sm sm:text-base font-semibold">Expert Doctors</p>
              </div>
            </div>
            <div className="text-center text-white">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-all hover:scale-105">
                <span className="text-3xl sm:text-4xl font-bold block mb-1">50K+</span>
                <p className="text-sm sm:text-base font-semibold">Happy Patients</p>
              </div>
            </div>
            <div className="text-center text-white">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-all hover:scale-105">
                <span className="text-3xl sm:text-4xl font-bold block mb-1">98%</span>
                <p className="text-sm sm:text-base font-semibold">Satisfaction Rate</p>
              </div>
            </div>
          </div>

          {/* Additional Trust Indicators */}
          <div className="mt-5 pt-5 border-t border-white/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-white">
              <div>
                <span className="text-2xl block mb-1">🏅</span>
                <p className="text-xs sm:text-sm font-semibold">NABH Accredited</p>
              </div>
              <div>
                <span className="text-2xl block mb-1">✅</span>
                <p className="text-xs sm:text-sm font-semibold">ISO Certified</p>
              </div>
              <div>
                <span className="text-2xl block mb-1">🔬</span>
                <p className="text-xs sm:text-sm font-semibold">NABL Labs</p>
              </div>
              <div>
                <span className="text-2xl block mb-1">⚕️</span>
                <p className="text-xs sm:text-sm font-semibold">JCI Accredited</p>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact Banner */}
        <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4 sm:p-5 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <span className="text-2xl">🚨</span>
                <h3 className="text-lg sm:text-xl font-bold text-red-800">Medical Emergency?</h3>
              </div>
              <p className="text-red-700 text-xs sm:text-sm font-medium">24/7 Emergency Services Available</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <a 
                href="tel:911" 
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-700 transition-all shadow-sm hover:shadow-md hover:scale-105 flex items-center gap-2 justify-center"
              >
                <span>📞</span>
                <span>Call 911</span>
              </a>
              <a 
                href="tel:+911234567890" 
                className="bg-white text-red-600 border-2 border-red-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-50 transition-all shadow-sm hover:shadow-md hover:scale-105 flex items-center gap-2 justify-center"
              >
                <span>🚑</span>
                <span>Ambulance</span>
              </a>
            </div>
          </div>
        </div>

        {/* Health Information and Patient Resources */}
        <HealthInformationSection />
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

      {/* Footer */}
      <Footer />
    </div>
    </>
  )
  
}
