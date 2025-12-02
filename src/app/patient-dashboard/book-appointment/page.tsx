"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { auth, db } from "@/firebase/config"
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, updateDoc, increment } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/hospital-queries"
import LoadingSpinner from "@/components/ui/StatusComponents"
import Notification from "@/components/ui/Notification"
import BookAppointmentForm from "@/components/patient/BookAppointmentForm"
import { AppointmentSuccessModal } from "@/components/patient/AppointmentModals"
import PageHeader from "@/components/ui/PageHeader"
import { UserData, Doctor, NotificationData } from "@/types/patient"
import Footer from "@/components/ui/Footer"
import { useSearchParams, useRouter } from "next/navigation"
import { sendWhatsAppMessage, formatWhatsAppRecipient } from "@/utils/whatsapp"
import { isDateBlocked } from "@/utils/blockedDates"
import { formatAppointmentDateTime } from "@/utils/date"

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading Booking Form..." />}>
      <BookAppointmentContent />
    </Suspense>
  )
}

function BookAppointmentContent() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState<NotificationData | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successAppointmentData, setSuccessAppointmentData] = useState<any>(null)

  const { user, loading } = useAuth("patient")
  const { activeHospitalId, loading: hospitalLoading } = useMultiHospital()
  const searchParams = useSearchParams()
  const router = useRouter()
 
  const rescheduleMode = useMemo(() => searchParams?.get('reschedule') === '1', [searchParams])
  const rescheduleAppointmentId = useMemo(() => searchParams?.get('aptId') || '', [searchParams])
  const initialDoctorId = useMemo(() => searchParams?.get('doctorId') || '', [searchParams])


  const sendWhatsAppSafely = useCallback(async (rawRecipient: string | null | undefined, message: string) => {
    const to = formatWhatsAppRecipient(rawRecipient ?? null)
    if (!to) return

    try {
      const response = await sendWhatsAppMessage({ to, message })
      if (!response.success) {
        console.warn("Patient booking WhatsApp failed", response.error)
      }
    } catch (error) {
      console.warn("Patient booking WhatsApp error", error)
    }
  }, [])

  const sendAppointmentConfirmationMessage = useCallback(
    async (opts: {
      patientFirstName?: string
      patientLastName?: string
      patientPhone?: string | null
      doctorName?: string
      doctorSpecialization?: string
      appointmentDate: string
      appointmentTime: string
      transactionId: string
      appointmentId?: string
      paymentAmount: number
      paymentType?: "full" | "partial"
      chiefComplaint?: string
    }) => {
      const fullName = [opts.patientFirstName, opts.patientLastName].filter(Boolean).join(" ") || "there"
      const friendlyName = opts.patientFirstName || "there"

      let doctorLabel = opts.doctorName?.trim() || ""
      if (doctorLabel) {
        const lower = doctorLabel.toLowerCase()
        doctorLabel = lower.startsWith("dr") ? opts.doctorName!.trim() : `Dr. ${doctorLabel}`
      } else {
        doctorLabel = "our doctor"
      }

      const dateDisplay = new Date(opts.appointmentDate + "T00:00:00").toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      
      const timeStr = opts.appointmentTime || ""
      const [h, m] = timeStr.split(":").map(Number)
      const timeDisplay = !isNaN(h) && !isNaN(m) 
        ? new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : timeStr

      const appointmentId = opts.appointmentId || opts.transactionId || "N/A"
      const doctorSpecialization = opts.doctorSpecialization ? ` (${opts.doctorSpecialization})` : ""
      const paymentTypeText = opts.paymentType === "partial" ? "Partial" : "Full"

      const message = `🎉 *Appointment Successfully Booked!*

Hi ${fullName},

Your appointment has been confirmed and booked successfully.

📋 *Appointment Details:*
• 👨‍⚕️ Doctor: ${doctorLabel}${doctorSpecialization}
• 📅 Date: ${dateDisplay}
• 🕒 Time: ${timeDisplay}
• 📋 Appointment ID: ${appointmentId}
${opts.chiefComplaint ? `• 📝 Reason: ${opts.chiefComplaint}` : ""}

💳 *Payment Information:*
• Amount Paid: ₹${new Intl.NumberFormat("en-IN").format(opts.paymentAmount || 0)}
• Payment Type: ${paymentTypeText}
• Status: ✅ Paid
• Transaction ID: ${opts.transactionId || "N/A"}

✅ Your appointment is confirmed and visible in your patient dashboard.

If you need to reschedule or have any questions, reply here or call us at +91-XXXXXXXXXX.

See you soon! 🏥`

      await sendWhatsAppSafely(opts.patientPhone ?? null, message)
    },
    [sendWhatsAppSafely]
  )
 
  useEffect(() => {
    if (!user || !activeHospitalId) return

    const fetchData = async () => {
      const patientDoc = await getDoc(doc(db, "patients", user.uid))
      if (patientDoc.exists()) {
        const data = patientDoc.data() as UserData
        setUserData(data)
      }

      const doctorsQuery = query(getHospitalCollection(activeHospitalId, "doctors"), where("status", "==", "active"))
      const unsub = onSnapshot(doctorsQuery, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Doctor))
        setDoctors(list)
      })
      return unsub
    }

    const maybeUnsubPromise = fetchData()
    return () => {
      // unsubscribe doctors listener if available
      if (maybeUnsubPromise && typeof (maybeUnsubPromise as any) === 'function') {
        ;(maybeUnsubPromise as any)()
      }
    }
  }, [user])

  if (loading) {
    return <LoadingSpinner message="Loading Booking Form..." />
  }

  if (!user || !userData) {
    return null
  }

  const handleAppointmentSubmit = async (formData: {
    selectedDoctor: string
    appointmentData: {
      date: string; time: string; problem: string; medicalHistory: string;
      symptomOnset?: string; symptomDuration?: string; symptomSeverity?: number; symptomProgression?: string; symptomTriggers?: string; associatedSymptoms?: string;
      vitalTemperatureC?: number; vitalBloodPressure?: string; vitalHeartRate?: number; vitalRespiratoryRate?: number; vitalSpO2?: number;
      additionalConcern?: string;
    }
    paymentMethod: "card" | "upi" | "cash"
    paymentType: "full" | "partial"
    paymentData: { cardNumber: string; cardName: string; expiryDate: string; cvv: string; upiId: string }
  }): Promise<void> => {
    const { selectedDoctor, appointmentData, paymentMethod, paymentType, paymentData } = formData
    
    if (!selectedDoctor) {
      setNotification({ type: "error", message: "Please select a doctor" })
      return
    }

    if (!appointmentData.date || !appointmentData.time || (!rescheduleMode && !appointmentData.problem)) {
      setNotification({ type: "error", message: "Please fill all required fields" })
      return
    }

    if (!rescheduleMode && paymentMethod === "card") {
      if (!paymentData.cardNumber || !paymentData.cardName || !paymentData.expiryDate || !paymentData.cvv) {
        setNotification({ type: "error", message: "Please fill all card details" })
        return
      }
    } else if (!rescheduleMode && paymentMethod === "upi") {
      if (!paymentData.upiId) {
        setNotification({ type: "error", message: "Please enter UPI ID" })
        return
      }
    }

    // Blocked date guard (client-side)
    const selectedDoctorData = doctors.find(doc => doc.id === selectedDoctor)
    if (selectedDoctorData) {
      try {
        const blockedDates: any[] = Array.isArray((selectedDoctorData as any).blockedDates) ? (selectedDoctorData as any).blockedDates : []
        if (isDateBlocked(appointmentData.date, blockedDates)) {
          setNotification({ type: 'error', message: 'Doctor is not available on the selected date' })
          return
        }
      } catch {}
    }

    setSubmitting(true)
    
    try {
      // await new Promise(resolve => setTimeout(resolve, 2000))

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to book appointments.")
      }
      const authToken = await currentUser.getIdToken()

      // RESCHEDULE: only update date/time and status
      if (rescheduleMode && rescheduleAppointmentId) {
        const response = await fetch("/api/patient/book-appointment", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            mode: "reschedule",
            appointmentId: rescheduleAppointmentId,
            patientUid: user.uid,
            appointmentDate: appointmentData.date,
            appointmentTime: appointmentData.time,
          }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data?.error || "Failed to reschedule appointment")
        }

        setNotification({ type: "success", message: "Appointment rescheduled successfully" })
        router.push("/patient-dashboard")
        return
      }

      const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`
      
      const selectedDoctorData = doctors.find(doc => doc.id === selectedDoctor)
      
      if (!selectedDoctorData) {
        throw new Error("Doctor not found")
      }

      const CONSULTATION_FEE = selectedDoctorData.consultationFee || 500
      const PARTIAL_PAYMENT_AMOUNT = Math.ceil(CONSULTATION_FEE * 0.1)
      const REMAINING_AMOUNT = CONSULTATION_FEE - PARTIAL_PAYMENT_AMOUNT
      const AMOUNT_TO_PAY = paymentType === "partial" ? PARTIAL_PAYMENT_AMOUNT : CONSULTATION_FEE
      
      // Check slot availability BEFORE payment deduction
      if (!rescheduleMode) {
        const slotCheckResponse = await fetch(
          `/api/appointments/check-slot?doctorId=${selectedDoctor}&date=${appointmentData.date}&time=${appointmentData.time}`
        )
        if (!slotCheckResponse.ok) {
          const slotData = await slotCheckResponse.json().catch(() => ({}))
          throw new Error(slotData?.error || "This slot is already booked. Please choose another time.")
        }
        const slotData = await slotCheckResponse.json().catch(() => ({}))
        if (!slotData?.available) {
          throw new Error(slotData?.error || "This slot is already booked. Please choose another time.")
        }
      }
      
      // Fetch latest patient profile to reflect any inline edits done during booking
      const latestPatientDoc = await getDoc(doc(db, "patients", user.uid))
      const latestUserData = latestPatientDoc.exists() ? (latestPatientDoc.data() as UserData) : userData
      
      
      const patientSixDigitId = latestUserData?.patientId || user.uid
      const appointmentPayload = {
        patientUid: user.uid,
        patientId: patientSixDigitId,
        patientName: `${latestUserData.firstName} ${latestUserData.lastName}`,
        patientEmail: latestUserData.email,
        patientPhone: latestUserData.phoneNumber || "",
        patientGender: latestUserData.gender || "",
        patientBloodGroup: latestUserData.bloodGroup || "",
        patientDateOfBirth: latestUserData.dateOfBirth || "",
        patientDrinkingHabits: latestUserData.drinkingHabits || "",
        patientSmokingHabits: latestUserData.smokingHabits || "",
        patientVegetarian: latestUserData.vegetarian ?? false,
        patientOccupation: latestUserData.occupation || "",
        patientFamilyHistory: latestUserData.familyHistory || "",
        patientPregnancyStatus: latestUserData.pregnancyStatus || "",
        patientHeightCm: latestUserData.heightCm ?? null,
        patientWeightKg: latestUserData.weightKg ?? null,
        
        // Patient Medical Info (visible to doctor)
        patientAllergies: latestUserData.allergies || "",
        patientCurrentMedications: latestUserData.currentMedications || "",
        
        doctorId: selectedDoctor,
        doctorName: `${selectedDoctorData.firstName} ${selectedDoctorData.lastName}`,
        doctorSpecialization: selectedDoctorData.specialization || "",
        appointmentDate: appointmentData.date,
        appointmentTime: appointmentData.time,
        chiefComplaint: appointmentData.problem,
        medicalHistory: appointmentData.medicalHistory || "",
        patientAdditionalConcern: appointmentData.additionalConcern || "",
        // Structured symptoms
        symptomOnset: appointmentData.symptomOnset || "",
        symptomDuration: appointmentData.symptomDuration || "",
        symptomSeverity: appointmentData.symptomSeverity ?? null,
        symptomProgression: appointmentData.symptomProgression || "",
        symptomTriggers: appointmentData.symptomTriggers || "",
        associatedSymptoms: appointmentData.associatedSymptoms || "",
        // Vitals
        vitalTemperatureC: appointmentData.vitalTemperatureC ?? null,
        vitalBloodPressure: appointmentData.vitalBloodPressure || "",
        vitalHeartRate: appointmentData.vitalHeartRate ?? null,
        vitalRespiratoryRate: appointmentData.vitalRespiratoryRate ?? null,
        vitalSpO2: appointmentData.vitalSpO2 ?? null,
        paymentStatus: "paid",
        paymentMethod: paymentMethod,
        paymentType: paymentType,
        totalConsultationFee: CONSULTATION_FEE,
        paymentAmount: AMOUNT_TO_PAY,
        remainingAmount: paymentType === "partial" ? REMAINING_AMOUNT : 0,
        transactionId: transactionId,
        paidAt: new Date().toISOString(),
        status: "confirmed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const response = await fetch("/api/patient/book-appointment", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          mode: "create",
          appointmentData: appointmentPayload,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setNotification({
          type: "error",
          message: data?.error || "Failed to create appointment",
        })
        setSubmitting(false)
        return
      }

      // Get appointment ID from response if available
      const responseData = await response.json().catch(() => ({}))
      const appointmentId = responseData?.id || responseData?.appointmentId || transactionId
      
      await sendAppointmentConfirmationMessage({
        patientFirstName: latestUserData.firstName,
        patientLastName: latestUserData.lastName,
        patientPhone: (latestUserData as any).phoneNumber || (latestUserData as any).phone || null,
        doctorName: `${selectedDoctorData.firstName} ${selectedDoctorData.lastName}`,
        doctorSpecialization: selectedDoctorData.specialization || "",
        appointmentDate: appointmentData.date,
        appointmentTime: appointmentData.time,
        transactionId,
        appointmentId: appointmentId,
        paymentAmount: AMOUNT_TO_PAY,
        paymentType: paymentType,
        chiefComplaint: appointmentData.problem,
      })

      // Show success modal with appointment details
      setSuccessAppointmentData({
        doctorName: `${selectedDoctorData.firstName} ${selectedDoctorData.lastName}`,
        doctorSpecialization: selectedDoctorData.specialization,
        appointmentDate: appointmentData.date,
        appointmentTime: appointmentData.time,
        transactionId: transactionId,
        paymentAmount: AMOUNT_TO_PAY,
        paymentType: paymentType,
        remainingAmount: paymentType === "partial" ? REMAINING_AMOUNT : 0,
        patientName: `${userData.firstName} ${userData.lastName}`
      })
      setShowSuccessModal(true)
      
    } catch (error: unknown) {
      console.error("Error processing payment:", error)
      setNotification({ 
        type: "error", 
        message: (error as Error).message || "Payment failed. Please try again." 
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Book an Appointment"
          subtitle="Schedule a consultation with our expert doctors"
          icon="📅"
          gradient="from-teal-600 to-cyan-700"
        />

        <BookAppointmentForm
          user={user}
          userData={userData}
          doctors={doctors}
          onSubmit={handleAppointmentSubmit}
          submitting={submitting}
          rescheduleMode={rescheduleMode}
          initialDoctorId={initialDoctorId}
        />
      </main>

      {/* Appointment Success Modal */}
      <AppointmentSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        appointmentData={successAppointmentData}
      />

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

