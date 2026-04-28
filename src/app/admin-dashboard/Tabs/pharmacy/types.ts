export type QueueItem = {
  appointmentId: string
  patientName: string
  doctorName: string
  appointmentDate: string
  branchId?: string
  branchName?: string
  medicineText: string
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  dispensed: boolean
}
