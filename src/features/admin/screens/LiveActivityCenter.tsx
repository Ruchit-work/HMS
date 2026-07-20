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
  FileText,
  RefreshCw,
  Stethoscope,
  UserCog,
  Users,
  Wallet,
  BedDouble,
  CalendarDays,
  ArrowRight,
} from "lucide-react"
import { db } from "@/firebase/config"
import { useAuth } from "@/shared/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"
import type { Hospital } from "@/types/hospital"
import { AUDIT_ACTIONS } from "@/shared/types/audit"
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
} from "@/features/admin/components/hq"

export type ActivitySeverity = "critical" | "warning" | "info" | "success"

export type ActivityType =
  | "patient_registered"
  | "patient_updated"
  | "appointment_created"
  | "appointment_cancelled"
  | "appointment_completed"
  | "payment_collected"
  | "refund_requested"
  | "refund_approved"
  | "admission_created"
  | "patient_discharged"
  | "doctor_created"
  | "user_created"
  | "billing_settings_updated"
  | "hospital_created"
  | "hospital_updated"
  | "document_uploaded"

type NavTab =
  | "hospitals"
  | "admins"
  | "subscriptions"
  | "doctors"
  | "patients"
  | "billing"
  | "appointments"
  | "audit"
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
  source: "derived" | "instrumented"
}

const TYPE_META: Record<
  ActivityType,
  { label: string; icon: typeof Building2 }
> = {
  patient_registered: { label: "Patient Registered", icon: Users },
  patient_updated: { label: "Patient Updated", icon: Users },
  appointment_created: { label: "Appointment Created", icon: CalendarDays },
  appointment_cancelled: { label: "Appointment Cancelled", icon: Ban },
  appointment_completed: { label: "Appointment Completed", icon: CheckCircle2 },
  payment_collected: { label: "Payment Collected", icon: Wallet },
  refund_requested: { label: "Refund Requested", icon: CreditCard },
  refund_approved: { label: "Refund Approved", icon: CreditCard },
  admission_created: { label: "Admission Created", icon: BedDouble },
  patient_discharged: { label: "Patient Discharged", icon: BedDouble },
  doctor_created: { label: "Doctor Created", icon: Stethoscope },
  user_created: { label: "Staff User Created", icon: UserCog },
  billing_settings_updated: { label: "Billing Settings Updated", icon: FileText },
  hospital_created: { label: "Hospital Created", icon: Building2 },
  hospital_updated: { label: "Hospital Settings Updated", icon: Building2 },
  document_uploaded: { label: "Document Uploaded", icon: FileText },
}

const AUDIT_ACTION_TO_TYPE: Record<string, ActivityType> = {
  [AUDIT_ACTIONS.PATIENT_CREATED]: "patient_registered",
  [AUDIT_ACTIONS.PATIENT_UPDATED]: "patient_updated",
  [AUDIT_ACTIONS.APPOINTMENT_CREATED]: "appointment_created",
  [AUDIT_ACTIONS.APPOINTMENT_CANCELLED]: "appointment_cancelled",
  [AUDIT_ACTIONS.APPOINTMENT_RESCHEDULED]: "appointment_created",
  [AUDIT_ACTIONS.PAYMENT_COLLECTED]: "payment_collected",
  [AUDIT_ACTIONS.REFUND_REQUESTED]: "refund_requested",
  [AUDIT_ACTIONS.REFUND_APPROVED]: "refund_approved",
  [AUDIT_ACTIONS.ADMISSION_CREATED]: "admission_created",
  [AUDIT_ACTIONS.PATIENT_DISCHARGED]: "patient_discharged",
  [AUDIT_ACTIONS.BILLING_SETTINGS_CHANGED]: "billing_settings_updated",
  [AUDIT_ACTIONS.USER_CREATED]: "user_created",
  [AUDIT_ACTIONS.USER_ROLE_CHANGED]: "user_created",
  [AUDIT_ACTIONS.USER_DISABLED_DELETED]: "user_created",
  [AUDIT_ACTIONS.BILL_EDITED]: "payment_collected",
  [AUDIT_ACTIONS.ROOM_CHANGED]: "admission_created",
}

