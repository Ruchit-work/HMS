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
    <form id={formId} onSubmit={onSubmit} className="p-3 space-y-4">
      {/* Doctor's Notes Section — primary clinical field */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Doctor&apos;s Notes <span className="text-red-500">*</span>
        </label>
        <div className="relative flex items-center">
          <textarea
            value={completionData.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={3}
            placeholder="Enter observations, diagnosis, recommendations..."
            className="w-full pl-2 pr-10 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs resize-none"
            required
          />
          <div className="absolute right-2 top-2 pointer-events-none flex items-end justify-end">
            <div className="pointer-events-auto">
              <VoiceInput
                onTranscript={(text) => handleNotesChange(text)}
                language="en-IN"
                useGoogleCloud={false}
                useMedicalModel={false}
                variant="inline"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Prescription Section */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-700">
            Prescribed Medicines <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            {sameDoctorHistory.length > 0 && (
              <button
                type="button"
                onClick={onCopyPreviousPrescription}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-all"
                title="Copy previous prescription"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Use Previous
              </button>
            )}
          </div>
        </div>

        {/* AI suggested medicines (distinct from added list below) */}
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
        />

        {/* Added to prescription — clearly distinct from suggestions above */}
        <div className="mt-4 pt-3 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-700 mb-2">Added to prescription</p>
          <MedicineForm
          appointmentId={appointment.id}
          medicines={completionData.medicines || []}
          medicineSuggestions={medicineSuggestions}
          medicineSuggestionsLoading={medicineSuggestionsLoading}
          onMedicinesChange={handleMedicinesChange}
        />
        </div>
      </div>

      {/* Recheckup Section + Documents actions */}
      <div className="pt-1 border-t border-slate-200 mt-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`recheckupRequired-${appointment.id}`}
              checked={completionData.recheckupRequired || false}
              onChange={(e) => handleRecheckupRequiredChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
            />
            <label
              htmlFor={`recheckupRequired-${appointment.id}`}
              className="text-xs font-medium text-gray-700 cursor-pointer"
            >
              🔄 Follow-up Required
            </label>
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={onDocumentUploadToggle}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-all flex items-center gap-1"
            >
              {showDocumentUpload ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Hide Documents
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Documents
                </>
              )}
            </button>
          </div>
        </div>
        {completionData.recheckupRequired && (
          <div className="mt-2 space-y-2">
            <div>
              <label htmlFor={`recheckupDays-${appointment.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                Follow-up after (days) — Sundays skipped
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id={`recheckupDays-${appointment.id}`}
                  value={
                    [3, 5, 7, 10, 14, 21, 28].includes(completionData.recheckupDays ?? 7)
                      ? String(completionData.recheckupDays ?? 7)
                      : "custom"
                  }
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === "custom") {
                      const current = completionData.recheckupDays ?? 7
                      handleRecheckupDaysChange(Number.isNaN(current) ? 7 : current)
                    } else {
                      handleRecheckupDaysChange(Number(v))
                    }
                  }}
                  className="w-full max-w-[120px] px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                >
                  <option value={3}>3 days</option>
                  <option value={5}>5 days</option>
                  <option value={7}>7 days</option>
                  <option value={10}>10 days</option>
                  <option value={14}>14 days</option>
                  <option value={21}>21 days</option>
                  <option value={28}>28 days</option>
                  <option value="custom">Custom</option>
                </select>
                {![3, 5, 7, 10, 14, 21, 28].includes(completionData.recheckupDays ?? 7) && (
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={completionData.recheckupDays ?? 7}
                    onChange={(e) => handleRecheckupDaysChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    placeholder="Days"
                  />
                )}
              </div>
            </div>
            <div>
              <label htmlFor={`recheckupNote-${appointment.id}`} className="block text-xs font-medium text-gray-700 mb-1">
              Follow-up Note (Optional)
              </label>
              <textarea
                id={`recheckupNote-${appointment.id}`}
                value={completionData.recheckupNote || ""}
                onChange={(e) => handleRecheckupNoteChange(e.target.value)}
                rows={2}
                placeholder="e.g., Follow-up for blood pressure"
                className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Document Upload Section */}
      {showDocumentUpload && (
        <div className="mt-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
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

      {/* Add Anatomy - above actions */}
      {onAddAnatomy && (
        <div className="pt-2 pb-1 border-t border-slate-200 mt-3">
          <button
            type="button"
            onClick={onAddAnatomy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-white border-2 border-dashed border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Anatomy
          </button>
        </div>
      )}

      {/* In-form submit buttons — hidden when sticky bar is used (formId provided) */}
      {!formId && (
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={updating || !hasValidPrescriptionInput(completionData)}
            className="btn-modern btn-modern-success btn-modern-sm flex-1"
          >
            {updating ? "Completing..." : "Complete Checkup"}
          </button>
          <button
            type="button"
            onClick={onAdmitClick}
            disabled={updating || admitting || !hasValidPrescriptionInput(completionData)}
            className="flex-1 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {admitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span>🏥</span>
                <span>Admit Patient</span>
              </>
            )}
          </button>
        </div>
      )}
    </form>
  )
}

