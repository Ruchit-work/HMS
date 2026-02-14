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

export default function AppointmentsListPane({
  appointments,
  selectedId,
  onSelect,
  onSkip,
  skippingId,
}: AppointmentsListPaneProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-full shadow-sm">
      <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/80">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-blue-900">Appointments</h3>
          <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
            {appointments.length} {appointments.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {appointments.map((apt) => {
          const isSelected = selectedId === apt.id
          const isSkipping = skippingId === apt.id
          return (
            <div
              key={apt.id}
              className={`w-full px-4 py-3.5 border-b border-slate-100 transition-colors last:border-b-0 ${
                isSelected
                  ? "bg-blue-50 border-l-4 border-l-blue-600"
                  : "bg-white hover:bg-slate-50 border-l-4 border-l-transparent"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(apt.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-900 truncate block">
                    {apt.patientName || "Patient"}
                  </span>
                  <span
                    className={`flex-shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${getStatusColor(
                      apt.status
                    )}`}
                  >
                    {apt.status === "confirmed" ? "Confirmed" : apt.status === "completed" ? "Completed" : apt.status === "no_show" ? "Skipped" : apt.status}
                  </span>
                </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                <span>
                  {new Date(apt.appointmentDate).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span aria-hidden>·</span>
                <span>{apt.appointmentTime}</span>
              </div>
              {apt.chiefComplaint && (
                <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                  {apt.chiefComplaint}
                </p>
              )}
              </button>
              {apt.status === "confirmed" && onSkip && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSkip(apt.id)
                    }}
                    disabled={isSkipping}
                    className="py-1 px-2 rounded border border-amber-300 bg-amber-50 text-amber-800 text-[10px] font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSkipping ? "Skipping…" : "Skip"}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