const TYPE_NAV: Record<ActivityType, NavTab> = {
  patient_registered: "patients",
  patient_updated: "patients",
  appointment_created: "appointments",
  appointment_cancelled: "appointments",
  appointment_completed: "appointments",
  payment_collected: "billing",
  refund_requested: "billing",
  refund_approved: "billing",
  admission_created: "patients",
  patient_discharged: "patients",
  doctor_created: "doctors",
  user_created: "admins",
  billing_settings_updated: "hospitals",
  hospital_created: "hospitals",
  hospital_updated: "hospitals",
  document_uploaded: "patients",
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

function severityForType(type: ActivityType): ActivitySeverity {
  if (type === "appointment_cancelled" || type === "refund_requested") return "warning"
  if (type === "refund_approved" || type === "payment_collected" || type === "appointment_completed") {
    return "success"
  }
  if (type === "hospital_created" || type === "patient_registered" || type === "admission_created") {
    return "success"
  }
  return "info"
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

      // Prefer audit_logs — real business events only (no polling / heartbeats).
      try {
        const auditSnap = await getDocs(
          query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(120))
        )
        for (const docSnap of auditSnap.docs) {
          const data = docSnap.data() as Record<string, unknown>
          const action = String(data.action || "")
          const type = AUDIT_ACTION_TO_TYPE[action]
          if (!type) continue
          const created = parseDate(data.createdAt)
          if (!created) continue
          const hospitalId = data.hospitalId ? String(data.hospitalId) : undefined
          const actor = String(data.performedByName || data.performedByUserId || "System")
          const summary = String(data.summary || action)
          const roleHint = data.performedByRole ? ` · ${String(data.performedByRole)}` : ""
          let title = TYPE_META[type].label
          if (action === AUDIT_ACTIONS.USER_CREATED) {
            const metaRole = String((data.metadata as Record<string, unknown> | undefined)?.role || "")
            if (metaRole.toLowerCase().includes("doctor")) {
              title = "Doctor Created"
            } else if (metaRole.toLowerCase().includes("receptionist")) {
              title = "Receptionist Created"
            }
          }
          collected.push({
            id: `audit-${docSnap.id}`,
            type,
            severity: severityForType(type),
            title,
            detail: `${summary} · ${actor}${roleHint}`,
            at: created.getTime(),
            hospitalId,
            hospitalName: nameOf(hospitalId),
            navTab: TYPE_NAV[type],
            source: "instrumented",
          })
        }
      } catch {
        /* audit_logs may lack an index for global orderBy — fall back below */
      }

      for (const h of hospitals.slice(0, 40)) {
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
              query(getHospitalCollection(hospitalId, "doctors"), orderBy("createdAt", "desc"), limit(15)),
            )
            for (const d of docs.docs) {
              const data = d.data() as Record<string, unknown>
              const at = parseDate(data.createdAt)
              if (!at) continue
              collected.push({
                id: `doc-${hospitalId}-${d.id}`,
                type: "doctor_created",
                severity: "info",
                title: "Doctor Created",
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
              query(getHospitalCollection(hospitalId, "patients"), orderBy("createdAt", "desc"), limit(15)),
            )
            for (const d of docs.docs) {
              const data = d.data() as Record<string, unknown>
              const at = parseDate(data.createdAt)
              if (!at) continue
              collected.push({
                id: `pat-${hospitalId}-${d.id}`,
                type: "patient_registered",
                severity: "success",
                title: "Patient Registered",
                detail: `${personName(data)} · ${hName}`,
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
          try {
            const docs = await getDocs(
              query(
                getHospitalCollection(hospitalId, "appointments"),
                orderBy("createdAt", "desc"),
                limit(20),
              ),
            )
            for (const d of docs.docs) {
              const data = d.data() as Record<string, unknown>
              const status = String(data.status || "").toLowerCase()
              const at =
                parseDate(data.cancelledAt) ||
                parseDate(data.completedAt) ||
                parseDate(data.createdAt)
              if (!at) continue
              if (status === "cancelled" || status === "doctor_cancelled") {
                collected.push({
                  id: `apt-cancel-${hospitalId}-${d.id}`,
                  type: "appointment_cancelled",
                  severity: "warning",
                  title: "Appointment Cancelled",
                  detail: `${String(data.patientName || "Patient")} · ${String(data.doctorName || "Doctor")} · ${hName}`,
                  at: at.getTime(),
                  hospitalId,
                  hospitalName: hName,
                  navTab: "appointments",
                  source: "derived",
                })
              } else if (status === "completed") {
                collected.push({
                  id: `apt-done-${hospitalId}-${d.id}`,
                  type: "appointment_completed",
                  severity: "success",
                  title: "Appointment Completed",
                  detail: `${String(data.patientName || "Patient")} · ${String(data.doctorName || "Doctor")} · ${hName}`,
                  at: at.getTime(),
                  hospitalId,
                  hospitalName: hName,
                  navTab: "appointments",
                  source: "derived",
                })
              } else {
                const created = parseDate(data.createdAt)
                if (!created) continue
                collected.push({
                  id: `apt-create-${hospitalId}-${d.id}`,
                  type: "appointment_created",
                  severity: "info",
                  title: "Appointment Created",
                  detail: `${String(data.patientName || "Patient")} · ${String(data.doctorName || "Doctor")} · ${hName}`,
                  at: created.getTime(),
                  hospitalId,
                  hospitalName: hName,
                  navTab: "appointments",
                  source: "derived",
                })
              }
            }
          } catch {
            /* ignore */
          }
        }),
      )

      // Dedupe by id — prefer instrumented audit rows when titles collide by id.
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
      .sort((a, b) => b.at - a.at)
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
        description="Meaningful business events across hospitals — newest first. Technical noise such as polling, heartbeats, and background sync is excluded."
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
            <FilterChip active={typeFilter === "appointment_cancelled"} onClick={() => setTypeFilter((t) => (t === "appointment_cancelled" ? "all" : "appointment_cancelled"))}>
              Cancellations
            </FilterChip>
            <FilterChip active={typeFilter === "payment_collected"} onClick={() => setTypeFilter((t) => (t === "payment_collected" ? "all" : "payment_collected"))}>
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
              Reset
            </Button>
          </div>
        }
      />

      <HqWorkspace
        primary={
          <HqPanel
            title="Activity stream"
            subtitle={`${filtered.length} events · newest first`}
          >
            {filtered.length === 0 ? (
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
                          {count}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </HqPanel>
            <HqPanel title="About this feed" padded>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Shows meaningful business events from audit logs and hospital records — patient,
                appointment, billing, admission, and staffing changes. Low-value technical noise is excluded.
              </p>
              <div className="mt-3 text-[11px] text-slate-500">
                Sorted newest first with readable absolute and relative timestamps.
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
