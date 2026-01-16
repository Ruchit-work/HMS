"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface AppointmentsListPaneProps {
  appointments: AppointmentType[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function AppointmentsListPane({
  appointments,
  selectedId,
  onSelect,
}: AppointmentsListPaneProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 shadow-lg overflow-hidden flex flex-col h-full animate-fade-in">
      <div className="px-4 py-3.5 border-b border-slate-200/50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shadow-md animate-slide-up-fade">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Appointments
        </h3>
        <span className="text-[11px] font-bold text-white bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-lg animate-pulse-slow border border-white/30">
          {appointments.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {appointments.map((apt, index) => (
          <button
            key={apt.id}
            type="button"
            onClick={() => onSelect(apt.id)}
            className={`w-full px-4 py-3 text-left text-xs border-b border-slate-100 flex flex-col gap-1 transition-all duration-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50/50 hover:shadow-sm stagger-item ${
              selectedId === apt.id 
                ? "bg-gradient-to-r from-blue-100 to-indigo-100 border-l-4 border-l-blue-500 shadow-md" 
                : "bg-white"
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900 truncate">
                {apt.patientName || "Patient"}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusColor(
                  apt.status
                )}`}
              >
                {apt.status === "confirmed"
                  ? "Confirmed"
                  : apt.status === "completed"
                  ? "Completed"
                  : apt.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate">
                {new Date(apt.appointmentDate).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                })}
                {" · "}
                {apt.appointmentTime}
              </span>
              {apt.chiefComplaint && (
                <span className="ml-2 truncate max-w-[140px]">
                  {apt.chiefComplaint}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

