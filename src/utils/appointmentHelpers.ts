import { db } from "@/firebase/config"
import { doc, updateDoc, getDoc, query, where, getDocs, deleteDoc, deleteField } from "firebase/firestore"
import { getHospitalCollection } from "@/utils/hospital-queries"
const SLOT_COLLECTION = "appointmentSlots"
const getSlotDocId = (doctorId?: string, date?: string, time?: string) => {
  if (!doctorId || !date || !time) return null
  return `${doctorId}_${date}_${time.replace(/[:\s]/g, "-")}`
}

export const releaseAppointmentSlot = async (doctorId?: string, date?: string, time?: string) => {
  const slotId = getSlotDocId(doctorId, date, time)
  if (!slotId) return
  try {
    await deleteDoc(doc(db, SLOT_COLLECTION, slotId))
  } catch (error) {
  }
}
import { Appointment } from "@/types/patient"

// Calculate hours until appointment
export const getHoursUntilAppointment = (appointment: Appointment) => {
  const appointmentDateTime = new Date(`${appointment.appointmentDate} ${appointment.appointmentTime}`)
  const now = new Date()
  const diffMs = appointmentDateTime.getTime() - now.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours
}

// Handle appointment cancellation with refund logic
export const cancelAppointment = async (appointment: Appointment) => {
  const hoursUntil = getHoursUntilAppointment(appointment)
  const cancellationPolicy = hoursUntil >= 10 ? "full_refund" : "with_fee"
  
  const CANCELLATION_FEE = 100
  const cancellationFee = hoursUntil >= 10 ? 0 : CANCELLATION_FEE
  const refundAmount = appointment.paymentAmount - cancellationFee
  
  const refundTransactionId = `REFUND${Date.now()}${Math.floor(Math.random() * 1000)}`
  
  await updateDoc(doc(db, "appointments", appointment.id), {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelledBy: "patient",
    cancellationPolicy: cancellationPolicy,
    hoursBeforeCancellation: Math.floor(hoursUntil * 10) / 10,
    refundStatus: "processed",
    refundAmount: refundAmount,
    cancellationFee: cancellationFee,
    refundTransactionId: refundTransactionId,
    refundProcessedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  const refundMessage = hoursUntil >= 10 
    ? `Full refund of ₹${refundAmount} processed. Refund ID: ${refundTransactionId}`
    : `Refund of ₹${refundAmount} processed. Cancellation fee: ₹${cancellationFee}. Refund ID: ${refundTransactionId}`

  await releaseAppointmentSlot(appointment.doctorId, appointment.appointmentDate, appointment.appointmentTime)

  return {
    success: true,
    message: `Appointment cancelled successfully. ${refundMessage}`,
    updatedAppointment: {
      ...appointment,
      status: "cancelled" as const,
      cancellationPolicy: cancellationPolicy,
      refundStatus: "processed",
      refundAmount: refundAmount,
      cancellationFee: cancellationFee,
      refundTransactionId: refundTransactionId
    }
  }
}

// Complete appointment (doctor-side)
export const completeAppointment = async (
  appointmentId: string,
  medicine: string,
  notes: string,
  hospitalId: string,
  finalDiagnosis?: string[],
  customDiagnosis?: string,
  updatedBy?: string,
  updatedByRole: "doctor" | "admin" = "doctor"
) => {
  if (!hospitalId) {
    throw new Error("Hospital ID is required")
  }

  // Validate diagnosis requirement
  if (!finalDiagnosis || finalDiagnosis.length === 0) {
    throw new Error("At least one diagnosis is required to complete the consultation")
  }

  // Load appointment to validate rules - use hospital-scoped collection
  const appointmentsRef = getHospitalCollection(hospitalId, "appointments")
  const aptRef = doc(appointmentsRef, appointmentId)
  const aptSnap = await getDoc(aptRef)
  if (!aptSnap.exists()) {
    throw new Error("Appointment not found")
  }
  const apt = aptSnap.data() as any

  // Rule 1: Only today's appointments may be completed
  // COMMENTED OUT FOR TESTING - Allow completing appointments from any date
  // const isToday = new Date(String(apt.appointmentDate)).toDateString() === new Date().toDateString()
  // if (!isToday) {
  //   throw new Error("Only today's appointments can be completed")
  // }

  // Rule 2: Must complete earliest pending first
  const doctorId = String(apt.doctorId || "")
  if (!doctorId) {
    throw new Error("Invalid doctor for this appointment")
  }
  const todayStr = new Date().toISOString().slice(0,10)
  const qConfirmedToday = query(
    appointmentsRef,
    where("doctorId", "==", doctorId),
    where("appointmentDate", "==", todayStr),
    where("status", "==", "confirmed")
  )
  const qs = await getDocs(qConfirmedToday)
  const pendingToday = qs.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
  const toMinutes = (t: string) => {
    const [h, m] = String(t||"0:0").split(":").map(Number)
    return h * 60 + m
  }
  const targetTime = toMinutes(String(apt.appointmentTime))
  const earlierPending = pendingToday.filter(p => toMinutes(String(p.appointmentTime)) < targetTime)
  if (earlierPending.length > 0) {
    throw new Error("Please complete earlier appointments first")
  }

  // Prepare diagnosis history entry for audit
  const diagnosisHistoryEntry: any = {
    diagnoses: finalDiagnosis,
    updatedBy: updatedBy || doctorId,
    updatedAt: new Date().toISOString(),
    updatedByRole: updatedByRole
  }
  
  // Only include customDiagnosis if it has a value
  if (customDiagnosis && customDiagnosis.trim()) {
    diagnosisHistoryEntry.customDiagnosis = customDiagnosis.trim()
  }

  // Get existing diagnosis history or initialize
  const existingHistory = apt.diagnosisHistory || []
  const updatedHistory = [...existingHistory, diagnosisHistoryEntry]

  // Build update object - only include customDiagnosis if it has a value
  // Ensure notes and medicine are never undefined (Firestore doesn't allow undefined values)
  const updateData: any = {
    status: "completed",
    medicine: medicine || "",
    doctorNotes: notes || "",
    finalDiagnosis: finalDiagnosis,
    diagnosisHistory: updatedHistory,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  // Only include customDiagnosis if it has a value, otherwise remove it if it exists
  if (customDiagnosis && customDiagnosis.trim()) {
    updateData.customDiagnosis = customDiagnosis.trim()
  } else if (apt.customDiagnosis !== undefined) {
    // Remove the field if it exists but new value is empty
    updateData.customDiagnosis = deleteField()
  }

  await updateDoc(aptRef, updateData)

  await releaseAppointmentSlot(apt.doctorId, apt.appointmentDate, apt.appointmentTime)

  return {
    success: true,
    message: "Checkup completed successfully!",
    updates: {
      status: "completed" as const,
      medicine: medicine,
      doctorNotes: notes,
      finalDiagnosis: finalDiagnosis,
      customDiagnosis: customDiagnosis
    }
  }
}

// Get status color for badges
export const getStatusColor = (status: string) => {
  switch(status) {
    case "confirmed": return "bg-blue-100 text-blue-800 border-blue-200"
    case "completed": return "bg-green-100 text-green-800 border-green-200"
    case "cancelled": return "bg-red-100 text-red-800 border-red-200"
    default: return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

