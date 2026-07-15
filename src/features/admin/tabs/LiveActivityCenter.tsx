"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore"
import {
  Activity,
  AlertTriangle,
  Ban,
  Bell,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  HardDrive,
  LifeBuoy,
  Mail,
  MessageSquare,
  ReceiptText,
  RefreshCw,
  Smartphone,
  Stethoscope,
  UserCog,
  Users,
  XCircle,
  ArrowRight,
  Filter,
} from "lucide-react"
import { auth, db } from "@/firebase/config"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import type { Hospital } from "@/types/hospital"
import { Button } from '@/shared/components'
import { FilterChip } from '@/shared/components'
import { Notification } from '@/shared/components'
import {
  HqShell,
  HqPageHeader,
  HqToolbar,
  HqMetricGrid,
  HqMetricCard,
  HqPanel,
  HqWorkspace,
  HqSkeleton,
  HqEmptyState,
  HqSectionLabel,
} from "@/features/admin/hq"

export type ActivitySeverity = "critical" | "warning" | "info" | "success"

export type ActivityType =
  | "hospital_created"
  | "hospital_deleted"
  | "admin_login"
  | "doctor_added"
  | "subscription_renewed"
  | "invoice_generated"
  | "payment_failed"
  | "backup_completed"
  | "whatsapp_sent"
  | "sms_failed"
  | "email_delivered"
  | "patient_imported"

type NavTab =
  | "hospitals"
  | "admins"
  | "subscriptions"
  | "doctors"
  | "patients"
  | "billing"
  | "monitoring"
  | "activity"

type PlatformActivity = {
  id: string
  type: ActivityType
  severity: ActivitySeverity
  title: string
  detail: string
  at: number
  hospitalId?: string
  hospitalName?: string
  navTab: NavTab
  source: "derived" | "instrumented" | "uninstrumented"
}

const TYPE_META: Record<
  ActivityType,
  { label: string; icon: typeof Building2; instrumented: boolean; hint?: string }
> = {
  hospital_created: { label: "Hospital Created", icon: Building2, instrumented: true },
  hospital_deleted: {
    label: "Hospital Deleted",
    icon: Ban,
    instrumented: true,
    hint: "Soft deactivate (inactive / suspended)",
  },
  admin_login: {
    label: "Admin Login",
    icon: UserCog,
    instrumented: false,
    hint: "Login telemetry is not instrumented yet",
  },
  doctor_added: { label: "Doctor Added", icon: Stethoscope, instrumented: true },
  subscription_renewed: {
    label: "Subscription Renewed",
    icon: CreditCard,
    instrumented: true,
    hint: "Entitlement / profile updates on hospitals",
  },
  invoice_generated: { label: "Invoice Generated", icon: ReceiptText, instrumented: true },
  payment_failed: {
    label: "Payment Failed",
    icon: XCircle,
    instrumented: true,
    hint: "Outstanding / cancelled billing as closest signal",
  },
  backup_completed: {
    label: "Backup Completed",
    icon: Database,
    instrumented: true,
    hint: "Mapped from successful cron / ops jobs when present",
  },
  whatsapp_sent: { label: "WhatsApp Sent", icon: MessageSquare, instrumented: true },
  sms_failed: {
    label: "SMS Failed",
    icon: Smartphone,
    instrumented: true,
    hint: "Messaging failures from reminder / missed-appt logs",
  },
  email_delivered: {
    label: "Email Delivered",
    icon: Mail,
    instrumented: false,
    hint: "Email delivery is not instrumented on this platform",
  },
  patient_imported: {
    label: "Patient Imported",
    icon: Users,
    instrumented: true,
    hint: "Patient registrations (bulk import not tracked separately)",
  },
}

const SEVERITY_RANK: Record<ActivitySeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3,
}

