"use client"

import React from 'react'
import { Appointment as AppointmentType } from '@/types/patient'
import { getStatusColor } from '@/utils/appointmentHelpers'

interface AppointmentCardProps {
  appointment: AppointmentType
  isExpanded: boolean
  onToggle: () => void
  children?: React.ReactNode
}

export default function AppointmentCard({
  appointment,
  isExpanded,
  onToggle,
  children,
}: AppointmentCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
        aria-expanded={isExpanded}
        aria-controls={`appointment-details-${appointment.id}`}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-lg font-semibold text-gray-700">
            {appointment.patientName.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-gray-900 truncate">
                {appointment.patientName}
              </h3>
              {appointment.patientGender && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {appointment.patientGender}
                </span>
              )}
              {appointment.patientBloodGroup && (
                <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
                  {appointment.patientBloodGroup}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
              <span>{new Date(appointment.appointmentDate).toLocaleDateString()}</span>
              <span>{appointment.appointmentTime}</span>
              {appointment.patientPhone && <span>{appointment.patientPhone}</span>}
            </div>
            {appointment.chiefComplaint && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-1">
                {appointment.chiefComplaint}
              </p>
            )}
          </div>

          {/* Status & Chevron */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(appointment.status)}`}>
              {appointment.status === 'confirmed' ? 'Confirmed' : appointment.status === 'completed' ? 'Completed' : appointment.status}
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          id={`appointment-details-${appointment.id}`}
          className="border-t border-gray-200 p-6 bg-gray-50"
        >
          {children}
        </div>
      )}
    </div>
  )
}

