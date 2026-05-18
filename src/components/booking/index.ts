/**
 * Shared booking utilities used by patient and receptionist flows.
 * Patient UI: BookAppointmentForm + /patient-dashboard/book-appointment
 * Receptionist UI: BookAppointmentPanel (patient search, payment, desk workflow)
 */
export { checkAppointmentSlot, assertAppointmentSlotAvailable } from '@/utils/booking/checkAppointmentSlot'
export type { SlotCheckResult } from '@/utils/booking/checkAppointmentSlot'
