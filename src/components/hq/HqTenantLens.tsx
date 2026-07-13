"use client"

import type { ReactNode } from "react"

/**
 * Inspection-mode banner: reminds Super Admin that ops tabs are
 * tenant-scoped, not platform-wide.
 */
export function HqTenantLens({
  tenantName,
  children,
}: {
  tenantName?: string | null
  children?: ReactNode
}) {
  return (
    <div className="hq-ds-tenant-lens">
      <div className="min-w-0 flex-1">
        <p className="hq-ds-tenant-lens-label">Inspection lens</p>
        <p className="hq-ds-tenant-lens-name">{tenantName || "Select a tenant"}</p>
        <p className="hq-ds-tenant-lens-hint">
          Day-to-day hospital data below belongs to this customer only — not the full platform.
        </p>
      </div>
      {children ? <div className="hq-ds-tenant-lens-controls">{children}</div> : null}
    </div>
  )
}
