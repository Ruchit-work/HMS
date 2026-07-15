"use client"

import type { Appointment } from "@/types/patient"
import { compareAppointmentsByDateTime } from "@/features/doctor/dashboard/morningClinicUtils"

interface ConsultationQueuePanelProps {
  appointments: Appointment[]
  selectedId: string | null
  onSelect: (id: string) => void
  onSkip?: (id: string) => void
  skippingId?: string | null
}

export default function ConsultationQueuePanel({
  appointments,
  selectedId,
  onSelect,
  onSkip,
  skippingId,
}: ConsultationQueuePanelProps) {
  const confirmed = appointments
    .filter((a) => a.status === "confirmed")
    .sort(compareAppointmentsByDateTime)

  if (confirmed.length === 0) {
    return (
      <div className="consultation-queue-panel">
        <p className="consultation-queue-panel__empty">No patients waiting</p>
      </div>
    )
  }

  return (
    <div className="consultation-queue-panel">
      <p className="consultation-queue-panel__title">
        Queue <span className="text-slate-400">({confirmed.length})</span>
      </p>
      <ul className="consultation-queue-panel__list">
        {confirmed.map((apt, idx) => {
          const isSelected = apt.id === selectedId
          return (
            <li key={apt.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onSelect(apt.id)}
                className={`consultation-queue-panel__item flex-1 ${
                  isSelected ? "consultation-queue-panel__item--active" : ""
                }`}
              >
                <span className="consultation-queue-panel__pos">{idx + 1}</span>
                <span className="consultation-queue-panel__info min-w-0">
                  <span className="consultation-queue-panel__name truncate">
                    {apt.patientName || "Patient"}
                  </span>
                  <span className="consultation-queue-panel__time">{apt.appointmentTime}</span>
                </span>
              </button>
              {onSkip && !isSelected && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSkip(apt.id)
                  }}
                  disabled={skippingId === apt.id}
                  className="consultation-queue-panel__skip"
                  title="Skip patient"
                >
                  Skip
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
