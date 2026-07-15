"use client"

import type { ReactNode } from "react"
import { Button } from '@/shared/components'

export function HqEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}) {
  return (
    <div className="hq-ds-empty">
      {icon ? <div className="hq-ds-empty-icon">{icon}</div> : null}
      <p className="hq-ds-empty-title">{title}</p>
      {description ? <p className="hq-ds-empty-desc">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button type="button" size="sm" className="mt-3" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
