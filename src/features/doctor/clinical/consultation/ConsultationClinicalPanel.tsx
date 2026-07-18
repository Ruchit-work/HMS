"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import type { Appointment } from "@/types/patient"
import type { CompletionFormEntry } from "@/types/appointments"
import AIDiagnosisSuggestion from "@/features/doctor/appointments/ai/AIDiagnosisSuggestion"
import { formatAIDiagnosisForNotes } from "@/shared/utils/appointments/diagnosisParsers"
import VoiceInput from "@/shared/ui/VoiceInput"
import ClinicalPanel from "@/features/doctor/clinical/ClinicalPanel"
import { ClipboardList, FileText, Microscope, Stethoscope } from "lucide-react"
import { mergeConsultationNotes, splitConsultationNotes } from "./consultationNotesUtils"

const NOTE_TEMPLATES = [
  { label: "Normal exam", text: "General examination unremarkable. Patient stable." },
  { label: "ENT routine", text: "ENT examination performed. No acute distress." },
  { label: "Follow-up stable", text: "Follow-up visit. Condition stable on current treatment." },
  { label: "Advised rest", text: "Advised rest, adequate hydration, and symptomatic care." },
]

interface ConsultationClinicalPanelProps {
  appointment: Appointment
  completionData: CompletionFormEntry
  updating: boolean
  aiDiagnosisText?: string
  loadingAiDiagnosis: boolean
  showAiDiagnosisSuggestion: boolean
  onCompletionDataChange: (data: CompletionFormEntry) => void
  onGenerateAiDiagnosis: () => void
  onAiDiagnosisRegenerate: () => void
  onDeclineAiDiagnosis: () => void
  onCompleteConsultation: () => void
  showCompletionForm?: boolean
  extraContent?: React.ReactNode
  /** Slot rendered as the first item in the header row (e.g. toggle button + patient chip) */
  headerLeading?: React.ReactNode
}

