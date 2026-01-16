/**
 * Time Slot Utility Functions
 * Handles visiting hours, slot generation, and availability checking
 */

import { VisitingHours, DaySchedule, Appointment, Doctor } from "@/types/patient"
import { BranchTimings } from "@/types/branch"
import { normalizeBlockedDates } from "@/utils/analytics/blockedDates"

// Default visiting hours (9 AM - 5 PM with 1-2 PM lunch break)
export const DEFAULT_VISITING_HOURS: VisitingHours = {
  monday: { isAvailable: true, slots: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }] },
  tuesday: { isAvailable: true, slots: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }] },
  wednesday: { isAvailable: true, slots: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }] },
  thursday: { isAvailable: true, slots: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }] },
  friday: { isAvailable: true, slots: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }] },
  saturday: { isAvailable: true, slots: [{ start: "09:00", end: "13:00" }] },
  sunday: { isAvailable: false, slots: [] }
}


export function normalizeTime(time: string): string {
  if (!time || typeof time !== "string") return time
  
  // Remove spaces and convert to uppercase
  let normalized = time.trim().replace(/\s+/g, "").toUpperCase()
  
  // Check if it's already in 24-hour format (HH:MM or HH-MM)
  if (normalized.includes("AM") || normalized.includes("PM")) {
    // 12-hour format - convert to 24-hour
    const match = normalized.match(/^(\d{1,2})[:\-]?(\d{2})\s*(AM|PM)$/)
    if (match) {
      let hours = parseInt(match[1], 10)
      const minutes = parseInt(match[2], 10)
      const period = match[3]
      
      if (period === "PM" && hours !== 12) {
        hours += 12
      } else if (period === "AM" && hours === 12) {
        hours = 0
      }
      
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    }
  } else {
    // Already in 24-hour format, just normalize separators
    normalized = normalized.replace(/-/g, ":")
    // Ensure format is HH:MM
    const parts = normalized.split(":")
    if (parts.length === 2) {
      const hours = parseInt(parts[0], 10)
      const minutes = parseInt(parts[1], 10)
      if (!isNaN(hours) && !isNaN(minutes)) {
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
      }
    }
  }
  
  return normalized
}

