"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { Appointment as AppointmentType } from "@/types/patient"
import { CompletionFormEntry } from "@/types/appointments"
import { DocumentMetadata } from "@/types/document"
import { MedicineSuggestion } from "@/shared/utils/medicineSuggestions"
import AIPrescriptionSuggestion from "@/features/doctor/appointments/ai/AIPrescriptionSuggestion"
import AIDiagnosisSuggestion from "@/features/doctor/appointments/ai/AIDiagnosisSuggestion"
import { formatAIDiagnosisForNotes } from "@/shared/utils/appointments/diagnosisParsers"
import MedicineForm from "@/features/doctor/appointments/forms/MedicineForm"
import PrescriptionPanel from "@/features/doctor/clinical/PrescriptionPanel"
import ConsultationWorkspace from "@/features/doctor/clinical/ConsultationWorkspace"
import ConsultationClinicalPanel from "@/features/doctor/clinical/consultation/ConsultationClinicalPanel"
import ConsultationContextPanel from "@/features/doctor/clinical/consultation/ConsultationContextPanel"
import ConsultationOrdersPanel from "@/features/doctor/clinical/consultation/ConsultationOrdersPanel"
import PrescriptionQuickAccess from "@/features/doctor/clinical/consultation/PrescriptionQuickAccess"
import { mergeMedicines } from "@/shared/utils/prescriptionWorkspace"
import DocumentUpload from "@/features/documents/DocumentUpload"
import VoiceInput from "@/shared/ui/VoiceInput"
import { parseAiPrescription } from "@/shared/utils/appointments/prescriptionParsers"
import { hasClinicalDocumentation } from "@/features/doctor/clinical/consultation/consultationNotesUtils"

