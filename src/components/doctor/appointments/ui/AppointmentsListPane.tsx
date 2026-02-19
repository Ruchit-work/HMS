"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface AppointmentsListPaneProps {
  appointments: AppointmentType[]
  selectedId: string | null
  onSelect: (id: string) => void
  onSkip?: (id: string) => void
  skippingId?: string | null
}

function formatStatus(status: string): string {
  if (status === "confirmed") return "Confirmed"
  if (status === "completed") return "Completed"
  if (status === "no_show") return "Skipped"
  return status
}

export default function AppointmentsListPane({
  appointments,
  selectedId,
  onSelect,
  onSkip,
  skippingId,
}: AppointmentsListPaneProps) {
  return (
    <div className="m-2 rounded-lg border border-slate-200 bg-white p-0 shadow-sm flex flex-col w-full">
      {/* Compact header */}
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Appointments</h3>
          <span className="text-xs text-slate-500">
            {appointments.length} {appointments.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>

      {/* List: subtle separators, no scroll, height auto */}
      <div className="flex flex-col p-2">
        {appointments.map((apt) => {
          const isSelected = selectedId === apt.id
          const isSkipping = skippingId === apt.id
          return (
            <div
              key={apt.id}
              className={`
                w-full flex items-center gap-2 px-3 py-2 border-b border-slate-100 last:border-b-0
                transition-colors
                ${isSelected
                  ? "bg-slate-100 border-l-4 border-l-blue-600 rounded-l"
                  : "bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent"}
              `}
            >
              <button
                type="button"
                onClick={() => onSelect(apt.id)}
                className="flex-1 min-w-0 flex items-center gap-2 text-left"
              >
                {/* 1. Patient name — primary */}
                <span className="font-semibold text-slate-900 text-sm truncate shrink min-w-0 max-w-[100px] sm:max-w-[120px]">
                  {apt.patientName || "Patient"}
                </span>
                {/* 2. Time — secondary */}
                <span className="text-xs text-slate-600 tabular-nums shrink-0">
                  {apt.appointmentTime}
                </span>
                {/* 3. Visit type — tertiary (more space so "Family Medicine Specialist" etc. readable) */}
                <span
                  className="text-xs text-slate-500 min-w-0 max-w-[10rem] sm:max-w-[13rem] truncate"
                  title={apt.doctorSpecialization || undefined}
                >
                  {apt.doctorSpecialization || "—"}
                </span>
              </button>
              {/* Status and action inline, close to content */}
              <span
                className={`shrink-0 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide border ${getStatusColor(apt.status)}`}
              >
                {formatStatus(apt.status)}
              </span>
              {apt.status === "confirmed" && onSkip && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSkip(apt.id)
                  }}
                  disabled={isSkipping}
                  className="shrink-0 py-1 px-2 rounded border border-slate-300 bg-white text-slate-600 text-[10px] font-medium hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSkipping ? "…" : "Skip"}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
