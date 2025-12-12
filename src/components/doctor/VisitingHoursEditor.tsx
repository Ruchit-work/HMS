/**
 * VisitingHoursEditor Component
 * Allows doctors to set their weekly visiting schedule
 * Design: Day-by-day time slot configuration
 */

"use client"

import { VisitingHours } from "@/types/patient"

interface VisitingHoursEditorProps {
  value: VisitingHours
  onChange: (hours: VisitingHours) => void
}

export default function VisitingHoursEditor({ value, onChange }: VisitingHoursEditorProps) {
  // Get next occurrence of each day
  const getNextDateForDay = (dayIndex: number): string => {
    const today = new Date()
    const currentDay = today.getDay()
    const daysUntil = (dayIndex - currentDay + 7) % 7 || 7
    const nextDate = new Date(today)
    nextDate.setDate(today.getDate() + daysUntil)
    return nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const days: { key: keyof VisitingHours; label: string; dayIndex: number }[] = [
    { key: 'monday', label: 'Monday', dayIndex: 1 },
    { key: 'tuesday', label: 'Tuesday', dayIndex: 2 },
    { key: 'wednesday', label: 'Wednesday', dayIndex: 3 },
    { key: 'thursday', label: 'Thursday', dayIndex: 4 },
    { key: 'friday', label: 'Friday', dayIndex: 5 },
    { key: 'saturday', label: 'Saturday', dayIndex: 6 },
    { key: 'sunday', label: 'Sunday', dayIndex: 0 },
  ]

  const toggleDayAvailability = (day: keyof VisitingHours) => {
    const updated = {
      ...value,
      [day]: {
        ...value[day],
        isAvailable: !value[day].isAvailable
      }
    }
    onChange(updated)
  }

  const updateTimeSlot = (day: keyof VisitingHours, slotIndex: number, field: 'start' | 'end', newValue: string) => {
    const daySchedule = value[day]
    const updatedSlots = [...daySchedule.slots]
    updatedSlots[slotIndex] = {
      ...updatedSlots[slotIndex],
      [field]: newValue
    }
    
    const updated = {
      ...value,
      [day]: {
        ...daySchedule,
        slots: updatedSlots
      }
    }
    onChange(updated)
  }

  const addTimeSlot = (day: keyof VisitingHours) => {
    const daySchedule = value[day]
    const updated = {
      ...value,
      [day]: {
        ...daySchedule,
        slots: [...daySchedule.slots, { start: "09:00", end: "17:00" }]
      }
    }
    onChange(updated)
  }

  const removeTimeSlot = (day: keyof VisitingHours, slotIndex: number) => {
    const daySchedule = value[day]
    const updated = {
      ...value,
      [day]: {
        ...daySchedule,
        slots: daySchedule.slots.filter((_, index) => index !== slotIndex)
      }
    }
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
        <p className="text-xs text-blue-800 font-medium flex items-center gap-2">
          <span>ℹ️</span>
          <span>Lunch break (1-2 PM) recommended. Each appointment: 15 min.</span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {days.map((day) => {
          const schedule = value[day.key]
          return (
            <div key={day.key} className="bg-white border border-slate-200 rounded-lg p-3 hover:border-teal-300 transition-all">
              {/* Day Header - Compact */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule.isAvailable}
                      onChange={() => toggleDayAvailability(day.key)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{day.label}</h3>
                    <p className="text-xs text-slate-500">Next: {getNextDateForDay(day.dayIndex)}</p>
                  </div>
                </div>
                
                {schedule.isAvailable && (
                  <button
                    type="button"
                    onClick={() => addTimeSlot(day.key)}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 px-2 py-1 border border-teal-300 rounded hover:bg-teal-50 transition-colors"
                  >
                    + Slot
                  </button>
                )}
              </div>

              {/* Time Slots - Compact */}
              {schedule.isAvailable ? (
                schedule.slots.length > 0 ? (
                  <div className="space-y-2">
                    {schedule.slots.map((slot, index) => (
                      <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded">
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) => updateTimeSlot(day.key, index, 'start', e.target.value)}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <span className="text-slate-400">→</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) => updateTimeSlot(day.key, index, 'end', e.target.value)}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        {schedule.slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTimeSlot(day.key, index)}
                            className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">Click "+ Slot"</p>
                )
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">Closed</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

