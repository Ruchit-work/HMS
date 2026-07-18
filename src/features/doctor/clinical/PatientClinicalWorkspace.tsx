"use client"

import React from "react"
import type { Appointment } from "@/types/patient"
import type { DocumentMetadata } from "@/types/document"
import ClinicalTimeline from "@/features/doctor/clinical/ClinicalTimeline"
import ClinicalStatusBadge from "@/features/doctor/clinical/ClinicalStatusBadge"
import ClinicalReportsPanel from "@/features/doctor/clinical/ClinicalReportsPanel"
import ClinicalPanel from "@/features/doctor/clinical/ClinicalPanel"
import ClinicalChipList from "@/features/doctor/clinical/ClinicalChipList"
import PatientAvatar from "@/features/doctor/clinical/PatientAvatar"
import ClinicalSummaryCard from "@/features/doctor/appointments/ui/ClinicalSummaryCard"
import MedicalInfoSection from "@/features/doctor/appointments/sections/MedicalInfoSection"
import LifestyleSection from "@/features/doctor/appointments/sections/LifestyleSection"
import PatientHistorySection from "@/features/doctor/appointments/sections/PatientHistorySection"
import { Button } from '@/shared/components'
import { calculateAge } from "@/shared/utils/shared/date"
import { parsePrescription as parsePrescriptionUtil } from "@/shared/utils/appointments/prescriptionParsers"
import {
  buildClinicalTimelineItems,
  extractCurrentMedications,
  extractMedicationsFromHistory,
  extractPreviousDiagnoses,
  flattenHistoryDocuments,
  getEmergencyInfo,
  getVitalsList,
} from "@/features/doctor/clinical/patientClinicalUtils"
import {
  AlertTriangle,
  FileText,
  FolderOpen,
  History,
  Pill,
  Play,
  Stethoscope,
} from "lucide-react"

interface LatestRecommendation {
  finalDiagnosis: string[]
  medicine?: string | null
  notes?: string | null
  date?: string
}

interface PatientClinicalWorkspaceProps {
  appointment: Appointment
  patientHistory: Appointment[]
  historyDocuments: Record<string, DocumentMetadata[]>
  historyFilters: { text: string; date: string }
  showHistory: boolean
  onToggleHistory: () => void
  onDocumentClick: (doc: DocumentMetadata) => void
  latestRecommendation: LatestRecommendation | null
  onLastVisitClick?: () => void
  onOpenDocuments?: () => void
  onOpenConsentVideo?: () => void
  isReturningPatient?: boolean
  isHistoryView?: boolean
  onDownloadPdf?: () => void
}