const ALL_TYPES = Object.keys(TYPE_META) as ActivityType[]

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybe = value as { toDate?: () => Date }
    if (typeof maybe.toDate === "function") return maybe.toDate()
  }
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatAbsolute(ts: number) {
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRelative(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `${days}d ago`
  return formatAbsolute(ts)
}

function personName(data: Record<string, unknown>) {
  const composed = [data.firstName, data.lastName].filter(Boolean).join(" ").trim()
  return composed || String(data.fullName || data.name || data.email || "Unknown")
}

async function safeGetDocs(path: string, max = 40) {
  try {
    const snap = await getDocs(query(collection(db, path), limit(max)))
    return snap.docs
  } catch {
    return []
  }
}

export default function LiveActivityCenter() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isSuperAdmin, setActiveHospital, userHospitals } = useMultiHospital()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<PlatformActivity[]>([])
  const [typeFilter, setTypeFilter] = useState<ActivityType | "all">("all")
  const [severityFilter, setSeverityFilter] = useState<ActivitySeverity | "all">("all")
  const [hospitalFilter, setHospitalFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [navigatingId, setNavigatingId] = useState<string | null>(null)

  const hospitalNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of userHospitals) map.set(h.id, h.name)
    return map
  }, [userHospitals])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const collected: PlatformActivity[] = []
      const hospitalsSnap = await getDocs(query(collection(db, "hospitals"), orderBy("createdAt", "desc")))
      const hospitals = hospitalsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Hospital,
      )
      const nameOf = (id?: string | null) =>
        (id && (hospitalNameById.get(id) || hospitals.find((h) => h.id === id)?.name)) || undefined

      for (const h of hospitals) {
        const created = parseDate(h.createdAt)
        if (created) {
          collected.push({
            id: `hosp-create-${h.id}`,
            type: "hospital_created",
            severity: "success",
            title: "Hospital Created",
            detail: `${h.name} · ${h.code || "—"}`,
            at: created.getTime(),
            hospitalId: h.id,
            hospitalName: h.name,
            navTab: "hospitals",
            source: "derived",
          })
        }
        if (h.status === "inactive" || h.status === "suspended") {
          const updated = parseDate(h.updatedAt) || created
          if (updated) {
            collected.push({
              id: `hosp-del-${h.id}`,
              type: "hospital_deleted",
              severity: "critical",
              title: "Hospital Deactivated",
              detail: `${h.name} · status ${h.status} (soft delete)`,
              at: updated.getTime(),
              hospitalId: h.id,
              hospitalName: h.name,
              navTab: "hospitals",
              source: "derived",
            })
          }
        }
      }

      const renewCandidates = hospitals
        .map((h) => ({ h, updated: parseDate(h.updatedAt), created: parseDate(h.createdAt) }))
        .filter((row) => {
          if (!row.updated) return false
          const createdMs = row.created?.getTime() ?? 0
          return row.updated.getTime() - createdMs > 7 * 24 * 60 * 60 * 1000
        })
        .sort((a, b) => (b.updated?.getTime() || 0) - (a.updated?.getTime() || 0))
        .slice(0, 25)

      for (const { h, updated } of renewCandidates) {
        if (!updated) continue
        collected.push({
          id: `sub-renew-${h.id}-${updated.getTime()}`,
          type: "subscription_renewed",
          severity: "info",
          title: "Subscription Renewed",
          detail: `${h.name} · entitlements / profile updated`,
          at: updated.getTime(),
          hospitalId: h.id,
          hospitalName: h.name,
          navTab: "subscriptions",
          source: "derived",
        })
      }

      const activeIds = hospitals
        .filter((h) => h.status === "active")
        .map((h) => h.id)
        .slice(0, 12)

      await Promise.all(
        activeIds.map(async (hospitalId) => {
          const hName = nameOf(hospitalId) || "Hospital"
          try {
            const docs = await getDocs(
              query(getHospitalCollection(hospitalId, "doctors"), limit(30)),
            )
            for (const d of docs.docs) {
              const data = d.data() as Record<string, unknown>
              const at = parseDate(data.createdAt)
              if (!at) continue
              collected.push({
                id: `doc-${hospitalId}-${d.id}`,
                type: "doctor_added",
                severity: "info",
                title: "Doctor Added",
                detail: `${personName(data)} · ${String(data.specialization || "Clinician")} · ${hName}`,
                at: at.getTime(),
                hospitalId,
                hospitalName: hName,
                navTab: "doctors",
                source: "derived",
              })
            }
          } catch {
            /* ignore */
          }
          try {
            const docs = await getDocs(
              query(getHospitalCollection(hospitalId, "patients"), limit(30)),
            )
            for (const d of docs.docs) {
              const data = d.data() as Record<string, unknown>
              const at = parseDate(data.createdAt)
              if (!at) continue
              collected.push({
                id: `pat-${hospitalId}-${d.id}`,
                type: "patient_imported",
                severity: "info",
                title: "Patient Imported",
                detail: `${personName(data)} · registered · ${hName}`,
                at: at.getTime(),
                hospitalId,
                hospitalName: hName,
                navTab: "patients",
                source: "derived",
              })
            }
          } catch {
            /* ignore */
          }
        }),
      )

      try {
        const user = auth.currentUser
        if (user) {
          const token = await user.getIdToken()
          const res = await fetch("/api/admin/billing-records", {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data = await res.json()
            const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
            for (const r of records.slice(0, 80)) {
              const id = String(r.id || "")
              const hospitalId = r.hospitalId ? String(r.hospitalId) : undefined
              const patientName = String(r.patientName || "Patient")
              const amount = Number(r.totalAmount || 0)
              const amountLabel = Number.isFinite(amount)
                ? `₹${amount.toLocaleString("en-IN")}`
                : "—"
              const generated = parseDate(r.generatedAt || r.paidAt || r.createdAt)
              if (generated) {
                collected.push({
                  id: `inv-${id}`,
                  type: "invoice_generated",
                  severity: "success",
                  title: "Invoice Generated",
                  detail: `${patientName} · ${amountLabel} · ${String(r.status || "")}`,
                  at: generated.getTime(),
                  hospitalId,
                  hospitalName: nameOf(hospitalId),
                  navTab: "billing",
                  source: "instrumented",
                })
              }
              const status = String(r.status || "")
              if (status === "cancelled" || status === "void") {
                const failedAt = parseDate(r.updatedAt || r.generatedAt) || generated
                if (failedAt) {
                  collected.push({
                    id: `payfail-${id}`,
                    type: "payment_failed",
                    severity: "critical",
                    title: "Payment Failed",
                    detail: `${patientName} · ${amountLabel} · ${status}`,
                    at: failedAt.getTime(),
                    hospitalId,
                    hospitalName: nameOf(hospitalId),
                    navTab: "billing",
                    source: "derived",
                  })
                }
              } else if (status === "pending") {
                const pendingAt = parseDate(r.generatedAt) || generated
                if (pendingAt && Date.now() - pendingAt.getTime() > 24 * 60 * 60 * 1000) {
                  collected.push({
                    id: `paypend-${id}`,
                    type: "payment_failed",
                    severity: "warning",
                    title: "Payment Failed",
                    detail: `${patientName} · ${amountLabel} · outstanding >24h`,
                    at: pendingAt.getTime(),
                    hospitalId,
                    hospitalName: nameOf(hospitalId),
                    navTab: "billing",
                    source: "derived",
                  })
                }
              }
            }
          }
        }
      } catch {
        /* ignore */
      }

      for (const path of ["appointment_reminders", "not_attended_messages"] as const) {
        const docs = await safeGetDocs(path, 50)
        for (const d of docs) {
          const data = d.data() as Record<string, unknown>
          const status = String(data.status || "")
          const hospitalId = data.hospitalId ? String(data.hospitalId) : undefined
          const sentAt =
            parseDate(data.sentAt) || parseDate(data.updatedAt) || parseDate(data.createdAt)
          if (!sentAt) continue
          if (status === "sent") {
            collected.push({
              id: `wa-${path}-${d.id}`,
              type: "whatsapp_sent",
              severity: "success",
              title: "WhatsApp Sent",
              detail: `${String(data.messageId || d.id).slice(0, 18)} · ${path.replace(/_/g, " ")}`,
              at: sentAt.getTime(),
              hospitalId,
              hospitalName: nameOf(hospitalId),
              navTab: "monitoring",
              source: "instrumented",
            })
          } else if (status === "failed") {
            const channel = String(data.channel || data.provider || "message").toLowerCase()
            const isSms = channel.includes("sms") || channel.includes("bhash")
            collected.push({
              id: `msgfail-${path}-${d.id}`,
              type: "sms_failed",
              severity: "critical",
              title: isSms ? "SMS Failed" : "SMS Failed",
              detail: `${String(data.error || "Delivery failed").slice(0, 80)} · ${path.replace(/_/g, " ")}`,
              at: sentAt.getTime(),
              hospitalId,
              hospitalName: nameOf(hospitalId),
              navTab: "monitoring",
              source: "instrumented",
            })
          }
        }
      }

      const cronDocs = await safeGetDocs("cron_logs", 40)
      for (const d of cronDocs) {
        const data = d.data() as Record<string, unknown>
        const at = parseDate(data.executedAt) || parseDate(data.createdAt)
        if (!at) continue
        const job = String(data.job || data.name || "platform-job")
        const ok = data.success !== false
        if (ok) {
          collected.push({
            id: `backup-${d.id}`,
            type: "backup_completed",
            severity: "success",
            title: "Backup Completed",
            detail: `Ops job · ${job}${data.summary ? ` · ${String(data.summary).slice(0, 60)}` : ""}`,
            at: at.getTime(),
            navTab: "monitoring",
            source: "derived",
          })
        }
      }

      // Dedupe by id
      const byId = new Map<string, PlatformActivity>()
      for (const e of collected) byId.set(e.id, e)
      setEvents(Array.from(byId.values()))
    } catch {
      setError("Failed to load platform activity feed.")
    } finally {
      setLoading(false)
    }
  }, [hospitalNameById])

  useEffect(() => {
    if (user && isSuperAdmin) void load()
  }, [user, isSuperAdmin, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return events
      .filter((e) => {
        if (typeFilter !== "all" && e.type !== typeFilter) return false
        if (severityFilter !== "all" && e.severity !== severityFilter) return false
        if (hospitalFilter !== "all" && e.hospitalId !== hospitalFilter) return false
        if (!q) return true
        return (
          e.title.toLowerCase().includes(q) ||
          e.detail.toLowerCase().includes(q) ||
          (e.hospitalName || "").toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        if (sev !== 0) return sev
        return b.at - a.at
      })
  }, [events, typeFilter, severityFilter, hospitalFilter, search])

  const counts = useMemo(() => {
    const bySev: Record<ActivitySeverity, number> = {
      critical: 0,
      warning: 0,
      info: 0,
      success: 0,
    }
    const byType: Partial<Record<ActivityType, number>> = {}
    for (const e of events) {
      bySev[e.severity] += 1
      byType[e.type] = (byType[e.type] || 0) + 1
    }
    return { bySev, byType, total: events.length }
  }, [events])

  const hospitalOptions = useMemo(
    () => hospitalsOptions(hospitalsSnapNames(events, userHospitals)),
    [events, userHospitals],
  )

  const navigate = async (event: PlatformActivity) => {
    setNavigatingId(event.id)
    try {
      if (event.hospitalId) await setActiveHospital(event.hospitalId)
      router.push(`/admin-dashboard?tab=${event.navTab}`)
    } catch {
      setError("Could not open related record.")
    } finally {
      setNavigatingId(null)
    }
  }

  const selectedTypeMeta = typeFilter === "all" ? null : TYPE_META[typeFilter]
  const showUninstrumentedEmpty =
    selectedTypeMeta &&
    !selectedTypeMeta.instrumented &&
    filtered.length === 0

  if (authLoading || (loading && events.length === 0)) {
    return <HqSkeleton metrics={4} split />
  }

  if (!isSuperAdmin) {
    return (
      <HqEmptyState
        title="Platform access required"
        description="Only platform super admins can view the Live Activity Center."
      />
    )
  }

  return (
    <HqShell>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      <HqPageHeader
        variant="hero"
        eyebrow="Operational excellence · Live Activity"
        title="Platform Activity Feed"
        description="Real-time and derived platform events across tenants — sorted by severity, filterable, with jump-to-record actions."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} loading={loading} loadingText="…">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <HqSectionLabel>Severity overview</HqSectionLabel>
      <HqMetricGrid columns={4}>
        <HqMetricCard
          label="Critical"
          value={counts.bySev.critical}
          hint="needs attention"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Warning"
          value={counts.bySev.warning}
          hint="review soon"
          icon={<Bell className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Info"
          value={counts.bySev.info}
          hint="lifecycle"
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Success"
          value={counts.bySev.success}
          hint="completed"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
      </HqMetricGrid>

      <HqSectionLabel>Filters</HqSectionLabel>
      <HqToolbar
        leading={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity…"
              className="hq-ds-input hq-ds-input--search"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as ActivityType | "all")}
              className="hq-ds-input w-auto max-w-[14rem]"
            >
              <option value="all">All event types</option>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as ActivitySeverity | "all")}
              className="hq-ds-input w-auto max-w-[10rem]"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
            </select>
            <select
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              className="hq-ds-input w-auto max-w-[12rem]"
            >
              <option value="all">All tenants</option>
              {hospitalOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </>
        }
        trailing={
          <div className="flex flex-wrap gap-1">
            <FilterChip active={severityFilter === "critical"} onClick={() => setSeverityFilter((s) => (s === "critical" ? "all" : "critical"))}>
              Critical
            </FilterChip>
            <FilterChip active={typeFilter === "whatsapp_sent"} onClick={() => setTypeFilter((t) => (t === "whatsapp_sent" ? "all" : "whatsapp_sent"))}>
              WhatsApp
            </FilterChip>
            <FilterChip active={typeFilter === "payment_failed"} onClick={() => setTypeFilter((t) => (t === "payment_failed" ? "all" : "payment_failed"))}>
              Payments
            </FilterChip>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setTypeFilter("all")
                setSeverityFilter("all")
                setHospitalFilter("all")
                setSearch("")
              }}
            >
              <Filter className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        }
      />

      <HqWorkspace
        primary={
          <HqPanel
            title="Activity stream"
            subtitle={`${filtered.length} events · severity then newest`}
          >
            {showUninstrumentedEmpty ? (
              <HqEmptyState
                title={`${selectedTypeMeta!.label} — not instrumented`}
                description={selectedTypeMeta!.hint || "No telemetry is available for this event type yet."}
              />
            ) : filtered.length === 0 ? (
              <HqEmptyState
                title="No activities match"
                description="Adjust filters or refresh the feed."
              />
            ) : (
              <ul className="hq-act-list">
                {filtered.slice(0, 120).map((event) => {
                  const Icon = TYPE_META[event.type].icon
                  return (
                    <li key={event.id} className={`hq-act-row hq-act-row--${event.severity}`}>
                      <span className={`hq-act-sev hq-act-sev--${event.severity}`}>
                        {event.severity}
                      </span>
                      <span className="hq-act-icon">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="hq-act-body">
                        <div className="hq-act-title-row">
                          <p className="hq-act-title">{event.title}</p>
                          <time className="hq-act-time" title={formatAbsolute(event.at)} dateTime={new Date(event.at).toISOString()}>
                            {formatRelative(event.at)}
                          </time>
                        </div>
                        <p className="hq-act-detail">{event.detail}</p>
                        <p className="hq-act-meta">
                          {formatAbsolute(event.at)}
                          {event.hospitalName ? ` · ${event.hospitalName}` : ""}
                          {` · ${event.source}`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={navigatingId === event.id}
                        onClick={() => void navigate(event)}
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </HqPanel>
        }
        rail={
          <>
            <HqPanel title="Event catalog" padded>
              <ul className="space-y-1.5">
                {ALL_TYPES.map((t) => {
                  const meta = TYPE_META[t]
                  const count = counts.byType[t] || 0
                  return (
                    <li key={t}>
                      <button
                        type="button"
                        className={`hq-act-catalog-btn ${typeFilter === t ? "hq-act-catalog-btn--active" : ""}`}
                        onClick={() => setTypeFilter((cur) => (cur === t ? "all" : t))}
                      >
                        <meta.icon className="h-3.5 w-3.5 shrink-0 text-cyan-700" />
                        <span className="min-w-0 flex-1 truncate text-left">{meta.label}</span>
                        <span className="tabular-nums text-[10px] font-semibold text-slate-500">
                          {meta.instrumented ? count : "—"}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </HqPanel>
            <HqPanel title="About this feed" padded>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Events are aggregated from hospitals, clinical records, billing, messaging logs, and ops jobs.
                Uninstrumented types (Admin Login, Email Delivered) stay empty until telemetry exists.
              </p>
              <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
                <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" />
                <span>Sorted by severity (critical → success), then timestamp.</span>
              </div>
              <div className="mt-2 flex items-start gap-2 text-[11px] text-slate-500">
                <LifeBuoy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>Hospital Deleted reflects soft deactivation, not hard delete.</span>
              </div>
            </HqPanel>
          </>
        }
      />
    </HqShell>
  )
}

function hospitalsSnapNames(
  events: PlatformActivity[],
  userHospitals: Array<{ id: string; name: string }>,
) {
  const map = new Map<string, string>()
  for (const h of userHospitals) map.set(h.id, h.name)
  for (const e of events) {
    if (e.hospitalId && e.hospitalName) map.set(e.hospitalId, e.hospitalName)
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
}

function hospitalsOptions(list: Array<{ id: string; name: string }>) {
  return list.sort((a, b) => a.name.localeCompare(b.name))
}
