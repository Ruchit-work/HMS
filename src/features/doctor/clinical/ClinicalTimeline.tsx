"use client"

import React from "react"
import ClinicalStatusBadge from "./ClinicalStatusBadge"
import ClinicalEmptyState from "./ClinicalEmptyState"

export interface ClinicalTimelineItem {
  id: string
  date: string
  title: string
  subtitle?: string
  description?: string
  status?: string
  badges?: string[]
  onClick?: () => void
  actions?: React.ReactNode
}

interface ClinicalTimelineProps {
  items: ClinicalTimelineItem[]
  emptyMessage?: string
  emptyDescription?: string
  className?: string
  compact?: boolean
}

export default function ClinicalTimeline({
  items,
  emptyMessage = "No history available",
  emptyDescription,
  className = "",
  compact = false,
}: ClinicalTimelineProps) {
  if (items.length === 0) {
    return (
      <ClinicalEmptyState
        compact
        illustration="consultation"
        title={emptyMessage}
        description={emptyDescription}
        className={className}
      />
    )
  }

  return (
    <div className={`clinical-timeline ${compact ? "clinical-timeline--compact" : ""} ${className}`.trim()}>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`clinical-timeline__item ${item.onClick ? "clinical-timeline__item--clickable" : ""}`}
          onClick={item.onClick}
          onKeyDown={
            item.onClick
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    item.onClick?.()
                  }
                }
              : undefined
          }
          role={item.onClick ? "button" : undefined}
          tabIndex={item.onClick ? 0 : undefined}
        >
          <div className="clinical-timeline__rail">
            <div className="clinical-timeline__dot" />
            {index < items.length - 1 && <div className="clinical-timeline__line" />}
          </div>
          <div className="clinical-timeline__content">
            <div className="flex items-start justify-between gap-1.5">
              <div className="min-w-0">
                <p className="clinical-timeline__date">{item.date}</p>
                <p className="clinical-timeline__title">{item.title}</p>
                {!compact && item.subtitle && (
                  <p className="clinical-timeline__subtitle">{item.subtitle}</p>
                )}
              </div>
              {!compact && (
                <div className="flex items-center gap-1 shrink-0">
                  {item.status && <ClinicalStatusBadge status={item.status} size="sm" />}
                  {item.actions}
                </div>
              )}
            </div>
            {!compact && item.badges && item.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {item.badges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
            {item.description && (
              <p
                className={`clinical-timeline__description ${
                  compact ? "clinical-timeline__description--compact" : ""
                }`}
              >
                {item.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
