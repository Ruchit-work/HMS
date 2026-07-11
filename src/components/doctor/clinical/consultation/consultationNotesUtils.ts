import type { CompletionFormEntry } from "@/types/appointments"

const EXAMINATION_MARKER = "\n\n--- Examination findings ---\n"
export const DIAGNOSIS_MARKER = "\n\n--- Diagnosis ---\n"

export function splitConsultationNotes(notes: string): {
  clinicalNotes: string
  examinationFindings: string
} {
  const raw = notes || ""
  const idx = raw.indexOf(EXAMINATION_MARKER)
  if (idx === -1) {
    return { clinicalNotes: raw, examinationFindings: "" }
  }
  return {
    clinicalNotes: raw.slice(0, idx).trimEnd(),
    examinationFindings: raw.slice(idx + EXAMINATION_MARKER.length).trim(),
  }
}

export function mergeConsultationNotes(clinicalNotes: string, examinationFindings: string): string {
  const clinical = clinicalNotes.trim()
  const exam = examinationFindings.trim()
  if (!exam) return clinical
  if (!clinical) return `${EXAMINATION_MARKER.trim()}\n${exam}`
  return `${clinical}${EXAMINATION_MARKER}${exam}`
}

/** True when clinical notes or diagnosis field has content. */
export function hasClinicalDocumentation(entry?: CompletionFormEntry): boolean {
  if (!entry) return false
  return Boolean((entry.notes || "").trim() || (entry.customDiagnosis || "").trim())
}

/**
 * UI-only: fold diagnosis into notes before submit so nothing typed in the Diagnosis
 * field is lost (backend still receives a single notes string).
 */
export function buildSubmissionNotes(entry: CompletionFormEntry): string {
  const { clinicalNotes, examinationFindings } = splitConsultationNotes(entry.notes || "")
  const diagnosis = (entry.customDiagnosis || "").trim()

  let clinical = clinicalNotes
  if (diagnosis && !clinical.includes(diagnosis) && !clinical.includes(DIAGNOSIS_MARKER)) {
    clinical = clinical
      ? `${clinical}${DIAGNOSIS_MARKER}${diagnosis}`
      : `${DIAGNOSIS_MARKER.trim()}\n${diagnosis}`
  }

  return mergeConsultationNotes(clinical, examinationFindings)
}
