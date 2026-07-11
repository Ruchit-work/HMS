"use client"

import type { Appointment } from "@/types/patient"
import { compareAppointmentsByDateTime } from "@/components/doctor/dashboard/morningClinicUtils"

interface AppointmentScheduleRailProps {
  appointments: Appointment[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function AppointmentScheduleRail({
  appointments,
  selectedId,
  onSelect,
}: AppointmentScheduleRailProps) {
  const sorted = [...appointments].sort(compareAppointmentsByDateTime)
  if (sorted.length === 0) return null

  const now = Date.now()

  return (
    <div className="appointment-schedule-rail">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
        Today&apos;s schedule
      </p>
      <div className="appointment-schedule-rail__track">
        {sorted.map((apt) => {
          const ts = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime()
          const isPast = ts < now
          const isSelected = selectedId === apt.id
          const isNow = Math.abs(ts - now) < 30 * 60 * 1000

          return (
            <button
              key={apt.id}
              type="button"
              onClick={() => onSelect(apt.id)}
              className={`appointment-schedule-rail__slot ${
                isSelected ? "appointment-schedule-rail__slot--selected" : ""
              } ${isPast ? "appointment-schedule-rail__slot--past" : ""} ${
                isNow ? "appointment-schedule-rail__slot--now" : ""
              }`}
              title={`${apt.patientName} · ${apt.appointmentTime}`}
            >
              <span className="appointment-schedule-rail__time">{apt.appointmentTime}</span>
              <span className="appointment-schedule-rail__name truncate">
                {(apt.patientName || "Patient").split(" ")[0]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
