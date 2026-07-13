"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/Button"

/** Root wrapper for Pharmacy Operations Center surfaces */
export function PhOpsShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`ph-ops ${className}`.trim()}>{children}</div>
}

export function PhOpsPageHeader({
  eyebrow = "Pharmacy Operations",
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="ph-ops-header">
      <div className="min-w-0 flex-1">
        <p className="ph-ops-eyebrow">{eyebrow}</p>
        <h2 className="ph-ops-title">{title}</h2>
        {description ? <p className="ph-ops-desc">{description}</p> : null}
      </div>
      {actions ? <div className="ph-ops-header-actions">{actions}</div> : null}
    </header>
  )
}

export function PhOpsSectionLabel({ children }: { children: ReactNode }) {
  return <p className="ph-ops-section-label">{children}</p>
}

export function PhOpsMetricGrid({
  children,
  columns = 4,
}: {
  children: ReactNode
  columns?: 3 | 4 | 5 | 6
}) {
  return <div className={`ph-ops-metric-grid ph-ops-metric-grid--${columns}`}>{children}</div>
}

export function PhOpsMetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  onClick,
  actionLabel,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: "neutral" | "ok" | "warn" | "danger" | "info"
  icon?: ReactNode
  onClick?: () => void
  actionLabel?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="ph-ops-metric-label">{label}</p>
        {icon ? <span className="ph-ops-metric-icon">{icon}</span> : null}
      </div>
      <p className="ph-ops-metric-value">{value}</p>
      {hint ? <p className="ph-ops-metric-hint">{hint}</p> : null}
      {actionLabel && onClick ? (
        <span className="ph-ops-metric-cta">{actionLabel} →</span>
      ) : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={`ph-ops-metric ph-ops-metric--${tone} ph-ops-metric--interactive`} onClick={onClick}>
        {body}
      </button>
    )
  }

  return <div className={`ph-ops-metric ph-ops-metric--${tone}`}>{body}</div>
}

