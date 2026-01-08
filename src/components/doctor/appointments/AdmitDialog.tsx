"use client"

import { Appointment as AppointmentType } from "@/types/patient"

interface AdmitDialogProps {
  open: boolean
  appointment: AppointmentType | null
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function AdmitDialog({
  open,
  appointment,
  isSubmitting,
  onCancel,
  onConfirm,
}: AdmitDialogProps) {
  if (!open || !appointment) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            🏥
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Admit patient?</h3>
            <p className="text-sm text-slate-600 mt-1">
              Are you sure you want to send an admission request for{" "}
              <span className="font-semibold text-slate-900">
                {appointment.patientName || "this patient"}
              </span>
              ? This will send the request to the receptionist for further processing.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-700"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Yes, Admit Patient"}
          </button>
        </div>
      </div>
    </div>
  )
}


