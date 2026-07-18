import type { Appointment } from "@/types/patient"
import type { DocumentMetadata } from "@/types/document"
import { parsePrescription as parsePrescriptionUtil } from "@/shared/utils/appointments/prescriptionParsers"

export function getPatientAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export function flattenHistoryDocuments(
  historyDocuments: Record<string, DocumentMetadata[]>
): DocumentMetadata[] {
  const seen = new Set<string>()
  const docs: DocumentMetadata[] = []
  Object.values(historyDocuments).forEach((list) => {
    list.forEach((doc) => {
      if (!seen.has(doc.id)) {
        seen.add(doc.id)
        docs.push(doc)
      }
    })
  })
  return docs.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )
}

export function extractPreviousDiagnoses(
  patientHistory: Appointment[],
  currentAppointmentId: string
): string[] {
  const diagnoses = new Set<string>()
  patientHistory
    .filter((h) => h.id !== currentAppointmentId)
    .forEach((h) => {
      const anyH = h as Appointment & { finalDiagnosis?: string[]; customDiagnosis?: string }
      if (Array.isArray(anyH.finalDiagnosis)) {
        anyH.finalDiagnosis.forEach((d) => d?.trim() && diagnoses.add(d.trim()))
      }
      if (anyH.customDiagnosis?.trim()) diagnoses.add(anyH.customDiagnosis.trim())
    })
  return Array.from(diagnoses)
}

export function extractCurrentMedications(appointment: Appointment): string[] {
  const meds: string[] = []
  if (appointment.patientCurrentMedications?.trim()) {
    appointment.patientCurrentMedications
      .split(/[,;\n]+/)
      .map((m) => m.trim())
      .filter(Boolean)
      .forEach((m) => meds.push(m))
  }
  return meds
}

export function extractMedicationsFromHistory(patientHistory: Appointment[]): string[] {
  const meds = new Set<string>()
  patientHistory.forEach((h) => {
    if (!h.medicine) return
    const parsed = parsePrescriptionUtil(h.medicine)
    if (parsed?.medicines?.length) {
      parsed.medicines.forEach((m) => m.name && meds.add(m.name))
    } else {
      h.medicine
        .split("\n")
        .map((l) => l.replace(/[*#]/g, "").trim())
        .filter((l) => l.length > 2)
        .slice(0, 3)
        .forEach((l) => meds.add(l))
    }
  })
  return Array.from(meds).slice(0, 12)
}

export function buildClinicalTimelineItems(
  patientHistory: Appointment[],
  currentPatientId: string
): Array<{
  id: string
  date: string
  title: string
  subtitle?: string
  description?: string
  status: string
  badges?: string[]
}> {
  return patientHistory
    .filter((h) => h.patientId === currentPatientId)
    .sort((a, b) => {
      const aT = new Date(`${a.appointmentDate} ${a.appointmentTime || "00:00"}`).getTime()
      const bT = new Date(`${b.appointmentDate} ${b.appointmentTime || "00:00"}`).getTime()
      return bT - aT
    })
    .map((h) => {
      const anyH = h as Appointment & { finalDiagnosis?: string[] }
      const diagnosis =
        Array.isArray(anyH.finalDiagnosis) && anyH.finalDiagnosis.length > 0
          ? anyH.finalDiagnosis[0]
          : undefined
      return {
        id: h.id,
        date: new Date(h.appointmentDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        title: h.chiefComplaint || "Consultation",
        subtitle: h.doctorName ? `Dr. ${h.doctorName}` : undefined,
        description: diagnosis,
        status: h.status,
        badges: diagnosis ? [diagnosis] : undefined,
      }
    })
}

export function getEmergencyInfo(appointment: Appointment): Array<{ label: string; value: string; urgent?: boolean }> {
  const items: Array<{ label: string; value: string; urgent?: boolean }> = []

  if (appointment.patientAllergies?.trim()) {
    items.push({ label: "Allergies", value: appointment.patientAllergies, urgent: true })
  }
  if ((appointment.symptomSeverity ?? 0) >= 7) {
    items.push({ label: "Symptom severity", value: `${appointment.symptomSeverity}/10`, urgent: true })
  }
  if (appointment.patientPregnancyStatus?.trim()) {
    items.push({ label: "Pregnancy status", value: appointment.patientPregnancyStatus, urgent: true })
  }
  if (appointment.associatedSymptoms?.trim()) {
    items.push({ label: "Associated symptoms", value: appointment.associatedSymptoms })
  }
  if (appointment.symptomOnset?.trim()) {
    items.push({ label: "Symptom onset", value: appointment.symptomOnset })
  }
  if (appointment.symptomDuration?.trim()) {
    items.push({ label: "Duration", value: appointment.symptomDuration })
  }
  if (appointment.patientFamilyHistory?.trim()) {
    items.push({ label: "Family history", value: appointment.patientFamilyHistory })
  }
  if (appointment.medicalHistory?.trim()) {
    items.push({ label: "Medical history", value: appointment.medicalHistory })
  }

  return items
}

export function getVitalsList(appointment: Appointment): Array<{ label: string; value: string }> {
  const vitals: Array<{ label: string; value: string }> = []
  if (appointment.vitalBloodPressure) vitals.push({ label: "BP", value: appointment.vitalBloodPressure })
  if (appointment.vitalHeartRate) vitals.push({ label: "Pulse", value: `${appointment.vitalHeartRate} bpm` })
  if (appointment.vitalTemperatureC) vitals.push({ label: "Temp", value: `${appointment.vitalTemperatureC}°C` })
  if (appointment.vitalRespiratoryRate) vitals.push({ label: "RR", value: `${appointment.vitalRespiratoryRate}/min` })
  if (appointment.vitalSpO2) vitals.push({ label: "SpO₂", value: `${appointment.vitalSpO2}%` })
  if (appointment.patientWeightKg) vitals.push({ label: "Weight", value: `${appointment.patientWeightKg} kg` })
  if (appointment.patientHeightCm) vitals.push({ label: "Height", value: `${appointment.patientHeightCm} cm` })
  return vitals
}
