"use client"

import type { ReactNode } from "react"

export function HqMetricGrid({
  children,
  columns = 6,
}: {
  children: ReactNode
  columns?: 4 | 5 | 6
}) {
  return (
    <div className={`hq-ds-metric-grid hq-ds-metric-grid--${columns}`} role="list">
      {children}
    </div>
  )
}

export function HqMetricCard({
  label,
  value,
  hint,
  icon,
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="hq-ds-metric-top">
        <p className="hq-ds-metric-label">{label}</p>
        {icon ? <span className="hq-ds-metric-icon">{icon}</span> : null}
      </div>
      <div className="hq-ds-metric-bottom">
        <p className="hq-ds-metric-value">{value}</p>
        {hint ? <span className="hq-ds-metric-hint">{hint}</span> : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button type="button" role="listitem" onClick={onClick} className="hq-ds-metric hq-ds-metric--interactive">
        {body}
      </button>
    )
  }

  return (
    <div role="listitem" className="hq-ds-metric">
      {body}
    </div>
  )
}
