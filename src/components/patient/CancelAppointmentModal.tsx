"use client"

import { Appointment } from "@/types/patient"

interface CancelAppointmentModalProps {
  appointment: Appointment | null
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  cancelling: boolean
  getHoursUntilAppointment: (appointment: Appointment) => number
}

export default function CancelAppointmentModal({
  appointment,
  isOpen,
  onClose,
  onConfirm,
  cancelling,
  getHoursUntilAppointment
}: CancelAppointmentModalProps) {
  if (!isOpen || !appointment) return null

  const hoursUntil = getHoursUntilAppointment(appointment)
  const CANCELLATION_FEE = 100
  const refundAmount = hoursUntil >= 10 ? appointment.paymentAmount : appointment.paymentAmount - CANCELLATION_FEE

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-xl font-semibold text-slate-800">Cancel Appointment</h2>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Appointment Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Doctor:</strong> Dr. {appointment.doctorName}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Date:</strong> {new Date(appointment.appointmentDate).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Time:</strong> {appointment.appointmentTime}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Amount Paid:</strong> ₹{appointment.paymentAmount}
            </p>
          </div>

          {/* Cancellation Policy Info */}
          <div className={`rounded-lg p-4 mb-4 ${
            hoursUntil >= 10 
              ? "bg-green-50 border border-green-200" 
              : "bg-yellow-50 border border-yellow-200"
          }`}>
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>ℹ️</span>
              <span>Cancellation Policy</span>
            </h3>
            <div className="text-sm text-gray-700 space-y-2">
              {hoursUntil >= 10 ? (
                <>
                  <p className="font-semibold text-green-700">✅ Full Refund (100%)</p>
                  <p>You are cancelling more than 10 hours before your appointment.</p>
                  <div className="bg-white rounded p-2 mt-2">
                    <p className="text-gray-900"><strong>Refund Amount:</strong> ₹{appointment.paymentAmount}</p>
                    <p className="text-xs text-gray-600 mt-1">Full amount will be refunded to your account</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-semibold text-yellow-700">⚠️ Cancellation Fee: ₹100</p>
                  <p>You are cancelling less than 10 hours before your appointment.</p>
                  <div className="bg-white rounded p-2 mt-2 space-y-1">
                    <p className="text-gray-900"><strong>Original Amount Paid:</strong> ₹{appointment.paymentAmount}</p>
                    <p className="text-gray-900"><strong>Cancellation Fee:</strong> <span className="text-red-600 font-bold">-₹{CANCELLATION_FEE}</span></p>
                    <p className="text-gray-900 pt-1 border-t"><strong>Refund Amount:</strong> <span className="text-green-600 font-bold">₹{refundAmount}</span></p>
                  </div>
                  {appointment.paymentAmount <= CANCELLATION_FEE ? (
                    <p className="text-xs text-orange-600 font-semibold mt-2 bg-orange-50 p-2 rounded border border-orange-200">
                      ⚠️ Your paid amount (₹{appointment.paymentAmount}) equals/covers the cancellation fee. No refund will be issued.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Confirmation Message */}
          <p className="text-gray-700 mb-6 text-center font-medium">
            Are you sure you want to cancel this appointment?
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              disabled={cancelling}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? "Cancelling..." : "Confirm Cancellation"}
            </button>
            <button
              onClick={onClose}
              disabled={cancelling}
              className="flex-1 px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all font-medium text-slate-700"
            >
              Keep Appointment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

