"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { calculateAge } from "@/utils/shared/date"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface PatientSummaryBarProps {
  appointment: AppointmentType
  onOpenDocuments?: () => void
  onOpenConsentVideo?: () => void
  /** When true, show "Returning"; when false, show "New". Omit to hide the tag. */
  isReturningPatient?: boolean
}

function getInitials(name?: string) {
  if (!name) return "P"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
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

function formatStatus(status: string): string {
  if (status === "confirmed") return "Confirmed"
  if (status === "completed") return "Completed"
  if (status === "no_show") return "Skipped"
  if (status === "pending") return "Pending"
  if (status === "cancelled") return "Cancelled"
  return status
}

export default function PatientSummaryBar({
  appointment,
  onOpenDocuments,
  onOpenConsentVideo,
  isReturningPatient,
}: PatientSummaryBarProps) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null
  const showActions = onOpenDocuments != null
  const dateLabel = new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <div className="sticky top-0 z-10 rounded-t-xl border border-slate-200 bg-white shadow-sm px-4 sm:px-6 py-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Patient info */}
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-sky-100 flex items-center justify-center text-lg sm:text-xl font-bold text-sky-800">
            {getInitials(appointment.patientName)}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {appointment.patientName || "Patient"}
            </h2>
            {(appointment.patientPhone || age != null) && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                {appointment.patientPhone ? (
                  <>
                    <PhoneIcon className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>{appointment.patientPhone}</span>
                  </>
                ) : null}
                {appointment.patientPhone && age != null && <span className="text-slate-400">·</span>}
                {age != null && <span>{age} yrs</span>}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {appointment.doctorSpecialization && (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {appointment.doctorSpecialization}
                </span>
              )}
              {isReturningPatient === true && (
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Returning
                </span>
              )}
              {isReturningPatient === false && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  New
                </span>
              )}
              <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 tabular-nums">
                {dateLabel} · {appointment.appointmentTime}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Status + Actions */}
        <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
              appointment.status
            )}`}
          >
            {formatStatus(appointment.status)}
          </span>
          {showActions && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenDocuments}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition"
              >
                <FolderIcon className="w-4 h-4 text-sky-600 shrink-0" />
                Documents &amp; reports
              </button>
              {onOpenConsentVideo && (
                <button
                  type="button"
                  onClick={onOpenConsentVideo}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 hover:border-sky-300 transition"
                >
                  <PlayIcon className="w-4 h-4 text-sky-600 shrink-0" />
                  Consent video
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {appointment.chiefComplaint && (
        <p className="mt-4 pt-4 text-sm text-slate-600 border-t border-slate-100">
          <span className="font-medium text-slate-800">Reason for visit: </span>
          {appointment.chiefComplaint}
        </p>
      )}
    </div>
  )
}
