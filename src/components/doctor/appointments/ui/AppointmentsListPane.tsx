"use client"

import { Appointment as AppointmentType } from "@/types/patient"

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
  if (status === "pending") return "Pending"
  if (status === "cancelled") return "Cancelled"
  return status
}

const STATUS_BADGE_STYLES: Record<string, { container: string; text: string }> = {
  confirmed: {
    container: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
  },
  pending: {
    container: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
  },
  completed: {
    container: "bg-sky-50 border-sky-200",
    text: "text-sky-700",
  },
  no_show: {
    container: "bg-slate-50 border-slate-200",
    text: "text-slate-600",
  },
  cancelled: {
    container: "bg-rose-50 border-rose-200",
    text: "text-rose-700",
  },
}

function getStatusBadgeClasses(status: string) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
  const cfg = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.no_show
  return `${base} ${cfg.container} ${cfg.text}`
}

function getInitials(name?: string) {
  if (!name) return "P"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

export default function AppointmentsListPane({
  appointments,
  selectedId,
  onSelect,
  onSkip,
  skippingId,
}: AppointmentsListPaneProps) {
  return (
    <div className="m-2 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Appointments</h3>
          <span className="text-xs text-slate-500">
            {appointments.length} {appointments.length === 1 ? "item" : "items"}
          </span>
        </div>
      </div>

      {/* List as clean cards */}
      <div className="flex flex-col gap-2.5 p-3">
        {appointments.map((apt) => {
          const isSelected = selectedId === apt.id
          const isSkipping = skippingId === apt.id
          const badgeClasses = getStatusBadgeClasses(apt.status)

          return (
            <div
              key={apt.id}
              className={`group rounded-xl border bg-white px-3.5 py-2.5 flex items-center justify-between gap-3 transition-all duration-150 ${
                isSelected
                  ? "border-blue-300 bg-blue-50/60 shadow-sm"
                  : "border-slate-200 hover:border-blue-200 hover:bg-slate-50/80"
              }`}
            >
              {/* Left: avatar + patient + time + specialization */}
              <button
                type="button"
                onClick={() => onSelect(apt.id)}
                className="flex-1 min-w-0 flex items-center gap-3 text-left"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-semibold">
                  {getInitials(apt.patientName)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate max-w-[9rem] sm:max-w-[11rem]">
                      {apt.patientName || "Patient"}
                    </p>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      {apt.appointmentTime}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 text-xs text-slate-500 truncate max-w-[14rem]"
                    title={apt.doctorSpecialization || undefined}
                  >
                    {apt.doctorSpecialization || "—"}
                  </p>
                </div>
              </button>

              {/* Right: status badge + actions */}
              <div className="flex items-center gap-2">
                <span className={badgeClasses}>{formatStatus(apt.status)}</span>

                {apt.status === "confirmed" && onSkip && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSkip(apt.id)
                    }}
                    disabled={isSkipping}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    aria-label="Skip appointment"
                    title="Skip appointment"
                  >
                    {isSkipping ? (
                      <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 8l4 4-4 4" />
                        <path d="M4 4v16" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
