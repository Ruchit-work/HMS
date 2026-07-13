"use client"

import type { ReactNode } from "react"
import { HqHealthBadge, type HqHealthLevel } from "./HqHealth"
import { HqModuleChipRow } from "./HqModuleChip"

export type HqTenantPlan = "Starter" | "Growth" | "Enterprise"

export function deriveTenantPlan(input: {
  multipleBranchesEnabled?: boolean
  enableAnalytics?: boolean
  enablePharmacy?: boolean
}): HqTenantPlan {
  const branches = input.multipleBranchesEnabled === true
  const analytics = input.enableAnalytics !== false
  const pharmacy = input.enablePharmacy === true
  if (branches && analytics && pharmacy) return "Enterprise"
  if (analytics && (branches || pharmacy)) return "Growth"
  return "Starter"
}

export function HqTenantAvatar({
  name,
  code,
  size = "md",
}: {
  name: string
  code?: string
  size?: "sm" | "md" | "lg"
}) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("")
  const hue =
    Array.from(code || name || "H")
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360

  const sizeCls =
    size === "lg" ? "h-12 w-12 text-sm" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs"

  return (
    <div
      className={`hq-ds-tenant-avatar ${sizeCls}`}
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 50% 28%))`,
      }}
      aria-hidden
    >
      {initials || "H"}
    </div>
  )
}

export function HqTenantCard({
  name,
  code,
  email,
  plan,
  statusLabel,
  statusVariant,
  subscriptionLabel,
  subscriptionVariant,
  renewalLabel,
  health,
  doctors,
  patients,
  branches,
  storageLabel,
  apiLabel,
  activityLabel,
  modules,
  actions,
  selected,
  onClick,
}: {
  name: string
  code: string
  email?: string
  plan: HqTenantPlan
  statusLabel: string
  statusVariant: "success" | "neutral" | "warning" | "danger"
  subscriptionLabel: string
  subscriptionVariant: "success" | "warning" | "neutral" | "danger"
  renewalLabel: string
  health: HqHealthLevel
  doctors: number | string
  patients: number | string
  branches: number | string
  storageLabel: string
  apiLabel: string
  activityLabel: string
  modules: { branches?: boolean; analytics?: boolean; pharmacy?: boolean }
  actions: ReactNode
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <article
      className={`hq-ds-tenant-card ${selected ? "hq-ds-tenant-card--selected" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onClick()
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="hq-ds-tenant-card-top">
        <HqTenantAvatar name={name} code={code} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-slate-900">{name}</h3>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
              {code}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{email || "No billing email"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`hq-ds-plan-pill hq-ds-plan-pill--${plan.toLowerCase()}`}>{plan}</span>
            <span className={`hq-ds-mini-pill hq-ds-mini-pill--${statusVariant}`}>{statusLabel}</span>
            <span className={`hq-ds-mini-pill hq-ds-mini-pill--${subscriptionVariant}`}>
              {subscriptionLabel}
            </span>
            <HqHealthBadge status={health} />
          </div>
        </div>
      </div>

      <div className="hq-ds-tenant-metrics">
        <div>
          <p className="hq-ds-tenant-metric-label">Renewal</p>
          <p className="hq-ds-tenant-metric-value">{renewalLabel}</p>
        </div>
        <div>
          <p className="hq-ds-tenant-metric-label">Branches</p>
          <p className="hq-ds-tenant-metric-value">{branches}</p>
        </div>
        <div>
          <p className="hq-ds-tenant-metric-label">Doctors</p>
          <p className="hq-ds-tenant-metric-value">{doctors}</p>
        </div>
        <div>
          <p className="hq-ds-tenant-metric-label">Patients</p>
          <p className="hq-ds-tenant-metric-value">{patients}</p>
        </div>
        <div>
          <p className="hq-ds-tenant-metric-label">Storage</p>
          <p className="hq-ds-tenant-metric-value">{storageLabel}</p>
        </div>
        <div>
          <p className="hq-ds-tenant-metric-label">API usage</p>
          <p className="hq-ds-tenant-metric-value">{apiLabel}</p>
        </div>
      </div>

      <div className="hq-ds-tenant-card-mid">
        <HqModuleChipRow
          branches={modules.branches}
          analytics={modules.analytics}
          pharmacy={modules.pharmacy}
        />
        <p className="hq-ds-tenant-activity">{activityLabel}</p>
      </div>

      <div
        className="hq-ds-tenant-actions"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {actions}
      </div>
    </article>
  )
}
