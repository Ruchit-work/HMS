export interface PatientConsentMetadata {
  id: string
  patientId: string
  patientUid: string
  patientName?: string
  appointmentId?: string
  hospitalId: string
  storagePath: string
  downloadUrl: string
  fileName: string
  mimeType: string
  fileSize: number
  source: 'recorded' | 'uploaded'
  uploadedBy: {
    uid: string
    role: 'doctor' | 'receptionist'
    name: string
  }
  uploadedAt: string
  durationSeconds?: number
}
