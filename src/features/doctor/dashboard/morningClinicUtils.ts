import type { Appointment } from "@/types/patient"

const EMERGENCY_KEYWORDS = [
  "emergency",
  "severe",
  "chest pain",
  "breathing",
  "unconscious",
  "bleeding",
  "stroke",
  "heart attack",
  "critical",
  "acute",
]

const REPORT_KEYWORDS = [
  "report",
  "lab",
  "radiology",
  "x-ray",
  "xray",
  "mri",
  "ct scan",
  "ultrasound",
  "pathology",
  "result",
  "investigation",
]

const FOLLOW_UP_KEYWORDS = ["re-checkup", "recheckup", "follow-up", "follow up", "revisit"]

export function isToday(dateStr: string) {
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

export function compareAppointmentsByDateTime(a: Appointment, b: Appointment) {
  const dateA = new Date(`${a.appointmentDate} ${a.appointmentTime}`).getTime()
  const dateB = new Date(`${b.appointmentDate} ${b.appointmentTime}`).getTime()
  return dateA - dateB
}

export function getAppointmentTimestamp(apt: Appointment) {
  return new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime()
}

function matchesKeywords(text: string, keywords: string[]) {
  const normalized = text.toLowerCase()
  return keywords.some((keyword) => normalized.includes(keyword))
}

function getSearchableText(apt: Appointment) {
  return [
    apt.chiefComplaint,
    apt.associatedSymptoms,
    apt.patientAdditionalConcern,
    apt.medicalHistory,
  ]
    .filter(Boolean)
    .join(" ")
}

export function isEmergencyCase(apt: Appointment) {
  if (apt.status === "completed" || apt.status === "cancelled") return false
  if ((apt.symptomSeverity ?? 0) >= 8) return true
  return matchesKeywords(getSearchableText(apt), EMERGENCY_KEYWORDS)
}

export function isFollowUpAppointment(apt: Appointment) {
  return matchesKeywords(apt.chiefComplaint || "", FOLLOW_UP_KEYWORDS)
}

export function isReportRelatedAppointment(apt: Appointment) {
  if (apt.status === "cancelled") return false
  return matchesKeywords(getSearchableText(apt), REPORT_KEYWORDS)
}

export interface MorningClinicSnapshot {
  confirmedToday: Appointment[]
  waitingQueue: Appointment[]
  nextPatient: Appointment | null
  pendingConsultations: Appointment[]
  followUps: Appointment[]
  pendingReports: Appointment[]
  emergencyCases: Appointment[]
  waitingCount: number
  pendingCount: number
  followUpCount: number
  reportsCount: number
  emergencyCount: number
}

export function buildMorningClinicSnapshot(appointments: Appointment[]): MorningClinicSnapshot {
  const now = Date.now()

  const confirmedToday = appointments
    .filter((apt) => isToday(apt.appointmentDate) && apt.status === "confirmed")
    .sort(compareAppointmentsByDateTime)

  const waitingQueue = confirmedToday.filter((apt) => getAppointmentTimestamp(apt) <= now)

  const nextPatient =
    confirmedToday.find((apt) => getAppointmentTimestamp(apt) >= now) ??
    confirmedToday.find((apt) => getAppointmentTimestamp(apt) < now) ??
    null

  const pendingConsultations = confirmedToday

  const followUps = appointments
    .filter(
      (apt) =>
        (apt.status === "confirmed" || apt.status === "pending") &&
        isFollowUpAppointment(apt) &&
        getAppointmentTimestamp(apt) >= now - 24 * 60 * 60 * 1000
    )
    .sort(compareAppointmentsByDateTime)

  const pendingReports = appointments
    .filter(
      (apt) =>
        (apt.status === "confirmed" || apt.status === "pending") && isReportRelatedAppointment(apt)
    )
    .sort(compareAppointmentsByDateTime)

  const emergencyCases = appointments.filter((apt) => isToday(apt.appointmentDate) && isEmergencyCase(apt))

  return {
    confirmedToday,
    waitingQueue,
    nextPatient,
    pendingConsultations,
    followUps,
    pendingReports,
    emergencyCases,
    waitingCount: waitingQueue.length,
    pendingCount: pendingConsultations.length,
    followUpCount: followUps.length,
    reportsCount: pendingReports.length,
    emergencyCount: emergencyCases.length,
  }
}
