"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Flame,
  HardDrive,
  Mail,
  MessageSquare,
  RefreshCw,
  Server,
  Smartphone,
  CreditCard,
  Cpu,
  ListOrdered,
  Bug,
  Gauge,
  XCircle,
} from "lucide-react"
import { collection, getDocs, limit, query } from "firebase/firestore"
import { auth, db } from "@/firebase/config"
import { useAuth } from "@/shared/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { Button } from '@/shared/components'
import { Notification } from '@/shared/components'
import {
  HqShell,
  HqPageHeader,
  HqMetricGrid,
  HqMetricCard,
  HqPanel,
  HqWorkspace,
  HqSkeleton,
  HqEmptyState,
  HqSectionLabel,
  HqHealthBadge,
  type HqHealthLevel,
} from "@/features/admin/components/hq"

type ServiceId =
  | "firebase"
  | "database"
  | "email"
  | "sms"
  | "whatsapp"
  | "payment"
  | "storage"
  | "cron"
  | "queue"
  | "workers"
  | "api"
  | "errors"

type ProbeMode = "live" | "uninstrumented"

interface ServiceProbe {
  id: ServiceId
  name: string
  category: "Core" | "Messaging" | "Payments" | "Jobs" | "Edge"
  mode: ProbeMode
  icon: typeof Database
  status: HqHealthLevel
  responseMs: number | null
  lastIncident: string | null
  lastRecovery: string | null
  detail: string
  checkedAt: number | null
}

interface LogEntry {
  id: string
  at: number
  level: "info" | "warn" | "error"
  service: string
  message: string
}

const SERVICE_DEFS: Array<{
  id: ServiceId
  name: string
  category: ServiceProbe["category"]
  mode: ProbeMode
  icon: typeof Database
}> = [
  { id: "firebase", name: "Firebase", category: "Core", mode: "live", icon: Flame },
  { id: "database", name: "Database", category: "Core", mode: "live", icon: Database },
  { id: "api", name: "API Response", category: "Edge", mode: "live", icon: Server },
  { id: "errors", name: "System Errors", category: "Edge", mode: "live", icon: Bug },
  { id: "email", name: "Email", category: "Messaging", mode: "uninstrumented", icon: Mail },
  { id: "sms", name: "SMS", category: "Messaging", mode: "uninstrumented", icon: Smartphone },
  { id: "whatsapp", name: "WhatsApp", category: "Messaging", mode: "uninstrumented", icon: MessageSquare },
  { id: "payment", name: "Payment Gateway", category: "Payments", mode: "uninstrumented", icon: CreditCard },
  { id: "storage", name: "Cloud Storage", category: "Core", mode: "uninstrumented", icon: HardDrive },
  { id: "cron", name: "Cron Jobs", category: "Jobs", mode: "uninstrumented", icon: Clock },
  { id: "queue", name: "Notification Queue", category: "Jobs", mode: "uninstrumented", icon: ListOrdered },
  { id: "workers", name: "Background Workers", category: "Jobs", mode: "uninstrumented", icon: Cpu },
]

