"use client"

import type { Appointment } from "@/types/patient"
import { calculateAge } from "@/utils/shared/date"
import { getVitalsList } from "@/components/doctor/clinical/patientClinicalUtils"
import { AlertTriangle, ChevronLeft } from "lucide-react"

interface ConsultationStickyPatientBarProps {
  appointment: Appointment
  queuePosition?: { current: number; total: number }
  onBackToQueue: () => void
}

export default function ConsultationStickyPatientBar({
  appointment,
  queuePosition,
  onBackToQueue,
}: ConsultationStickyPatientBarProps) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null
  const vitals = getVitalsList(appointment).slice(0, 3)
  const hasAllergies = Boolean(appointment.patientAllergies?.trim())

  return (
    <header className="consultation-sticky-patient-bar">
      <div className="consultation-sticky-patient-bar__row">
        <button
          type="button"
          onClick={onBackToQueue}
          className="consultation-sticky-patient-bar__back"
          title="Back to queue (Esc)"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Queue</span>
        </button>

        <div className="consultation-sticky-patient-bar__identity min-w-0">
          <span className="consultation-sticky-patient-bar__name truncate">
            {appointment.patientName || "Patient"}
          </span>
          <span className="consultation-sticky-patient-bar__meta hidden sm:inline">
            {age != null && <span>{age} yrs</span>}
            {appointment.patientGender && <span>{appointment.patientGender}</span>}
            {appointment.appointmentTime && <span>{appointment.appointmentTime}</span>}
          </span>
        </div>

        {hasAllergies && (
          <div
            className="consultation-sticky-patient-bar__allergy hidden md:flex"
            title={appointment.patientAllergies || undefined}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[10rem] lg:max-w-xs">{appointment.patientAllergies}</span>
          </div>
        )}

        {appointment.chiefComplaint?.trim() && (
          <p className="consultation-sticky-patient-bar__complaint hidden lg:block truncate">
            {appointment.chiefComplaint}
          </p>
        )}

        {vitals.length > 0 && (
          <div className="consultation-sticky-patient-bar__vitals hidden xl:flex">
            {vitals.map((v) => (
              <span key={v.label} className="consultation-sticky-patient-bar__vital">
                <span className="text-slate-400">{v.label}</span> {v.value}
              </span>
            ))}
          </div>
        )}

        {queuePosition && (
          <span className="consultation-sticky-patient-bar__queue-pos shrink-0">
            {queuePosition.current}/{queuePosition.total}
          </span>
        )}
      </div>

      {hasAllergies && (
        <div className="consultation-sticky-patient-bar__allergy consultation-sticky-patient-bar__allergy--mobile md:hidden">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="line-clamp-1">{appointment.patientAllergies}</span>
        </div>
      )}
    </header>
  )
}