export default function PatientClinicalWorkspace({
  appointment,
  patientHistory,
  historyDocuments,
  historyFilters,
  showHistory,
  onToggleHistory,
  onDocumentClick,
  latestRecommendation,
  onLastVisitClick,
  onOpenDocuments,
  onOpenConsentVideo,
  isReturningPatient,
  isHistoryView = false,
  onDownloadPdf,
}: PatientClinicalWorkspaceProps) {
  const age = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null
  const vitals = getVitalsList(appointment)
  const allDocs = flattenHistoryDocuments(historyDocuments)
  const timelineItems = buildClinicalTimelineItems(patientHistory, appointment.patientId)
  const previousDiagnoses = extractPreviousDiagnoses(patientHistory, appointment.id)
  const currentMeds = [
    ...extractCurrentMedications(appointment),
    ...extractMedicationsFromHistory(
      patientHistory.filter((h) => h.id !== appointment.id && h.status === "completed")
    ),
  ].filter((m, i, arr) => arr.indexOf(m) === i)
  const emergencyInfo = getEmergencyInfo(appointment)

  const visitDateLabel = new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  return (
    <div className="flex flex-col min-h-0">
      {/* ── Clinical summary header ── */}
      <div className="patient-summary-card shrink-0">
        <div className="patient-summary-card__inner">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <PatientAvatar name={appointment.patientName} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="patient-summary-card__name text-xl">{appointment.patientName}</h2>
                  <ClinicalStatusBadge status={appointment.status} size="sm" />
                  {isReturningPatient === true && (
                    <span className="patient-summary-card__tag patient-summary-card__tag--returning">Returning</span>
                  )}
                  {isReturningPatient === false && (
                    <span className="patient-summary-card__tag patient-summary-card__tag--new">New</span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {age != null && <span><strong className="text-slate-800">Age</strong> {age} yrs</span>}
                  {appointment.patientGender && <span><strong className="text-slate-800">Gender</strong> {appointment.patientGender}</span>}
                  {appointment.patientBloodGroup && <span><strong className="text-slate-800">Blood</strong> {appointment.patientBloodGroup}</span>}
                  {appointment.patientPhone && <span>{appointment.patientPhone}</span>}
                </div>

                {appointment.patientAllergies?.trim() && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Allergy: {appointment.patientAllergies}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:w-56 shrink-0 space-y-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Current visit</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{visitDateLabel} · {appointment.appointmentTime}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{appointment.chiefComplaint || "—"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Doctor</p>
                <p className="text-sm font-medium text-slate-800 mt-0.5">Dr. {appointment.doctorName}</p>
                <p className="text-xs text-slate-500 truncate">{appointment.doctorSpecialization}</p>
              </div>
            </div>
          </div>

          {vitals.length > 0 && (
            <div className="patient-summary-card__vitals mt-4">
              {vitals.map((v) => (
                <div key={v.label} className="patient-summary-card__vital">
                  <span className="patient-summary-card__vital-label">{v.label}</span>
                  <span className="patient-summary-card__vital-value">{v.value}</span>
                </div>
              ))}
            </div>
          )}

          {!isHistoryView && (onOpenDocuments || onOpenConsentVideo) && (
            <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-100">
              {onOpenDocuments && (
                <Button type="button" variant="outline" size="sm" onClick={onOpenDocuments}>
                  <FolderOpen className="w-4 h-4" />
                  Documents
                </Button>
              )}
              {onOpenConsentVideo && (
                <Button type="button" variant="secondary" size="sm" onClick={onOpenConsentVideo}>
                  <Play className="w-4 h-4" />
                  Consent
                </Button>
              )}
            </div>
          )}

          {isHistoryView && onDownloadPdf && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={onDownloadPdf}>
                Download visit PDF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Last visit snapshot (if returning) ── */}
      {latestRecommendation && !isHistoryView && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last visit</p>
            {onLastVisitClick && (
              <button type="button" onClick={onLastVisitClick} className="text-xs font-semibold text-[var(--color-primary-dark)] hover:underline">
                View details
              </button>
            )}
          </div>
          <ClinicalSummaryCard
            appointment={appointment}
            latestRecommendation={latestRecommendation}
            minimal
            onClick={onLastVisitClick}
          />
        </div>
      )}

      {/* ── History visit summary (completed record) ── */}
      {isHistoryView && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {appointment.chiefComplaint?.trim() && (
            <ClinicalPanel title="Chief complaint" icon={<Stethoscope className="w-4 h-4" />} className="md:col-span-2 max-h-none [&>div:last-child]:max-h-none">
              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{appointment.chiefComplaint}</p>
            </ClinicalPanel>
          )}
          <ClinicalPanel title="Visit diagnosis" icon={<Stethoscope className="w-4 h-4" />}>
            {Array.isArray((appointment as Appointment & { finalDiagnosis?: string[] }).finalDiagnosis) &&
            (appointment as Appointment & { finalDiagnosis?: string[] }).finalDiagnosis!.length > 0 ? (
              <ClinicalChipList
                items={(appointment as Appointment & { finalDiagnosis?: string[] }).finalDiagnosis!}
                emptyText="No diagnosis recorded."
              />
            ) : (
              <p className="text-xs text-slate-500 italic">No diagnosis recorded.</p>
            )}
          </ClinicalPanel>
          <ClinicalPanel title="Prescription" icon={<Pill className="w-4 h-4" />}>
            {appointment.medicine ? (
              (() => {
                const parsed = parsePrescriptionUtil(appointment.medicine)
                if (parsed && parsed.medicines.length > 0) {
                  return (
                    <ul className="space-y-1">
                      {parsed.medicines.map((med, index) => (
                        <li key={index} className="flex items-center gap-2 text-xs text-slate-800">
                          <span>{med.emoji}</span>
                          <span>
                            {med.name}
                            {med.dosage && <span className="ml-1 text-slate-500">({med.dosage})</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                }
                return <p className="text-xs text-slate-700 whitespace-pre-line">{appointment.medicine}</p>
              })()
            ) : (
              <p className="text-xs text-slate-500 italic">No prescription recorded.</p>
            )}
          </ClinicalPanel>
          <ClinicalPanel title="Visit notes" icon={<FileText className="w-4 h-4" />} className="md:col-span-2 max-h-none [&>div:last-child]:max-h-none">
            <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
              {appointment.doctorNotes?.trim() || "No notes recorded."}
            </p>
          </ClinicalPanel>
        </div>
      )}

      {/* ── Clinical panels grid — visible without deep scrolling ── */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0 [&>*]:min-h-[10rem] [&>*]:max-h-[14rem]">
        <ClinicalPanel title="Clinical timeline" icon={<History className="w-4 h-4" />} badge={timelineItems.length}>
          <ClinicalTimeline items={timelineItems.slice(0, 5)} emptyMessage="No prior visits recorded." />
        </ClinicalPanel>

        <ClinicalPanel title="Previous diagnoses" icon={<Stethoscope className="w-4 h-4" />} badge={previousDiagnoses.length}>
          <ClinicalChipList items={previousDiagnoses} emptyText="No prior diagnoses on record." />
        </ClinicalPanel>

        <ClinicalPanel title="Current medications" icon={<Pill className="w-4 h-4" />} badge={currentMeds.length}>
          <ClinicalChipList items={currentMeds} emptyText="No current medications recorded." />
        </ClinicalPanel>

        <ClinicalPanel title="Emergency information" icon={<AlertTriangle className="w-4 h-4" />} badge={emergencyInfo.length}>
          {emergencyInfo.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No emergency flags or critical alerts.</p>
          ) : (
            <ul className="space-y-2">
              {emergencyInfo.map((item) => (
                <li
                  key={item.label}
                  className={`rounded-lg px-2.5 py-2 text-xs ${
                    item.urgent ? "bg-rose-50 border border-rose-200 text-rose-900" : "bg-slate-50 border border-slate-100 text-slate-700"
                  }`}
                >
                  <span className="font-semibold block">{item.label}</span>
                  <span className="mt-0.5 block leading-relaxed">{item.value}</span>
                </li>
              ))}
            </ul>
          )}
        </ClinicalPanel>
      </div>

      {/* ── Reports & documents (patient context) ── */}
      <div className="mt-3">
        <ClinicalPanel
          title="Reports & documents"
          icon={<FileText className="w-4 h-4" />}
          badge={allDocs.length}
          className="max-h-none [&>div:last-child]:max-h-none"
        >
          <ClinicalReportsPanel
            documents={allDocs}
            currentAppointmentId={appointment.id}
            patientId={appointment.patientId}
            patientUid={appointment.patientUid || appointment.patientId || ""}
            appointmentSpecialty={appointment.doctorSpecialization}
            appointmentStatus={appointment.status}
            onDocumentClick={onDocumentClick}
            canUpload={!isHistoryView && appointment.status === "confirmed"}
            canEdit={!isHistoryView && appointment.status === "confirmed"}
            canDelete={!isHistoryView && appointment.status === "confirmed"}
            onlyCurrentAppointment={isHistoryView}
          />
        </ClinicalPanel>
      </div>

      {/* ── Full-width sections ── */}
      <div className="mt-3 space-y-3">
        {patientHistory.length > 0 && (
          <ClinicalPanel title="Visit history" icon={<History className="w-4 h-4" />} className="max-h-none [&>div:last-child]:max-h-[16rem]">
            <PatientHistorySection
              appointment={appointment}
              patientHistory={patientHistory}
              historyDocuments={historyDocuments}
              historyFilters={historyFilters}
              showHistory={showHistory}
              onToggleHistory={onToggleHistory}
              onDocumentClick={onDocumentClick}
            />
          </ClinicalPanel>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ClinicalPanel title="Medical background" icon={<Stethoscope className="w-4 h-4" />} className="max-h-none [&>div:last-child]:max-h-[10rem]">
            <MedicalInfoSection appointment={appointment} minimal />
          </ClinicalPanel>
          <ClinicalPanel title="Lifestyle" icon={<Stethoscope className="w-4 h-4" />} className="max-h-none [&>div:last-child]:max-h-[10rem]">
            <LifestyleSection appointment={appointment} minimal />
          </ClinicalPanel>
        </div>
      </div>
    </div>
  )
}
