"use client"

import { useEffect, type ReactNode } from "react"
import { Button } from '@/shared/components'
import { StatusPill, type StatusVariant } from '@/shared/components'
import type { Branch, BranchTimings } from "@/types/branch"
import { Timestamp } from "firebase/firestore"

const DAY_ORDER: (keyof BranchTimings)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

function parseCity(location?: string) {
  if (!location?.trim()) return "—"
  return location.split(",")[0]?.trim() || location
}

function formatDate(value?: Branch["updatedAt"] | Branch["createdAt"]) {
  if (!value) return "—"
  try {
    if (value instanceof Timestamp) {
      return value.toDate().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    }
    if (typeof value === "string") {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      }
    }
  } catch {
    /* ignore */
  }
  return "—"
}

export type BranchDrawerMetrics = {
  doctors?: number | null
  staff?: number | null
  todayPatients?: number | null
  revenue?: number | null
  bedOccupancyPct?: number | null
}

export default function BranchDetailDrawer({
  open,
  branch,
  metrics,
  onClose,
  onEdit,
  onAssignStaff,
  onAssignDoctors,
  onViewReports,
  onDeactivate,
}: {
  open: boolean
  branch: Branch | null
  metrics?: BranchDrawerMetrics
  onClose: () => void
  onEdit: () => void
  onAssignStaff: () => void
  onAssignDoctors: () => void
  onViewReports: () => void
  onDeactivate?: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || !branch) return null

  const statusVariant: StatusVariant = branch.status === "active" ? "success" : "neutral"
  const city = parseCity(branch.location)

  const metricCards = [
    { label: "Doctor Count", value: formatMetric(metrics?.doctors) },
    { label: "Staff Count", value: formatMetric(metrics?.staff) },
    { label: "Today's Patients", value: formatMetric(metrics?.todayPatients) },
    {
      label: "Revenue",
      value:
        metrics?.revenue != null && !Number.isNaN(metrics.revenue)
          ? `₹${Math.round(metrics.revenue).toLocaleString("en-IN")}`
          : "—",
    },
    {
      label: "Bed Occupancy",
      value:
        metrics?.bedOccupancyPct != null && !Number.isNaN(metrics.bedOccupancyPct)
          ? `${Math.round(metrics.bedOccupancyPct)}%`
          : "—",
    },
  ]

  const activities = [
    {
      id: "updated",
      title: "Branch profile updated",
      when: formatDate(branch.updatedAt || branch.createdAt),
      tone: "bg-cyan-50 text-cyan-700",
    },
    {
      id: "created",
      title: "Branch created in hospital network",
      when: formatDate(branch.createdAt),
      tone: "bg-slate-100 text-slate-600",
    },
    {
      id: "status",
      title: branch.status === "active" ? "Marked operational" : "Marked inactive",
      when: formatDate(branch.updatedAt || branch.createdAt),
      tone: branch.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
    },
  ]

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={`${branch.name} details`}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px] transition-opacity"
        aria-label="Close branch drawer"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[22rem] flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-200 sm:max-w-md">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Site overview</p>
            <h2 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-slate-900">{branch.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusPill label={branch.status === "active" ? "Active" : "Inactive"} variant={statusVariant} />
              <span className="text-[11px] text-slate-500">{city}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            aria-label="Close"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-2.5">
          <Section title="Branch Information">
            <dl className="space-y-1 text-[12px]">
              <Row label="Name" value={branch.name} />
              <Row label="City" value={city} />
              <Row label="Location" value={branch.location || "—"} />
              <Row label="Branch ID" value={branch.id} mono />
              <Row label="Hospital ID" value={branch.hospitalId || "—"} mono />
              <Row label="Last updated" value={formatDate(branch.updatedAt || branch.createdAt)} />
            </dl>
          </Section>

          <Section title="Operational snapshot">
            <div className="grid grid-cols-2 gap-1.5">
              {metricCards.map((m) => (
                <div key={m.label} className="branch-drawer-metric">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{m.label}</p>
                  <p className="mt-0.5 text-[13px] font-semibold tabular-nums tracking-tight text-slate-900">{m.value}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Recent Activities">
            <ul className="space-y-1.5">
              {activities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2 rounded-md border border-transparent px-1 py-1 transition-colors hover:border-slate-100 hover:bg-slate-50"
                >
                  <span className={`mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold ${a.tone}`}>
                    Event
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-slate-800">{a.title}</p>
                    <p className="text-[10px] text-slate-500">{a.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Contact Information">
            <dl className="space-y-1 text-[12px]">
              <Row label="Front desk" value="—" />
              <Row label="Email" value="—" />
              <Row label="Emergency" value="—" />
              <Row label="Address" value={branch.location || "—"} />
            </dl>
          </Section>

          <Section title="Operating Hours">
            <ul className="space-y-0.5 rounded-lg border border-slate-100 bg-white p-1.5">
              {DAY_ORDER.map((day) => {
                const slot = branch.timings?.[day]
                return (
                  <li
                    key={day}
                    className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <span className="capitalize text-slate-500">{day.slice(0, 3)}</span>
                    <span className="font-medium tabular-nums text-slate-800">
                      {slot ? `${slot.start} – ${slot.end}` : "Closed"}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Section>
        </div>

        <footer className="shrink-0 space-y-1.5 border-t border-slate-100 bg-slate-50/90 px-3.5 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quick actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button type="button" size="sm" onClick={onEdit}>
              Edit Branch
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onAssignStaff}>
              Assign Staff
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onAssignDoctors}>
              Assign Doctors
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onViewReports}>
              View Reports
            </Button>
          </div>
          {onDeactivate && branch.status === "active" && (
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={onDeactivate}>
              Deactivate branch
            </Button>
          )}
        </footer>
      </aside>
    </div>
  )
}

function formatMetric(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—"
  return String(n)
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className={`text-right font-medium text-slate-800 ${mono ? "truncate font-mono text-[11px]" : ""}`}>
        {value}
      </dd>
    </div>
  )
}
