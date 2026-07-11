"use client"

import { useMemo, useState } from "react"
import type { DocumentMetadata } from "@/types/document"
import AppointmentDocuments from "@/components/documents/AppointmentDocuments"
import ClinicalTabBar from "@/components/doctor/clinical/ClinicalTabBar"
import ClinicalEmptyState from "@/components/doctor/clinical/ClinicalEmptyState"
import {
  buildClinicalReportEntries,
  countReportsByCategory,
  filterReportEntries,
  getReportCategoryIcon,
  getReportCategoryLabel,
  type ClinicalReportCategory,
  type ClinicalReportEntry,
} from "@/utils/clinicalReportUtils"
import { AlertTriangle, Eye, FileText } from "lucide-react"

interface ClinicalReportsPanelProps {
  documents: DocumentMetadata[]
  currentAppointmentId: string
  patientId: string
  patientUid: string
  appointmentSpecialty?: string
  appointmentStatus?: string
  onDocumentClick: (doc: DocumentMetadata) => void
  canUpload?: boolean
  canEdit?: boolean
  canDelete?: boolean
  onlyCurrentAppointment?: boolean
  compact?: boolean
  maxItems?: number
}

const CATEGORY_TABS: Array<{ id: ClinicalReportCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "lab", label: "Lab" },
  { id: "radiology", label: "Radiology" },
  { id: "prescription", label: "Rx" },
  { id: "clinical", label: "Clinical" },
  { id: "discharge", label: "Discharge" },
]

function StatusBadge({ entry }: { entry: ClinicalReportEntry }) {
  const toneClass =
    entry.statusTone === "critical"
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : entry.statusTone === "linked"
        ? "bg-teal-50 text-teal-800 border-teal-200"
        : entry.statusTone === "archived"
          ? "bg-slate-100 text-slate-600 border-slate-200"
          : "bg-slate-50 text-slate-600 border-slate-200"

  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass}`}>
      {entry.statusLabel}
    </span>
  )
}

function ReportTimelineCard({
  entry,
  onPreview,
  showTimeline = true,
}: {
  entry: ClinicalReportEntry
  onPreview: () => void
  showTimeline?: boolean
}) {
  return (
    <div className={`clinical-report-card ${entry.isCritical ? "clinical-report-card--critical" : ""}`}>
      {showTimeline && <div className="clinical-report-card__rail" aria-hidden />}
      <div className="clinical-report-card__body">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="text-lg shrink-0 leading-none mt-0.5" aria-hidden>
            {getReportCategoryIcon(entry.category)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {getReportCategoryLabel(entry.category)}
              </span>
              <StatusBadge entry={entry} />
              {entry.isCritical && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  <AlertTriangle className="w-3 h-3" />
                  Critical
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-semibold text-slate-900 truncate">
              {entry.document.originalFileName}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
              <span>{entry.displayDate}</span>
              <span>Dr. {entry.displayDoctor}</span>
            </div>
            {entry.isCritical && entry.criticalSnippet && (
              <p className="mt-1.5 text-[11px] font-medium text-rose-800 bg-rose-50 border border-rose-100 rounded-md px-2 py-1 line-clamp-2">
                {entry.criticalSnippet}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onPreview}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-200 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClinicalReportsPanel({
  documents,
  currentAppointmentId,
  patientId,
  patientUid,
  appointmentSpecialty,
  appointmentStatus,
  onDocumentClick,
  canUpload = false,
  canEdit = false,
  canDelete = false,
  onlyCurrentAppointment = false,
  compact = false,
  maxItems,
}: ClinicalReportsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<ClinicalReportCategory>("all")

  const entries = useMemo(
    () => buildClinicalReportEntries(documents, currentAppointmentId),
    [documents, currentAppointmentId]
  )

  const counts = useMemo(() => countReportsByCategory(entries), [entries])
  const filtered = useMemo(
    () => filterReportEntries(entries, activeCategory),
    [entries, activeCategory]
  )
  const displayEntries = maxItems ? filtered.slice(0, maxItems) : filtered
  const criticalEntries = entries.filter((e) => e.isCritical)

  if (compact) {
    return (
      <div className="space-y-2">
        {criticalEntries.length > 0 && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-900">
            <span className="font-semibold">{criticalEntries.length} critical finding(s)</span> need review
          </div>
        )}
        {displayEntries.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">No reports on file.</p>
        ) : (
          displayEntries.map((entry) => (
            <ReportTimelineCard
              key={entry.id}
              entry={entry}
              onPreview={() => onDocumentClick(entry.document)}
              showTimeline={false}
            />
          ))
        )}
      </div>
    )
  }

  return (
    <div className="clinical-reports-panel">
      {criticalEntries.length > 0 && (
        <div className="clinical-reports-panel__critical-banner">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {criticalEntries.length} report{criticalEntries.length === 1 ? "" : "s"} with critical findings
            </p>
            <p className="text-xs opacity-90 mt-0.5">Review highlighted items below before closing the visit.</p>
          </div>
        </div>
      )}

      <ClinicalTabBar
        tabs={CATEGORY_TABS.filter((tab) => tab.id === "all" || counts[tab.id] > 0).map((tab) => ({
          id: tab.id,
          label: tab.label,
          count: counts[tab.id],
        }))}
        activeId={activeCategory}
        onChange={setActiveCategory}
        size="sm"
      />

      <div className="clinical-reports-panel__timeline">
        {displayEntries.length === 0 ? (
          <ClinicalEmptyState
            compact
            illustration="documents"
            title="No reports in this category"
            className="py-6"
          />
        ) : (
          displayEntries.map((entry) => (
            <ReportTimelineCard
              key={entry.id}
              entry={entry}
              onPreview={() => onDocumentClick(entry.document)}
            />
          ))
        )}
      </div>

      {(canUpload || canEdit) && (
        <div className="clinical-reports-panel__upload border-t border-slate-100 pt-3 mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Upload &amp; manage
          </p>
          <AppointmentDocuments
            appointmentId={currentAppointmentId}
            patientId={patientId}
            patientUid={patientUid}
            appointmentSpecialty={appointmentSpecialty}
            appointmentStatus={appointmentStatus}
            canUpload={canUpload}
            canEdit={canEdit}
            canDelete={canDelete}
            onlyCurrentAppointment={onlyCurrentAppointment}
          />
        </div>
      )}
    </div>
  )
}
