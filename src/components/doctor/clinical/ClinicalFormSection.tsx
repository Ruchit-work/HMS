"use client"

import React from "react"

interface ClinicalFormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
}

export default function ClinicalFormSection({
  title,
  description,
  children,
  actions,
  className = "",
}: ClinicalFormSectionProps) {
  return (
    <section className={`clinical-form-section clinical-surface overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="px-4 sm:px-5 py-4">{children}</div>
    </section>
  )
}
