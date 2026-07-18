import { db } from "@/firebase/config"
import { doc, updateDoc, getDoc, query, where, getDocs, deleteDoc, deleteField } from "firebase/firestore"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"
import { authedFetchJson } from "@/shared/utils/authedFetch"
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
  } catch {
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

/** Collected money (paid / paidAt) that hasn't been refunded — such appointments must go through the refund workflow. */
export const isAppointmentPaid = (appointment: Appointment): boolean => {
  const paymentStatus = String(appointment.paymentStatus || "").toLowerCase()
  if (paymentStatus === "refunded") return false
  return (
    paymentStatus === "paid" ||
    (Boolean(appointment.paidAt) && String(appointment.paidAt).trim() !== "")
  )
}

/**
 * Cancel an appointment through the unified server-side cancellation engine.
 * Hospital billing settings decide whether paid appointments are disallowed,
 * kept as paid revenue, turned into refund requests, or auto-refunded.
 */
export const cancelAppointment = async (appointment: Appointment, hospitalId: string) => {
  const result = await authedFetchJson<{
    success?: boolean
    status?: string
    paymentStatus?: string
    message?: string
  }>(
    `/api/appointments/${appointment.id}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ hospitalId, action: "cancel", reason: "patient_cancelled" }),
    },
    "Failed to cancel appointment"
  )

  const newStatus = result.status === "refund_requested" ? "refund_requested" : "cancelled"

  return {
    success: true,
    message: result.message || "Appointment cancelled successfully.",
    updatedAppointment: {
      ...appointment,
      status: newStatus as Appointment["status"],
      ...(result.paymentStatus ? { paymentStatus: result.paymentStatus } : {}),
      ...(newStatus === "refund_requested"
        ? { refundRequested: true }
        : { cancelledAt: new Date().toISOString() }),
    } as Appointment,
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

  // Require doctor notes (diagnosis field removed in favor of notes-only)
  if (!notes || !String(notes).trim()) {
    throw new Error("Doctor's notes are required to complete the consultation")
  }

  // Load appointment to validate rules - use hospital-scoped collection
  const appointmentsRef = getHospitalCollection(hospitalId, "appointments")
  const aptRef = doc(appointmentsRef, appointmentId)
  const aptSnap = await getDoc(aptRef)
  if (!aptSnap.exists()) {
    throw new Error("Appointment not found")
  }
  const apt = aptSnap.data() as any

 

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

  // Preserve existing diagnosis history; append notes-based entry if we have legacy diagnosis
  const existingHistory = apt.diagnosisHistory || []
  const updatedHistory =
    finalDiagnosis && finalDiagnosis.length > 0
      ? [
          ...existingHistory,
          {
            diagnoses: finalDiagnosis,
            updatedBy: updatedBy || doctorId,
            updatedAt: new Date().toISOString(),
            updatedByRole: updatedByRole,
            ...(customDiagnosis?.trim() && { customDiagnosis: customDiagnosis.trim() }),
          },
        ]
      : existingHistory

  const updateData: any = {
    status: "completed",
    medicine: medicine || "",
    doctorNotes: notes || "",
    diagnosisHistory: updatedHistory,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  if (finalDiagnosis && finalDiagnosis.length > 0) {
    updateData.finalDiagnosis = finalDiagnosis
  }
  if (customDiagnosis?.trim()) {
    updateData.customDiagnosis = customDiagnosis.trim()
  } else if (apt.customDiagnosis !== undefined) {
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

/**
 * Mark appointment as skipped (patient did not come).
 * Doctor can then proceed to the next appointment.
 */
export const markAppointmentSkipped = async (
  appointmentId: string,
  hospitalId: string
) => {
  if (!hospitalId) throw new Error("Hospital ID is required")

  const appointmentsRef = getHospitalCollection(hospitalId, "appointments")
  const aptRef = doc(appointmentsRef, appointmentId)
  const aptSnap = await getDoc(aptRef)
  if (!aptSnap.exists()) throw new Error("Appointment not found")

  const apt = aptSnap.data() as any
  if (apt.status !== "confirmed") {
    throw new Error("Only confirmed appointments can be marked as skipped")
  }

  await updateDoc(aptRef, {
    status: "no_show",
    noShowAt: new Date().toISOString(),
    doctorNotes: "Patient did not come (skipped).",
    updatedAt: new Date().toISOString(),
  })

  await releaseAppointmentSlot(apt.doctorId, apt.appointmentDate, apt.appointmentTime)

  return { success: true, message: "Appointment skipped. You can take the next patient." }
}

// Get status color for badges
export const getStatusColor = (status: string) => {
  switch(status) {
    case "confirmed": return "bg-blue-100 text-blue-800 border-blue-200"
    case "completed": return "bg-green-100 text-green-800 border-green-200"
    case "cancelled": return "bg-red-100 text-red-800 border-red-200"
    case "no_show": return "bg-amber-100 text-amber-800 border-amber-200"
    default: return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

