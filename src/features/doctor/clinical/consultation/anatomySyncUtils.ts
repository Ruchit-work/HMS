import type { CompletionFormEntry } from "@/types/appointments"
import type { AnatomyViewerData } from "@/features/doctor/anatomy/InlineAnatomyViewer"
import { mergeMedicines } from "@/shared/utils/prescriptionWorkspace"
import { mergeConsultationNotes, splitConsultationNotes } from "./consultationNotesUtils"

function appendUniqueLine(existing: string, line: string): string {
  const trimmed = line.trim()
  if (!trimmed) return existing
  if (existing.includes(trimmed)) return existing
  return existing ? `${existing}\n${trimmed}` : trimmed
}

function appendUniqueToken(existing: string, token: string, separator = "; "): string {
  const trimmed = token.trim()
  if (!trimmed) return existing
  if (existing.split(separator).some((part) => part.trim() === trimmed)) return existing
  return existing ? `${existing}${separator}${trimmed}` : trimmed
}

/** UI-only merge: anatomy selection updates diagnosis & findings in existing completion data. */
export function syncAnatomySelectionToCompletion(
  current: CompletionFormEntry,
  data: AnatomyViewerData
): CompletionFormEntry {
  const { clinicalNotes, examinationFindings } = splitConsultationNotes(current.notes || "")

  let customDiagnosis = current.customDiagnosis || ""
  let exam = examinationFindings

  if (data.selectedPartInfo?.name) {
    const partLine = data.selectedPartInfo.description
      ? `${data.selectedPartInfo.name} — ${data.selectedPartInfo.description}`
      : data.selectedPartInfo.name
    exam = appendUniqueLine(exam, partLine)
  }

  if (data.selectedDisease?.name) {
    customDiagnosis = appendUniqueToken(customDiagnosis, data.selectedDisease.name)
    if (data.selectedDisease.description) {
      exam = appendUniqueLine(exam, `${data.selectedDisease.name}: ${data.selectedDisease.description}`)
    }
  }

  data.diagnoses?.forEach((diag) => {
    if (diag?.trim()) {
      customDiagnosis = appendUniqueToken(customDiagnosis, diag.trim())
    }
  })

  if (data.customDiagnosis?.trim()) {
    customDiagnosis = appendUniqueToken(customDiagnosis, data.customDiagnosis.trim())
  }

  const medicines =
    data.medicines?.length && data.medicines.some((m) => m.name?.trim())
      ? mergeMedicines(current.medicines || [], data.medicines)
      : current.medicines

  return {
    ...current,
    customDiagnosis,
    notes: mergeConsultationNotes(clinicalNotes, exam),
    medicines,
  }
}
