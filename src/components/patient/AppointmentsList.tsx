"use client"

import { useState } from "react"
import { Appointment } from "@/types/patient"
import AppointmentCard from "./AppointmentCard"

interface AppointmentsListProps {
  appointments: Appointment[]
  onCancelAppointment: (appointment: Appointment) => void
  onPayBill?: (appointment: Appointment) => void
}

export default function AppointmentsList({
  appointments,
  onCancelAppointment,
  onPayBill
}: AppointmentsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl">
        <span className="text-5xl block mb-3 text-slate-300">📅</span>
        <p className="text-slate-600 font-medium">No appointments found</p>
        <p className="text-sm text-slate-400 mt-1">Your appointments will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {appointments.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          isExpanded={expandedId === appointment.id}
          onToggle={() => setExpandedId(expandedId === appointment.id ? null : appointment.id)}
          onCancel={() => onCancelAppointment(appointment)}
          onPayBill={onPayBill ? () => onPayBill(appointment) : undefined}
        />
      ))}
    </div>
  )
}

