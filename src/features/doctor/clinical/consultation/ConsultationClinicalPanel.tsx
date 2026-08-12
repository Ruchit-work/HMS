"use client"

import React, { useCallback, useRef, useState } from "react"
import type { Appointment } from "@/types/patient"
import type { CompletionFormEntry } from "@/types/appointments"
import type { DocumentMetadata } from "@/types/document"
import ClinicalPanel from "@/features/doctor/clinical/ClinicalPanel"
import PatientAvatar from "@/features/doctor/clinical/PatientAvatar"
import ClinicalStatusBadge from "@/features/doctor/clinical/ClinicalStatusBadge"
import ClinicalTimeline from "@/features/doctor/clinical/ClinicalTimeline"
import ClinicalReportsPanel from "@/features/doctor/clinical/ClinicalReportsPanel"
import {
  buildClinicalTimelineItems,
  extractPreviousDiagnoses,
  flattenHistoryDocuments,
  getVitalsList,
} from "@/features/doctor/clinical/patientClinicalUtils"
import { calculateAge } from "@/shared/utils/shared/date"
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  FolderOpen,
  History,
  Microscope,
  Pill,
  Stethoscope,
  User,
} from "lucide-react"
import { mergeConsultationNotes, splitConsultationNotes } from "./consultationNotesUtils"

interface ConsultationClinicalPanelProps {
  appointment: Appointment
  completionData: CompletionFormEntry
  updating?: boolean
  patientHistory?: Appointment[]
  historyDocuments?: Record<string, DocumentMetadata[]>
  onDocumentClick?: (doc: DocumentMetadata) => void
  onOpenDocuments?: () => void
  isReturningPatient?: boolean
  aiDiagnosisText?: string
  loadingAiDiagnosis?: boolean
  showAiDiagnosisSuggestion?: boolean
  onCompletionDataChange: (data: CompletionFormEntry) => void
  onGenerateAiDiagnosis?: () => void
  onAiDiagnosisRegenerate?: () => void
  onDeclineAiDiagnosis?: () => void
  onCompleteConsultation?: () => void
  showCompletionForm?: boolean
  extraContent?: React.ReactNode
  headerLeading?: React.ReactNode
}

