"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { calculateAge } from "@/utils/shared/date"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface PatientSummaryBarProps {
  appointment: AppointmentType
}

export default function PatientSummaryBar({ appointment }: PatientSummaryBarProps) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null

  return (
    <div className="sticky top-0 z-10 rounded-t-xl border-b border-blue-100 bg-blue-50/90 backdrop-blur-sm px-4 sm:px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center text-lg font-bold text-blue-800">
            {appointment.patientName?.charAt(0).toUpperCase() || "P"}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {appointment.patientName || "Patient"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {age != null && <span>{age} yrs</span>}
              {age != null && (appointment.patientPhone || appointment.patientGender) && " · "}
              {appointment.patientPhone || appointment.patientGender || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
              appointment.status
            )}`}
          >
            {appointment.status === "confirmed"
              ? "Confirmed"
              : appointment.status === "completed"
              ? "Completed"
              : appointment.status}
          </span>
          <span className="text-sm text-slate-600 font-medium">
            {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            at {appointment.appointmentTime}
          </span>
        </div>
      </div>
      {appointment.chiefComplaint && (
        <p className="mt-3 text-sm text-slate-600 border-t border-blue-100 pt-3">
          <span className="font-medium text-blue-900">Reason for visit: </span>
          {appointment.chiefComplaint}
        </p>
      )}
    </div>
  )
}
