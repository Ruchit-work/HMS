import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/firebase/config"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"
import {
  generateTimeSlots,
  getAvailableTimeSlots,
  getDayName,
  getVisitingHoursForBranch,
  isSlotInPast,
  normalizeTime,
} from "@/shared/utils/timeSlots"
import { isDateBlocked } from "@/shared/utils/analytics/blockedDates"
import type { Doctor, Appointment } from "@/types/patient"
import type { BranchTimings } from "@/types/branch"

export interface ComputeAvailableSlotsInput {
  hospitalId: string
  doctorId: string
  appointmentDate: string
  doctor: Doctor | Record<string, unknown>
  branchId?: string | null
  branchTimings?: BranchTimings | null
}

export interface ComputeAvailableSlotsResult {
  available: string[]
  booked: string[]
  past: string[]
  all: string[]
}

const emptyResult = (): ComputeAvailableSlotsResult => ({
  available: [],
  booked: [],
  past: [],
  all: [],
})

/**
 * Single source of truth for client-side slot availability.
 * Used by receptionist, doctor, and patient booking UIs so they all:
 *  - respect blocked dates
 *  - load confirmed appointments from hospitals/{id}/appointments
 *  - load reserved slots from appointmentSlots WITH hospitalId
 *    (required by Firestore security rules)
 *  - hide past slots
 */
export async function computeAvailableSlots(
  input: ComputeAvailableSlotsInput
): Promise<ComputeAvailableSlotsResult> {
  const { hospitalId, doctorId, appointmentDate, doctor, branchId, branchTimings } = input

  if (!hospitalId || !doctorId || !appointmentDate) {
    return emptyResult()
  }

  const blockedDates: unknown[] = Array.isArray((doctor as { blockedDates?: unknown }).blockedDates)
    ? ((doctor as { blockedDates: unknown[] }).blockedDates)
    : []
  if (blockedDates.length > 0 && isDateBlocked(appointmentDate, blockedDates)) {
    return emptyResult()
  }

  const doctorWithId = {
    ...(doctor as object),
    id: (doctor as { id?: string }).id || doctorId,
  } as Doctor

  const dateObj = new Date(`${appointmentDate}T00:00:00`)
  const visitingHours = getVisitingHoursForBranch(doctorWithId, branchId, branchTimings)
  const daySchedule = visitingHours[getDayName(dateObj)]
  const all = daySchedule ? generateTimeSlots(daySchedule) : []

  if (all.length === 0) {
    return emptyResult()
  }

  const aptConstraints = [
    where("doctorId", "==", doctorId),
    where("appointmentDate", "==", appointmentDate),
  ]
  if (branchId) {
    aptConstraints.push(where("branchId", "==", branchId))
  }

  const [aptSnap, slotsSnap] = await Promise.all([
    getDocs(query(getHospitalCollection(hospitalId, "appointments"), ...aptConstraints)),
    getDocs(
      query(
        collection(db, "appointmentSlots"),
        where("hospitalId", "==", hospitalId),
        where("doctorId", "==", doctorId),
        where("appointmentDate", "==", appointmentDate)
      )
    ),
  ])

  const existing = aptSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Appointment[]

  const reservedFromSlots = new Set<string>()
  slotsSnap.docs.forEach((docSnap) => {
    const time = docSnap.data()?.appointmentTime
    if (time) reservedFromSlots.add(normalizeTime(String(time)))
  })

  const bookedFromAppointments = new Set<string>()
  existing.forEach((apt) => {
    if (apt.status !== "confirmed" || !apt.appointmentTime) return
    bookedFromAppointments.add(normalizeTime(String(apt.appointmentTime)))
  })

  const bookedSet = new Set<string>([...bookedFromAppointments, ...reservedFromSlots])
  const past = all.filter((s) => isSlotInPast(s, appointmentDate))
  const pastSet = new Set(past)

  // Prefer getAvailableTimeSlots for visiting-hours / confirmed-apt conflict logic,
  // then also exclude anything reserved in appointmentSlots and past times.
  const openFromSchedule = getAvailableTimeSlots(
    doctorWithId,
    dateObj,
    existing,
    branchId,
    branchTimings
  )

  const available = openFromSchedule.filter((s) => {
    const normalized = normalizeTime(s)
    if (pastSet.has(s) || pastSet.has(normalized)) return false
    if (bookedSet.has(normalized)) return false
    return true
  })

  const booked = all.filter((s) => bookedSet.has(normalizeTime(s)))

  return { available, booked, past, all }
}