export function PhOpsPanel({
  title,
  subtitle,
  actions,
  children,
  padded = true,
  className = "",
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  padded?: boolean
  className?: string
}) {
  return (
    <section className={`ph-ops-panel ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <div className="ph-ops-panel-header">
          <div className="min-w-0">
            {title ? <h3 className="ph-ops-panel-title">{title}</h3> : null}
            {subtitle ? <p className="ph-ops-panel-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="ph-ops-panel-actions">{actions}</div> : null}
        </div>
      )}
      <div className={padded ? "ph-ops-panel-body" : undefined}>{children}</div>
    </section>
  )
}

export function PhOpsToolbar({ leading, trailing }: { leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="ph-ops-toolbar">
      <div className="ph-ops-toolbar-leading">{leading}</div>
      {trailing ? <div className="ph-ops-toolbar-trailing">{trailing}</div> : null}
    </div>
  )
}

export function PhOpsStatusBadge({
  label,
  tone = "neutral",
}: {
  label: string
  tone?: "neutral" | "ok" | "warn" | "danger" | "info"
}) {
  return <span className={`ph-ops-badge ph-ops-badge--${tone}`}>{label}</span>
}

export function PhOpsAlertCard({
  title,
  count,
  description,
  tone = "warn",
  onAction,
  actionLabel = "Review",
}: {
  title: string
  count: number
  description?: string
  tone?: "warn" | "danger" | "info" | "ok"
  onAction?: () => void
  actionLabel?: string
}) {
  return (
    <div className={`ph-ops-alert ph-ops-alert--${tone}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="ph-ops-alert-title">{title}</p>
          <PhOpsStatusBadge label={String(count)} tone={tone} />
        </div>
        {description ? <p className="ph-ops-alert-desc">{description}</p> : null}
      </div>
      {onAction ? (
        <Button type="button" size="sm" variant="outline" onClick={onAction} disabled={count === 0}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function PhOpsEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="ph-ops-empty">
      <p className="ph-ops-empty-title">{title}</p>
      {description ? <p className="ph-ops-empty-desc">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button type="button" size="sm" className="mt-3" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function PhOpsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="ph-ops space-y-3">
      <div className="ph-ops-skel ph-ops-skel--header" />
      <div className="ph-ops-metric-grid ph-ops-metric-grid--6">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="ph-ops-skel ph-ops-skel--card" />
        ))}
      </div>
      <div className="ph-ops-skel ph-ops-skel--panel" />
    </div>
  )
}

export function PhOpsWorkflowStrip({
  steps,
}: {
  steps: Array<{ label: string; active?: boolean; done?: boolean }>
}) {
  return (
    <ol className="ph-ops-workflow">
      {steps.map((step, i) => (
        <li
          key={step.label}
          className={[
            "ph-ops-workflow-step",
            step.active ? "ph-ops-workflow-step--active" : "",
            step.done ? "ph-ops-workflow-step--done" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="ph-ops-workflow-num">{i + 1}</span>
          <span className="ph-ops-workflow-label">{step.label}</span>
        </li>
      ))}
    </ol>
  )
}

export function PhOpsPosShell({
  catalog,
  cart,
}: {
  catalog: ReactNode
  cart: ReactNode
}) {
  return (
    <div className="ph-ops-pos">
      <div className="ph-ops-pos-catalog">{catalog}</div>
      <aside className="ph-ops-pos-cart">{cart}</aside>
    </div>
  )
}

/** Semantic aliases — same primitives, clearer pharmacy vocabulary */
export function PhOpsTodayCard(props: Parameters<typeof PhOpsMetricCard>[0]) {
  return <PhOpsMetricCard {...props} />
}

export function PhOpsMedicineStatusCard(props: Parameters<typeof PhOpsMetricCard>[0]) {
  return <PhOpsMetricCard {...props} />
}

export function PhOpsInventorySummaryCard(props: Parameters<typeof PhOpsMetricCard>[0]) {
  return <PhOpsMetricCard {...props} />
}

export function PhOpsLowStockAlertCard(
  props: Omit<Parameters<typeof PhOpsAlertCard>[0], "tone"> & { tone?: Parameters<typeof PhOpsAlertCard>[0]["tone"] }
) {
  return <PhOpsAlertCard tone="warn" {...props} />
}

export function PhOpsExpiryAlertCard(
  props: Omit<Parameters<typeof PhOpsAlertCard>[0], "tone"> & { tone?: Parameters<typeof PhOpsAlertCard>[0]["tone"] }
) {
  return <PhOpsAlertCard tone="danger" {...props} />
}

export function PhOpsPrescriptionQueueCard(props: Parameters<typeof PhOpsMetricCard>[0]) {
  return <PhOpsMetricCard tone="info" {...props} />
}

export function PhOpsBillingSummaryCard(props: Parameters<typeof PhOpsPanel>[0]) {
  return <PhOpsPanel {...props} />
}

export function PhOpsSupplierCard({
  name,
  contact,
  pendingOrders,
  onView,
}: {
  name: string
  contact?: string
  pendingOrders?: number
  onView?: () => void
}) {
  return (
    <div className="ph-ops-alert ph-ops-alert--info">
      <div className="min-w-0 flex-1">
        <p className="ph-ops-alert-title">{name}</p>
        {contact ? <p className="ph-ops-alert-desc">{contact}</p> : null}
        {pendingOrders != null ? (
          <p className="ph-ops-alert-desc mt-1">{pendingOrders} pending order{pendingOrders === 1 ? "" : "s"}</p>
        ) : null}
      </div>
      {onView ? (
        <Button type="button" size="sm" variant="outline" onClick={onView}>
          View
        </Button>
      ) : null}
    </div>
  )
}

export function PhOpsPurchaseOrderCard({
  orderNumber,
  supplier,
  status,
  total,
  expected,
  onView,
  onReceive,
}: {
  orderNumber: string
  supplier: string
  status: string
  total?: string
  expected?: string
  onView?: () => void
  onReceive?: () => void
}) {
  const tone =
    status === "pending" || status === "draft"
      ? "warn"
      : status === "received"
        ? "ok"
        : status === "cancelled"
          ? "danger"
          : "neutral"
  return (
    <div className={`ph-ops-alert ph-ops-alert--${tone === "neutral" ? "info" : tone}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="ph-ops-alert-title font-mono">{orderNumber}</p>
          <PhOpsStatusBadge label={status} tone={tone} />
        </div>
        <p className="ph-ops-alert-desc">{supplier}</p>
        {(total || expected) && (
          <p className="ph-ops-alert-desc mt-1">
            {[total, expected ? `Expected ${expected}` : null].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {onView ? (
          <Button type="button" size="sm" variant="outline" onClick={onView}>
            View
          </Button>
        ) : null}
        {onReceive ? (
          <Button type="button" size="sm" variant="primary" onClick={onReceive}>
            Receive
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function PhOpsFilterToolbar(props: Parameters<typeof PhOpsToolbar>[0]) {
  return <PhOpsToolbar {...props} />
}

export function PhOpsSearchToolbar(props: Parameters<typeof PhOpsToolbar>[0]) {
  return <PhOpsToolbar {...props} />
}

export function PhOpsFormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <PhOpsPanel title={title} subtitle={description}>
      {children}
    </PhOpsPanel>
  )
}

export function PhOpsDialogFrame({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="ph-ops-panel w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ph-ops-panel-header">
          <h3 className="ph-ops-panel-title">{title}</h3>
          <Button type="button" size="sm" variant="outline" onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>
        <div className="ph-ops-panel-body flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="border-t border-slate-100 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}
