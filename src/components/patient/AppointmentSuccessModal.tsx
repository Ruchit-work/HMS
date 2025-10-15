"use client"

import { useEffect } from "react"
import jsPDF from "jspdf"

interface AppointmentSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  appointmentData: {
    doctorName: string
    doctorSpecialization: string
    appointmentDate: string
    appointmentTime: string
    transactionId: string
    paymentAmount: number
    paymentType: string
    remainingAmount?: number
    patientName: string
  } | null
}

export default function AppointmentSuccessModal({
  isOpen,
  onClose,
  appointmentData
}: AppointmentSuccessModalProps) {
  
  // Auto-close after 10 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 10000) // 10 seconds
      
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen || !appointmentData) return null

  const downloadConfirmationPDF = () => {
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    
    // Header
    pdf.setFillColor(45, 55, 72) // slate-800
    pdf.rect(0, 0, pageWidth, 40, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(24)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Appointment Confirmed', pageWidth / 2, 25, { align: 'center' })
    
    // Success Icon
    pdf.setFontSize(40)
    pdf.text('✓', pageWidth / 2, 60, { align: 'center' })
    
    // Appointment Details
    pdf.setTextColor(0, 0, 0)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('APPOINTMENT DETAILS', 20, 80)
    
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    let yPos = 95
    
    pdf.text(`Patient Name: ${appointmentData.patientName}`, 20, yPos)
    yPos += 10
    pdf.text(`Doctor: Dr. ${appointmentData.doctorName}`, 20, yPos)
    yPos += 10
    pdf.text(`Specialization: ${appointmentData.doctorSpecialization}`, 20, yPos)
    yPos += 10
    pdf.text(`Date: ${new Date(appointmentData.appointmentDate).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`, 20, yPos)
    yPos += 10
    pdf.text(`Time: ${appointmentData.appointmentTime}`, 20, yPos)
    
    // Payment Details
    yPos += 20
    pdf.setFont('helvetica', 'bold')
    pdf.text('PAYMENT DETAILS', 20, yPos)
    
    pdf.setFont('helvetica', 'normal')
    yPos += 15
    pdf.text(`Transaction ID: ${appointmentData.transactionId}`, 20, yPos)
    yPos += 10
    pdf.text(`Amount Paid: ₹${appointmentData.paymentAmount}`, 20, yPos)
    
    if (appointmentData.paymentType === 'partial' && appointmentData.remainingAmount) {
      yPos += 10
      pdf.setTextColor(255, 100, 0)
      pdf.text(`Remaining to Pay at Hospital: ₹${appointmentData.remainingAmount}`, 20, yPos)
      pdf.setTextColor(0, 0, 0)
    }
    
    // Footer
    yPos += 25
    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text('Please arrive 15 minutes before your appointment time.', 20, yPos)
    yPos += 7
    pdf.text('Bring this confirmation and a valid ID.', 20, yPos)
    
    // Download
    pdf.save(`Appointment-Confirmation-${appointmentData.transactionId}.pdf`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full animate-scale-in overflow-hidden border-2 border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors"
          >
            <span className="text-white text-xl">×</span>
          </button>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg animate-bounce-once">
              <span className="text-4xl text-white">✓</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">Appointment Confirmed</h2>
            <p className="text-slate-300 text-sm">Your booking was successful</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Doctor Info */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center text-white text-xl">
                👨‍⚕️
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-medium mb-1">Your Doctor</p>
                <p className="text-lg font-bold text-slate-800">Dr. {appointmentData.doctorName}</p>
                <p className="text-xs text-slate-600 font-medium">{appointmentData.doctorSpecialization}</p>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📅</span>
                <p className="text-xs text-slate-500 font-bold uppercase">Date</p>
              </div>
              <p className="text-sm font-bold text-slate-800">
                {new Date(appointmentData.appointmentDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
              <p className="text-xs text-slate-600 font-medium">
                {new Date(appointmentData.appointmentDate).toLocaleDateString('en-US', { weekday: 'long' })}
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🕐</span>
                <p className="text-xs text-slate-500 font-bold uppercase">Time</p>
              </div>
              <p className="text-lg font-bold text-slate-800">
                {appointmentData.appointmentTime}
              </p>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💳</span>
              <p className="text-sm font-bold text-slate-800">Payment Successful</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Transaction ID:</span>
                <span className="font-mono text-slate-800 font-semibold text-xs">{appointmentData.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Amount Paid:</span>
                <span className="text-slate-800 font-bold">₹{appointmentData.paymentAmount}</span>
              </div>
              {appointmentData.paymentType === 'partial' && appointmentData.remainingAmount && (
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-700 font-semibold">Pay at Hospital:</span>
                  <span className="text-slate-900 font-bold">₹{appointmentData.remainingAmount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Important Note */}
          <div className="bg-slate-100 border-l-4 border-slate-600 p-3 rounded">
            <p className="text-xs text-slate-700">
              <span className="font-bold">📌 Important:</span> Please arrive 15 minutes before your appointment time. Bring this confirmation and a valid ID.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={downloadConfirmationPDF}
              className="flex-1 bg-slate-700 hover:bg-slate-800 text-white px-4 py-3 rounded-lg font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-all border border-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes scale-in {
          from {
            transform: scale(0.9);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes bounce-once {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.4s ease-out;
        }
        
        .animate-bounce-once {
          animation: bounce-once 0.6s ease-out;
        }
      `}</style>
    </div>
  )
}

