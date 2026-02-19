"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { calculateAge } from "@/utils/shared/date"

interface PatientInfoSectionProps {
  appointment: AppointmentType
}

export default function PatientInfoSection({ appointment }: PatientInfoSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 border-l-blue-500">
      <div className="flex items-center gap-2 min-h-[3.25rem] pb-3 mb-3 border-b border-slate-200">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h4 className="font-semibold text-slate-900 text-sm">Patient information</h4>
      </div>
      <div className="space-y-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
          <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wide">Full name</span>
          <p className="text-slate-900 mt-1 text-sm font-semibold">{appointment.patientName}</p>
        </div>
        {appointment.patientPhone && (
          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
            <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wide">Phone</span>
            <p className="text-slate-900 mt-1 font-medium">{appointment.patientPhone}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {appointment.patientGender && (
            <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
              <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wide">Gender</span>
              <p className="text-slate-900 mt-1 font-medium">{appointment.patientGender}</p>
            </div>
          )}
          {appointment.patientBloodGroup && (
            <div className="rounded-lg bg-red-50 p-2 border border-red-100">
              <span className="text-red-600 text-[10px] font-medium uppercase tracking-wide">Blood group</span>
              <p className="text-red-800 mt-1 font-semibold">{appointment.patientBloodGroup}</p>
            </div>
          )}
          {appointment.patientHeightCm != null && (
            <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
              <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wide">Height</span>
              <p className="text-slate-900 mt-1 font-medium">{appointment.patientHeightCm} cm</p>
            </div>
          )}
          {appointment.patientWeightKg != null && (
            <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
              <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wide">Weight</span>
              <p className="text-slate-900 mt-1 font-medium">{appointment.patientWeightKg} kg</p>
            </div>
          )}
        </div>
        {appointment.patientDateOfBirth && (
          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
            <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wide">Date of birth</span>
            <p className="text-slate-900 mt-1 font-medium">
              {new Date(appointment.patientDateOfBirth).toLocaleDateString()}
              {(() => {
                const age = calculateAge(appointment.patientDateOfBirth)
                return age !== null ? <span className="text-slate-500 ml-1">(Age: {age})</span> : null
              })()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
