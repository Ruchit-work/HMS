/**
 * DoctorCard Component
 * Modern card for displaying doctor information
 * Design: Professional, trustworthy with medical theme
 */

import { Doctor } from "@/types/patient"
import { getAvailabilityDays } from "@/utils/timeSlots"

interface DoctorCardProps {
  doctor: Doctor
  onSelect?: () => void
  isSelected?: boolean
}

export default function DoctorCard({ doctor, onSelect, isSelected }: DoctorCardProps) {
  const availableDays = getAvailabilityDays(doctor.visitingHours)
  const daysPreview = availableDays.slice(0, 4)
  const extra = Math.max(0, availableDays.length - daysPreview.length)
  
  return (
    <div
      onClick={onSelect}
      className={`group relative overflow-hidden bg-white border-2 rounded-xl p-4 sm:p-6 transition-all duration-300 ${onSelect ? 'cursor-pointer' : ''} 
        ${isSelected ? 'border-teal-500 bg-teal-50/30 shadow-lg ring-2 ring-teal-200' : 'border-slate-200 hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5'}
      `}
    >
      {/* Doctor Header */}
      <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
        {/* Avatar */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-md ring-2 ring-white flex-shrink-0">
          {doctor.firstName?.[0]}{doctor.lastName?.[0]}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate">
            Dr. {doctor.firstName} {doctor.lastName}
          </h3>
          <p className="inline-block mt-0.5 text-[11px] sm:text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
            {doctor.specialization}
          </p>
          {isSelected && (
            <span className="inline-block mt-1 text-xs bg-teal-500 text-white px-2 py-0.5 rounded-full font-medium">
              ✓ Selected
            </span>
          )}
        </div>
      </div>

      {/* Doctor Details */}
      <div className="space-y-2">
        {doctor.qualification && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">🎓</span>
            <span className="text-slate-600 truncate" title={doctor.qualification}>{doctor.qualification}</span>
          </div>
        )}
        
        {doctor.experience && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">⏱️</span>
            <span className="text-slate-600">{doctor.experience}</span>
          </div>
        )}

        {/* Availability Days */}
        <div className="flex items-start gap-2 text-sm">
          <span className="text-slate-400">📅</span>
          <div className="flex-1">
            <p className="text-[11px] text-slate-500">Available</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {daysPreview.map((d) => (
                <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">{d}</span>
              ))}
              {extra > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500">+{extra} more</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">💰</span>
            <span className="text-lg font-bold text-green-600">₹{doctor.consultationFee}</span>
            <span className="text-xs text-slate-500">per visit</span>
          </div>
          {!!onSelect && !isSelected && (
            <span className="text-[10px] sm:text-xs px-2 py-1 rounded-md bg-teal-600 text-white opacity-0 group-hover:opacity-100 transition-opacity">Select</span>
          )}
        </div>
      </div>
    </div>
  )
}

