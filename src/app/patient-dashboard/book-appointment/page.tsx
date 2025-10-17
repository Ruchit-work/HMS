"use client"

import { useEffect, useState } from "react"
import { db } from "@/firebase/config"
import { doc, getDoc, getDocs, collection, query, where, addDoc } from "firebase/firestore"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import Notification from "@/components/Notification"
import BookAppointmentForm from "@/components/patient/BookAppointmentForm"
import AppointmentSuccessModal from "@/components/patient/AppointmentSuccessModal"
import PageHeader from "@/components/ui/PageHeader"
import { UserData, Doctor, NotificationData } from "@/types/patient"
import Footer from "@/components/Footer"

export default function BookAppointmentPage() {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState<NotificationData | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successAppointmentData, setSuccessAppointmentData] = useState<any>(null)

  const { user, loading } = useAuth("patient")

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      const patientDoc = await getDoc(doc(db, "patients", user.uid))
      if (patientDoc.exists()) {
        const data = patientDoc.data() as UserData
        setUserData(data)
      }

      const doctorsQuery = query(collection(db, "doctors"), where("status", "==", "active"))
      const doctorsSnapshot = await getDocs(doctorsQuery)
      const doctorsList = doctorsSnapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Doctor))
      setDoctors(doctorsList)
    }

    fetchData()
  }, [user])

  if (loading) {
    return <LoadingSpinner message="Loading Booking Form..." />
  }

  if (!user || !userData) {
    return null
  }

  const handleAppointmentSubmit = async (formData: {
    selectedDoctor: string
    appointmentData: { date: string; time: string; problem: string; medicalHistory: string }
    paymentMethod: "card" | "upi" | "cash"
    paymentType: "full" | "partial"
    paymentData: { cardNumber: string; cardName: string; expiryDate: string; cvv: string; upiId: string }
  }) => {
    const { selectedDoctor, appointmentData, paymentMethod, paymentType, paymentData } = formData
    
    if (!selectedDoctor) {
      setNotification({ type: "error", message: "Please select a doctor" })
      return
    }

    if (!appointmentData.date || !appointmentData.time || !appointmentData.problem) {
      setNotification({ type: "error", message: "Please fill all required fields" })
      return
    }

    if (paymentMethod === "card") {
      if (!paymentData.cardNumber || !paymentData.cardName || !paymentData.expiryDate || !paymentData.cvv) {
        setNotification({ type: "error", message: "Please fill all card details" })
        return
      }
    } else if (paymentMethod === "upi") {
      if (!paymentData.upiId) {
        setNotification({ type: "error", message: "Please enter UPI ID" })
        return
      }
    }

    setSubmitting(true)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`
      
      const selectedDoctorData = doctors.find(doc => doc.id === selectedDoctor)
      
      if (!selectedDoctorData) {
        throw new Error("Doctor not found")
      }

      const CONSULTATION_FEE = selectedDoctorData.consultationFee || 500
      const PARTIAL_PAYMENT_AMOUNT = Math.ceil(CONSULTATION_FEE * 0.1)
      const REMAINING_AMOUNT = CONSULTATION_FEE - PARTIAL_PAYMENT_AMOUNT
      const AMOUNT_TO_PAY = paymentType === "partial" ? PARTIAL_PAYMENT_AMOUNT : CONSULTATION_FEE
      
      await addDoc(collection(db, "appointments"), {
        patientId: user?.uid,
        patientName: `${userData.firstName} ${userData.lastName}`,
        patientEmail: userData.email,
        patientPhone: userData.phoneNumber || "",
        patientGender: userData.gender || "",
        patientBloodGroup: userData.bloodGroup || "",
        patientDateOfBirth: userData.dateOfBirth || "",
        patientDrinkingHabits: userData.drinkingHabits,
        patientSmokingHabits: userData.smokingHabits,
        patientVegetarian: userData.vegetarian,
        
        // Patient Medical Info (visible to doctor)
        patientAllergies: userData.allergies || "",
        patientCurrentMedications: userData.currentMedications || "",
        
        doctorId: selectedDoctor,
        doctorName: `${selectedDoctorData.firstName} ${selectedDoctorData.lastName}`,
        doctorSpecialization: selectedDoctorData.specialization || "",
        appointmentDate: appointmentData.date,
        appointmentTime: appointmentData.time,
        chiefComplaint: appointmentData.problem,
        medicalHistory: appointmentData.medicalHistory || "",
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

