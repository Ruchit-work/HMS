"use client"

import type { Appointment } from "@/types/patient"
import ClinicalStatusBadge from "@/components/doctor/clinical/ClinicalStatusBadge"
import { AlertTriangle, ChevronRight, Clock } from "lucide-react"

interface NextPatientBannerProps {
  patient: Appointment | null
  onStart: (id: string) => void
  selectedId?: string | null
}

function getInitials(name?: string) {
  if (!name) return "P"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

export default function NextPatientBanner({
  patient,
  onStart,
  selectedId,
}: NextPatientBannerProps) {
  if (!patient) {
    return (
      <div className="doctor-next-patient doctor-next-patient--empty">
        <p className="text-sm font-medium text-slate-600">No more patients scheduled for today.</p>
        <p className="text-xs text-slate-400 mt-0.5">Review completed visits or upcoming follow-ups.</p>
      </div>
    )
  }

  const isUrgent = (patient.symptomSeverity ?? 0) >= 8
  const isActive = selectedId === patient.id

  return (
    <div className={`doctor-next-patient ${isActive ? "doctor-next-patient--active" : ""}`}>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Next patient</span>
        {isUrgent && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700">
            <AlertTriangle className="w-3 h-3" />
            Urgent
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onStart(patient.id)}
        className="mt-2 w-full flex items-center gap-3 text-left group"
      >
        <div className="w-11 h-11 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center text-sm font-bold shrink-0">
          {getInitials(patient.patientName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900 truncate">{patient.patientName}</p>
            <ClinicalStatusBadge status={patient.status} size="sm" />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
              <Clock className="w-3 h-3" />
              {patient.appointmentTime}
            </span>
            {patient.chiefComplaint && (
              <span className="truncate max-w-[16rem]">{patient.chiefComplaint}</span>
            )}
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white group-hover:bg-teal-700 transition-colors">
          {isActive ? "In consult" : "Open"}
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </button>
    </div>
  )
}
