"use client"

import { useState, useRef, useEffect } from "react"

import { Appointment as AppointmentType } from "@/types/patient"
import { CompletionFormEntry } from "@/types/appointments"
import { DocumentMetadata } from "@/types/document"
import { MedicineSuggestion } from "@/utils/medicineSuggestions"
import AIPrescriptionSuggestion from "@/components/doctor/appointments/ai/AIPrescriptionSuggestion"
import MedicineForm from "@/components/doctor/appointments/forms/MedicineForm"
import DocumentUpload from "@/components/documents/DocumentUpload"
import { parseAiPrescription } from "@/utils/appointments/prescriptionParsers"
import { hasValidPrescriptionInput } from "@/types/appointments"
import VoiceInput from "@/components/ui/VoiceInput"

interface CompletionFormProps {
  appointment: AppointmentType
  completionData: CompletionFormEntry
  patientHistory: AppointmentType[]
  medicineSuggestions: MedicineSuggestion[]
  medicineSuggestionsLoading: boolean
  aiPrescription: { medicine: string; notes: string } | undefined
  loadingAiPrescription: boolean
  showAiPrescriptionSuggestion: boolean
  removedAiMedicines: number[]
  showDocumentUpload: boolean
  updating: boolean
  admitting: boolean
  onCompletionDataChange: (data: CompletionFormEntry) => void
  onAiPrescriptionAddAll: (medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>) => void
  onAiPrescriptionAddSingle: (medicine: { name: string; dosage: string; frequency: string; duration: string }, originalIndex: number) => void
  onAiPrescriptionRemove: (originalIndex: number) => void
  onAiPrescriptionRemoveAll: (indices: number[]) => void
  onAiPrescriptionRegenerate: () => void
  onDeclinePrescription: () => void
  onCopyPreviousPrescription: () => void
  onDocumentUploadToggle: () => void
  onDocumentUploadSuccess: (document: DocumentMetadata) => void
  onDocumentUploadError: (error: string) => void
  onSubmit: (e: React.FormEvent) => void
  onAdmitClick: () => void
  onAddAnatomy?: () => void
  /** Optional form id for external submit (e.g. sticky bar button) */
  formId?: string
}

