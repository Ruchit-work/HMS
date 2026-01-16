"use client"

import { Doctor } from "@/types/patient"
import DoctorCard from "@/components/ui/layout/DoctorCard"

interface DoctorSelectionStepProps {
  doctors: Doctor[]
  filteredDoctors: Doctor[]
  recommendedDoctors: Doctor[]
  otherDoctors: Doctor[]
  selectedDoctor: string
  selectedSymptomCategory: string | null
  slideDirection: 'right' | 'left'
  onDoctorSelect: (doctorId: string) => void
}

export default function DoctorSelectionStep({
  doctors,
  filteredDoctors,
  recommendedDoctors,
  otherDoctors,
  selectedDoctor,
  selectedSymptomCategory,
  slideDirection,
  onDoctorSelect
}: DoctorSelectionStepProps) {
  const selectedDoctorData = doctors.find(doc => doc.id === selectedDoctor)

  return (
    <div className={`space-y-4 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
      <div className="bg-white border-2 border-teal-200 rounded-xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-xl sm:text-2xl">👨‍⚕️</span>
            <span>Select Your Doctor</span>
          </h3>
          {filteredDoctors.length < doctors.length && (
            <span className="text-[10px] sm:text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Recommended</span>
          )}
        </div>
        
        {/* Recommended Doctors Section */}
        {selectedSymptomCategory && recommendedDoctors.length > 0 && (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm font-semibold text-teal-700">⭐ Recommended for Your Symptoms</span>
              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                {recommendedDoctors.length} {recommendedDoctors.length === 1 ? 'doctor' : 'doctors'}
              </span>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
              {recommendedDoctors.map((doctor) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  isSelected={selectedDoctor === doctor.id}
                  onSelect={() => onDoctorSelect(doctor.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Other Doctors Section */}
        {selectedSymptomCategory && recommendedDoctors.length > 0 && otherDoctors.length > 0 && (
          <>
            <div className="mb-4 flex items-center gap-2 border-t border-slate-200 pt-4">
              <span className="text-sm font-semibold text-slate-600">👨‍⚕️ All Other Doctors</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {otherDoctors.length} {otherDoctors.length === 1 ? 'doctor' : 'doctors'}
              </span>
              <span className="text-xs text-amber-600 font-medium ml-auto">⚠️ Not specifically recommended</span>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {otherDoctors.map((doctor) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  isSelected={selectedDoctor === doctor.id}
                  onSelect={() => onDoctorSelect(doctor.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Show all doctors if no category selected or no recommendations */}
        {(!selectedSymptomCategory || recommendedDoctors.length === 0) && doctors.length > 0 && (
          <>
            {selectedSymptomCategory && recommendedDoctors.length === 0 && (
              <div className="text-center py-4 text-slate-500 mb-4">
                <p className="text-sm font-medium">No matching doctors found for your symptoms</p>
                <p className="text-xs mt-1">Showing all available doctors…</p>
              </div>
            )}
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {doctors.map((doctor) => (
                <DoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  isSelected={selectedDoctor === doctor.id}
                  onSelect={() => onDoctorSelect(doctor.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* No doctors available */}
        {doctors.length === 0 && (
          <div className="text-center py-10 sm:py-12 text-slate-500">
            <span className="text-4xl sm:text-5xl block mb-2 sm:mb-3">👨‍⚕️</span>
            <p className="font-medium">No doctors available</p>
            <p className="text-xs sm:text-sm mt-1">Please contact reception for assistance</p>
          </div>
        )}

        {/* Selection summary pill */}
        {selectedDoctor && selectedDoctorData && (
          <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-3 flex items-center justify-between">
            <p className="text-xs sm:text-sm text-teal-800 font-semibold">
              Selected: {selectedDoctorData.firstName} {selectedDoctorData.lastName} • {selectedDoctorData.specialization}
            </p>
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
              Fee ₹{selectedDoctorData.consultationFee || 500}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

