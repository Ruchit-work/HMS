"use client"

import DocumentViewer from "@/features/documents/DocumentViewer"
import { DocumentMetadata } from "@/types/document"
import ReportViewer from "@/features/doctor/clinical/ReportViewer"
import {
  buildClinicalReportEntries,
  formatReportDate,
  getReportDoctor,
} from "@/shared/utils/clinicalReportUtils"

interface HistoryDocumentViewerProps {
  document: DocumentMetadata | null
  onClose: () => void
  currentAppointmentId?: string
}

export function HistoryDocumentViewer({
  document,
  onClose,
  currentAppointmentId,
}: HistoryDocumentViewerProps) {
  if (!document) return null

  const entry = buildClinicalReportEntries([document], currentAppointmentId)[0]
  const subtitle = [
    formatReportDate(document),
    getReportDoctor(document) !== "—" ? `Dr. ${getReportDoctor(document)}` : null,
    entry?.statusLabel,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl h-[92vh]">
        <ReportViewer
          title={document.originalFileName || "Document"}
          subtitle={subtitle}
          onClose={onClose}
          className={`h-full ${entry?.isCritical ? "report-viewer--critical" : ""}`}
        >
          {entry?.isCritical && entry.criticalSnippet && (
            <div className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              <span className="font-semibold">Critical finding: </span>
              {entry.criticalSnippet}
            </div>
          )}
          <DocumentViewer
            document={document}
            onClose={onClose}
            canEdit={false}
            canDelete={false}
          />
        </ReportViewer>
      </div>
    </div>
  )
}
