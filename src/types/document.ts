export type DocumentType =
  | "laboratory-report"
  | "radiology-report"
  | "cardiology-report"
  | "prescription"
  | "other"

export type DocumentStatus = "active" | "archived" | "deleted"

export interface DocumentMetadata {
  id: string
  patientId: string
  patientUid: string
  hospitalId: string
  fileName: string
  originalFileName: string
  fileType: DocumentType
  mimeType: string
  fileSize: number // in bytes
  storagePath: string // Firebase Storage path
  downloadUrl?: string // Temporary download URL (expires)
  specialty?: string // e.g., "ENT", "Cardiology", "General"
  description?: string
  tags?: string[]
  appointmentId?: string // Linked appointment ID
  doctorId?: string // Doctor ID from the appointment
  doctorName?: string // Doctor name from the appointment
  appointmentDate?: string // Appointment date from the appointment
  patientName?: string // Patient name from the appointment/patient record
  uploadedBy: {
    uid: string
    role: "doctor" | "receptionist" | "patient"
    name: string
  }
  uploadedAt: string // ISO timestamp
  updatedAt?: string // ISO timestamp
  updatedBy?: {
    uid: string
    role: "doctor" | "receptionist"
    name: string
  }
  status: DocumentStatus
  version?: number // For versioning
  previousVersionId?: string // Link to previous version if replaced
  isLinkedToAppointment?: boolean
}

export interface BulkUploadResult {
  success: DocumentMetadata[]
  failed: Array<{
    fileName: string
    error: string
  }>
}
   