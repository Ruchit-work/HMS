import { db } from "@/firebase/config"
import { doc, updateDoc } from "firebase/firestore"
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
  notes: string
) => {
  await updateDoc(doc(db, "appointments", appointmentId), {
    status: "completed",
    medicine: medicine,
    doctorNotes: notes,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  return {
    success: true,
    message: "Checkup completed successfully!",
    updates: {
      status: "completed" as const,
      medicine: medicine,
      doctorNotes: notes
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

