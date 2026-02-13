export type TabKey = "today" | "tomorrow" | "thisWeek" | "nextWeek" | "history"

export type CompletionFormEntry = {
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  notes: string
  recheckupRequired: boolean
  recheckupNote?: string
  /** Days after which to auto-book recheckup (calendar days; Sundays are skipped when computing date). */
  recheckupDays?: number
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

