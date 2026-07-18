"use client"

import type { ReactNode } from "react"

export interface FormSectionProps {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  actions?: ReactNode
}

/** Card-grouped form section */
export default function FormSection({
  title,
  description,
  icon,
  children,
  className = "",
  actions,
}: FormSectionProps) {
  return (
    <section className={`rx-form-card ${className}`.trim()}>
      <div className="rx-form-card-header">
        <div className="rx-form-section-header !mb-0">
          {icon ? <div className="rx-form-section-icon">{icon}</div> : null}
          <div className="min-w-0 flex-1">
            <p className="rx-form-section-title">{title}</p>
            {description ? <p className="rx-form-section-desc">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className="rx-form-card-body">{children}</div>
    </section>
  )
}
