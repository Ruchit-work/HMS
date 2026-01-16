"use client"

import React from 'react'
import { Appointment as AppointmentType } from "@/types/patient"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface AppointmentCardHeaderProps {
  appointment: AppointmentType
  isExpanded: boolean
  onToggle: () => void
}

export default function AppointmentCardHeader({
  appointment,
  isExpanded,
  onToggle,
}: AppointmentCardHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left p-3 sm:p-4 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100/80 hover:to-white transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Patient Avatar */}
        <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-gradient-to-br from-indigo-100 via-sky-100 to-cyan-100 text-indigo-700 font-semibold text-lg flex items-center justify-center shadow-sm">
          {appointment.patientName.charAt(0).toUpperCase()}
        </div>

        {/* Patient Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {appointment.patientName}
            </h3>
            {appointment.patientGender && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                {appointment.patientGender}
              </span>
            )}
            {appointment.patientBloodGroup && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-red-50 text-red-700 border border-red-200 font-semibold">
                {appointment.patientBloodGroup}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              {new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="inline-flex items-center gap-1">
              {appointment.appointmentTime}
            </span>
            {appointment.patientPhone && (
              <span className="inline-flex items-center gap-1">
                {appointment.patientPhone}
              </span>
            )}
          </div>
        </div>

        {/* Status / Chevron */}
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(appointment.status)}`}
          >
            {appointment.status === "confirmed" ? "✓ Confirmed" : 
             appointment.status === "completed" ? "✓ Completed" : 
             appointment.status}
          </span>
          <div className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
            <span className="text-slate-600 text-sm">▼</span>
          </div>
        </div>
      </div>
    </button>
  )
}

