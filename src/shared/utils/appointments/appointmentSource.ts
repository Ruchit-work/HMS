/**
 * Single source of truth helpers for appointment data.
 * Canonical path: hospitals/{hospitalId}/appointments
 */

export const APPOINTMENTS_COLLECTION = "appointments" as const

export function getAppointmentsCollectionPath(hospitalId: string): string {
  return `hospitals/${hospitalId}/${APPOINTMENTS_COLLECTION}`
}

/** Fields every appointment document should carry */
export const REQUIRED_APPOINTMENT_FIELDS = [
  "patientId",
  "doctorId",
  "appointmentDate",
  "appointmentTime",
  "status",
  "paymentStatus",
  "createdBy",
  "createdAt",
  "updatedAt",
  "hospitalId",
] as const

export type AppointmentCreatedBy =
  | "doctor"
  | "receptionist"
  | "patient"
  | "admin"
  | "whatsapp"
  | string

export interface AppointmentBranchFields {
  branchId?: string | null
  createdBy?: AppointmentCreatedBy | null
}

/**
 * Reception visibility rule (hospital-scoped data only):
 * - No branch assignment on receptionist → see all hospital appointments
 * - Matching branch → visible
 * - Unassigned branch (null/undefined/"") → visible (WhatsApp / legacy)
 * - Doctor-created → always visible to reception (payment / front-desk workflow)
 */
export function isAppointmentVisibleToReceptionist(
  appointment: AppointmentBranchFields,
  receptionistBranchId: string | null | undefined
): boolean {
  if (!receptionistBranchId) return true

  const aptBranch = appointment.branchId
  if (aptBranch == null || aptBranch === "") return true
  if (aptBranch === receptionistBranchId) return true

  const createdBy = String(appointment.createdBy || "").toLowerCase()
  if (createdBy === "doctor") return true

  return false
}

export function logAppointmentQuery(meta: {
  module: string
  collection: string
  filters?: Record<string, unknown>
  count?: number
  empty?: boolean
}) {
  if (process.env.NODE_ENV !== "development") return
  const emptyNote = meta.empty || meta.count === 0 ? " (empty)" : ""
  console.info(
    `[appointments] ${meta.module} → ${meta.collection}` +
      `${meta.filters ? ` filters=${JSON.stringify(meta.filters)}` : ""}` +
      `${typeof meta.count === "number" ? ` returned=${meta.count}` : ""}` +
      emptyNote
  )
}

/**
 * Normalize create payload so all modules share the same shape.
 * Does not overwrite existing explicit values.
 */
export function buildCanonicalAppointmentFields(input: {
  patientId: string
  doctorId: string
  appointmentDate: string
  appointmentTime: string
  status?: string
  paymentStatus?: string
  billingStatus?: string
  appointmentType?: string
  createdBy: AppointmentCreatedBy
  hospitalId: string
  branchId?: string | null
  branchName?: string | null
  nowIso?: string
}): Record<string, unknown> {
  const nowIso = input.nowIso || new Date().toISOString()
  return {
    patientId: input.patientId,
    doctorId: input.doctorId,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    status: input.status || "confirmed",
    appointmentType: input.appointmentType || "consultation",
    paymentStatus: input.paymentStatus || "pending",
    billingStatus: input.billingStatus || input.paymentStatus || "pending",
    createdBy: input.createdBy,
    createdAt: nowIso,
    updatedAt: nowIso,
    hospitalId: input.hospitalId,
    branchId: input.branchId ?? null,
    branchName: input.branchName ?? null,
  }
}
