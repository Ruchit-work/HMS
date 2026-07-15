"use client"

import type { ReactNode } from "react"

/**
 * Console-style page header (Stripe / Firebase density).
 * Prefer this inside HQ pages over repeating local H1 blocks.
 */
export function HqPageHeader({
  eyebrow = "Harmony HMS · Platform",
  title,
  description,
  actions,
  variant = "default",
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  /** `hero` for Command Center; `default` for directories */
  variant?: "default" | "hero"
}) {
  return (
    <header className={variant === "hero" ? "hq-ds-hero" : "hq-ds-page-header"}>
      <div className="hq-ds-page-header-meta min-w-0 flex-1">
        <p className="hq-ds-eyebrow">{eyebrow}</p>
        <h2 className={variant === "hero" ? "hq-ds-hero-title" : "hq-ds-title"}>{title}</h2>
        {description ? <p className="hq-ds-desc">{description}</p> : null}
      </div>
      {actions ? <div className="hq-ds-page-header-actions">{actions}</div> : null}
    </header>
  )
}
