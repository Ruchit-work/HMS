import { formatDate } from "@/shared/utils/shared/date"
import type { Appointment } from "@/types/patient"

export type PatientVisitHistoryItem = Partial<Appointment> & {
  id: string
  department?: string
  billingAmount?: number
}

export interface PatientVisitHistoryDetails {
  total: number
  upcoming: number
  appointments?: PatientVisitHistoryItem[]
}

export function normalizeVisitStatus(status?: string): string {
  const value = String(status || "").toLowerCase()
  if (value === "whatsapp_pending") return "pending"
  if (value === "in_consultation") return "confirmed"
  return value || "pending"
}

export function getVisitStatusLabel(status?: string): string {
  const value = String(status || "").toLowerCase()
  if (value === "whatsapp_pending") return "Pending"
  if (value === "in_consultation") return "In Consultation"
  if (value === "pending") return "Scheduled"
  if (value === "confirmed") return "Confirmed"
  if (value === "completed") return "Completed"
  if (value === "waiting") return "Waiting"
  if (value === "doctor_cancelled") return "Cancelled"
  if (value === "no_show") return "Not Attended"
  if (value === "not_attended") return "Not Attended"
  return status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"
}

export function getPaymentStatusLabel(status?: string): string {
  const value = String(status || "").toLowerCase()
  if (value === "refunded") return "Refunded"
  if (value === "paid") return "Paid"
  if (value === "partial") return "Partial"
  return "Pending"
}

export function getPaymentStatusClasses(label: string): string {
  if (label === "Paid") return "bg-emerald-50 text-emerald-800 border-emerald-200"
  if (label === "Refunded") return "bg-amber-50 text-amber-800 border-amber-200"
  if (label === "Partial") return "bg-cyan-50 text-cyan-800 border-cyan-200"
  return "bg-slate-100 text-slate-600 border-slate-200"
}

export function formatBillingAmount(amount?: number): string {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0
  return `₹${value.toLocaleString("en-IN")}`
}

export function getVisitType(visit: Record<string, unknown>): string {
  if (visit.whatsappPending) return "WhatsApp"
  if (visit.createdBy === "receptionist") return "Walk-in"
  return "Online"
}

export function getAppointmentType(visit: Record<string, unknown>): string {
  const type = String(visit.appointmentType || "")
  if (type === "follow_up" || type === "follow-up") return "Follow-up"
  if (type === "emergency") return "Emergency"
  return type ? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "New Patient"
}

export function formatVisitDateTime(appointmentDate?: string, appointmentTime?: string): string {
  return [
    appointmentDate ? formatDate(appointmentDate) : "Date TBD",
    appointmentTime || "",
  ]
    .filter(Boolean)
    .join(" · ")
}

export function getPrimaryDiagnosis(visit: {
  finalDiagnosis?: string[]
  customDiagnosis?: string
}): string {
  const parts = [
    ...(Array.isArray(visit.finalDiagnosis) ? visit.finalDiagnosis : []),
    visit.customDiagnosis || "",
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "—"
}

export function resolveBillingAmount(visit: Record<string, unknown>): number {
  if (typeof visit.paymentAmount === "number") return visit.paymentAmount
  if (typeof visit.totalConsultationFee === "number") return visit.totalConsultationFee
  if (typeof visit.consultationFee === "number") return visit.consultationFee
  return 0
}

export function hasText(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "boolean") return true
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function displayValue(value: unknown): string {
  if (value == null || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—"
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—"
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}
