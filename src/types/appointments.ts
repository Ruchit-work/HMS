export type TabKey = "today" | "tomorrow" | "thisWeek" | "nextWeek" | "history"

export type CompletionFormEntry = {
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  notes: string
  recheckupRequired: boolean
  recheckupNote?: string
  finalDiagnosis?: string[]
  customDiagnosis?: string
}

export interface UserData {
  id: string
  name: string
  firstName?: string
  email: string
  role: string
  specialization?: string
}

export const hasValidPrescriptionInput = (entry?: CompletionFormEntry) =>
  Boolean(entry?.medicines?.some((med) => med.name && med.name.trim()))

