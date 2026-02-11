"use client"

import { Appointment as AppointmentType } from "@/types/patient"
import { CompletionFormEntry } from "@/types/appointments"
import { DocumentMetadata } from "@/types/document"
import { MedicineSuggestion } from "@/utils/medicineSuggestions"
import DiagnosisSelector from "@/components/doctor/DiagnosisSelector"
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
  onAiPrescriptionRegenerate: () => void
  onDeclinePrescription: () => void
  onCopyPreviousPrescription: () => void
  onDocumentUploadToggle: () => void
  onDocumentUploadSuccess: (document: DocumentMetadata) => void
  onDocumentUploadError: (error: string) => void
  onSubmit: (e: React.FormEvent) => void
  onAdmitClick: () => void
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
  onAiPrescriptionRegenerate,
  onDeclinePrescription,
  onCopyPreviousPrescription,
  onDocumentUploadToggle,
  onDocumentUploadSuccess,
  onDocumentUploadError,
  onSubmit,
  onAdmitClick,
}: CompletionFormProps) {
  const handleDiagnosesChange = (diagnoses: string[]) => {
    onCompletionDataChange({
      ...completionData,
      finalDiagnosis: diagnoses,
    })
  }

  const handleCustomDiagnosisChange = (customDiagnosis: string) => {
    onCompletionDataChange({
      ...completionData,
      customDiagnosis,
    })
  }

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

  const sameDoctorHistory = patientHistory.filter(
    (historyItem: AppointmentType) =>
      historyItem.doctorId === appointment.doctorId &&
      historyItem.id !== appointment.id &&
      historyItem.medicine
  )

  return (
    <form onSubmit={onSubmit} className="p-3 space-y-4">
      {/* Final Diagnosis Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <DiagnosisSelector
          selectedDiagnoses={completionData.finalDiagnosis || []}
          customDiagnosis={completionData.customDiagnosis || ""}
          onDiagnosesChange={handleDiagnosesChange}
          onCustomDiagnosisChange={handleCustomDiagnosisChange}
          showPatientComplaints={appointment.chiefComplaint || undefined}
          error={
            completionData.finalDiagnosis?.length === 0
              ? "At least one diagnosis is required"
              : undefined
          }
        />
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

        {/* AI Generated Prescription Suggestion Box */}
        <AIPrescriptionSuggestion
          isLoading={loadingAiPrescription}
          isVisible={showAiPrescriptionSuggestion}
          aiPrescriptionText={aiPrescription?.medicine}
          removedIndices={removedAiMedicines}
          existingMedicines={completionData.medicines || []}
          onAddAll={onAiPrescriptionAddAll}
          onAddSingle={onAiPrescriptionAddSingle}
          onRemove={handleAiPrescriptionRemove}
          onRegenerate={onAiPrescriptionRegenerate}
        />

        {/* Structured Medicine Form */}
        <MedicineForm
          appointmentId={appointment.id}
          medicines={completionData.medicines || []}
          medicineSuggestions={medicineSuggestions}
          medicineSuggestionsLoading={medicineSuggestionsLoading}
          onMedicinesChange={handleMedicinesChange}
        />
      </div>

      {/* Notes Section */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Doctor&apos;s Notes <span className="text-gray-400 text-xs">(Optional)</span>
        </label>
        <div className="relative flex items-center">
          <textarea
            value={completionData.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={2}
            placeholder="Enter observations, diagnosis, recommendations... or use voice input"
            className="w-full pl-2 pr-10 py-1 pt-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 text-xs resize-none"
          />
          <div className="absolute right-2 top-2 pointer-events-none flex items-end justify-end">
            <div className="pointer-events-auto">
              <VoiceInput
                onTranscript={(text) => {
                  handleNotesChange(text)
                }}
                language="en-IN"
                useGoogleCloud={false}
                useMedicalModel={false}
                variant="inline"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recheckup Section + 3D Model / Documents actions */}
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
              🔄 Re-checkup Required
            </label>
          </div>

          <div className="flex items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => {
                const url = `/doctor-dashboard/anatomy?appointmentId=${appointment.id}&patientName=${encodeURIComponent(
                  appointment.patientName || 'Patient'
                )}`
                window.location.href = url
              }}
              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition-all flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Open 3D Model
            </button>
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
          <div className="mt-2">
            <label htmlFor={`recheckupNote-${appointment.id}`} className="block text-xs font-medium text-gray-700 mb-1">
              Re-checkup Note (Optional)
            </label>
            <textarea
              id={`recheckupNote-${appointment.id}`}
              value={completionData.recheckupNote || ""}
              onChange={(e) => handleRecheckupNoteChange(e.target.value)}
              rows={2}
              placeholder="Enter note for re-checkup (e.g., 'Follow-up required in 2 weeks', 'Monitor blood pressure')"
              className="w-full px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs resize-none"
            />
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

      {/* Submit Buttons */}
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
    </form>
  )
}

