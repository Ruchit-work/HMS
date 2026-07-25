export type PharmacyQueueStatus = 'pending' | 'dispensed' | 'removed' | 'expired'

export type QueueItem = {
  appointmentId: string
  patientName: string
  patientId?: string | null
  patientUid?: string | null
  doctorName: string
  department?: string
  appointmentDate: string
  prescriptionTime?: string
  branchId?: string
  branchName?: string
  medicineText: string
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  medicineCount?: number
  dispensed: boolean
  queueStatus?: PharmacyQueueStatus
}
