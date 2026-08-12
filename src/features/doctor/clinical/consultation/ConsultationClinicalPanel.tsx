"use client"

import React, { useCallback, useRef, useState } from "react"
import type { Appointment } from "@/types/patient"
import type { CompletionFormEntry } from "@/types/appointments"
import ClinicalPanel from "@/features/doctor/clinical/ClinicalPanel"
import { ClipboardList, FileText, Microscope, Stethoscope } from "lucide-react"
import { mergeConsultationNotes, splitConsultationNotes } from "./consultationNotesUtils"

interface ConsultationClinicalPanelProps {
  appointment: Appointment
  completionData: CompletionFormEntry
  updating: boolean
  aiDiagnosisText?: string
  loadingAiDiagnosis?: boolean
  showAiDiagnosisSuggestion?: boolean
  onCompletionDataChange: (data: CompletionFormEntry) => void
  onGenerateAiDiagnosis?: () => void
  onAiDiagnosisRegenerate?: () => void
  onDeclineAiDiagnosis?: () => void
  onCompleteConsultation: () => void
  showCompletionForm?: boolean
  extraContent?: React.ReactNode
  /** Slot rendered as the first item in the header row (e.g. toggle button + patient chip) */
  headerLeading?: React.ReactNode
}

export default function ConsultationClinicalPanel({
  appointment,
  completionData,
  onCompletionDataChange,
  extraContent,
  headerLeading,
}: ConsultationClinicalPanelProps) {
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle")
  const draftSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completionDataRef = useRef(completionData)
  completionDataRef.current = completionData

  const [examinationFindings, setExaminationFindings] = useState(
    () => splitConsultationNotes(completionData.notes || "").examinationFindings
  )

  const markDraftSaved = useCallback(() => {
    setDraftStatus("saving")
    if (draftSavedTimeoutRef.current) clearTimeout(draftSavedTimeoutRef.current)
    draftSavedTimeoutRef.current = setTimeout(() => {
      draftSavedTimeoutRef.current = null
      setDraftStatus("saved")
      setTimeout(() => setDraftStatus("idle"), 2000)
    }, 400)
  }, [])

  const handleExaminationChange = (value: string) => {
    setExaminationFindings(value)
    const currentClinical = splitConsultationNotes(completionDataRef.current.notes || "").clinicalNotes
    onCompletionDataChange({
      ...completionDataRef.current,
      notes: mergeConsultationNotes(currentClinical, value),
    })
    markDraftSaved()
  }

  const handleAssessmentChange = (value: string) => {
    onCompletionDataChange({
      ...completionDataRef.current,
      assessment: value,
    })
    markDraftSaved()
  }

  const handleDiagnosisChange = (value: string) => {
    onCompletionDataChange({
      ...completionDataRef.current,
      customDiagnosis: value,
    })
    markDraftSaved()
  }

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

        <ClinicalPanel title="Assessment" icon={<FileText className="w-3.5 h-3.5" />} collapsible>
          <textarea
            value={completionData.assessment || ""}
            onChange={(e) => handleAssessmentChange(e.target.value)}
            rows={2}
            placeholder="Doctor's clinical assessment / impression…"
            className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 resize-y min-h-[52px]"
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