export default function ConsultationClinicalPanel({
  appointment,
  completionData,
  updating,
  aiDiagnosisText,
  loadingAiDiagnosis,
  showAiDiagnosisSuggestion,
  onCompletionDataChange,
  onGenerateAiDiagnosis,
  onAiDiagnosisRegenerate,
  onDeclineAiDiagnosis,
  onCompleteConsultation,
  showCompletionForm = true,
  extraContent,
  headerLeading,
}: ConsultationClinicalPanelProps) {
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [suggestionApplied, setSuggestionApplied] = useState(false)
  const draftSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)
  const completionDataRef = useRef(completionData)
  completionDataRef.current = completionData

  // Keep the two note fields in LOCAL state so typing is native.
  // Deriving them from the merged `notes` string on every keystroke trims
  // trailing spaces/newlines, which breaks normal typing (spaces between
  // words, Enter for paragraphs).
  const [clinicalNotes, setClinicalNotes] = useState(
    () => splitConsultationNotes(completionData.notes || "").clinicalNotes
  )
  const [examinationFindings, setExaminationFindings] = useState(
    () => splitConsultationNotes(completionData.notes || "").examinationFindings
  )
  const localNotesRef = useRef({ clinicalNotes, examinationFindings })
  localNotesRef.current = { clinicalNotes, examinationFindings }

  // Resync local fields when notes change externally (draft restore,
  // AI suggestion applied, switching patient) without clobbering typing.
  useEffect(() => {
    const incoming = completionData.notes || ""
    const local = localNotesRef.current
    const localMerged = mergeConsultationNotes(local.clinicalNotes, local.examinationFindings)
    if (incoming !== localMerged) {
      const next = splitConsultationNotes(incoming)
      setClinicalNotes(next.clinicalNotes)
      setExaminationFindings(next.examinationFindings)
    }
  }, [completionData.notes])

  const markDraftSaved = useCallback(() => {
    setDraftStatus("saving")
    if (draftSavedTimeoutRef.current) clearTimeout(draftSavedTimeoutRef.current)
    draftSavedTimeoutRef.current = setTimeout(() => {
      draftSavedTimeoutRef.current = null
      setDraftStatus("saved")
      setTimeout(() => setDraftStatus("idle"), 2000)
    }, 400)
  }, [])

  const updateNotes = useCallback(
    (clinical: string, examination: string) => {
      onCompletionDataChange({
        ...completionDataRef.current,
        notes: mergeConsultationNotes(clinical, examination),
      })
      markDraftSaved()
    },
    [markDraftSaved, onCompletionDataChange]
  )

  const handleClinicalNotesChange = (value: string) => {
    setClinicalNotes(value)
    updateNotes(value, localNotesRef.current.examinationFindings)
  }

  const handleExaminationChange = (value: string) => {
    setExaminationFindings(value)
    updateNotes(localNotesRef.current.clinicalNotes, value)
  }

  const appendTemplate = (text: string) => {
    const existing = clinicalNotes.trim()
    const merged = existing ? `${existing}\n${text}` : text
    handleClinicalNotesChange(merged)
  }

  const handleDiagnosisChange = (value: string) => {
    onCompletionDataChange({
      ...completionDataRef.current,
      customDiagnosis: value,
    })
    markDraftSaved()
  }

  const handleApplyDiagnosisToNotes = useCallback(() => {
    const raw = (aiDiagnosisText || "").trim()
    if (!raw) return

    const summary = formatAIDiagnosisForNotes(raw).trim() || raw.replace(/\*\*/g, "").trim()
    if (!summary) return

    const existing = (completionDataRef.current.customDiagnosis || "").trim()
    const merged = existing ? `${existing}\n${summary}` : summary

    onCompletionDataChange({
      ...completionDataRef.current,
      customDiagnosis: merged,
    })
    setSuggestionApplied(true)
    setDraftStatus("saved")
    setTimeout(() => setSuggestionApplied(false), 2500)
  }, [aiDiagnosisText, onCompletionDataChange])

  const draftIndicator = (
    <span className="text-xs text-slate-500 flex items-center gap-1.5">
      {draftStatus === "saving" && (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Saving draft…
        </>
      )}
      {draftStatus === "saved" && (
        <>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Draft saved
        </>
      )}
      {draftStatus === "idle" && <span className="text-slate-400">Auto-save draft</span>}
    </span>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="consultation-workspace__panel-header consultation-workspace__panel-header--workflow">
        <div className="flex items-center gap-2 min-w-0">
          {headerLeading}
          <h3>Clinical documentation</h3>
        </div>
        {draftIndicator}
      </div>
      <div className="consultation-workspace__panel-scroll p-3 space-y-3">
        <ClinicalPanel
          title="Chief complaint"
          icon={<ClipboardList className="w-3.5 h-3.5" />}
          bodyClassName="text-sm"
          collapsible
          defaultCollapsed={false}
        >
          {appointment.chiefComplaint?.trim() ? (
            <p className="text-sm text-slate-800 leading-relaxed">{appointment.chiefComplaint}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">No chief complaint recorded for this visit.</p>
          )}
          {(appointment.associatedSymptoms?.trim() ||
            appointment.symptomOnset?.trim() ||
            appointment.symptomDuration?.trim()) && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {appointment.associatedSymptoms?.trim() && (
                <span>
                  <span className="font-semibold text-slate-500">Symptoms: </span>
                  {appointment.associatedSymptoms}
                </span>
              )}
              {appointment.symptomOnset?.trim() && (
                <span>
                  <span className="font-semibold text-slate-500">Onset: </span>
                  {appointment.symptomOnset}
                </span>
              )}
              {appointment.symptomDuration?.trim() && (
                <span>
                  <span className="font-semibold text-slate-500">Duration: </span>
                  {appointment.symptomDuration}
                </span>
              )}
            </div>
          )}
        </ClinicalPanel>

        <ClinicalPanel
          title="Clinical notes"
          icon={<FileText className="w-3.5 h-3.5" />}
          collapsible
          actions={
            <div className="flex items-center gap-1.5">
              <VoiceInput
                onTranscript={(text) => handleClinicalNotesChange(text)}
                language="en-IN"
                useGoogleCloud={false}
                useMedicalModel={false}
                allowGujarati
                variant="inline"
              />
            </div>
          }
        >
          <div className="flex flex-wrap gap-1.5 mb-2">
            {NOTE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => appendTemplate(tpl.text)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 transition-colors"
              >
                + {tpl.label}
              </button>
            ))}
          </div>
          {suggestionApplied && (
            <p className="mb-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              AI suggestion applied to diagnosis.
            </p>
          )}
          <textarea
            ref={notesTextareaRef}
            value={clinicalNotes}
            onChange={(e) => handleClinicalNotesChange(e.target.value)}
            rows={3}
            placeholder="History, assessment, plan, and clinical observations…"
            className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 resize-y min-h-[72px]"
          />
        </ClinicalPanel>

        <ClinicalPanel title="Diagnosis" icon={<Stethoscope className="w-3.5 h-3.5" />} collapsible>
          <textarea
            value={completionData.customDiagnosis || ""}
            onChange={(e) => handleDiagnosisChange(e.target.value)}
            rows={2}
            placeholder="Primary and differential diagnosis…"
            className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 resize-y min-h-[52px]"
          />
          <div className="mt-2">
            {(showAiDiagnosisSuggestion || loadingAiDiagnosis) && (
              <AIDiagnosisSuggestion
                appointment={appointment}
                aiDiagnosisText={aiDiagnosisText}
                isLoading={loadingAiDiagnosis}
                showCompletionForm={showCompletionForm}
                updating={updating}
                onClose={onDeclineAiDiagnosis}
                onRegenerate={onAiDiagnosisRegenerate}
                onApplyToNotes={aiDiagnosisText?.trim() ? handleApplyDiagnosisToNotes : undefined}
                onCompleteConsultation={onCompleteConsultation}
              />
            )}
            {!showAiDiagnosisSuggestion && !loadingAiDiagnosis && !aiDiagnosisText && (
              <button
                type="button"
                onClick={onGenerateAiDiagnosis}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
              >
                Generate AI suggestion
              </button>
            )}
          </div>
        </ClinicalPanel>

        <ClinicalPanel
          title="Examination findings"
          icon={<Microscope className="w-3.5 h-3.5" />}
          collapsible
        >
          <textarea
            value={examinationFindings}
            onChange={(e) => handleExaminationChange(e.target.value)}
            rows={2}
            placeholder="Physical examination, ENT findings, systemic exam…"
            className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 resize-y min-h-[52px]"
          />
        </ClinicalPanel>

        {extraContent}
      </div>
    </div>
  )
}
