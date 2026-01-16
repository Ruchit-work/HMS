"use client"

import { Appointment as AppointmentType } from "@/types/patient"

interface AppointmentActionsCardProps {
  appointment: AppointmentType
  updating: boolean
  onStartConsultation: () => void
  onOpenDocuments: () => void
  consultationStarted: boolean
}

export default function AppointmentActionsCard({
  appointment,
  updating,
  onStartConsultation,
  onOpenDocuments,
  consultationStarted,
}: AppointmentActionsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50/20 shadow-sm p-4 space-y-4 transition-all duration-300 hover:shadow-md hover:border-emerald-200 animate-fade-in card-hover">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Appointment
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          · {appointment.appointmentTime}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Status:{" "}
          <span className="font-medium text-slate-900">
            {appointment.status === "confirmed"
              ? "Confirmed"
              : appointment.status === "completed"
              ? "Completed"
              : appointment.status}
          </span>
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onStartConsultation}
          disabled={updating || consultationStarted}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <span>{consultationStarted ? "Consultation in progress" : "Start consultation"}</span>
        </button>
        <button
          type="button"
          onClick={onOpenDocuments}
          className="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 hover:border-blue-400 flex items-center justify-center gap-2 transform transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <span>Documents &amp; reports</span>
        </button>
      </div>
    </div>
  )
}

