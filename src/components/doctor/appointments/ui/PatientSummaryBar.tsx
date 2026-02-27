"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { calculateAge } from "@/utils/shared/date"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface PatientSummaryBarProps {
  appointment: AppointmentType
  onOpenDocuments?: () => void
  onOpenConsentVideo?: () => void
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  )
}

export default function PatientSummaryBar({
  appointment,
  onOpenDocuments,
  onOpenConsentVideo,
}: PatientSummaryBarProps) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null
  const showActions = onOpenDocuments != null

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
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
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
          {showActions && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onOpenDocuments}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md shadow-sm hover:shadow transition cursor-pointer"
              >
                <FolderIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                Documents &amp; reports
              </button>
              {onOpenConsentVideo && (
                <button
                  type="button"
                  onClick={onOpenConsentVideo}
                  className="inline-flex items-center gap-1.5 rounded-md border-2 border-blue-200 bg-blue-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer"
                >
                  <PlayIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Consent video
                </button>
              )}
            </div>
          )}
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
