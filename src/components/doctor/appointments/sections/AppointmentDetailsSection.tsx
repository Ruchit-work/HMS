"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { getStatusColor } from "@/utils/appointmentHelpers"

interface AppointmentDetailsSectionProps {
  appointment: AppointmentType
}

export default function AppointmentDetailsSection({ appointment }: AppointmentDetailsSectionProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-100/50 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h4 className="font-semibold text-slate-800 text-sm">
          Appointment Details
        </h4>
      </div>
      <div className="space-y-2 text-xs">
        <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/30 rounded-lg p-2 border border-blue-100/50">
          <span className="text-blue-600 text-[10px] font-semibold uppercase tracking-wide">Date</span>
          <p className="text-slate-900 mt-1 font-medium text-xs">{new Date(appointment.appointmentDate).toLocaleDateString('en-US', {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'})}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/30 rounded-lg p-2 border border-blue-100/50">
          <span className="text-blue-600 text-[10px] font-semibold uppercase tracking-wide">Time</span>
          <p className="text-slate-900 mt-1 font-semibold text-sm">{appointment.appointmentTime}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50/50 to-cyan-50/30 rounded-lg p-2 border border-blue-100/50">
          <span className="text-blue-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Status</span>
          <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${getStatusColor(appointment.status)}`}>
            {appointment.status === "confirmed" ? "✓ Confirmed" : 
             appointment.status === "completed" ? "✓ Completed" : 
             appointment.status}
          </span>
        </div>
      </div>
    </div>
  )
}