export default function ConsultationClinicalPanel({
  appointment,
  completionData,
  patientHistory = [],
  historyDocuments,
  onDocumentClick,
  onOpenDocuments,
  isReturningPatient,
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

  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null
  const vitals = getVitalsList(appointment)
  const timelineItems = buildClinicalTimelineItems(patientHistory, appointment.patientId).slice(0, 4)
  const reportDocs = historyDocuments ? flattenHistoryDocuments(historyDocuments) : []
  const priorDiagnoses = extractPreviousDiagnoses(patientHistory, appointment.id).slice(0, 5)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="consultation-workspace__panel-header consultation-workspace__panel-header--workflow shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {headerLeading}
          <h3>Clinical documentation</h3>
        </div>
        {draftIndicator}
      </div>

      <div className="consultation-workspace__panel-scroll p-3 sm:p-4 space-y-4 overflow-y-auto min-h-0 flex-1">
        {/* ROW 1: Patient summary & History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* 1. Patient Summary */}
          <ClinicalPanel
            title="Patient summary"
            icon={<User className="w-3.5 h-3.5 text-sky-600" />}
            className="h-full flex flex-col"
          >
            <div className="flex items-start gap-3">
              <PatientAvatar name={appointment.patientName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 truncate">{appointment.patientName}</h3>
                  <ClinicalStatusBadge status={appointment.status} size="sm" />
                  {isReturningPatient === true && (
                    <span className="patient-summary-card__tag patient-summary-card__tag--returning text-[10px]">
                      Returning
                    </span>
                  )}
                  {isReturningPatient === false && (
                    <span className="patient-summary-card__tag patient-summary-card__tag--new text-[10px]">
                      New
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">
                    ID: <span className="font-bold text-slate-900">{appointment.patientId || appointment.patientUid || appointment.id}</span>
                  </span>
                  {onOpenDocuments && (
                    <button
                      type="button"
                      onClick={onOpenDocuments}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition-colors shadow-2xs cursor-pointer"
                      title="View patient documents"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      View documents
                    </button>
                  )}
                  {age != null && <span><strong className="text-slate-800">Age:</strong> {age} yrs</span>}
                  {appointment.patientGender && <span><strong className="text-slate-800">Gender:</strong> {appointment.patientGender}</span>}
                  {appointment.patientBloodGroup && <span><strong className="text-slate-800">Blood:</strong> {appointment.patientBloodGroup}</span>}
                  {appointment.patientPhone && <span>{appointment.patientPhone}</span>}
                </div>

                {appointment.patientAllergies?.trim() && (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    Allergy: {appointment.patientAllergies}
                  </div>
                )}

                {vitals.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                    {vitals.map((v) => (
                      <div key={v.label} className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-1 text-center">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{v.label}</p>
                        <p className="text-xs font-bold text-slate-800">{v.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ClinicalPanel>

          {/* 2. History */}
          <ClinicalPanel
            title="History"
            icon={<History className="w-3.5 h-3.5 text-sky-600" />}
            className="h-full flex flex-col"
            collapsible
          >
            <div className="space-y-2.5 text-xs text-slate-700 max-h-[16rem] overflow-y-auto pr-1">
              {appointment.medicalHistory?.trim() && (
                <div>
                  <p className="font-semibold text-slate-500 mb-0.5">Medical Conditions</p>
                  <p className="text-slate-800">{appointment.medicalHistory}</p>
                </div>
              )}
              {appointment.patientFamilyHistory?.trim() && (
                <div>
                  <p className="font-semibold text-slate-500 mb-0.5">Family History</p>
                  <p className="text-slate-800">{appointment.patientFamilyHistory}</p>
                </div>
              )}
              {appointment.patientCurrentMedications?.trim() && (
                <div>
                  <p className="font-semibold text-slate-500 mb-0.5">Current Medications</p>
                  <p className="text-slate-800">{appointment.patientCurrentMedications}</p>
                </div>
              )}
              {priorDiagnoses.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-500 mb-1">Prior Diagnoses</p>
                  <div className="flex flex-wrap gap-1">
                    {priorDiagnoses.map((d) => (
                      <span key={d} className="inline-flex rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {timelineItems.length > 0 ? (
                <div className="pt-2 border-t border-slate-100">
                  <p className="font-semibold text-slate-500 mb-1.5">Past Visits Timeline</p>
                  <ClinicalTimeline items={timelineItems} emptyMessage="No prior visits." compact />
                </div>
              ) : (
                !appointment.medicalHistory?.trim() &&
                !appointment.patientFamilyHistory?.trim() &&
                !appointment.patientCurrentMedications?.trim() &&
                priorDiagnoses.length === 0 && (
                  <p className="text-slate-400 italic">No prior medical history recorded for this patient.</p>
                )
              )}
            </div>
          </ClinicalPanel>
        </div>

        {/* ROW 2: Patient Documents & Chief Complaint */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* 3. Patient Documents */}
          <ClinicalPanel
            title="Patient Documents"
            icon={<FileText className="w-3.5 h-3.5 text-sky-600" />}
            className="h-full flex flex-col"
            collapsible
          >
            {reportDocs.length > 0 && onDocumentClick ? (
              <ClinicalReportsPanel
                documents={reportDocs}
                currentAppointmentId={appointment.id}
                patientId={appointment.patientId}
                patientUid={appointment.patientUid || appointment.patientId || ""}
                onDocumentClick={onDocumentClick}
                compact
                maxItems={4}
              />
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                No documents or lab reports attached.
              </div>
            )}
          </ClinicalPanel>

          {/* 4. Chief Complaint */}
          <ClinicalPanel
            title="Chief complaint"
            icon={<ClipboardList className="w-3.5 h-3.5 text-sky-600" />}
            className="h-full flex flex-col"
            collapsible
          >
            {appointment.chiefComplaint?.trim() ? (
              <p className="text-sm font-medium text-slate-800 leading-relaxed">{appointment.chiefComplaint}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No chief complaint recorded for this visit.</p>
            )}
            {(appointment.associatedSymptoms?.trim() ||
              appointment.symptomOnset?.trim() ||
              appointment.symptomDuration?.trim()) && (
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
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
        </div>

        {/* ROW 3: Assessment & Diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* 5. Assessment */}
          <ClinicalPanel
            title="Assessment"
            icon={<FileText className="w-3.5 h-3.5 text-sky-600" />}
            className="h-full flex flex-col"
            collapsible
          >
            <textarea
              value={completionData.assessment || ""}
              onChange={(e) => handleAssessmentChange(e.target.value)}
              rows={3}
              placeholder="Doctor's clinical assessment / impression…"
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 resize-y min-h-[64px]"
            />
          </ClinicalPanel>

          {/* 6. Diagnosis */}
          <ClinicalPanel
            title="Diagnosis"
            icon={<Stethoscope className="w-3.5 h-3.5 text-sky-600" />}
            className="h-full flex flex-col"
            collapsible
          >
            <textarea
              value={completionData.customDiagnosis || ""}
              onChange={(e) => handleDiagnosisChange(e.target.value)}
              rows={3}
              placeholder="Primary and differential diagnosis…"
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 resize-y min-h-[64px]"
            />
          </ClinicalPanel>
        </div>

        {/* ROW 4: Examination Findings & Prescription */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          {/* 7. Examination Findings */}
          <ClinicalPanel
            title="Examination findings"
            icon={<Microscope className="w-3.5 h-3.5 text-sky-600" />}
            className="h-full flex flex-col"
            collapsible
          >
            <textarea
              value={examinationFindings}
              onChange={(e) => handleExaminationChange(e.target.value)}
              rows={4}
              placeholder="Physical examination, ENT findings, systemic exam…"
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 resize-y min-h-[80px]"
            />
          </ClinicalPanel>

          {/* 8. Prescription */}
          <ClinicalPanel
            title="Prescription"
            icon={<Pill className="w-3.5 h-3.5 text-sky-600" />}
            className="h-full flex flex-col"
            collapsible
          >
            {extraContent}
          </ClinicalPanel>
        </div>
      </div>
    </div>
  )
}
