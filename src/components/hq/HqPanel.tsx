"use client"

import type { ReactNode } from "react"

/** White console panel — directory, rail cards, forms sections */
export function HqPanel({
  title,
  subtitle,
  actions,
  children,
  padded = false,
  className = "",
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  /** Apply inner padding (for non-table content) */
  padded?: boolean
  className?: string
}) {
  const hasHeader = Boolean(title || subtitle || actions)

  return (
    <section className={`hq-ds-panel ${className}`.trim()}>
      {hasHeader ? (
        <div className="hq-ds-panel-header">
          <div className="min-w-0">
            {title ? <h3 className="hq-ds-panel-title">{title}</h3> : null}
            {subtitle ? <p className="hq-ds-panel-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="hq-ds-panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={padded ? "hq-ds-panel-body" : undefined}>{children}</div>
    </section>
  )
}
