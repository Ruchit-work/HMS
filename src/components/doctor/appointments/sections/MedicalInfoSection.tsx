"use client"

import { Appointment as AppointmentType } from "@/types/patient"

interface MedicalInfoSectionProps {
  appointment: AppointmentType
}

export default function MedicalInfoSection({ appointment }: MedicalInfoSectionProps) {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-100/50 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h4 className="font-semibold text-slate-800 text-sm">
          Medical Information
        </h4>
      </div>
      <div className="space-y-2 text-xs">
        <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
          <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Chief Complaint</span>
          <p className="text-slate-900 font-medium text-xs leading-relaxed">
            {appointment.chiefComplaint || "No chief complaint provided"}
          </p>
        </div>
        {appointment.patientAdditionalConcern && (
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
            <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Additional Details</span>
            <p className="text-slate-900 font-medium text-xs leading-relaxed">
              {appointment.patientAdditionalConcern}
            </p>
          </div>
        )}
        {appointment.medicalHistory && (
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
            <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Medical History</span>
            <p className="text-slate-900 font-medium text-xs leading-relaxed">
              {appointment.medicalHistory}
            </p>
          </div>
        )}
        {appointment.patientAllergies && (
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-2.5 border border-red-300">
            <span className="text-red-700 text-[10px] font-semibold uppercase tracking-wide mb-1 block flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              ALLERGIES - DO NOT PRESCRIBE
            </span>
            <p className="text-red-900 font-semibold text-xs leading-relaxed">
              {appointment.patientAllergies}
            </p>
          </div>
        )}
        {appointment.patientCurrentMedications && (
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
            <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Current Medications</span>
            <p className="text-slate-900 font-medium text-xs leading-relaxed">
              {appointment.patientCurrentMedications}
            </p>
          </div>
        )}
        {appointment.patientFamilyHistory && (
          <div className="bg-gradient-to-br from-purple-50/50 to-pink-50/30 rounded-lg p-2.5 border border-purple-100/50">
            <span className="text-purple-600 text-[10px] font-semibold uppercase tracking-wide mb-1 block">Family History</span>
            <p className="text-slate-900 font-medium text-xs leading-relaxed">
              {appointment.patientFamilyHistory}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

