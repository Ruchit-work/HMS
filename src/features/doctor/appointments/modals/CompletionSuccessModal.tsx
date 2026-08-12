"use client"

import React, { useState } from "react"
import { CheckCircle2, FileText, X, Eye } from "lucide-react"
import type { Appointment } from "@/types/patient"

interface CompletionSuccessModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: Appointment | null
  onViewSummary: () => void
  onGeneratePDF: () => Promise<void> | void
}

export default function CompletionSuccessModal({
  isOpen,
  onClose,
  appointment,
  onViewSummary,
  onGeneratePDF,
}: CompletionSuccessModalProps) {
  const [downloadState, setDownloadState] = useState<"idle" | "generating" | "success">("idle")
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  if (!isOpen || !appointment) return null

  const handleGeneratePdfClick = async () => {
    if (downloadState === "generating") return
    setDownloadState("generating")
    setToastMessage(null)
    try {
      await onGeneratePDF()
      setDownloadState("success")
      setToastMessage({ type: "success", text: "PDF downloaded successfully" })
      setTimeout(() => {
        setDownloadState("idle")
      }, 2500)
      setTimeout(() => {
        setToastMessage(null)
      }, 4000)
    } catch (err) {
      console.error("PDF generation failed:", err)
      setDownloadState("idle")
      setToastMessage({ type: "error", text: "Failed to download PDF. Please try again." })
      setTimeout(() => {
        setToastMessage(null)
      }, 4000)
    }
  }

  const visitDateFormatted = appointment.appointmentDate
    ? new Date(appointment.appointmentDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }) + (appointment.appointmentTime ? ` • ${appointment.appointmentTime}` : "")
    : "—"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Appointment Completed</h3>
              <p className="text-xs text-slate-500">Consultation successfully finalized</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Details card */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 space-y-2.5 text-xs text-slate-700">
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="font-semibold text-slate-500">Patient Name</span>
            <span className="font-bold text-slate-900">{appointment.patientName}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="font-semibold text-slate-500">Doctor Name</span>
            <span className="font-medium text-slate-800">
              {appointment.doctorName?.startsWith("Dr.")
                ? appointment.doctorName
                : `Dr. ${appointment.doctorName || ""}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-500">Visit Date</span>
            <span className="font-medium text-slate-800">{visitDateFormatted}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleGeneratePdfClick}
            disabled={downloadState === "generating"}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors ${
              downloadState === "success"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 disabled:opacity-75"
            }`}
          >
            {downloadState === "generating" ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Generating PDF...</span>
              </>
            ) : downloadState === "success" ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Downloaded ✓</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 shrink-0" />
                <span>Download PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onViewSummary()
              onClose()
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <Eye className="h-4 w-4 text-slate-500" />
            View Consultation Summary
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toastMessage.type === "success" ? (
            <span className="text-emerald-400 font-bold text-sm">✓</span>
          ) : (
            <span className="text-rose-400 font-bold text-sm">✕</span>
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  )
}
