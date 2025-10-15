"use client"

import { Appointment } from "@/types/patient"
import { generatePrescriptionPDF } from "@/utils/prescriptionPDF"
import { generateAppointmentConfirmationPDF } from "@/utils/appointmentConfirmationPDF"

interface AppointmentCardProps {
  appointment: Appointment
  isExpanded: boolean
  onToggle: () => void
  onCancel: () => void
}

export default function AppointmentCard({
  appointment,
  isExpanded,
  onToggle,
  onCancel
}: AppointmentCardProps) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition-all">
      {/* Accordion Header */}
      <div 
        onClick={onToggle}
        className={`flex items-center justify-between p-4 cursor-pointer transition-all ${
          appointment.status === "confirmed"
            ? "bg-teal-50 hover:bg-teal-100/50" 
            : appointment.status === "completed"
            ? "bg-slate-50 hover:bg-slate-100"
            : "bg-red-50/50 hover:bg-red-100/50"
        }`}
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Arrow Icon */}
          <span className="text-slate-400 text-lg transition-transform duration-200" style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
          }}>
            ▶
          </span>

          {/* Appointment Info */}
          <div className="flex-1">
            <h3 className="font-medium text-slate-800 mb-1">
              Dr. {appointment.doctorName}
            </h3>
            <p className="text-sm text-slate-500">
              {new Date(appointment.appointmentDate).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })} at {appointment.appointmentTime}
            </p>
          </div>

          {/* Status Badge */}
          <span className={`px-3 py-1 rounded text-xs font-medium ${
            appointment.status === "confirmed"
              ? "bg-teal-500 text-white"
              : appointment.status === "completed"
              ? "bg-slate-700 text-white"
              : "bg-red-500 text-white"
          }`}>
            {appointment.status === "confirmed" ? "Confirmed" : appointment.status === "completed" ? "Completed" : "Cancelled"}
          </span>
        </div>
      </div>

      {/* Accordion Body */}
      {isExpanded && (
        <div className="p-6 bg-white border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Doctor Details */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>👨‍⚕️</span>
                <span>Doctor Information</span>
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <p className="text-gray-900 mt-1">Dr. {appointment.doctorName}</p>
                </div>
                <div>
                  <span className="text-gray-600">Specialization:</span>
                  <p className="text-gray-900 mt-1">{appointment.doctorSpecialization}</p>
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>📅</span>
                <span>Appointment Details</span>
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Date:</span>
                  <p className="text-gray-900 mt-1">{new Date(appointment.appointmentDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Time:</span>
                  <p className="text-gray-900 mt-1">{appointment.appointmentTime}</p>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      appointment.status === "confirmed"
                        ? "bg-blue-600 text-white"
                        : appointment.status === "completed"
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white"
                    }`}>
                      {appointment.status}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div className="md:col-span-2 bg-yellow-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span>🩺</span>
                <span>Medical Information</span>
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600 font-medium">Chief Complaint:</span>
                  <p className="text-gray-900 mt-1 bg-white p-2 rounded border">
                    {appointment.chiefComplaint}
                  </p>
                </div>
                {appointment.medicalHistory && (
                  <div>
                    <span className="text-gray-600 font-medium">Medical History:</span>
                    <p className="text-gray-900 mt-1 bg-white p-2 rounded border">
                      {appointment.medicalHistory}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Prescription & Notes (Only for completed appointments) */}
            {appointment.status === "completed" && (appointment.medicine || appointment.doctorNotes) && (
              <div className="md:col-span-2 bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <span>💊</span>
                    <span>Prescription & Doctor's Notes</span>
                  </h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      generatePrescriptionPDF(appointment)
                    }}
                    className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download PDF
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  {appointment.medicine && (
                    <div>
                      <span className="text-gray-600 font-medium">💊 Prescribed Medicine:</span>
                      <p className="text-gray-900 mt-1 bg-white p-3 rounded border whitespace-pre-line">
                        {appointment.medicine}
                      </p>
                    </div>
                  )}
                  {appointment.doctorNotes && (
                    <div>
                      <span className="text-gray-600 font-medium">📝 Doctor's Notes:</span>
                      <p className="text-gray-900 mt-1 bg-white p-3 rounded border whitespace-pre-line">
                        {appointment.doctorNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons (Only for confirmed appointments) */}
            {appointment.status === "confirmed" && (
              <div className="md:col-span-2 mt-4 space-y-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    generateAppointmentConfirmationPDF(appointment)
                  }}
                  className="w-full px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-semibold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Confirmation
                </button>
                <button
                  onClick={onCancel}
                  className="w-full px-4 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all"
                >
                  Cancel Appointment
                </button>
                <p className="text-xs text-center text-slate-400">
                  Cancel 10+ hours before for full refund
                </p>
              </div>
            )}

            {/* Cancellation Info (Only for cancelled appointments) */}
            {appointment.status === "cancelled" && (
              <>
                <div className="md:col-span-2 bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>❌</span>
                    <span>Cancellation Details</span>
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <p className="text-red-600 font-semibold mt-1">Cancelled</p>
                    </div>
                    {appointment.cancelledAt && (
                      <div>
                        <span className="text-gray-600">Cancelled on:</span>
                        <p className="text-gray-900 mt-1">{new Date(appointment.cancelledAt).toLocaleString()}</p>
                      </div>
                    )}
                    {appointment.hoursBeforeCancellation !== undefined && (
                      <div>
                        <span className="text-gray-600">Cancelled:</span>
                        <p className="text-gray-900 mt-1">{appointment.hoursBeforeCancellation} hours before appointment</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment & Refund Info */}
                <div className="md:col-span-2 bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span>💰</span>
                    <span>Payment & Refund Details</span>
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Original Amount:</span>
                      <span className="font-semibold text-gray-900">₹{appointment.paymentAmount}</span>
                    </div>
                    {appointment.refundAmount !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Refund Amount:</span>
                        <span className="font-semibold text-green-600">₹{appointment.refundAmount}</span>
                      </div>
                    )}
                    {appointment.cancellationPolicy === "with_fee" && appointment.cancellationFee && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Cancellation Fee:</span>
                        <span className="font-semibold text-red-600">₹{appointment.cancellationFee}</span>
                      </div>
                    )}
                    {appointment.refundTransactionId && (
                      <div>
                        <span className="text-gray-600">Refund Transaction ID:</span>
                        <p className="text-gray-900 mt-1 font-mono text-xs">{appointment.refundTransactionId}</p>
                      </div>
                    )}
                    {appointment.refundStatus && (
                      <div className="pt-2 border-t border-blue-200">
                        <p className="text-green-600 font-semibold">✓ Refund {appointment.refundStatus}</p>
                        {appointment.paymentType === "partial" && appointment.cancellationPolicy === "with_fee" && appointment.cancellationFee && appointment.cancellationFee >= appointment.paymentAmount && (
                          <p className="text-xs text-orange-600 mt-1">
                            ℹ️ Your partial payment (₹{appointment.paymentAmount}) covered the cancellation fee (₹{appointment.cancellationFee})
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Payment Info (For active and completed appointments) */}
            {(appointment.status === "confirmed" || appointment.status === "completed") && appointment.paymentAmount && (
              <div className="md:col-span-2 bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>💳</span>
                  <span>Payment Details</span>
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Consultation Fee:</span>
                    <span className="font-semibold text-gray-900">₹{appointment.totalConsultationFee || appointment.paymentAmount}</span>
                  </div>
                  
                  {appointment.paymentType === "partial" && (
                    <>
                      <div className="flex justify-between items-center text-blue-700">
                        <span>Paid Online (10%):</span>
                        <span className="font-bold">₹{appointment.paymentAmount}</span>
                      </div>
                      <div className="flex justify-between items-center text-orange-600">
                        <span>Remaining (Pay at Hospital):</span>
                        <span className="font-bold">₹{appointment.remainingAmount}</span>
                      </div>
                    </>
                  )}
                  
                  {appointment.paymentType === "full" && (
                    <div className="flex justify-between items-center text-green-700">
                      <span>Paid Online (100%):</span>
                      <span className="font-bold">₹{appointment.paymentAmount}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium text-gray-900 capitalize">{appointment.paymentMethod}</span>
                  </div>
                  
                  {appointment.transactionId && (
                    <div>
                      <span className="text-gray-600">Transaction ID:</span>
                      <p className="text-gray-900 mt-1 font-mono text-xs">{appointment.transactionId}</p>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-blue-200">
                    <p className="text-green-600 font-semibold">✓ Payment Successful</p>
                    {appointment.paymentType === "partial" && (
                      <p className="text-orange-600 text-xs mt-1">
                        ⚠️ Remember to pay ₹{appointment.remainingAmount} at the hospital
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

