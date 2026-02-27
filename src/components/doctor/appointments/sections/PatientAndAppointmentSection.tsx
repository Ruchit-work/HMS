"use client"

import { Appointment as AppointmentType } from "@/types/patient"

interface PatientAndAppointmentSectionProps {
  appointment: AppointmentType
  updating?: boolean
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

export default function PatientAndAppointmentSection({
  appointment,
  onOpenDocuments,
  onOpenConsentVideo,
}: PatientAndAppointmentSectionProps) {
  const showActions = onOpenDocuments != null

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm border-l-4 border-l-blue-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: name + phone */}
        <div className="flex flex-col gap-0.5 text-sm min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500 shrink-0">Name:</span>
            <span className="font-medium text-slate-900 truncate">{appointment.patientName}</span>
          </div>
          {appointment.patientPhone && (
            <div className="flex items-baseline gap-2">
              <span className="text-slate-500 shrink-0">Phone:</span>
              <span className="font-medium text-slate-900">{appointment.patientPhone}</span>
            </div>
          )}
        </div>

        {/* Right: buttons */}
        {showActions && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenDocuments}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-md shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <FolderIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              Documents &amp; reports
            </button>
            {onOpenConsentVideo && (
              <button
                type="button"
                onClick={onOpenConsentVideo}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border-2 border-blue-200 bg-blue-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
              >
                <PlayIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                Consent video
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
