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
  
  return (
    <div
      onClick={onSelect}
      className={`
        bg-white border-2 rounded-xl p-6 transition-all duration-300
        ${onSelect ? 'cursor-pointer' : ''}
        ${isSelected 
          ? 'border-teal-500 bg-teal-50/30 shadow-lg ring-2 ring-teal-200' 
          : 'border-slate-200 hover:border-teal-300 hover:shadow-md'
        }
      `}
    >
      {/* Doctor Header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0">
          {doctor.firstName[0]}{doctor.lastName[0]}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-800 truncate">
            Dr. {doctor.firstName} {doctor.lastName}
          </h3>
          <p className="text-sm text-teal-600 font-medium">{doctor.specialization}</p>
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
            <span className="text-slate-600">{doctor.qualification}</span>
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
            <p className="text-xs text-slate-500">Available</p>
            <p className="text-slate-700 font-medium">{availableDays.join(', ')}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-slate-400">💰</span>
          <span className="text-lg font-bold text-green-600">₹{doctor.consultationFee}</span>
          <span className="text-xs text-slate-500">consultation fee</span>
        </div>
      </div>
    </div>
  )
}

