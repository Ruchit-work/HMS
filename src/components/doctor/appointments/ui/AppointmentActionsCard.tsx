"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface AppointmentActionsCardProps {
  appointment: AppointmentType
  updating: boolean
  onStartConsultation: () => void
  onOpenDocuments: () => void
  onOpenConsentVideo?: () => void
  consultationStarted: boolean
}

function StethoscopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15a6 6 0 1 0 12 0v-3" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v2 M6 3v2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10a2 2 0 1 0 4 0 2 2 0 1 0 -4 0" />
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

export default function AppointmentActionsCard({
  appointment,
  updating,
  onStartConsultation,
  onOpenDocuments,
  onOpenConsentVideo,
  consultationStarted,
}: AppointmentActionsCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm border-l-4 border-l-teal-500">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
          APPOINTMENT
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          · {appointment.appointmentTime}
        </p>
        <p className="mt-1.5 flex items-center gap-2 text-xs text-slate-600">
          <span>Status:</span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(appointment.status)}`}>
            {appointment.status === "confirmed" ? "Confirmed" : appointment.status === "completed" ? "Completed" : appointment.status}
          </span>
        </p>
      </div>

      <button
        type="button"
        onClick={onStartConsultation}
        disabled={updating || consultationStarted}
        className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
      >
        <StethoscopeIcon className="w-5 h-5 text-white shrink-0" />
        {consultationStarted ? "Consultation in progress" : "Start consultation"}
      </button>

      <div className="flex flex-wrap justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={onOpenDocuments}
          className="inline-flex items-center gap-2 text-sm font-medium 
          text-slate-700 
          bg-white hover:bg-slate-50
          border border-slate-200 
          px-4 py-2 rounded-lg 
          shadow-sm hover:shadow-md
          transition-all duration-200
          cursor-pointer"        >
          <FolderIcon className="w-5 h-5 text-blue-600 shrink-0" />
          Documents &amp; reports
        </button>
        {onOpenConsentVideo && (
          <button
            type="button"
            onClick={onOpenConsentVideo}
            className="inline-flex items-center gap-2 rounded-full border-2 border-blue-200 bg-blue-50/50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
          >
            <PlayIcon className="w-4 h-4 text-blue-600 shrink-0" />
            Consent video
          </button>
        )}
      </div>
    </div>
  )
}
