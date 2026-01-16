"use client"

import { Doctor, AppointmentFormData } from "@/types/patient"
import { Branch } from "@/types/branch"
import { formatTimeDisplay, isDoctorAvailableOnDate, getDayName, getVisitingHoursText } from "@/utils/timeSlots"
import { isDateBlocked as isDateBlockedFromRaw } from "@/utils/analytics/blockedDates"

interface DateTimeSelectionStepProps {
  appointmentData: AppointmentFormData
  selectedDoctorData: Doctor | undefined
  selectedBranchId: string
  selectedBranch: Branch | null
  availableTimeSlots: string[]
  bookedTimeSlots: string[]
  allTimeSlots: string[]
  pastTimeSlots: string[]
  loadingSlots: boolean
  hasDuplicateAppointment: boolean
  duplicateAppointmentTime: string
  slideDirection: 'right' | 'left'
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
}

export default function DateTimeSelectionStep({
  appointmentData,
  selectedDoctorData,
  selectedBranchId,
  selectedBranch,
  availableTimeSlots,
  bookedTimeSlots,
  allTimeSlots,
  pastTimeSlots,
  loadingSlots,
  hasDuplicateAppointment,
  duplicateAppointmentTime,
  slideDirection,
  onDateChange,
  onTimeChange
}: DateTimeSelectionStepProps) {
  if (!selectedDoctorData) return null

  return (
    <div className={`space-y-4 ${slideDirection === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}>
      <div className="bg-white border-2 border-purple-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">📅</span>
          <span>Choose Date & Time</span>
        </h3>
        
        {/* Date Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Appointment Date <span className="text-red-500">*</span>
          </label>
          <input 
            type="date" 
            name="appointmentDate"
            value={appointmentData.date}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            required
          />
          
          {appointmentData.date && selectedDoctorData && (
            <>
              {/* Check if date is blocked */}
              {(() => {
                const blockedDates: any[] = Array.isArray((selectedDoctorData as any)?.blockedDates) ? (selectedDoctorData as any).blockedDates : []
                const isBlocked = isDateBlockedFromRaw(appointmentData.date, blockedDates)
                const isNotAvailableOnDay = !isDoctorAvailableOnDate(
                  selectedDoctorData, 
                  new Date(appointmentData.date),
                  selectedBranchId,
                  selectedBranch?.timings || null
                )
                
                if (isBlocked) {
                  const blockedDateInfo = blockedDates.find((bd: any) => {
                    const normalizedDate = bd?.date ? String(bd.date).slice(0, 10) : ""
                    return normalizedDate === appointmentData.date
                  })
                  const reason = blockedDateInfo?.reason || "Doctor is not available"
                  
                  return (
                    <div className="mt-2 text-sm bg-red-50 border-l-4 border-red-400 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-red-800 mb-1">Date Not Available</p>
                          <p className="text-red-700 text-xs mb-2">{reason}</p>
                          <p className="text-red-600 text-xs">Please select another date to continue booking.</p>
                        </div>
                      </div>
                    </div>
                  )
                }
                
                if (isNotAvailableOnDay) {
                  return (
                    <div className="mt-2 text-sm bg-amber-50 border-l-4 border-amber-400 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-amber-800 mb-1">Doctor Not Available on This Day</p>
                          <p className="text-amber-700 text-xs">
                            The doctor does not have visiting hours on {new Date(appointmentData.date).toLocaleDateString('en-US', { weekday: 'long' })}. Please select another date.
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                }
                
                return null
              })()}
            </>
          )}
        </div>

        {/* Time Slots Selection */}
        {appointmentData.date && selectedDoctorData && (() => {
          const blockedDates: any[] = Array.isArray((selectedDoctorData as any)?.blockedDates) ? (selectedDoctorData as any).blockedDates : []
          const isBlocked = isDateBlockedFromRaw(appointmentData.date, blockedDates)
          const isAvailableOnDay = isDoctorAvailableOnDate(
            selectedDoctorData, 
            new Date(appointmentData.date),
            selectedBranchId,
            selectedBranch?.timings || null
          )
          return isAvailableOnDay && !isBlocked
        })() && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Available Time Slots <span className="text-red-500">*</span>
              <span className="text-xs text-slate-500 ml-2">(15 min per appointment)</span>
            </label>
            {hasDuplicateAppointment && (
              <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-xl p-5 shadow-lg animate-shake-fade-in">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">⚠️</div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-red-800 mb-2">Appointment Already Exists!</h4>
                    <p className="text-sm text-red-700 mb-2">
                      You already have an appointment with <strong>Dr. {selectedDoctorData?.firstName} {selectedDoctorData?.lastName}</strong> on{' '}
                      <strong>{new Date(appointmentData.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}</strong> at{' '}
                      <strong className="text-red-900">{formatTimeDisplay(duplicateAppointmentTime)}</strong>
                    </p>
                    <div className="bg-white/60 rounded-lg p-3 mt-3 border border-red-200">
                      <p className="text-xs text-red-800 font-semibold mb-1">💡 What you can do:</p>
                      <ul className="text-xs text-red-700 space-y-1 ml-4 list-disc">
                        <li>Select a <strong>different date</strong></li>
                        <li>Select a <strong>different doctor</strong></li>
                        <li>Cancel your existing appointment and rebook</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Doctor's visiting hours for selected day */}
            {selectedDoctorData.visitingHours && (
              <div className="mb-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
                <p className="text-xs text-slate-600 font-medium">
                  Doctor's hours on {new Date(appointmentData.date).toLocaleDateString('en-US', { weekday: 'long' })}:
                </p>
                <p className="text-sm text-slate-800 font-semibold mt-1">
                  {getVisitingHoursText(selectedDoctorData.visitingHours[getDayName(new Date(appointmentData.date))])}
                </p>
              </div>
            )}

            {loadingSlots ? (
              <div className="text-center py-8">
                <svg className="animate-spin h-8 w-8 mx-auto text-purple-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-sm text-slate-500 mt-2">Checking availability...</p>
              </div>
            ) : hasDuplicateAppointment ? (
              <div className="text-center py-8 bg-red-50 rounded-lg border-2 border-red-200">
                <span className="text-4xl block mb-2">🚫</span>
                <p className="text-sm text-red-600 font-bold">Time slots hidden</p>
                <p className="text-xs text-red-500 mt-1">Please resolve the duplicate appointment above</p>
              </div>
            ) : allTimeSlots.length > 0 ? (
              <>
                {/* Availability Legend */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-emerald-200 border border-emerald-300"></div>
                    <span className="text-[11px] sm:text-xs text-slate-600">Available ({availableTimeSlots.length})</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-rose-200 border border-rose-300"></div>
                    <span className="text-[11px] sm:text-xs text-slate-600">Booked ({bookedTimeSlots.length})</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-gray-200 border border-gray-300"></div>
                    <span className="text-[11px] sm:text-xs text-slate-600">Past ({pastTimeSlots.length})</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-purple-500 border border-purple-600"></div>
                    <span className="text-[11px] sm:text-xs text-slate-600">Your Selection</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {allTimeSlots.map((slot) => {
                    const isBooked = bookedTimeSlots.includes(slot)
                    const isAvailable = availableTimeSlots.includes(slot)
                    const isPast = pastTimeSlots.includes(slot)
                    const isSelected = appointmentData.time === slot

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          if (isAvailable && !isPast) {
                            onTimeChange(slot)
                          }
                        }}
                        disabled={isBooked || isPast}
                        className={`
                          px-2 py-2 sm:px-3 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all
                          ${isSelected
                            ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300 transform scale-105'
                            : isPast
                            ? 'bg-gray-100 border-2 border-gray-300 text-gray-400 cursor-not-allowed opacity-60'
                            : isBooked
                            ? 'bg-rose-50 border-2 border-rose-300 text-rose-600 cursor-not-allowed opacity-70'
                            : 'bg-emerald-50 border-2 border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-sm cursor-pointer'
                          }
                        `}
                      >
                        {formatTimeDisplay(slot)}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-lg">
                <span className="text-4xl block mb-2">📅</span>
                <p className="text-sm text-slate-600 font-medium">No slots available</p>
                <p className="text-xs text-slate-500 mt-1">Doctor is not available on this day</p>
              </div>
            )}
          </div>
        )}

        {/* Selected Appointment Summary */}
        {appointmentData.date && appointmentData.time && (
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-xl p-4 animate-fade-in">
            <p className="text-xs text-purple-700 font-semibold mb-2">✓ Appointment Confirmed</p>
            <p className="text-lg font-bold text-slate-800">
              {new Date(appointmentData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {formatTimeDisplay(appointmentData.time)}
            </p>
            <p className="text-xs text-slate-600 mt-2">Duration: 15 minutes</p>
          </div>
        )}
      </div>
    </div>
  )
}