// Convert time string to minutes since midnight
export function timeToMinutes(time: string): number {
  const normalized = normalizeTime(time)
  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

// Convert minutes since midnight to time string
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// Get day name from date
export function getDayName(date: Date): keyof VisitingHours {
  const days: (keyof VisitingHours)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

// Generate all possible 15-minute time slots for a day's visiting hours
export function generateTimeSlots(daySchedule: DaySchedule): string[] {
  if (!daySchedule.isAvailable) return []
  
  const slotSet = new Set<string>() // Use Set to avoid duplicates
  const SLOT_DURATION = 15 // minutes
  
  daySchedule.slots.forEach(timeSlot => {
    const startMinutes = timeToMinutes(timeSlot.start)
    const endMinutes = timeToMinutes(timeSlot.end)
    
    for (let minutes = startMinutes; minutes < endMinutes; minutes += SLOT_DURATION) {
      slotSet.add(minutesToTime(minutes))
    }
  })
  
  // Convert Set back to array and sort
  return Array.from(slotSet).sort()
}

// Check if a time slot is available
export function isTimeSlotAvailable(
  slotTime: string,
  existingAppointments: Appointment[]
): boolean {
  // Normalize slot time before comparison
  const normalizedSlotTime = normalizeTime(slotTime)
  const slotMinutes = timeToMinutes(normalizedSlotTime)
  const SLOT_DURATION = 15 // minutes
  
  // Check if any existing appointment conflicts with this slot
  return !existingAppointments.some(apt => {
    // Normalize appointment time before comparison
    const normalizedAptTime = normalizeTime(apt.appointmentTime || "")
    const aptMinutes = timeToMinutes(normalizedAptTime)
    
    // Check if the new slot overlaps with existing appointment (within 15 min window)
    // An appointment blocks: [appointmentTime, appointmentTime + 15 minutes)
    return (
      slotMinutes >= aptMinutes && 
      slotMinutes < aptMinutes + SLOT_DURATION
    )
  })
}

// Check if a specific date is blocked by the doctor
export function isDateBlocked(doctor: Doctor, date: Date): boolean {
  if (!doctor.blockedDates || doctor.blockedDates.length === 0) return false
  
  const dateString = date.toISOString().split('T')[0]
  // Normalize blocked dates to handle various formats (string, object with date property, Firestore Timestamp, etc.)
  const normalizedBlockedDates = normalizeBlockedDates(doctor.blockedDates as any[])
  return normalizedBlockedDates.includes(dateString)
}

// Get blocked date info if date is blocked
export function getBlockedDateInfo(doctor: Doctor, date: Date): { reason: string } | null {
  if (!doctor.blockedDates) return null
  
  const dateString = date.toISOString().split('T')[0]
  // Find blocked date - handle various formats (normalize for comparison but return original for reason)
  const blocked = (doctor.blockedDates as any[]).find((b: any) => {
    // Normalize the blocked date for comparison
    let normalizedDate = ""
    if (typeof b === "string") {
      normalizedDate = b.slice(0, 10)
    } else if (b && typeof b.date === "string") {
      normalizedDate = String(b.date).slice(0, 10)
    } else if (b?.toDate && typeof b.toDate === "function") {
      const dt = b.toDate() as Date
      normalizedDate = dt.toISOString().split('T')[0]
    } else if (b?.seconds && typeof b.seconds === "number") {
      const dt = new Date(b.seconds * 1000)
      normalizedDate = dt.toISOString().split('T')[0]
    }
    return normalizedDate === dateString
  })
  return blocked ? { reason: (blocked.reason || "Doctor not available") as string } : null
}

/**
 * Convert branch timings to VisitingHours format
 */
export function convertBranchTimingsToVisitingHours(branchTimings: BranchTimings): VisitingHours {
  const visitingHours: VisitingHours = {
    monday: branchTimings.monday 
      ? { isAvailable: true, slots: [{ start: branchTimings.monday.start, end: branchTimings.monday.end }] }
      : { isAvailable: false, slots: [] },
    tuesday: branchTimings.tuesday 
      ? { isAvailable: true, slots: [{ start: branchTimings.tuesday.start, end: branchTimings.tuesday.end }] }
      : { isAvailable: false, slots: [] },
    wednesday: branchTimings.wednesday 
      ? { isAvailable: true, slots: [{ start: branchTimings.wednesday.start, end: branchTimings.wednesday.end }] }
      : { isAvailable: false, slots: [] },
    thursday: branchTimings.thursday 
      ? { isAvailable: true, slots: [{ start: branchTimings.thursday.start, end: branchTimings.thursday.end }] }
      : { isAvailable: false, slots: [] },
    friday: branchTimings.friday 
      ? { isAvailable: true, slots: [{ start: branchTimings.friday.start, end: branchTimings.friday.end }] }
      : { isAvailable: false, slots: [] },
    saturday: branchTimings.saturday 
      ? { isAvailable: true, slots: [{ start: branchTimings.saturday.start, end: branchTimings.saturday.end }] }
      : { isAvailable: false, slots: [] },
    sunday: branchTimings.sunday 
      ? { isAvailable: true, slots: [{ start: branchTimings.sunday.start, end: branchTimings.sunday.end }] }
      : { isAvailable: false, slots: [] },
  }
  return visitingHours
}

/**
 * Get visiting hours for a doctor at a specific branch
 * Priority: 1) Doctor's branch-specific timings, 2) Branch timings, 3) Doctor's general timings, 4) Default
 */
export function getVisitingHoursForBranch(
  doctor: Doctor,
  branchId: string | null | undefined,
  branchTimings: BranchTimings | null | undefined
): VisitingHours {
  // If doctor has branch-specific timings for this branch, use those
  if (branchId && doctor.branchTimings && doctor.branchTimings[branchId]) {
    return doctor.branchTimings[branchId]
  }

  // If branch timings are provided, convert and use them
  if (branchTimings) {
    return convertBranchTimingsToVisitingHours(branchTimings)
  }

  // Fall back to doctor's general visiting hours
  if (doctor.visitingHours) {
    return doctor.visitingHours
  }

  // Final fallback to default
  return DEFAULT_VISITING_HOURS
}

// Get available time slots for a specific doctor on a specific date
export function getAvailableTimeSlots(
  doctor: Doctor,
  selectedDate: Date,
  existingAppointments: Appointment[],
  branchId?: string | null,
  branchTimings?: BranchTimings | null
): string[] {
  // Check if date is blocked
  if (isDateBlocked(doctor, selectedDate)) {
    return [] // No slots available on blocked dates
  }
  
  // Get visiting hours based on branch (if provided)
  const visitingHours = getVisitingHoursForBranch(doctor, branchId, branchTimings)
  
  // Get the day name
  const dayName = getDayName(selectedDate)
  const daySchedule = visitingHours[dayName]
  
  // Generate all possible slots for this day
  const allSlots = generateTimeSlots(daySchedule)
  
  // Filter appointments for this specific doctor and date (and branch if specified)
  const dateString = selectedDate.toISOString().split('T')[0]
  const appointmentsOnDate = existingAppointments.filter(apt => {
    const matchesDoctor = apt.doctorId === doctor.id
    const matchesDate = apt.appointmentDate === dateString
    const matchesBranch = branchId ? apt.branchId === branchId : true // If branchId provided, filter by branch
    const isConfirmed = apt.status === "confirmed"
    return matchesDoctor && matchesDate && matchesBranch && isConfirmed
  })
  
  // Filter to only available slots
  return allSlots.filter(slot => isTimeSlotAvailable(slot, appointmentsOnDate))
}

// Format time for display (convert 24h to 12h format)
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

// Get summary of doctor availability (which days they're available)
export function getAvailabilityDays(visitingHours: VisitingHours = DEFAULT_VISITING_HOURS): string[] {
  const days: (keyof VisitingHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  
  return days
    .filter(day => visitingHours[day].isAvailable && visitingHours[day].slots.length > 0)
    .map(day => day.charAt(0).toUpperCase() + day.slice(1, 3)) // Mon, Tue, etc.
}

// Check if doctor is available on a specific date
export function isDoctorAvailableOnDate(
  doctor: Doctor, 
  date: Date,
  branchId?: string | null,
  branchTimings?: BranchTimings | null
): boolean {
  const visitingHours = getVisitingHoursForBranch(doctor, branchId, branchTimings)
  const dayName = getDayName(date)
  const daySchedule = visitingHours[dayName]
  
  return daySchedule.isAvailable && daySchedule.slots.length > 0
}

// Get visiting hours text for display
export function getVisitingHoursText(daySchedule: DaySchedule): string {
  if (!daySchedule.isAvailable) return "Closed"
  
  return daySchedule.slots
    .map(slot => `${formatTimeDisplay(slot.start)} - ${formatTimeDisplay(slot.end)}`)
    .join(', ')
}

export function isSlotInPast(slotTime: string, selectedDate: string): boolean {
  const now = new Date()
  const slotDateTime = new Date(`${selectedDate}T${slotTime}:00`)
  return slotDateTime < now
}