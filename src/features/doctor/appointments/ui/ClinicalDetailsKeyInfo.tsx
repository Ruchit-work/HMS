"use client"

import { Appointment as AppointmentType } from "@/types/patient"

interface ClinicalDetailsKeyInfoProps {
  appointment: AppointmentType
  lastVisitDate: string | null
}

export default function ClinicalDetailsKeyInfo({
  appointment,
  lastVisitDate,
}: ClinicalDetailsKeyInfoProps) {
  const chiefComplaint = appointment.chiefComplaint?.trim()
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      {chiefComplaint ? (
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            Chief complaint
          </p>
          <p className="text-sm font-medium text-slate-900 leading-snug">
            {chiefComplaint}
          </p>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            Chief complaint
          </p>
          <p className="text-sm text-slate-400 italic">Not provided</p>
        </div>
      )}
      {lastVisitDate && (
        <div className="flex-shrink-0 sm:border-l sm:border-slate-200 sm:pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
            Last visit
          </p>
          <p className="text-sm font-semibold text-slate-800 tabular-nums">
            {lastVisitDate}
          </p>
        </div>
      )}
    </div>
  )
}
