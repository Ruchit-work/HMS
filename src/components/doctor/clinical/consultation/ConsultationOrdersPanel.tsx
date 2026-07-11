"use client"

import { Button } from "@/components/ui/Button"
import { FileUp, FolderOpen } from "lucide-react"

interface ConsultationOrdersPanelProps {
  onOpenDocuments?: () => void
  onToggleUpload?: () => void
  showDocumentUpload?: boolean
}

export default function ConsultationOrdersPanel({
  onOpenDocuments,
  onToggleUpload,
  showDocumentUpload,
}: ConsultationOrdersPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50/70">
        <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500 flex-1">
          Clinical documents
        </h4>
        {onOpenDocuments && (
          <button
            type="button"
            onClick={onOpenDocuments}
            className="text-[11px] font-medium text-slate-400 hover:text-sky-600 hover:underline whitespace-nowrap"
          >
            View all
          </button>
        )}
      </div>
      <div className="p-3">
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onToggleUpload}>
          <FileUp className="w-3.5 h-3.5" />
          {showDocumentUpload ? "Hide upload" : "Upload document"}
        </Button>
      </div>
    </div>
  )
}
