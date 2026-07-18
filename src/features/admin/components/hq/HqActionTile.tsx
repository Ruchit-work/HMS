"use client"

import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"

/** Quick action row — Command Center rail / growth CTAs */
export function HqActionTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode
  title: string
  description?: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="hq-ds-action-tile">
      <span className="hq-ds-action-tile-icon">{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="hq-ds-action-tile-title">{title}</span>
        {description ? <span className="hq-ds-action-tile-desc">{description}</span> : null}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
    </button>
  )
}
