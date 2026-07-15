"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { calculateAge } from "@/utils/shared/date"
import PatientSummaryCard from "@/features/doctor/clinical/PatientSummaryCard"
import { Button } from '@/shared/components'
import { FolderOpen, Play } from "lucide-react"

interface PatientSummaryBarProps {
  appointment: AppointmentType
  onOpenDocuments?: () => void
  onOpenConsentVideo?: () => void
  /** When true, show "Returning"; when false, show "New". Omit to hide the tag. */
  isReturningPatient?: boolean
}

export default function PatientSummaryBar({
  appointment,
  onOpenDocuments,
  onOpenConsentVideo,
  isReturningPatient,
}: PatientSummaryBarProps) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null

  const vitals: Array<{ label: string; value: string }> = []
  if (appointment.vitalBloodPressure) vitals.push({ label: "BP", value: appointment.vitalBloodPressure })
  if (appointment.vitalHeartRate) vitals.push({ label: "Pulse", value: `${appointment.vitalHeartRate} bpm` })
  if (appointment.vitalTemperatureC) vitals.push({ label: "Temp", value: `${appointment.vitalTemperatureC}°C` })
  if (appointment.patientWeightKg) vitals.push({ label: "Weight", value: `${appointment.patientWeightKg} kg` })
  if (appointment.vitalSpO2) vitals.push({ label: "SpO₂", value: `${appointment.vitalSpO2}%` })

  const actions = onOpenDocuments ? (
    <>
      <Button type="button" variant="outline" size="sm" onClick={onOpenDocuments}>
        <FolderOpen className="w-4 h-4" />
        Documents
      </Button>
      {onOpenConsentVideo && (
        <Button type="button" variant="secondary" size="sm" onClick={onOpenConsentVideo}>
          <Play className="w-4 h-4" />
          Consent
        </Button>
      )}
    </>
  ) : undefined

  return (
    <PatientSummaryCard
      patientName={appointment.patientName || "Patient"}
      age={age}
      phone={appointment.patientPhone}
      status={appointment.status}
      chiefComplaint={appointment.chiefComplaint}
      appointmentDate={appointment.appointmentDate}
      appointmentTime={appointment.appointmentTime}
      specialization={appointment.doctorSpecialization}
      isReturningPatient={isReturningPatient}
      vitals={vitals.length > 0 ? vitals : undefined}
      actions={actions}
      sticky
    />
  )
}
