export const AUDIT_MODULES = [
  "Patient",
  "Appointment",
  "Billing",
  "Admission",
  "Administration",
] as const

export const AUDIT_SOURCES = [
  "Reception Dashboard",
  "Admin Dashboard",
  "Doctor Dashboard",
  "Patient Portal",
  "WhatsApp Assistant",
  "System API",
] as const

export const AUDIT_ACTIONS = {
  PATIENT_CREATED: "Patient Created",
  PATIENT_UPDATED: "Patient Updated",
  APPOINTMENT_CREATED: "Appointment Created",
  APPOINTMENT_RESCHEDULED: "Appointment Rescheduled",
  APPOINTMENT_CANCELLED: "Appointment Cancelled",
  PAYMENT_COLLECTED: "Payment Collected",
  BILL_EDITED: "Bill Edited",
  REFUND_REQUESTED: "Refund Requested",
  REFUND_APPROVED: "Refund Approved",
  ADMISSION_CREATED: "Admission Created",
  ROOM_CHANGED: "Room Changed",
  PATIENT_DISCHARGED: "Patient Discharged",
  BILLING_SETTINGS_CHANGED: "Hospital Billing Settings Changed",
  USER_CREATED: "User Created",
  USER_ROLE_CHANGED: "User Role Changed",
  USER_DISABLED_DELETED: "User Disabled / Deleted",
} as const

export type AuditModule = (typeof AUDIT_MODULES)[number]
export type AuditSource = (typeof AUDIT_SOURCES)[number]
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export interface AuditLogRecord {
  id: string
  hospitalId: string
  branchId: string | null
  module: AuditModule
  entityType: string
  entityId: string
  action: AuditAction
  summary: string
  performedBy: { id: string; name: string; role: string }
  performedByUserId: string
  performedByName: string
  performedByRole: string
  source: AuditSource
  createdAt: string
  metadata: Record<string, unknown>
}
