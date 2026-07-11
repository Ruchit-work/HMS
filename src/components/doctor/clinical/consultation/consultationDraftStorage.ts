import type { CompletionFormEntry } from "@/types/appointments"

const PREFIX = "hms_consultation_draft_"

export function saveConsultationDraft(appointmentId: string, data: CompletionFormEntry): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(
      `${PREFIX}${appointmentId}`,
      JSON.stringify({ data, savedAt: Date.now() })
    )
  } catch {
    // sessionStorage full or unavailable
  }
}

export function loadConsultationDraft(appointmentId: string): CompletionFormEntry | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${appointmentId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data?: CompletionFormEntry }
    return parsed.data ?? null
  } catch {
    return null
  }
}

export function clearConsultationDraft(appointmentId: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(`${PREFIX}${appointmentId}`)
  } catch {
    // ignore
  }
}