export default function CompletionForm({
  appointment,
  completionData,
  patientHistory,
  medicineSuggestions,
  medicineSuggestionsLoading,
  aiPrescription,
  loadingAiPrescription,
  showAiPrescriptionSuggestion,
  removedAiMedicines,
  showDocumentUpload,
  updating,
  admitting,
  onCompletionDataChange,
  onAiPrescriptionAddAll,
  onAiPrescriptionAddSingle,
  onAiPrescriptionRemove,
  onAiPrescriptionRemoveAll,
  onAiPrescriptionRegenerate,
  onDeclinePrescription,
  onCopyPreviousPrescription,
  onDocumentUploadToggle,
  onDocumentUploadSuccess,
  onDocumentUploadError,
  onSubmit,
  onAdmitClick,
  onAddAnatomy,
  formId,
}: CompletionFormProps) {
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle")
  const draftSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  const handleNotesChange = (notes: string) => {
    onCompletionDataChange({
      ...completionData,
      notes,
    })
    setDraftStatus("saving")
    if (draftSavedTimeoutRef.current) clearTimeout(draftSavedTimeoutRef.current)
    draftSavedTimeoutRef.current = setTimeout(() => {
      draftSavedTimeoutRef.current = null
      setDraftStatus("saved")
      const t = setTimeout(() => setDraftStatus("idle"), 2000)
      return () => clearTimeout(t)
    }, 400)
  }

  const handleMedicinesChange = (medicines: CompletionFormEntry["medicines"]) => {
    onCompletionDataChange({
      ...completionData,
      medicines,
    })
  }

  useEffect(() => {
    return () => {
      if (draftSavedTimeoutRef.current) clearTimeout(draftSavedTimeoutRef.current)
    }
  }, [])

  const handleRecheckupRequiredChange = (recheckupRequired: boolean) => {
    onCompletionDataChange({
      ...completionData,
      recheckupRequired,
    })
  }

  const handleRecheckupNoteChange = (recheckupNote: string) => {
    onCompletionDataChange({
      ...completionData,
      recheckupNote,
    })
  }

  const handleRecheckupDaysChange = (recheckupDays: number) => {
    onCompletionDataChange({
      ...completionData,
      recheckupDays,
    })
  }

  const handleAiPrescriptionRemove = (originalIndex: number) => {
    onAiPrescriptionRemove(originalIndex)
    // If this was the last visible medicine, hide the suggestion
    const parsedMedicines = parseAiPrescription(aiPrescription?.medicine || "")
    const currentRemoved = [...removedAiMedicines, originalIndex]
    const remainingVisible = parsedMedicines.filter((_, idx) => !currentRemoved.includes(idx))
    if (remainingVisible.length === 0) {
      onDeclinePrescription()
    }
  }

  const handleAiPrescriptionRemoveAll = (indices: number[]) => {
    onAiPrescriptionRemoveAll(indices)
    const parsedMedicines = parseAiPrescription(aiPrescription?.medicine || "")
    const currentRemoved = [...removedAiMedicines, ...indices]
    const remainingVisible = parsedMedicines.filter((_, idx) => !currentRemoved.includes(idx))
    if (remainingVisible.length === 0) {
      onDeclinePrescription()
    }
  }

  const sameDoctorHistory = patientHistory.filter(
    (historyItem: AppointmentType) =>
      historyItem.doctorId === appointment.doctorId &&
      historyItem.id !== appointment.id &&
      historyItem.medicine
  )

  return (
    <form id={formId} onSubmit={onSubmit} className="p-5">
      {/* Section 1 — Consultation Notes */}
      <section className="mb-6">
        <h3 className="text-base font-semibold text-slate-900 mb-2.5">
          Consultation Notes <span className="text-red-500">*</span>
        </h3>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-400">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              {draftStatus === "saving" && (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Saving...
                </>
              )}
              {draftStatus === "saved" && (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Saved
                </>
              )}
              {draftStatus === "idle" && (
                <span className="text-slate-400">Draft</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              <VoiceInput
                onTranscript={(text) => handleNotesChange(text)}
                language="en-IN"
                useGoogleCloud={false}
                useMedicalModel={false}
                allowGujarati
                variant="inline"
              />
            </div>
          </div>
          <textarea
            value={completionData.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={3}
            style={{ minHeight: "90px" }}
            placeholder="Enter diagnosis, symptoms, or doctor observations..."
            className="w-full rounded-b-xl border-0 p-4 pt-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 resize-y"
            required
          />
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-200 mb-6" />

      {/* Section 2 — Prescription */}
      <section className="mb-6">
        <h3 className="text-base font-semibold text-slate-900 mb-2.5">
          Prescription <span className="text-red-500">*</span>
        </h3>

        {/* Suggested medicines */}
        <AIPrescriptionSuggestion
          isLoading={loadingAiPrescription}
          isVisible={showAiPrescriptionSuggestion}
          aiPrescriptionText={aiPrescription?.medicine}
          removedIndices={removedAiMedicines}
          existingMedicines={completionData.medicines || []}
          onAddAll={onAiPrescriptionAddAll}
          onAddSingle={onAiPrescriptionAddSingle}
          onRemove={handleAiPrescriptionRemove}
          onRemoveAll={handleAiPrescriptionRemoveAll}
          onRegenerate={onAiPrescriptionRegenerate}
          showUsePrevious={sameDoctorHistory.length > 0}
          onCopyPrevious={onCopyPreviousPrescription}
        />

        {/* Added to prescription */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-900 mb-3">Added to prescription</p>
          <MedicineForm
            appointmentId={appointment.id}
            medicines={completionData.medicines || []}
            medicineSuggestions={medicineSuggestions}
            medicineSuggestionsLoading={medicineSuggestionsLoading}
            onMedicinesChange={handleMedicinesChange}
          />
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-slate-200 mb-6" />

      {/* Section 3 — Consultation Actions */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id={`recheckupRequired-${appointment.id}`}
              checked={completionData.recheckupRequired || false}
              onChange={(e) => handleRecheckupRequiredChange(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm font-medium text-slate-700">Follow-up required</span>
          </label>
          <button
            type="button"
            onClick={onDocumentUploadToggle}
            className="h-9 px-4 rounded-lg border border-[#CBD5E1] bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:opacity-90 transition-all"
          >
            {showDocumentUpload ? "Hide Documents" : "+ Add Documents"}
          </button>
        </div>
        {completionData.recheckupRequired && (
          <div className="mt-3 space-y-3 p-4 rounded-lg bg-slate-50/80 border border-slate-100">
            <div>
              <label htmlFor={`recheckupDays-${appointment.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                Follow-up after (days) — Sundays skipped
              </label>
              <input
                id={`recheckupDays-${appointment.id}`}
                type="number"
                min={1}
                max={365}
                value={completionData.recheckupDays ?? 7}
                onChange={(e) =>
                  handleRecheckupDaysChange(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1)))
                }
                className="max-w-[120px] w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                placeholder="Days"
              />
            </div>
            <div>
              <label htmlFor={`recheckupNote-${appointment.id}`} className="block text-sm font-medium text-slate-700 mb-1">
                Follow-up note (optional)
              </label>
              <textarea
                id={`recheckupNote-${appointment.id}`}
                value={completionData.recheckupNote || ""}
                onChange={(e) => handleRecheckupNoteChange(e.target.value)}
                rows={2}
                placeholder="e.g., Follow-up for blood pressure"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </div>
          </div>
        )}

        {onAddAnatomy && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onAddAnatomy}
              className="inline-flex items-center gap-2 rounded-[10px] border border-dashed border-[#CBD5E1] bg-transparent px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Anatomy
            </button>
          </div>
        )}
      </section>

      {/* Document Upload (when toggled) */}
      {showDocumentUpload && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <DocumentUpload
            patientId={appointment.patientId}
            patientUid={appointment.patientUid || appointment.patientId || ""}
            appointmentId={appointment.id}
            specialty={appointment.doctorSpecialization}
            onUploadSuccess={onDocumentUploadSuccess}
            onUploadError={onDocumentUploadError}
            allowBulk={true}
          />
        </div>
      )}

      {/* In-form submit buttons — hidden when sticky bar is used (formId provided) */}
      {!formId && (
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 mt-6">
          <button
            type="button"
            disabled={updating || !hasValidPrescriptionInput(completionData)}
            onClick={() => setShowCompleteConfirm(true)}
            className="inline-flex items-center justify-center gap-2 h-10 min-w-[150px] rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Completing…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Complete Checkup
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onAdmitClick}
            disabled={updating || admitting || !hasValidPrescriptionInput(completionData)}
            className="inline-flex items-center justify-center gap-2 h-10 min-w-[150px] rounded-lg border border-slate-800 bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {admitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h14a2 2 0 012 2v8M3 7l2.5-3h5L13 7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15h5m-2.5-2.5v5" />
                </svg>
                Admit Patient
              </>
            )}
          </button>
        </div>
      )}

      {/* Confirmation modal for completing checkup */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-2">
              Complete this checkup?
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              This will finalize the doctor&apos;s notes and prescription for this visit. You can still view them later in history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompleteConfirm(false)
                  onSubmit({} as React.FormEvent)
                }}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Yes, complete checkup
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}

