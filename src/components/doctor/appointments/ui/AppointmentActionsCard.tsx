"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface AppointmentActionsCardProps {
  appointment: AppointmentType
  updating: boolean
  onOpenDocuments: () => void
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

export default function AppointmentActionsCard({
  appointment,
  updating,
  onOpenDocuments,
  onOpenConsentVideo,
}: AppointmentActionsCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-sm border-l-4 border-l-teal-500">
      <div className="flex flex-wrap items-center gap-1.5 text-xs pb-2 border-b border-slate-200">
        <span className="font-medium uppercase tracking-wider text-slate-500">APPOINTMENT</span>
        <span className="text-slate-400" aria-hidden>·</span>
        <span className="font-semibold text-slate-900">
          {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          · {appointment.appointmentTime}
        </span>
        <span className="text-slate-400" aria-hidden>·</span>
        <span className="text-slate-600">Status:</span>
        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-medium ${getStatusColor(appointment.status)}`}>
          {appointment.status === "confirmed" ? "Confirmed" : appointment.status === "completed" ? "Completed" : appointment.status}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOpenDocuments}
          className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
        >
          <FolderIcon className="w-4 h-4 text-blue-600 shrink-0" />
          Documents &amp; reports
        </button>
        {onOpenConsentVideo && (
          <button
            type="button"
            onClick={onOpenConsentVideo}
            className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg border-2 border-blue-200 bg-blue-50/50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
          >
            <PlayIcon className="w-4 h-4 text-blue-600 shrink-0" />
            Consent video
          </button>
        )}
      </div>
    </div>
  )
}
