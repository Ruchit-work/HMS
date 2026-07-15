"use client"

import React from "react"
import { Appointment as AppointmentType } from "@/types/patient"
import ClinicalStatusBadge from "@/features/doctor/clinical/ClinicalStatusBadge"
import { isFollowUpAppointment } from "@/features/doctor/dashboard/morningClinicUtils"
import { AlertTriangle, ChevronRight, RotateCcw } from "lucide-react"

interface AppointmentsListPaneProps {
  appointments: AppointmentType[]
  selectedId: string | null
  onSelect: (id: string) => void
  onSkip?: (id: string) => void
  skippingId?: string | null
  showSkipActions?: boolean
}

function getInitials(name?: string) {
  if (!name) return "P"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

function formatVisitDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export default function AppointmentsListPane({
  appointments,
  selectedId,
  onSelect,
  onSkip,
  skippingId,
  showSkipActions = false,
}: AppointmentsListPaneProps) {
  const now = Date.now()

  return (
    <div className="doctor-appointment-queue flex flex-col w-full">
      <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Appointment list</h3>
          <span className="text-[11px] text-slate-400 tabular-nums">{appointments.length}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-2.5">
        {appointments.map((apt) => {
          const isSelected = selectedId === apt.id
          const isSkipping = skippingId === apt.id
          const ts = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime()
          const isPast = apt.status === "confirmed" && ts < now
          const isFollowUp = isFollowUpAppointment(apt)
          const isUrgent = (apt.symptomSeverity ?? 0) >= 8

          return (
            <article
              key={apt.id}
              className={`group doctor-appointment-card ${isSelected ? "doctor-appointment-card--selected" : ""} ${
                isPast ? "doctor-appointment-card--past" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(apt.id)}
                className="w-full text-left p-3 flex gap-3 min-w-0"
              >
                <div className="shrink-0 flex flex-col items-center w-12">
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{apt.appointmentTime}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{formatVisitDate(apt.appointmentDate)}</span>
                </div>

                <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(apt.patientName)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-900 truncate">{apt.patientName || "Patient"}</p>
                    <ClinicalStatusBadge status={apt.status} size="sm" showDot={false} />
                    {isFollowUp && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                        <RotateCcw className="w-2.5 h-2.5" />
                        Follow-up
                      </span>
                    )}
                    {isUrgent && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-700">
                        <AlertTriangle className="w-3 h-3" />
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 line-clamp-1">
                    {apt.chiefComplaint?.trim() || apt.doctorSpecialization || "General consultation"}
                  </p>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 self-center" />
              </button>

              {showSkipActions && apt.status === "confirmed" && onSkip && (
                <div className="px-3 pb-2 flex justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSkip(apt.id)
                    }}
                    disabled={isSkipping}
                    className="text-[10px] font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  >
                    {isSkipping ? "Skipping…" : "Skip"}
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
