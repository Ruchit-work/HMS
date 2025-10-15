/**
 * Time Slot Utility Functions
 * Handles visiting hours, slot generation, and availability checking
 */

import { VisitingHours, DaySchedule, TimeSlot, Appointment, Doctor } from "@/types/patient"

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

// Convert time string to minutes since midnight
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
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
  
  const slots: string[] = []
  const SLOT_DURATION = 15 // minutes
  
  daySchedule.slots.forEach(timeSlot => {
    const startMinutes = timeToMinutes(timeSlot.start)
    const endMinutes = timeToMinutes(timeSlot.end)
    
    for (let minutes = startMinutes; minutes < endMinutes; minutes += SLOT_DURATION) {
      slots.push(minutesToTime(minutes))
    }
  })
  
  return slots
}

// Check if a time slot is available
export function isTimeSlotAvailable(
  slotTime: string,
  existingAppointments: Appointment[]
): boolean {
  const slotMinutes = timeToMinutes(slotTime)
  const SLOT_DURATION = 15 // minutes
  
  // Check if any existing appointment conflicts with this slot
  return !existingAppointments.some(apt => {
    const aptMinutes = timeToMinutes(apt.appointmentTime)
    
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
  return doctor.blockedDates.some(blocked => blocked.date === dateString)
}

// Get blocked date info if date is blocked
export function getBlockedDateInfo(doctor: Doctor, date: Date): { reason: string } | null {
  if (!doctor.blockedDates) return null
  
  const dateString = date.toISOString().split('T')[0]
  const blocked = doctor.blockedDates.find(b => b.date === dateString)
  return blocked ? { reason: blocked.reason } : null
}

// Get available time slots for a specific doctor on a specific date
export function getAvailableTimeSlots(
  doctor: Doctor,
  selectedDate: Date,
  existingAppointments: Appointment[]
): string[] {
  // Check if date is blocked
  if (isDateBlocked(doctor, selectedDate)) {
    return [] // No slots available on blocked dates
  }
  
  // Get doctor's visiting hours (or use default)
  const visitingHours = doctor.visitingHours || DEFAULT_VISITING_HOURS
  
  // Get the day name
  const dayName = getDayName(selectedDate)
  const daySchedule = visitingHours[dayName]
  
  // Generate all possible slots for this day
  const allSlots = generateTimeSlots(daySchedule)
  
  // Filter appointments for this specific doctor and date
  const dateString = selectedDate.toISOString().split('T')[0]
  const appointmentsOnDate = existingAppointments.filter(apt => 
    apt.doctorId === doctor.id && 
    apt.appointmentDate === dateString &&
    apt.status === "confirmed" // Only consider confirmed appointments
  )
  
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
export function isDoctorAvailableOnDate(doctor: Doctor, date: Date): boolean {
  const visitingHours = doctor.visitingHours || DEFAULT_VISITING_HOURS
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

/**
 * Check if a time slot is in the past
 * @param slotTime - Time in "HH:MM" format (e.g., "09:30")
 * @param selectedDate - Date string in "YYYY-MM-DD" format
 * @returns true if slot is in the past, false otherwise
 */
export function isSlotInPast(slotTime: string, selectedDate: string): boolean {
  const now = new Date()
  const slotDateTime = new Date(`${selectedDate}T${slotTime}:00`)
  return slotDateTime < now
}