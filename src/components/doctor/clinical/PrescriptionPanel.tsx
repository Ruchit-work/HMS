"use client"

import React from "react"
import { Pill } from "lucide-react"

interface PrescriptionPanelProps {
  title?: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export default function PrescriptionPanel({
  title = "Prescription",
  description,
  children,
  actions,
  footer,
  className = "",
}: PrescriptionPanelProps) {
  return (
    <div className={`prescription-panel ${className}`}>
      <div className="prescription-panel__header">
        <div className="flex items-center gap-2.5">
          <div className="prescription-panel__icon" aria-hidden>
            <Pill className="w-4 h-4 text-teal-700" />
          </div>
          <div>
            <h3 className="prescription-panel__title">{title}</h3>
            {description && (
              <p className="prescription-panel__description">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="prescription-panel__body">{children}</div>
      {footer && <div className="prescription-panel__footer">{footer}</div>}
    </div>
  )
}
