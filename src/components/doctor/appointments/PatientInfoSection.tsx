"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { calculateAge } from "@/utils/date"

interface PatientInfoSectionProps {
  appointment: AppointmentType
}

export default function PatientInfoSection({ appointment }: PatientInfoSectionProps) {
  return (
    <div>
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-100/50 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-white shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h4 className="font-semibold text-slate-800 text-sm">
            Patient Information
          </h4>
        </div>
        <div className="space-y-2 text-xs">
          <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
            <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">
              Patient ID
            </span>
            <p className="font-mono text-slate-800 mt-1 text-xs font-medium break-all">
              {appointment.patientId || "—"}
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
            <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Full Name</span>
            <p className="text-slate-900 mt-1 text-sm font-semibold">{appointment.patientName}</p>
          </div>

          {appointment.patientPhone && (
            <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
              <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Phone</span>
              <p className="text-slate-900 mt-1 font-medium text-xs">{appointment.patientPhone}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {appointment.patientGender && (
              <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50">
                <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Gender</span>
                <p className="text-slate-900 mt-1 font-medium text-xs">{appointment.patientGender}</p>
              </div>
            )}
            {appointment.patientBloodGroup && (
              <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-2 border border-red-200">
                <span className="text-red-600 text-[10px] font-semibold uppercase tracking-wide">Blood Group</span>
                <p className="text-red-700 mt-1 font-semibold text-xs">{appointment.patientBloodGroup}</p>
              </div>
            )}
            {appointment.patientHeightCm != null && (
              <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50">
                <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Height</span>
                <p className="text-slate-900 mt-1 font-medium text-xs">{appointment.patientHeightCm} cm</p>
              </div>
            )}
            {appointment.patientWeightKg != null && (
              <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50">
                <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Weight</span>
                <p className="text-slate-900 mt-1 font-medium text-xs">{appointment.patientWeightKg} kg</p>
              </div>
            )}
          </div>
          {appointment.patientDateOfBirth && (
            <div className="bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 rounded-lg p-2.5 border border-emerald-100/50">
              <span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wide">Date of Birth</span>
              <p className="text-slate-900 mt-1 text-xs font-medium">
                {new Date(appointment.patientDateOfBirth).toLocaleDateString()}
                <span className="text-emerald-600 text-xs ml-1.5">
                  {(() => {
                    const age = calculateAge(appointment.patientDateOfBirth)
                    return age !== null ? `(Age: ${age})` : '(N/A)'
                  })()}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