function formatMs(ms: number | null) {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatWhen(ts: number | null) {
  if (!ts) return "—"
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatRelative(ts: number | null) {
  if (!ts) return "—"
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function initialServices(): ServiceProbe[] {
  return SERVICE_DEFS.map((d) => ({
    ...d,
    status: d.mode === "uninstrumented" ? "warning" : "warning",
    responseMs: null,
    lastIncident: null,
    lastRecovery: null,
    detail: d.mode === "uninstrumented" ? "Awaiting probe / not instrumented" : "Pending check…",
    checkedAt: null,
  }))
}

export default function PlatformMonitoring() {
  const { loading: authLoading } = useAuth()
  const { isSuperAdmin } = useMultiHospital()
  const [services, setServices] = useState<ServiceProbe[]>(initialServices)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [failures, setFailures] = useState<LogEntry[]>([])
  const [probing, setProbing] = useState(false)
  const [selectedId, setSelectedId] = useState<ServiceId>("firebase")
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastSweepAt, setLastSweepAt] = useState<number | null>(null)

  const pushLog = useCallback((entry: Omit<LogEntry, "id">) => {
    const row: LogEntry = { ...entry, id: `${entry.at}-${Math.random().toString(36).slice(2, 8)}` }
    setLogs((prev) => [row, ...prev].slice(0, 80))
    if (entry.level === "error" || entry.level === "warn") {
      setFailures((prev) => [row, ...prev].slice(0, 40))
    }
  }, [])

  const runProbes = useCallback(async () => {
    setProbing(true)
    setError(null)
    const now = Date.now()

    // Firebase + Database (Firestore read)
    let firebaseStatus: HqHealthLevel = "offline"
    let firebaseMs: number | null = null
    let firebaseDetail = "Unreachable"
    try {
      const t0 = performance.now()
      await getDocs(query(collection(db, "hospitals"), limit(1)))
      firebaseMs = Math.round(performance.now() - t0)
      if (firebaseMs > 5000) firebaseStatus = "critical"
      else if (firebaseMs > 2000) firebaseStatus = "warning"
      else firebaseStatus = "healthy"
      firebaseDetail =
        firebaseStatus === "healthy"
          ? "Firestore read OK"
          : firebaseStatus === "warning"
            ? "Elevated latency"
            : "Severe latency"
      pushLog({
        at: Date.now(),
        level: firebaseStatus === "healthy" ? "info" : "warn",
        service: "Firebase / Database",
        message: `Probe ${firebaseStatus} · ${firebaseMs} ms · ${firebaseDetail}`,
      })
    } catch (e) {
      firebaseStatus = "offline"
      firebaseDetail = e instanceof Error ? e.message : "Firestore probe failed"
      pushLog({
        at: Date.now(),
        level: "error",
        service: "Firebase / Database",
        message: `Probe offline · ${firebaseDetail}`,
      })
    }

    // API Response (existing billing endpoint)
    let apiStatus: HqHealthLevel = "offline"
    let apiMs: number | null = null
    let apiDetail = "Unreachable"
    try {
      const user = auth.currentUser
      if (!user) throw new Error("No authenticated session")
      const token = await user.getIdToken()
      const t0 = performance.now()
      const res = await fetch("/api/admin/billing-records", {
        headers: { Authorization: `Bearer ${token}` },
      })
      apiMs = Math.round(performance.now() - t0)
      if (!res.ok) {
        apiStatus = res.status >= 500 ? "critical" : "warning"
        apiDetail = `HTTP ${res.status}`
      } else if (apiMs > 8000) {
        apiStatus = "critical"
        apiDetail = "Severe API latency"
      } else if (apiMs > 3500) {
        apiStatus = "warning"
        apiDetail = "Elevated API latency"
      } else {
        apiStatus = "healthy"
        apiDetail = "Billing API responding"
      }
      pushLog({
        at: Date.now(),
        level: apiStatus === "healthy" ? "info" : apiStatus === "critical" ? "error" : "warn",
        service: "API Response",
        message: `Probe ${apiStatus} · ${apiMs} ms · ${apiDetail}`,
      })
    } catch (e) {
      apiStatus = "offline"
      apiDetail = e instanceof Error ? e.message : "API probe failed"
      pushLog({
        at: Date.now(),
        level: "error",
        service: "API Response",
        message: `Probe offline · ${apiDetail}`,
      })
    }

    // System errors derived from this sweep
    const errorStatus: HqHealthLevel =
      firebaseStatus === "offline" || apiStatus === "offline"
        ? "critical"
        : firebaseStatus === "critical" || apiStatus === "critical"
          ? "critical"
          : firebaseStatus === "warning" || apiStatus === "warning"
            ? "warning"
            : "healthy"

    setServices((prev) =>
      prev.map((s) => {
        if (s.id === "firebase" || s.id === "database") {
          const prevStatus = s.status
          return {
            ...s,
            status: firebaseStatus,
            responseMs: firebaseMs,
            detail: firebaseDetail,
            checkedAt: now,
            lastIncident:
              firebaseStatus === "healthy"
                ? s.lastIncident
                : formatWhen(now),
            lastRecovery:
              firebaseStatus === "healthy" && prevStatus !== "healthy"
                ? formatWhen(now)
                : s.lastRecovery || (firebaseStatus === "healthy" ? formatWhen(now) : s.lastRecovery),
          }
        }
        if (s.id === "api") {
          const prevStatus = s.status
          return {
            ...s,
            status: apiStatus,
            responseMs: apiMs,
            detail: apiDetail,
            checkedAt: now,
            lastIncident: apiStatus === "healthy" ? s.lastIncident : formatWhen(now),
            lastRecovery:
              apiStatus === "healthy" && prevStatus !== "healthy"
                ? formatWhen(now)
                : s.lastRecovery || (apiStatus === "healthy" ? formatWhen(now) : s.lastRecovery),
          }
        }
        if (s.id === "errors") {
          return {
            ...s,
            status: errorStatus,
            responseMs: apiMs != null && firebaseMs != null ? Math.max(apiMs, firebaseMs) : apiMs ?? firebaseMs,
            detail:
              errorStatus === "healthy"
                ? "No critical failures in last sweep"
                : "Issues detected in live probes",
            checkedAt: now,
            lastIncident: errorStatus === "healthy" ? s.lastIncident : formatWhen(now),
            lastRecovery: errorStatus === "healthy" ? formatWhen(now) : s.lastRecovery,
          }
        }
        // Uninstrumented — stay warning, refresh check timestamp
        return {
          ...s,
          status: "warning",
          responseMs: null,
          detail: "Not instrumented · awaiting observability hooks",
          checkedAt: now,
          lastIncident: s.lastIncident || "—",
          lastRecovery: s.lastRecovery || "—",
        }
      }),
    )

    setLastSweepAt(now)
    setProbing(false)
  }, [pushLog])

  useEffect(() => {
    if (!isSuperAdmin) return
    void runProbes()
  }, [isSuperAdmin, runProbes])

  useEffect(() => {
    if (!isSuperAdmin || !autoRefresh) return
    const id = window.setInterval(() => {
      void runProbes()
    }, 60_000)
    return () => window.clearInterval(id)
  }, [isSuperAdmin, autoRefresh, runProbes])

  const selected = useMemo(
    () => services.find((s) => s.id === selectedId) || services[0],
    [services, selectedId],
  )

  const summary = useMemo(() => {
    const healthy = services.filter((s) => s.status === "healthy").length
    const warning = services.filter((s) => s.status === "warning").length
    const critical = services.filter((s) => s.status === "critical").length
    const offline = services.filter((s) => s.status === "offline").length
    const live = services.filter((s) => s.mode === "live")
    const avgMs =
      live.reduce((sum, s) => sum + (s.responseMs || 0), 0) /
      Math.max(live.filter((s) => s.responseMs != null).length, 1)
    const overall: HqHealthLevel =
      offline > 0 || critical > 0 ? (offline > 0 ? "offline" : "critical") : warning > 0 ? "warning" : "healthy"
    return { healthy, warning, critical, offline, avgMs: Math.round(avgMs), overall }
  }, [services])

  if (authLoading) return <HqSkeleton metrics={4} split />

  if (!isSuperAdmin) {
    return (
      <HqEmptyState
        title="Platform access required"
        description="Only platform super admins can view Harmony infrastructure monitoring."
      />
    )
  }

  const overallBanner =
    summary.overall === "healthy"
      ? { cls: "ok", label: "All live probes healthy" }
      : summary.overall === "warning"
        ? { cls: "warn", label: "Degraded · attention recommended" }
        : summary.overall === "critical"
          ? { cls: "down", label: "Critical issues detected" }
          : { cls: "down", label: "Core services offline" }

  return (
    <HqShell>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      <HqPageHeader
        variant="hero"
        eyebrow="System monitoring · Observability"
        title="Platform Monitoring"
        description="Cloud-style health for Harmony infrastructure. Live probes for Firebase, Database, and API — other services show honest instrumentation status."
        actions={
          <>
            <span className={`hq-ds-status-banner hq-ds-status-banner--${overallBanner.cls}`}>
              {summary.overall === "healthy" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {overallBanner.label}
            </span>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300"
              />
              Auto 60s
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void runProbes()}
              loading={probing}
              loadingText="Probing…"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Run probes
            </Button>
          </>
        }
      />

      <HqSectionLabel>Fleet status</HqSectionLabel>
      <HqMetricGrid columns={6}>
        <HqMetricCard label="Healthy" value={summary.healthy} hint="services" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Warning" value={summary.warning} hint="services" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Critical" value={summary.critical} hint="services" icon={<XCircle className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Offline" value={summary.offline} hint="services" icon={<Activity className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Avg response" value={summary.avgMs ? `${summary.avgMs} ms` : "—"} hint="live probes" icon={<Gauge className="h-3.5 w-3.5" />} />
        <HqMetricCard
          label="Last sweep"
          value={lastSweepAt ? formatRelative(lastSweepAt) : "—"}
          hint={formatWhen(lastSweepAt)}
          icon={<Clock className="h-3.5 w-3.5" />}
        />
      </HqMetricGrid>

      <HqSectionLabel>Services</HqSectionLabel>
      <div className="hq-ds-monitor-grid">
        {services.map((s) => {
          const Icon = s.icon
          const active = s.id === selectedId
          return (
            <button
              key={s.id}
              type="button"
              className={`hq-ds-monitor-card hq-ds-monitor-card--${s.status} ${active ? "hq-ds-monitor-card--active" : ""}`}
              onClick={() => setSelectedId(s.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="hq-ds-monitor-icon">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="hq-ds-health-name truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.category}</p>
                  </div>
                </div>
                <HqHealthBadge status={s.status} />
              </div>
              <div className="hq-ds-monitor-meta">
                <div>
                  <p className="hq-ds-tenant-metric-label">Response</p>
                  <p className="hq-ds-tenant-metric-value">{formatMs(s.responseMs)}</p>
                </div>
                <div>
                  <p className="hq-ds-tenant-metric-label">Checked</p>
                  <p className="hq-ds-tenant-metric-value">{formatRelative(s.checkedAt)}</p>
                </div>
              </div>
              <p className="hq-ds-health-detail truncate">{s.detail}</p>
            </button>
          )
        })}
      </div>

      <HqWorkspace
        primary={
          <HqPanel
            title={selected?.name || "Service"}
            subtitle={`${selected?.category} · ${selected?.mode === "live" ? "Live probe" : "Uninstrumented"}`}
          >
            {selected ? (
              <div className="p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <HqHealthBadge status={selected.status} />
                  <span className="text-[11px] text-slate-500">{selected.detail}</span>
                </div>

                <div className="hq-ds-tenant-metrics" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <div>
                    <p className="hq-ds-tenant-metric-label">Response time</p>
                    <p className="hq-ds-tenant-metric-value">{formatMs(selected.responseMs)}</p>
                  </div>
                  <div>
                    <p className="hq-ds-tenant-metric-label">Last checked</p>
                    <p className="hq-ds-tenant-metric-value">{formatWhen(selected.checkedAt)}</p>
                  </div>
                  <div>
                    <p className="hq-ds-tenant-metric-label">Last incident</p>
                    <p className="hq-ds-tenant-metric-value">{selected.lastIncident || "—"}</p>
                  </div>
                  <div>
                    <p className="hq-ds-tenant-metric-label">Last recovery</p>
                    <p className="hq-ds-tenant-metric-value">{selected.lastRecovery || "—"}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="hq-ds-section-label mb-1">Instrumentation</p>
                  <p className="text-xs text-slate-600">
                    {selected.mode === "live"
                      ? "This service is checked from the Super Admin session using existing Firebase / API endpoints. No new backend agents were added."
                      : "This service has no Harmony health endpoint yet. Status is Warning until observability hooks are connected — not silently marked Healthy."}
                  </p>
                </div>

                <div>
                  <p className="hq-ds-section-label mb-2">Service log stream</p>
                  <ul className="hq-ds-activity-list max-h-56 rounded-lg border border-slate-100">
                    {logs.filter((l) => l.service.toLowerCase().includes(selected.name.split(" ")[0].toLowerCase()) || l.service.includes(selected.name)).length === 0 ? (
                      <li className="px-3 py-4 text-[11px] text-slate-400">No entries for this service in the current session.</li>
                    ) : (
                      logs
                        .filter(
                          (l) =>
                            l.service.toLowerCase().includes(selected.name.split(" ")[0].toLowerCase()) ||
                            l.service.includes(selected.name) ||
                            (selected.id === "database" && l.service.includes("Database")) ||
                            (selected.id === "firebase" && l.service.includes("Firebase")) ||
                            (selected.id === "errors" && (l.level === "error" || l.level === "warn")),
                        )
                        .slice(0, 12)
                        .map((l) => (
                          <li key={l.id} className="hq-ds-activity-item">
                            <span
                              className={`hq-ds-log-level hq-ds-log-level--${l.level}`}
                            >
                              {l.level}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="hq-ds-activity-title">{l.message}</p>
                              <p className="hq-ds-activity-meta">
                                {l.service} · {formatWhen(l.at)}
                              </p>
                            </div>
                          </li>
                        ))
                    )}
                  </ul>
                </div>
              </div>
            ) : null}
          </HqPanel>
        }
        rail={
          <>
            <HqPanel title="Recent failures" subtitle="Warn + error from this session">
              {failures.length === 0 ? (
                <div className="p-4">
                  <p className="text-[11px] text-slate-500">No failures recorded since this page loaded.</p>
                </div>
              ) : (
                <ul className="hq-ds-activity-list">
                  {failures.slice(0, 10).map((f) => (
                    <li key={f.id} className="hq-ds-activity-item">
                      <span className={`hq-ds-log-level hq-ds-log-level--${f.level}`}>{f.level}</span>
                      <div className="min-w-0 flex-1">
                        <p className="hq-ds-activity-title">{f.message}</p>
                        <p className="hq-ds-activity-meta">
                          {f.service} · {formatRelative(f.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </HqPanel>

            <HqPanel title="Probe logs" subtitle="Session observability stream">
              {logs.length === 0 ? (
                <div className="p-4">
                  <p className="text-[11px] text-slate-500">Run probes to populate logs.</p>
                </div>
              ) : (
                <ul className="hq-ds-activity-list max-h-80">
                  {logs.slice(0, 20).map((l) => (
                    <li key={l.id} className="hq-ds-activity-item">
                      <span className={`hq-ds-log-level hq-ds-log-level--${l.level}`}>{l.level}</span>
                      <div className="min-w-0 flex-1">
                        <p className="hq-ds-activity-title">{l.message}</p>
                        <p className="hq-ds-activity-meta">
                          {l.service} · {formatWhen(l.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </HqPanel>
          </>
        }
      />
    </HqShell>
  )
}
