"use client"

import type { ReactNode } from "react"

export type HqHealthLevel = "healthy" | "warning" | "critical" | "offline"

const LABEL: Record<HqHealthLevel, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
}

export function HqHealthBadge({ status }: { status: HqHealthLevel }) {
  return (
    <span className={`hq-ds-health-badge hq-ds-health-badge--${status}`}>
      <span className="hq-ds-health-dot" aria-hidden />
      {LABEL[status]}
    </span>
  )
}

export function HqHealthCard({
  name,
  status,
  detail,
}: {
  name: string
  status: HqHealthLevel
  detail?: string
}) {
  return (
    <div className={`hq-ds-health-card hq-ds-health-card--${status}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="hq-ds-health-name">{name}</p>
        <HqHealthBadge status={status} />
      </div>
      {detail ? <p className="hq-ds-health-detail">{detail}</p> : null}
    </div>
  )
}

export function HqActivityItem({
  title,
  meta,
  icon,
}: {
  title: string
  meta: string
  icon?: ReactNode
}) {
  return (
    <li className="hq-ds-activity-item">
      {icon ? <span className="hq-ds-activity-icon">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <p className="hq-ds-activity-title">{title}</p>
        <p className="hq-ds-activity-meta">{meta}</p>
      </div>
    </li>
  )
}
