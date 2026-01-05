"use client"

import { useEffect, useState } from "react"
import { db } from "@/firebase/config"
import { doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/hospital-queries"
import LoadingSpinner from "@/components/ui/StatusComponents"
import Notification from "@/components/ui/Notification"
import { AppointmentsList } from "@/components/patient/AppointmentCard"
import { CancelAppointmentModal } from "@/components/patient/AppointmentModals"
import PaymentMethodSection, {
  PaymentData as PaymentMethodData,
  PaymentMethodOption,
} from "@/components/payments/PaymentMethodSection"
import { UserData, Appointment, NotificationData, BillingRecord } from "@/types/patient"
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
  const [billingPaymentModalOpen, setBillingPaymentModalOpen] = useState(false)
  const [selectedBilling, setSelectedBilling] = useState<{ appointment: Appointment; billing: BillingRecord } | null>(null)
  const [billingPaymentMethod, setBillingPaymentMethod] = useState<PaymentMethodOption>("card")
  const [billingPaymentData, setBillingPaymentData] = useState<PaymentMethodData>({
    cardNumber: "",
    cardName: "",
    expiryDate: "",
    cvv: "",
    upiId: "",
  })
  const [payingBill, setPayingBill] = useState(false)

  // Protect route - only allow patients
  const { user, loading } = useAuth("patient")
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()

  useEffect(() => {
    if (!user || !activeHospitalId) return

    const fetchData = async () => {
      try {
        const patientDocRef = doc(db, "patients", user.uid)
        const patientDocSnap = await getDoc(patientDocRef)

        let patientData: UserData | null = null
        if (patientDocSnap.exists()) {
          patientData = patientDocSnap.data() as UserData
          setUserData(patientData)
        }

        const appointmentsCollection = getHospitalCollection(activeHospitalId, "appointments")
        const appointmentQueries: Promise<any>[] = [
          getDocs(query(appointmentsCollection, where("patientUid", "==", user.uid)))
        ]

        if (patientData?.patientId) {
          appointmentQueries.push(
            getDocs(query(appointmentsCollection, where("patientId", "==", patientData.patientId)))
          )
        }

        appointmentQueries.push(
          getDocs(query(appointmentsCollection, where("patientId", "==", user.uid)))
        )

        const appointmentSnapshots = await Promise.all(appointmentQueries)

        const appointmentMap = new Map<string, Appointment>()
        appointmentSnapshots.forEach((snapshot) => {
          if (!snapshot) return
          snapshot.docs.forEach((docSnap: any) => {
            const data = docSnap.data()
            appointmentMap.set(
              docSnap.id,
              { id: docSnap.id, ...data } as Appointment
            )
          })
        })

        let appointmentList = Array.from(appointmentMap.values())

        const billingSnapshots: any[] = []
        if (patientData?.patientId) {
          billingSnapshots.push(
            getDocs(query(getHospitalCollection(activeHospitalId, "billing_records"), where("patientId", "==", patientData.patientId)))
          )
        }
        billingSnapshots.push(
          getDocs(query(getHospitalCollection(activeHospitalId, "billing_records"), where("patientId", "==", user.uid)))
        )

        const resolvedBillingSnapshots = await Promise.all(billingSnapshots)

        const billingByAppointment = new Map<string, BillingRecord>()
        const billingByAdmission = new Map<string, BillingRecord>()

        resolvedBillingSnapshots.forEach((snapshot) => {
          snapshot?.docs.forEach((docSnap: any) => {
            const data = docSnap.data()
            const record: BillingRecord = {
              id: docSnap.id,
              admissionId: String(data.admissionId || ""),
              appointmentId: data.appointmentId ? String(data.appointmentId) : undefined,
              patientId: String(data.patientId || ""),
              patientUid: data.patientUid || null,
              patientName: data.patientName || null,
              doctorId: String(data.doctorId || ""),
              doctorName: data.doctorName || null,
              doctorFee: data.doctorFee !== undefined ? Number(data.doctorFee) : undefined,
              otherServices: Array.isArray(data.otherServices) ? data.otherServices : [],
              roomCharges: Number(data.roomCharges || 0),
              totalAmount: Number(data.totalAmount || 0),
              generatedAt: data.generatedAt || new Date().toISOString(),
              status: data.status || "pending",
              paymentMethod: data.paymentMethod || undefined,
              paidAt: data.paidAt || null,
              paymentReference: data.paymentReference || null,
              paidAtFrontDesk: data.paidAtFrontDesk ?? false,
              handledBy: data.handledBy || null,
              settlementMode: data.settlementMode || null
            }
            if (record.appointmentId) {
              billingByAppointment.set(record.appointmentId, record)
            }
            if (record.admissionId) {
              billingByAdmission.set(record.admissionId, record)
            }
          })
        })

        appointmentList = appointmentList.map((appointment) => {
          const billingRecord =
            (appointment.id && billingByAppointment.get(appointment.id)) ||
            (appointment.admissionId && billingByAdmission.get(appointment.admissionId))

          return billingRecord ? { ...appointment, billingRecord } : appointment
        })

        setAppointments(appointmentList)
      } catch (error) {
        setNotification({
          type: "error",
          message: "Failed to load appointments. Please try again."
        })
      }
    }

    fetchData()
  }, [user, activeHospitalId])

  if (loading || hospitalLoading) {
    return <LoadingSpinner message="Loading appointments..." />
  }

  if (!activeHospitalId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">No hospital selected. Please select a hospital to continue.</p>
          <Link href="/hospital-selection" className="btn-modern btn-modern-sm inline-block">
            Select Hospital
          </Link>
        </div>
      </div>
    )
  }

  if (!user || !userData) {
    return null
  }

  const TAB_STATUS_MAP: Record<typeof activeTab, string[]> = {
    confirmed: ["confirmed", "resrescheduled", "awaiting_reschedule", "awaiting_admission", "admitted"],
    completed: ["completed"],
    cancelled: ["cancelled", "doctor_cancelled", "refund_requested"]
  }

  const filterAppointmentsByTab = (tab: typeof activeTab) => {
    const allowed = TAB_STATUS_MAP[tab]
    return appointments.filter((apt) => allowed.includes(String(apt.status || "").toLowerCase()))
  }

  const confirmedAppointments = filterAppointmentsByTab("confirmed")
  const completedAppointments = filterAppointmentsByTab("completed")
  const cancelledAppointments = filterAppointmentsByTab("cancelled")

  const handleOpenBillingPayment = (appointment: Appointment) => {
    if (!appointment.billingRecord || appointment.billingRecord.status === "paid") return
    setSelectedBilling({ appointment, billing: appointment.billingRecord })
    setBillingPaymentMethod(
      appointment.billingRecord.paymentMethod && appointment.billingRecord.paymentMethod !== "cash"
        ? (appointment.billingRecord.paymentMethod as PaymentMethodOption)
        : "card"
    )
    setBillingPaymentData({
      cardNumber: "",
      cardName: "",
      expiryDate: "",
      cvv: "",
      upiId: "",
    })
    setBillingPaymentModalOpen(true)
  }

  const handleCloseBillingPayment = () => {
    setBillingPaymentModalOpen(false)
    setSelectedBilling(null)
    setBillingPaymentMethod("card")
    setBillingPaymentData({
      cardNumber: "",
      cardName: "",
      expiryDate: "",
      cvv: "",
      upiId: "",
    })
  }

  const handleConfirmBillingPayment = async () => {
    if (!selectedBilling) return
    setPayingBill(true)
    try {
      const res = await fetch("/api/patient/billing/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingId: selectedBilling.billing.id,
          paymentMethod: billingPaymentMethod
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to process payment")
      }
      const data = await res.json().catch(() => ({}))
      setAppointments(prev =>
        prev.map((apt) => {
          if (apt.id !== selectedBilling.appointment.id || !apt.billingRecord) return apt
          return {
            ...apt,
            billingRecord: {
              ...apt.billingRecord,
              status: "paid",
              paymentMethod: data?.paymentMethod || billingPaymentMethod,
              paidAt: data?.paidAt || new Date().toISOString(),
              paymentReference: data?.paymentReference || apt.billingRecord.paymentReference || null
            }
          }
        })
      )
      setNotification({
        type: "success",
        message: "Payment successful. Thank you!"
      })
      handleCloseBillingPayment()
    } catch (error: any) {
      setNotification({
        type: "error",
        message: error?.message || "Failed to pay bill. Please try again."
      })
    } finally {
      setPayingBill(false)
    }
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
      <div 
        className="min-h-screen relative pt-20"
        style={{
          backgroundImage: 'url(/images/1.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Overlay for better readability */}
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px]"></div>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 min-h-screen">

          {/* Page Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 sm:p-8 mb-8 text-white shadow-md">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-4xl">
                  📋
                </div>
                <div>
                  <h1 className="text-3xl font-bold">My Appointments</h1>
                  <p className="text-indigo-100 text-sm mt-1">View and manage all your appointments</p>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <Link href="/patient-dashboard/book-appointment" className="block">
                  <button className="btn-modern w-full group inline-flex items-center justify-center gap-3">
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
                    {confirmedAppointments.length}
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
                    {completedAppointments.length}
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
                    {cancelledAppointments.length}
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
            <div className="flex flex-col sm:flex-row border-b border-slate-200">
              <button
                onClick={() => setActiveTab("confirmed")}
                className={`w-full sm:flex-1 px-4 sm:px-6 py-4 font-semibold transition-all text-sm sm:text-base ${
                  activeTab === "confirmed"
                    ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                📅 Confirmed ({confirmedAppointments.length})
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`w-full sm:flex-1 px-4 sm:px-6 py-4 font-semibold transition-all text-sm sm:text-base ${
                  activeTab === "completed"
                    ? "bg-green-50 text-green-600 border-b-2 border-green-600"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                ✅ Completed ({completedAppointments.length})
              </button>
              <button
                onClick={() => setActiveTab("cancelled")}
                className={`w-full sm:flex-1 px-4 sm:px-6 py-4 font-semibold transition-all text-sm sm:text-base ${
                  activeTab === "cancelled"
                    ? "bg-red-50 text-red-600 border-b-2 border-red-600"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                ❌ Cancelled ({cancelledAppointments.length})
              </button>
            </div>
          </div>

          {/* Appointments List */}
          <AppointmentsList
            appointments={filterAppointmentsByTab(activeTab)
              .sort((a, b) => {
                const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`).getTime()
                const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`).getTime()
                return dateA - dateB // Earlier appointments first
              })
            }
            onCancelAppointment={openCancelModal}
            onPayBill={handleOpenBillingPayment}
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
        {billingPaymentModalOpen && selectedBilling && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Settle Hospital Bill</h3>
                  <p className="text-sm text-slate-500">
                    Appointment with Dr. {selectedBilling.appointment.doctorName}
                  </p>
                </div>
                <button
                  onClick={handleCloseBillingPayment}
                  className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="px-6 py-5 space-y-5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide mb-2">
                    Bill Summary
                  </p>
                  <div className="flex items-center justify-between text-slate-800">
                    <span className="text-sm">Total amount due</span>
                    <span className="text-2xl font-bold text-slate-900">
                      ₹{selectedBilling.billing.totalAmount}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Generated on{" "}
                    {selectedBilling.billing.generatedAt
                      ? new Date(selectedBilling.billing.generatedAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>

                <PaymentMethodSection
                  title="Choose payment method"
                  paymentMethod={billingPaymentMethod}
                  setPaymentMethod={(method) => setBillingPaymentMethod(method)}
                  paymentData={billingPaymentData}
                  setPaymentData={setBillingPaymentData}
                  amountToPay={selectedBilling.billing.totalAmount}
                  methods={["card", "upi"]}
                />
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  onClick={handleCloseBillingPayment}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all"
                  disabled={payingBill}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBillingPayment}
                  disabled={
                    payingBill ||
                    Number(selectedBilling.billing.totalAmount || 0) <= 0
                  }
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-60"
                >
                  {payingBill ? "Processing..." : `Pay ₹${selectedBilling.billing.totalAmount}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  )
}

