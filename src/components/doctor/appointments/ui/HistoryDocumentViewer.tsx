"use client"

import DocumentViewer from "@/components/documents/DocumentViewer"
import { DocumentMetadata } from "@/types/document"

interface HistoryDocumentViewerProps {
  document: DocumentMetadata | null
  onClose: () => void
}

export function HistoryDocumentViewer({ document, onClose }: HistoryDocumentViewerProps) {
  if (!document) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[92vh] flex flex-col overflow-y-auto">
        <DocumentViewer
          document={document}
          onClose={onClose}
          canEdit={false}
          canDelete={false}
        />
      </div>
    </div>
  )
}


