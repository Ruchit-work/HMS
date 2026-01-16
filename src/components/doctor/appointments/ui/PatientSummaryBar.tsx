"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { calculateAge } from "@/utils/shared/date"

interface PatientSummaryBarProps {
  appointment: AppointmentType
}

export default function PatientSummaryBar({ appointment }: PatientSummaryBarProps) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null

  return (
    <div className="sticky top-0 z-10 border-b border-slate-200/50 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 backdrop-blur-md shadow-xl px-4 py-4 flex items-center justify-between gap-4 animate-slide-up-fade">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-sm flex items-center justify-center text-base font-bold text-white shadow-2xl border-2 border-white/30 transform transition-all duration-300 hover:scale-110 hover:rotate-12 animate-breathe">
          {appointment.patientName?.charAt(0).toUpperCase() || "P"}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate drop-shadow-md">
            {appointment.patientName || "Patient"}
          </div>
          <div className="mt-0.5 text-xs text-white/90 truncate flex items-center gap-1">
            {age !== null && (
              <>
                <span>{age}y</span>
                <span className="text-white/60">·</span>
              </>
            )}
            <span>{appointment.patientPhone || appointment.patientGender || "—"}</span>
          </div>
        </div>
      </div>
      <div className="hidden md:flex flex-col items-end gap-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold shadow-lg border border-white/30 backdrop-blur-sm bg-white/20 text-white animate-badge-pulse`}
          >
            {appointment.status === "confirmed"
              ? "Confirmed"
              : appointment.status === "completed"
              ? "Completed"
              : appointment.status}
          </span>
          <span className="text-white/90 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            <span className="text-white/70">·</span> {appointment.appointmentTime}
          </span>
        </div>
        {appointment.chiefComplaint && (
          <p className="max-w-md text-[11px] text-white/80 line-clamp-1 flex items-center gap-1">
            <svg className="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {appointment.chiefComplaint}
          </p>
        )}
      </div>
    </div>
  )
}

