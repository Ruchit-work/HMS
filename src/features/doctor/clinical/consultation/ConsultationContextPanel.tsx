"use client"

import React from "react"
import type { Appointment } from "@/types/patient"
import type { DocumentMetadata } from "@/types/document"
import ClinicalStatusBadge from "@/features/doctor/clinical/ClinicalStatusBadge"
import ClinicalTimeline from "@/features/doctor/clinical/ClinicalTimeline"
import ClinicalReportsPanel from "@/features/doctor/clinical/ClinicalReportsPanel"
import ClinicalPanel from "@/features/doctor/clinical/ClinicalPanel"
import {
  buildClinicalTimelineItems,
  extractPreviousDiagnoses,
  flattenHistoryDocuments,
  getVitalsList,
} from "@/features/doctor/clinical/patientClinicalUtils"
import { calculateAge } from "@/utils/shared/date"
import { AlertTriangle, FileText, Heart, History, User } from "lucide-react"

interface LatestRecommendation {
  finalDiagnosis: string[]
  medicine?: string | null
  notes?: string | null
  date?: string
}

interface ConsultationContextPanelProps {
  appointment: Appointment
  patientHistory: Appointment[]
  historyDocuments?: Record<string, DocumentMetadata[]>
  onDocumentClick?: (doc: DocumentMetadata) => void
  latestRecommendation?: LatestRecommendation | null
  onLastVisitClick?: () => void
  isReturningPatient?: boolean
  extraBottom?: React.ReactNode
}

function getInitials(name?: string) {
  if (!name) return "P"
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

export default function ConsultationContextPanel({
  appointment,
  patientHistory,
  historyDocuments,
  onDocumentClick,
  latestRecommendation,
  onLastVisitClick,
  isReturningPatient,
  extraBottom,
}: ConsultationContextPanelProps) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null
  const vitals = getVitalsList(appointment)
  const timelineItems = buildClinicalTimelineItems(patientHistory, appointment.patientId).slice(0, 4)
  const reportDocs = historyDocuments ? flattenHistoryDocuments(historyDocuments) : []
  const priorDiagnoses = extractPreviousDiagnoses(patientHistory, appointment.id).slice(0, 5)
  const visitId = appointment.id.slice(0, 8).toUpperCase()

  return (
    <div className="consultation-context-panel flex flex-col h-full min-h-0">
      <ClinicalPanel
        title="Patient summary"
        icon={<User className="w-3.5 h-3.5" />}
        className="shrink-0"
        bodyClassName="space-y-2"
      >
        <div className="flex items-start gap-2.5">
          <div className="patient-summary-card__avatar w-10 h-10 text-sm shrink-0">
            {getInitials(appointment.patientName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{appointment.patientName}</h3>
              <ClinicalStatusBadge status={appointment.status} size="sm" />
              {isReturningPatient && (
                <span className="patient-summary-card__tag patient-summary-card__tag--returning text-[10px]">
                  Returning
                </span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-slate-600">
              {age != null && <span>{age} yrs</span>}
              {appointment.patientGender && <span>{appointment.patientGender}</span>}
              {appointment.patientBloodGroup && <span>{appointment.patientBloodGroup}</span>}
              <span className="font-mono text-slate-400">#{visitId}</span>
            </div>
          </div>
        </div>
      </ClinicalPanel>

      {appointment.patientAllergies?.trim() && (
        <div className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-900">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="line-clamp-2">{appointment.patientAllergies}</span>
        </div>
      )}

      {vitals.length > 0 && (
        <ClinicalPanel title="Vitals" icon={<Heart className="w-3.5 h-3.5" />} className="shrink-0">
          <div className="grid grid-cols-2 gap-1.5">
            {vitals.map((v) => (
              <div key={v.label} className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{v.label}</p>
                <p className="text-xs font-semibold text-slate-800">{v.value}</p>
              </div>
            ))}
          </div>
        </ClinicalPanel>
      )}

      {(appointment.medicalHistory?.trim() ||
        appointment.patientFamilyHistory?.trim() ||
        appointment.patientCurrentMedications?.trim() ||
        priorDiagnoses.length > 0) && (
        <ClinicalPanel title="Medical history" className="shrink-0" bodyClassName="space-y-2 text-xs">
          {appointment.medicalHistory?.trim() && (
            <div>
              <p className="font-semibold text-slate-500 mb-0.5">Conditions</p>
              <p className="text-slate-700 line-clamp-3">{appointment.medicalHistory}</p>
            </div>
          )}
          {appointment.patientFamilyHistory?.trim() && (
            <div>
              <p className="font-semibold text-slate-500 mb-0.5">Family history</p>
              <p className="text-slate-700 line-clamp-2">{appointment.patientFamilyHistory}</p>
            </div>
          )}
          {appointment.patientCurrentMedications?.trim() && (
            <div>
              <p className="font-semibold text-slate-500 mb-0.5">Current medications</p>
              <p className="text-slate-700 line-clamp-2">{appointment.patientCurrentMedications}</p>
            </div>
          )}
          {priorDiagnoses.length > 0 && (
            <div>
              <p className="font-semibold text-slate-500 mb-1">Prior diagnoses</p>
              <div className="flex flex-wrap gap-1">
                {priorDiagnoses.map((d) => (
                  <span
                    key={d}
                    className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </ClinicalPanel>
      )}

      {latestRecommendation && (
        <ClinicalPanel title="Last visit" className="shrink-0" collapsible>
          <p className="text-xs font-medium text-slate-800">{latestRecommendation.date}</p>
          {latestRecommendation.finalDiagnosis?.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-600 line-clamp-2">
              {latestRecommendation.finalDiagnosis.join(", ")}
            </p>
          )}
          <details className="mt-2 group">
            <summary className="text-[10px] font-semibold text-teal-700 cursor-pointer hover:underline list-none">
              View full last visit
            </summary>
            <div className="mt-2 space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 text-xs text-slate-700">
              {latestRecommendation.medicine?.trim() ? (
                <div>
                  <p className="font-semibold text-slate-500 mb-0.5">Prescription</p>
                  <p className="whitespace-pre-line line-clamp-6">{latestRecommendation.medicine}</p>
                </div>
              ) : (
                <p className="text-slate-400 italic">No prescription recorded.</p>
              )}
              {latestRecommendation.notes?.trim() && (
                <div>
                  <p className="font-semibold text-slate-500 mb-0.5">Notes</p>
                  <p className="whitespace-pre-line line-clamp-4">{latestRecommendation.notes}</p>
                </div>
              )}
            </div>
          </details>
        </ClinicalPanel>
      )}

      {reportDocs.length > 0 && onDocumentClick && (
        <ClinicalPanel title="Reports" icon={<FileText className="w-3.5 h-3.5" />} className="shrink-0">
          <ClinicalReportsPanel
            documents={reportDocs}
            currentAppointmentId={appointment.id}
            patientId={appointment.patientId}
            patientUid={appointment.patientUid || appointment.patientId || ""}
            onDocumentClick={onDocumentClick}
            compact
            maxItems={3}
          />
        </ClinicalPanel>
      )}

      <ClinicalPanel
        title="Visit timeline"
        icon={<History className="w-3.5 h-3.5" />}
        className="shrink-0"
        collapsible
        defaultCollapsed
        bodyClassName="clinical-panel__body--flush p-0 max-h-[9.5rem] overflow-y-auto"
        noPadding
      >
        <div className="px-2 py-1.5">
          <ClinicalTimeline
            items={timelineItems}
            emptyMessage="No prior visits."
            compact
          />
        </div>
      </ClinicalPanel>

      {extraBottom}
    </div>
  )
}
