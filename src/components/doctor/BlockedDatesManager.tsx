"use client"

import { useState } from "react"
import { BlockedDate } from "@/types/patient"

interface BlockedDatesManagerProps {
  blockedDates: BlockedDate[]
  onChange: (dates: BlockedDate[]) => void
}

export default function BlockedDatesManager({ blockedDates, onChange }: BlockedDatesManagerProps) {
  const [useRange, setUseRange] = useState(false)
  const [newDate, setNewDate] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [newReason, setNewReason] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)

  const handleAddBlockedDate = () => {
    if (useRange) {
      // Handle date range
      if (!startDate || !endDate || !newReason.trim()) return
      
      if (new Date(startDate) > new Date(endDate)) {
        alert("Start date must be before or equal to end date")
        return
      }

      // Generate all dates in the range
      const start = new Date(startDate)
      const end = new Date(endDate)
      const newBlockedDates: BlockedDate[] = []
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0]
        // Check if date is not already blocked
        if (!blockedDates.some(d => d.date === dateStr)) {
          newBlockedDates.push({
            date: dateStr,
            reason: newReason.trim(),
            createdAt: new Date().toISOString()
          })
        }
      }

      onChange([...blockedDates, ...newBlockedDates])
      setStartDate("")
      setEndDate("")
      setNewReason("")
      setShowAddForm(false)
    } else {
      // Handle single date
      if (!newDate || !newReason.trim()) return

      const blocked: BlockedDate = {
        date: newDate,
        reason: newReason.trim(),
        createdAt: new Date().toISOString()
      }

      onChange([...blockedDates, blocked])
      setNewDate("")
      setNewReason("")
      setShowAddForm(false)
    }
  }

  const handleRemoveBlockedDate = (dateToRemove: string) => {
    onChange(blockedDates.filter(d => d.date !== dateToRemove))
  }

  // Sort blocked dates by date
  const sortedBlockedDates = [...blockedDates].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Separate upcoming and past blocked dates
  const today = new Date().toISOString().split('T')[0]
  const upcomingBlocked = sortedBlockedDates.filter(d => d.date >= today)
  const pastBlocked = sortedBlockedDates.filter(d => d.date < today)

  return (
    <div className="space-y-4">
      {/* Add Button */}
      <div>
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white py-3 px-4 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <span>🚫</span>
            <span>Block Specific Dates</span>
          </button>
        ) : (
          <div className="bg-white border-2 border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span>🚫</span>
              <span>Block Date(s)</span>
            </h4>
            
            <div className="space-y-3">
              {/* Toggle between single date and date range */}
              <div className="flex gap-2 bg-slate-50 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setUseRange(false)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all ${
                    !useRange 
                      ? 'bg-white text-red-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Single Date
                </button>
                <button
                  type="button"
                  onClick={() => setUseRange(true)}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-all ${
                    useRange 
                      ? 'bg-white text-red-600 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Date Range
                </button>
              </div>

              {/* Single Date Input */}
              {!useRange && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Select Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}

              {/* Date Range Inputs */}
              {useRange && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      From Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      To Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              )}

              {/* Duration Display for Range */}
              {useRange && startDate && endDate && new Date(startDate) <= new Date(endDate) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800">
                  <span className="font-semibold">
                    Duration: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select reason...</option>
                  <option value="Vacation">Vacation</option>
                  <option value="Personal Leave">Personal Leave</option>
                  <option value="Medical Leave">Medical Leave</option>
                  <option value="Conference/Training">Conference/Training</option>
                  <option value="Public Holiday">Public Holiday</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddBlockedDate}
                  disabled={useRange ? (!startDate || !endDate || !newReason) : (!newDate || !newReason)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {useRange ? 'Block Date Range' : 'Block Date'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setUseRange(false)
                    setNewDate("")
                    setStartDate("")
                    setEndDate("")
                    setNewReason("")
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Blocked Dates */}
      {upcomingBlocked.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span>📅</span>
            <span>Upcoming Blocked Dates ({upcomingBlocked.length})</span>
          </h4>
          
          <div className="space-y-2">
            {upcomingBlocked.map((blocked) => (
              <div key={blocked.date} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 text-sm">
                    {new Date(blocked.date + 'T00:00:00').toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-xs text-red-700 mt-1 flex items-center gap-1">
                    <span>🚫</span>
                    <span>{blocked.reason}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBlockedDate(blocked.date)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-100 p-2 rounded-lg transition-colors"
                  title="Unblock this date"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Blocked Dates (Collapsed) */}
      {pastBlocked.length > 0 && (
        <details className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-800">
            Past Blocked Dates ({pastBlocked.length}) - Click to expand
          </summary>
          <div className="mt-3 space-y-2">
            {pastBlocked.slice(0, 5).map((blocked) => (
              <div key={blocked.date} className="flex items-center justify-between text-xs text-slate-500 p-2 bg-white rounded">
                <span>{new Date(blocked.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span>{blocked.reason}</span>
              </div>
            ))}
            {pastBlocked.length > 5 && (
              <p className="text-xs text-slate-400 text-center">...and {pastBlocked.length - 5} more</p>
            )}
          </div>
        </details>
      )}

      {/* Empty State */}
      {blockedDates.length === 0 && !showAddForm && (
        <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-3xl block mb-2">📅</span>
          <p className="text-sm text-slate-600 font-medium">No blocked dates</p>
          <p className="text-xs text-slate-400 mt-1">Click "Block Specific Dates" to add unavailable dates</p>
        </div>
      )}
    </div>
  )
}

