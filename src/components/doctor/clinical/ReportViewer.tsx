"use client"

import React from "react"
import { FileText, X } from "lucide-react"

interface ReportViewerProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose?: () => void
  actions?: React.ReactNode
  className?: string
  embedded?: boolean
}

export default function ReportViewer({
  title,
  subtitle,
  children,
  onClose,
  actions,
  className = "",
  embedded = false,
}: ReportViewerProps) {
  if (embedded) {
    return (
      <div className={`report-viewer report-viewer--embedded ${className}`}>
        <div className="report-viewer__header">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="report-viewer__title">{title}</h3>
              {subtitle && <p className="report-viewer__subtitle">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="report-viewer__close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="report-viewer__body">{children}</div>
      </div>
    )
  }

  return (
    <div className={`report-viewer ${className}`}>
      <div className="report-viewer__header">
        <div className="min-w-0">
          <h3 className="report-viewer__title">{title}</h3>
          {subtitle && <p className="report-viewer__subtitle">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="report-viewer__close"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="report-viewer__body">{children}</div>
    </div>
  )
}
