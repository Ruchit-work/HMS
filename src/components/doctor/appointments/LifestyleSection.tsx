"use client"

import { Appointment as AppointmentType } from "@/types/patient"

interface LifestyleSectionProps {
  appointment: AppointmentType
}

export default function LifestyleSection({ appointment }: LifestyleSectionProps) {
  if (!appointment.patientDrinkingHabits && !appointment.patientSmokingHabits && !appointment.patientVegetarian) {
    return null
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-100/50 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center text-white shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h4 className="font-semibold text-slate-800 text-sm">
          Lifestyle
        </h4>
      </div>
      <div className="space-y-2 text-xs">
        {appointment.patientDrinkingHabits && (
          <div className="bg-gradient-to-r from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50 flex items-center justify-between">
            <span className="text-emerald-700 font-medium text-xs">Drinking</span>
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 px-2 py-1 rounded-full text-white font-semibold capitalize text-[10px]">
              {appointment.patientDrinkingHabits}
            </span>
          </div>
        )}
        {appointment.patientSmokingHabits && (
          <div className="bg-gradient-to-r from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50 flex items-center justify-between">
            <span className="text-emerald-700 font-medium text-xs">Smoking</span>
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 px-2 py-1 rounded-full text-white font-semibold capitalize text-[10px]">
              {appointment.patientSmokingHabits}
            </span>
          </div>
        )}
        {appointment.patientOccupation && (
          <div className="bg-gradient-to-r from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50 flex items-center justify-between">
            <span className="text-emerald-700 font-medium text-xs">Occupation</span>
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 px-2 py-1 rounded-full text-white font-semibold text-[10px]">
              {appointment.patientOccupation}
            </span>
          </div>
        )}
        {appointment.patientVegetarian && (
          <div className="bg-gradient-to-r from-emerald-50/50 to-cyan-50/30 rounded-lg p-2 border border-emerald-100/50 flex items-center justify-between">
            <span className="text-emerald-700 font-medium text-xs">Diet</span>
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 px-2 py-1 rounded-full text-white font-semibold capitalize text-[10px]">
              {appointment.patientVegetarian}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

