"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import jsPDF from "jspdf"
import { CalendarDays, Check, Clock3, Download, Info, X } from "lucide-react"
import { Appointment } from "@/types/patient"
import { Button, RevealModal, useRevealModalClose } from "@/shared/components"
import { isAppointmentPaid } from "@/shared/utils/appointmentHelpers"
import { useHospitalBillingSettings } from "@/shared/hooks/useHospitalBillingSettings"
import type { PaidAppointmentCancellationPolicy } from "@/shared/utils/billingSettings"

// ============================================================================
// CancelAppointmentModal - Modal for confirming appointment cancellation.
// Paid-appointment behaviour is driven by hospital billing settings.
// ============================================================================

interface CancelAppointmentModalProps {
  appointment: Appointment | null
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  cancelling: boolean
}

function paidCancelCopy(policy: PaidAppointmentCancellationPolicy, amount: number) {
  switch (policy) {
    case "disallow":
      return {
        title: "This appointment has already been paid",
        body: (
          <p>
            This appointment has already been paid and cannot be cancelled.
          </p>
        ),
        confirmLabel: "Understood",
        confirmDisabled: true,
        question: "Cancellation is not allowed for this paid appointment.",
      }
    case "create_refund_request":
      return {
        title: "This appointment has already been paid",
        body: (
          <>
            <p>
              A <strong>refund request</strong> for ₹{amount} will be sent to the hospital for approval.
            </p>
            <p className="text-xs text-gray-600">
              Your appointment will be cancelled once the refund is approved. Until then, your
              payment remains recorded.
            </p>
          </>
        ),
        confirmLabel: "Create Refund Request",
        confirmDisabled: false,
        question: "Create a refund request and cancel this appointment?",
      }
    case "auto_refund":
      return {
        title: "This appointment has already been paid",
        body: (
          <p>
            Cancelling will automatically refund ₹{amount} and adjust hospital revenue.
          </p>
        ),
        confirmLabel: "Cancel & Refund",
        confirmDisabled: false,
        question: "Cancel this appointment and process an automatic refund?",
      }
    case "keep_payment":
    default:
      return {
        title: "This appointment has already been paid",
        body: (
          <p>
            The appointment will be cancelled. The payment of ₹{amount} remains with the hospital
            (non-refundable consultation fee policy).
          </p>
        ),
        confirmLabel: "Cancel Appointment",
        confirmDisabled: false,
        question: "Cancel this paid appointment without a refund?",
      }
  }
}

function CancelAppointmentModalContent({
  appointment,
  onConfirm,
  cancelling,
}: CancelAppointmentModalProps) {
  const requestClose = useRevealModalClose()
  const isPaid = isAppointmentPaid(appointment!)
  const { settings, refundsEnabled } = useHospitalBillingSettings()
  const policy = settings.paidAppointmentCancellation
  const amount = Number(appointment!.paymentAmount || 0)
  const resolvedPolicy =
    !refundsEnabled && (policy === "create_refund_request" || policy === "auto_refund")
      ? "keep_payment"
      : policy
  const effectiveCopy = isPaid ? paidCancelCopy(resolvedPolicy, amount) : null

  const handleConfirm = () => {
    if (effectiveCopy?.confirmDisabled) {
      requestClose()
      return
    }
    onConfirm()
    requestClose()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Cancel Appointment</h2>
          <button
            onClick={requestClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600 mb-2">
            <strong>Doctor:</strong> Dr. {appointment!.doctorName}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Date:</strong> {new Date(appointment!.appointmentDate).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Time:</strong> {appointment!.appointmentTime}
          </p>
          {isPaid && (
            <p className="text-sm text-gray-600">
              <strong>Amount Paid:</strong> ₹{appointment!.paymentAmount}
            </p>
          )}
        </div>

        {isPaid && effectiveCopy ? (
          <div className="rounded-lg p-4 mb-4 bg-blue-50 border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span>ℹ️</span>
              <span>{effectiveCopy.title}</span>
            </h3>
            <div className="text-sm text-gray-700 space-y-2">{effectiveCopy.body}</div>
          </div>
        ) : (
          <div className="rounded-lg p-4 mb-4 bg-slate-50 border border-slate-200">
            <p className="text-sm text-gray-700">
              No payment has been collected for this appointment, so it will be cancelled
              immediately and the slot will be released.
            </p>
          </div>
        )}

        <p className="text-gray-700 mb-6 text-center font-medium">
          {isPaid && effectiveCopy
            ? effectiveCopy.question
            : "Are you sure you want to cancel this appointment?"}
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={cancelling}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelling
              ? "Processing..."
              : isPaid && effectiveCopy
                ? effectiveCopy.confirmLabel
                : "Confirm Cancellation"}
          </button>
          <button
            onClick={requestClose}
            disabled={cancelling}
            className="flex-1 px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all font-medium text-slate-700"
          >
            Keep Appointment
          </button>
        </div>
      </div>
    </div>
  )
}

export function CancelAppointmentModal({
  appointment,
  isOpen,
  onClose,
  onConfirm,
  cancelling,
}: CancelAppointmentModalProps) {
  if (!isOpen || !appointment) return null

  return (
    <RevealModal isOpen={isOpen} onClose={onClose} contentClassName="p-0">
      <CancelAppointmentModalContent
        appointment={appointment}
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={onConfirm}
        cancelling={cancelling}
      />
    </RevealModal>
  )
}

// ============================================================================
// AppointmentSuccessModal - Modal shown after successful appointment booking
// ============================================================================

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
    paymentMethod?: string
    paymentStatus?: string
    totalConsultationFee?: number
    patientName: string
    /** Optional display-only fields when available from the booking response. */
    appointmentId?: string
    branchName?: string
  } | null
  /** Optional navigation after booking (defaults by current route). */
  onViewAppointment?: () => void
}

function formatAppointmentDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatPaymentMethod(method?: string): string {
  if (!method) return "—"
  const normalized = method.trim().toLowerCase()
  if (normalized === "upi") return "UPI"
  if (normalized === "cash") return "Cash"
  if (normalized === "card") return "Card"
  if (normalized === "bank_transfer") return "Bank Transfer"
  if (normalized === "cheque") return "Cheque"
  return method.charAt(0).toUpperCase() + method.slice(1)
}

function SummaryField({
  label,
  value,
  valueClassName = "",
  badge,
}: {
  label: string
  value: ReactNode
  valueClassName?: string
  badge?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className={`text-[15px] font-medium text-slate-900 break-words ${valueClassName}`}>{value}</p>
        {badge}
      </div>
    </div>
  )
}

function AppointmentSuccessModalContent({
  appointmentData,
  onViewAppointment,
}: {
  appointmentData: NonNullable<AppointmentSuccessModalProps["appointmentData"]>
  onClose: () => void
  onViewAppointment?: () => void
}) {
  const requestClose = useRevealModalClose()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => requestClose(), 10000)
    return () => clearTimeout(timer)
  }, [requestClose])

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
    
    if (appointmentData.paymentStatus === "pending" || appointmentData.paymentMethod === "cash") {
      pdf.text(`Payment Status: Pending`, 20, yPos)
      yPos += 10
      pdf.text(`Amount to Pay: ₹${appointmentData.totalConsultationFee || appointmentData.remainingAmount || 0}`, 20, yPos)
      yPos += 10
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Payment will be collected at the reception desk.`, 20, yPos)
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(11)
    } else {
      pdf.text(`Amount Paid: ₹${appointmentData.paymentAmount}`, 20, yPos)
      yPos += 10
      
      if (appointmentData.paymentType === 'partial' && appointmentData.remainingAmount && appointmentData.remainingAmount > 0) {
        pdf.setTextColor(255, 100, 0)
        pdf.text(`Remaining to Pay at Hospital: ₹${appointmentData.remainingAmount}`, 20, yPos)
        pdf.setTextColor(0, 0, 0)
      }
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

  const isPendingPayment =
    appointmentData.paymentStatus === "pending" || appointmentData.paymentMethod === "cash"
  const appointmentIdLabel =
    appointmentData.appointmentId ||
    (appointmentData.transactionId ? String(appointmentData.transactionId) : null)

  const handleViewAppointment = () => {
    if (onViewAppointment) {
      onViewAppointment()
      requestClose()
      return
    }
    requestClose()
    if (pathname?.includes("patient-dashboard")) {
      router.push("/patient-dashboard/appointments")
    }
  }

  return (
    <div
      className="w-full overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.10),0_24px_48px_rgba(15,23,42,0.06)]"
      role="document"
    >
      <div className="relative p-8">
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close appointment confirmation"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Header */}
        <header className="mx-auto max-w-lg text-center">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-[0_8px_20px_rgba(16,185,129,0.35)]"
            aria-hidden="true"
          >
            <Check className="h-7 w-7 text-white" strokeWidth={2.5} />
          </div>
          <h2 id="appointment-success-title" className="text-[30px] font-bold leading-tight tracking-tight text-slate-900">
            Appointment Confirmed
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Your appointment has been booked successfully.
          </p>
          <p className="mt-1 text-base leading-relaxed text-slate-500">
            A confirmation has also been sent via WhatsApp.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          {/* Appointment Summary */}
          <section
            aria-labelledby="appointment-summary-heading"
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="appointment-summary-heading" className="text-base font-semibold text-slate-900">
                Appointment Summary
              </h3>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                Confirmed
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SummaryField
                label="Doctor"
                value={`Dr. ${appointmentData.doctorName}`}
                badge={
                  <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/15">
                    Doctor
                  </span>
                }
              />
              <SummaryField label="Department" value={appointmentData.doctorSpecialization || "—"} />
              {appointmentIdLabel ? (
                <SummaryField
                  label="Appointment ID"
                  value={appointmentIdLabel}
                  valueClassName="font-mono text-[14px]"
                />
              ) : null}
              {appointmentData.branchName ? (
                <SummaryField
                  label="Branch"
                  value={appointmentData.branchName}
                  badge={
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                      Branch
                    </span>
                  }
                />
              ) : null}
              <SummaryField
                label="Date"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {formatAppointmentDate(appointmentData.appointmentDate)}
                  </span>
                }
              />
              <SummaryField
                label="Time"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {appointmentData.appointmentTime}
                  </span>
                }
              />
              <SummaryField
                label="Status"
                value={
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                    Confirmed
                  </span>
                }
              />
            </div>
          </section>

          {/* Payment Summary */}
          <section
            aria-labelledby="payment-summary-heading"
            className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
          >
            <h3 id="payment-summary-heading" className="text-base font-semibold text-slate-900">
              Payment Summary
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  {isPendingPayment ? "Amount to Pay" : "Amount Paid"}
                </p>
                <p className="mt-1 text-[28px] font-bold tracking-tight text-slate-900">
                  ₹
                  {isPendingPayment
                    ? appointmentData.totalConsultationFee || appointmentData.remainingAmount || 0
                    : appointmentData.paymentAmount}
                </p>
              </div>
              <SummaryField
                label="Payment Status"
                value={
                  isPendingPayment ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/15">
                      Pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
                      Paid
                    </span>
                  )
                }
              />
              <SummaryField
                label="Payment Method"
                value={formatPaymentMethod(appointmentData.paymentMethod)}
              />
              <div className="sm:col-span-2">
                <SummaryField
                  label="Transaction ID"
                  value={appointmentData.transactionId}
                  valueClassName="font-mono text-[14px]"
                />
              </div>
              {isPendingPayment ? (
                <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="text-xs leading-relaxed text-amber-800">
                    Payment will be collected at the reception desk before your appointment.
                  </p>
                </div>
              ) : null}
              {!isPendingPayment &&
              appointmentData.paymentType === "partial" &&
              appointmentData.remainingAmount &&
              appointmentData.remainingAmount > 0 ? (
                <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-700">Pay at Hospital</span>
                  <span className="text-sm font-bold text-slate-900">
                    ₹{appointmentData.remainingAmount}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {/* Important Information */}
          <section
            aria-labelledby="important-info-heading"
            className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4"
          >
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <Info className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 id="important-info-heading" className="text-base font-semibold text-sky-950">
                  Important Information
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-sky-900/80">
                  <li className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                    <span>Arrive at least 15 minutes before your appointment.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                    <span>Carry a valid photo ID.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                    <span>Bring previous prescriptions or reports if applicable.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                    <span>Contact reception if you need to reschedule.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={downloadConfirmationPDF}
              className="h-11 w-full shadow-sm transition-shadow hover:shadow-md sm:flex-1"
              aria-label="Download appointment confirmation PDF"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleViewAppointment}
              className="h-11 w-full shadow-sm transition-shadow hover:shadow-md sm:flex-1"
              aria-label="View appointment"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              View Appointment
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={requestClose}
              className="h-11 w-full sm:w-auto sm:min-w-[7.5rem]"
              aria-label="Close confirmation dialog"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppointmentSuccessModal({
  isOpen,
  onClose,
  appointmentData,
  onViewAppointment,
}: AppointmentSuccessModalProps) {
  if (!isOpen || !appointmentData) return null

  return (
    <RevealModal
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="p-0"
      contentMaxWidthClass="max-w-[min(100%,760px)]"
      ariaLabelledBy="appointment-success-title"
      closeOnOverlayClick
    >
      <AppointmentSuccessModalContent
        appointmentData={appointmentData}
        onClose={onClose}
        onViewAppointment={onViewAppointment}
      />
    </RevealModal>
  )
}

