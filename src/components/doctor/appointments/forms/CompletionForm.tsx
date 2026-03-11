"use client"

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
  const handleMedicinesChange = (medicines: CompletionFormEntry["medicines"]) => {
    onCompletionDataChange({
      ...completionData,
      medicines,
    })
  }

  const handleNotesChange = (notes: string) => {
    onCompletionDataChange({
      ...completionData,
      notes,
    })
  }

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
        <div className="relative">
          <textarea
            value={completionData.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={2}
            style={{ minHeight: "64px" }}
            placeholder="Enter consultation notes"
            className="w-full rounded-[10px] border border-[#CBD5E1] p-3 pr-24 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 resize-none"
            required
          />
          <div className="absolute right-3 top-3 pointer-events-none flex items-end justify-end">
            <div className="pointer-events-auto">
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
        <div className="flex gap-3 pt-6 border-t border-slate-200 mt-6">
          <button
            type="submit"
            disabled={updating || !hasValidPrescriptionInput(completionData)}
            className="flex-1 h-10 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? "Completing…" : "Complete Checkup"}
          </button>
          <button
            type="button"
            onClick={onAdmitClick}
            disabled={updating || admitting || !hasValidPrescriptionInput(completionData)}
            className="flex-1 h-10 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <>Admit Patient</>
            )}
          </button>
        </div>
      )}
    </form>
  )
}