interface CompletionFormProps {
  appointment: AppointmentType
  completionData: CompletionFormEntry
  patientHistory: AppointmentType[]
  medicineSuggestions: MedicineSuggestion[]
  medicineSuggestionsLoading: boolean
  aiPrescription: { medicine: string; notes: string } | undefined
  loadingAiPrescription: boolean
  showAiPrescriptionSuggestion: boolean
  aiDiagnosisText?: string
  loadingAiDiagnosis: boolean
  showAiDiagnosisSuggestion: boolean
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
  onGenerateAiDiagnosis: () => void
  onAiDiagnosisRegenerate: () => void
  onDeclineAiDiagnosis: () => void
  onCopyPreviousPrescription: () => void
  onDocumentUploadToggle: () => void
  onDocumentUploadSuccess: (document: DocumentMetadata) => void
  onDocumentUploadError: (error: string) => void
  onSubmit: (e: React.FormEvent) => void
  onAdmitClick: () => void
  onAddAnatomy?: () => void
  /** Optional form id for external submit (e.g. sticky bar button) */
  formId?: string
  layout?: "default" | "workspace"
  doctorUid?: string
  onOpenDocuments?: () => void
  latestRecommendation?: {
    finalDiagnosis: string[]
    medicine?: string | null
    notes?: string | null
    date?: string
  } | null
  onLastVisitClick?: () => void
  isReturningPatient?: boolean
  historyDocuments?: Record<string, DocumentMetadata[]>
  onDocumentClick?: (doc: DocumentMetadata) => void
  /** Renders below the workspace grid (e.g. action bar) */
  actionBar?: React.ReactNode
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
  aiDiagnosisText,
  loadingAiDiagnosis,
  showAiDiagnosisSuggestion,
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
  onGenerateAiDiagnosis,
  onAiDiagnosisRegenerate,
  onDeclineAiDiagnosis,
  onCopyPreviousPrescription,
  onDocumentUploadToggle,
  onDocumentUploadSuccess,
  onDocumentUploadError,
  onSubmit,
  onAdmitClick,
  onAddAnatomy,
  formId,
  layout = "default",
  doctorUid,
  onOpenDocuments,
  latestRecommendation,
  onLastVisitClick,
  isReturningPatient,
  historyDocuments,
  onDocumentClick,
  actionBar,
}: CompletionFormProps) {
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [suggestionApplied, setSuggestionApplied] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const draftSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completionDataRef = useRef(completionData)
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

  completionDataRef.current = completionData

  const handleNotesChange = (notes: string) => {
    onCompletionDataChange({
      ...completionDataRef.current,
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
      ...completionDataRef.current,
      medicines,
    })
  }

  const handleApplyDiagnosisToNotes = useCallback(() => {
    const raw = (aiDiagnosisText || '').trim()
    if (!raw) return

    const summary = formatAIDiagnosisForNotes(raw).trim() || raw.replace(/\*\*/g, '').trim()
    if (!summary) return

    const existing = (completionDataRef.current.notes || '').trim()
    const block = `--- Clinical data suggestion ---\n${summary}`
    const merged = existing ? `${existing}\n\n${block}` : block

    onCompletionDataChange({
      ...completionDataRef.current,
      notes: merged,
    })
    setSuggestionApplied(true)
    setDraftStatus('saved')
    window.setTimeout(() => setSuggestionApplied(false), 2500)
    window.setTimeout(() => {
      notesTextareaRef.current?.focus()
      notesTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }, [aiDiagnosisText, onCompletionDataChange])

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

  const documentUploadBlock = showDocumentUpload && (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
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
  )

  if (layout === "workspace") {
    const leftExtraBottom = (
      <>
        <PrescriptionQuickAccess
          doctorUid={doctorUid || ""}
          appointment={appointment}
          patientHistory={patientHistory}
          medicines={completionData.medicines || []}
          medicineSuggestions={medicineSuggestions}
          onApplyMedicines={(toAdd) =>
            handleMedicinesChange(mergeMedicines(completionData.medicines || [], toAdd))
          }
          onCopyPrevious={onCopyPreviousPrescription}
          showUsePrevious={sameDoctorHistory.length > 0}
        />

        {completionData.recheckupRequired && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50/70">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">Follow-up note</span>
              <span className="text-[10px] text-slate-400">(optional)</span>
            </div>
            <div className="p-3">
              <textarea
                value={completionData.recheckupNote || ""}
                onChange={(e) => handleRecheckupNoteChange(e.target.value)}
                rows={2}
                placeholder="e.g. Blood pressure follow-up in 7 days…"
                className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
              />
            </div>
          </section>
        )}

        <ConsultationOrdersPanel
          onOpenDocuments={onOpenDocuments}
          onToggleUpload={onDocumentUploadToggle}
          showDocumentUpload={showDocumentUpload}
        />

        {documentUploadBlock}
      </>
    )

    const centerExtraContent = (
      <>
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

        <PrescriptionPanel
          title="Prescription"
          description="Add medicines for this consultation"
        >
          <MedicineForm
            appointmentId={appointment.id}
            medicines={completionData.medicines || []}
            medicineSuggestions={medicineSuggestions}
            medicineSuggestionsLoading={medicineSuggestionsLoading}
            onMedicinesChange={handleMedicinesChange}
            doctorUid={doctorUid}
            compact={layout === "workspace"}
          />
        </PrescriptionPanel>
      </>
    )

    const headerLeading = (
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => setLeftCollapsed((v) => !v)}
          title={leftCollapsed ? "Show patient panel" : "Hide patient panel"}
          className="consultation-workspace__panel-toggle"
          aria-label={leftCollapsed ? "Expand left panel" : "Collapse left panel"}
        >
          {leftCollapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5" />
          )}
        </button>

        {leftCollapsed && (
          <div className="consultation-workspace__collapsed-patient min-w-0">
            <span className="font-semibold text-slate-800 truncate">{appointment.patientName}</span>
            {appointment.chiefComplaint?.trim() && (
              <>
                <span className="text-slate-300 mx-1.5">·</span>
                <span className="text-slate-500 truncate">{appointment.chiefComplaint}</span>
              </>
            )}
          </div>
        )}
      </div>
    )

    return (
      <form id={formId} onSubmit={onSubmit} className="min-h-0 flex flex-col h-full">
        <div className="flex-1 min-h-0 px-3">
          <ConsultationWorkspace
            leftCollapsed={leftCollapsed}
            left={
              <ConsultationContextPanel
                appointment={appointment}
                patientHistory={patientHistory}
                historyDocuments={historyDocuments}
                onDocumentClick={onDocumentClick}
                latestRecommendation={latestRecommendation}
                onLastVisitClick={onLastVisitClick}
                isReturningPatient={isReturningPatient}
                extraBottom={leftExtraBottom}
              />
            }
            center={
              <ConsultationClinicalPanel
                appointment={appointment}
                completionData={completionData}
                updating={updating}
                aiDiagnosisText={aiDiagnosisText}
                loadingAiDiagnosis={loadingAiDiagnosis}
                showAiDiagnosisSuggestion={showAiDiagnosisSuggestion}
                onCompletionDataChange={onCompletionDataChange}
                onGenerateAiDiagnosis={onGenerateAiDiagnosis}
                onAiDiagnosisRegenerate={onAiDiagnosisRegenerate}
                onDeclineAiDiagnosis={onDeclineAiDiagnosis}
                onCompleteConsultation={() => onSubmit({} as React.FormEvent)}
                showCompletionForm={Boolean(formId)}
                extraContent={centerExtraContent}
                headerLeading={headerLeading}
              />
            }
          />
        </div>
        {actionBar}
        {!formId && (
          <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-white">
            <button
              type="button"
              disabled={updating || !hasClinicalDocumentation(completionData)}
              onClick={() => setShowCompleteConfirm(true)}
              className="inline-flex items-center justify-center gap-2 h-10 min-w-[150px] rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Complete Checkup
            </button>
            <button
              type="button"
              onClick={onAdmitClick}
              disabled={updating || admitting || !hasClinicalDocumentation(completionData)}
              className="inline-flex items-center justify-center gap-2 h-10 min-w-[150px] rounded-lg border border-slate-800 bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Admit Patient
            </button>
          </div>
        )}
        {showCompleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
              <h3 className="text-base font-semibold text-slate-900 mb-2">Complete this checkup?</h3>
              <p className="text-sm text-slate-600 mb-4">
                This will finalize the doctor&apos;s notes and prescription for this visit.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCompleteConfirm(false)} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
          {suggestionApplied && (
            <p className="mx-3 mb-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Suggestion added to consultation notes above.
            </p>
          )}
          <textarea
            ref={notesTextareaRef}
            value={completionData.notes || ""}
            onChange={(e) => handleNotesChange(e.target.value)}
            rows={3}
            style={{ minHeight: "90px" }}
            placeholder="Enter diagnosis, symptoms, or doctor observations..."
            className="w-full rounded-b-xl border-0 p-4 pt-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 resize-y"
          />
        </div>
      </section>

      {/* Section 1b — clinical data suggestion */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Clinical data suggestion</h3>
            <p className="text-xs text-slate-500 mt-0.5">Suggested diagnosis from complaint, history, and patient profile</p>
          </div>
          {!showAiDiagnosisSuggestion && !loadingAiDiagnosis && !aiDiagnosisText && (
            <button
              type="button"
              onClick={onGenerateAiDiagnosis}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Generate suggestion
            </button>
          )}
        </div>
        {(showAiDiagnosisSuggestion || loadingAiDiagnosis) && (
          <AIDiagnosisSuggestion
            appointment={appointment}
            aiDiagnosisText={aiDiagnosisText}
            isLoading={loadingAiDiagnosis}
            showCompletionForm={Boolean(formId)}
            updating={updating}
            onClose={onDeclineAiDiagnosis}
            onRegenerate={onAiDiagnosisRegenerate}
            onApplyToNotes={aiDiagnosisText?.trim() ? handleApplyDiagnosisToNotes : undefined}
            onCompleteConsultation={() => onSubmit({} as React.FormEvent)}
          />
        )}
      </section>

      {/* Divider */}
      <div className="border-t border-slate-200 mb-6" />

      {/* Section 2 — Prescription */}
      <section className="mb-6">
        <h3 className="text-base font-semibold text-slate-900 mb-2.5">
          Prescription <span className="text-xs font-normal text-slate-400">(optional)</span>
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
        <PrescriptionPanel
          title="Prescription"
          description="Add medicines for this consultation"
          className="mt-4"
        >
          <MedicineForm
            appointmentId={appointment.id}
            medicines={completionData.medicines || []}
            medicineSuggestions={medicineSuggestions}
            medicineSuggestionsLoading={medicineSuggestionsLoading}
            onMedicinesChange={handleMedicinesChange}
          />
        </PrescriptionPanel>
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
            disabled={updating || !hasClinicalDocumentation(completionData)}
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
            disabled={updating || admitting || !hasClinicalDocumentation(completionData)}
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

