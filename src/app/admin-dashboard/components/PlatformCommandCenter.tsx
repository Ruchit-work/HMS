"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Building2,
  UserCog,
  Activity,
  ArrowRight,
  RefreshCw,
  BarChart3,
  GitBranch,
  Eye,
  AlertTriangle,
  CreditCard,
  IndianRupee,
  Users,
  Stethoscope,
  CalendarDays,
  Database,
  Plus,
  Megaphone,
  Settings,
  Layers,
  UserPlus,
  Ban,
  CheckCircle2,
  Search,
  Radio,
} from "lucide-react"
import {
  collection,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import { auth, db } from "@/firebase/config"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import type { Hospital } from "@/types/hospital"
import { Button } from "@/components/ui/Button"
import { StatusPill } from "@/components/ui/enterprise-table"
import Notification from "@/components/ui/feedback/Notification"
import {
  HqShell,
  HqPageHeader,
  HqMetricGrid,
  HqMetricCard,
  HqPanel,
  HqWorkspace,
  HqEmptyState,
  HqSkeleton,
  HqModuleChipRow,
  HqSectionLabel,
  HqHealthCard,
  HqActivityItem,
  type HqHealthLevel,
} from "@/components/hq"

type PlatformTab =
  | "overview"
  | "hospitals"
  | "admins"
  | "monitoring"
  | "subscriptions"
  | "activity"
  | "patients"
  | "doctors"
  | "appointments"
  | "billing"
  | "analytics"
  | "account"

interface PlatformCommandCenterProps {
  setActiveTab: (tab: PlatformTab) => void
  setSidebarOpen: (open: boolean) => void
  onOpenGlobalSearch?: () => void
}

type ActivityKind =
  | "hospital_added"
  | "hospital_suspended"
  | "doctor_note"
  | "subscription_note"
  | "admin_note"
  | "backup_note"

interface ActivityEvent {
  id: string
  kind: ActivityKind
  title: string
  meta: string
  at: number
}

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

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatRelative(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

async function safeCount(hospitalId: string, name: "doctors" | "patients" | "appointments") {
  try {
    const snap = await getCountFromServer(getHospitalCollection(hospitalId, name))
    return snap.data().count
  } catch {
    return 0
  }
}

export default function PlatformCommandCenter({
  setActiveTab,
  setSidebarOpen,
  onOpenGlobalSearch,
}: PlatformCommandCenterProps) {
  const {
    userHospitals,
    activeHospital,
    activeHospitalId,
    setActiveHospital,
    refreshHospitals,
    loading: contextLoading,
  } = useMultiHospital()

  const [tenants, setTenants] = useState<Hospital[]>([])
  const [adminCount, setAdminCount] = useState(0)
  const [tenantAdminCount, setTenantAdminCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const [firebaseOk, setFirebaseOk] = useState(false)
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState<number | null>(null)
  const [platformCounts, setPlatformCounts] = useState({
    doctors: 0,
    patients: 0,
    appointments: 0,
    branches: 0,
  })

  const loadPlatformSnapshot = async () => {
    setLoading(true)
    setError(null)

    try {
      const hospitalsSnap = await getDocs(query(collection(db, "hospitals"), orderBy("createdAt", "desc")))
      const list = hospitalsSnap.docs.map(
        (d) =>
          ({
            id: d.id,
            ...d.data(),
          }) as Hospital,
      )
      setTenants(list)
      setFirebaseOk(true)

      const adminsSnap = await getDocs(collection(db, "admins"))
      let total = 0
      let tenantAdmins = 0
      adminsSnap.docs.forEach((d) => {
        const data = d.data()
        total += 1
        if (!data.isSuperAdmin) {
          // When a tenant is selected, count only admins for that hospital
          if (activeHospitalId) {
            if (String(data.hospitalId || "") === activeHospitalId) tenantAdmins += 1
          } else {
            tenantAdmins += 1
          }
        }
      })
      setAdminCount(total)
      setTenantAdminCount(tenantAdmins)

      // Scope clinical counts to the selected tenant (header dropdown). Fall back to fleet sample only if none selected.
      const scopeIds = activeHospitalId
        ? [activeHospitalId]
        : list.filter((t) => t.status === "active").map((t) => t.id).slice(0, 25)

      const countResults = await Promise.all(
        scopeIds.map(async (id) => {
          const [doctors, patients, appointments] = await Promise.all([
            safeCount(id, "doctors"),
            safeCount(id, "patients"),
            safeCount(id, "appointments"),
          ])
          return { doctors, patients, appointments }
        }),
      )

      let branchTotal = 0
      try {
        if (activeHospitalId) {
          const branchSnap = await getCountFromServer(
            query(collection(db, "branches"), where("hospitalId", "==", activeHospitalId)),
          )
          branchTotal = branchSnap.data().count
        } else {
          const branchSnap = await getCountFromServer(collection(db, "branches"))
          branchTotal = branchSnap.data().count
        }
      } catch {
        branchTotal = 0
      }

      setPlatformCounts(
        countResults.reduce(
          (acc, row) => ({
            doctors: acc.doctors + row.doctors,
            patients: acc.patients + row.patients,
            appointments: acc.appointments + row.appointments,
            branches: branchTotal,
          }),
          { doctors: 0, patients: 0, appointments: 0, branches: branchTotal },
        ),
      )

      // Paid collections — filter to selected tenant when set
      try {
        const user = auth.currentUser
        if (user) {
          const token = await user.getIdToken()
          const res = await fetch("/api/admin/billing-records", {
            headers: { Authorization: `Bearer ${token}` },
          })
          setApiOk(res.ok)
          if (res.ok) {
            const data = await res.json()
            const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
            const now = new Date()
            const thisMonth = monthKey(now)
            let sum = 0
            for (const r of records) {
              if (r?.status !== "paid") continue
              if (activeHospitalId && String(r.hospitalId || "") !== activeHospitalId) continue
              const paidAt = parseDate(r.paidAt || r.generatedAt)
              if (!paidAt) continue
              if (monthKey(paidAt) !== thisMonth) continue
              const amt = Number(r.totalAmount || 0)
              if (Number.isFinite(amt)) sum += amt
            }
            setMonthlyRevenue(sum)
          } else {
            setMonthlyRevenue(null)
          }
        } else {
          setApiOk(false)
        }
      } catch {
        setApiOk(false)
        setMonthlyRevenue(null)
      }
    } catch {
      setFirebaseOk(false)
      setError("Could not refresh the platform snapshot. Showing available tenant context.")
      setTenants(userHospitals.map((h) => ({ ...h, status: h.status || "active" })))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPlatformSnapshot()
    // Re-load when the header tenant selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHospitalId])
  const focusedTenant = useMemo(() => {
    if (!activeHospitalId) return null
    return (
      tenants.find((t) => t.id === activeHospitalId) ||
      userHospitals.find((t) => t.id === activeHospitalId) ||
      activeHospital ||
      null
    )
  }, [activeHospitalId, tenants, userHospitals, activeHospital])

  const scopedTenants = useMemo(() => {
    if (!activeHospitalId) return tenants
    return tenants.filter((t) => t.id === activeHospitalId)
  }, [tenants, activeHospitalId])

  const now = useMemo(() => new Date(), [tenants, monthlyRevenue, activeHospitalId])

  const business = useMemo(() => {
    const pool = scopedTenants
    const active = pool.filter((t) => t.status === "active")
    const inactive = pool.filter((t) => t.status !== "active")
    const thisMonth = monthKey(now)
    const newHospitals = pool.filter((t) => {
      const c = parseDate(t.createdAt)
      return c ? monthKey(c) === thisMonth : false
    }).length
    const cancelledPlans = pool.filter((t) => {
      if (t.status === "active") return false
      const u = parseDate(t.updatedAt) || parseDate(t.createdAt)
      return u ? monthKey(u) === thisMonth : false
    }).length
    const renewals = active.filter(
      (t) => t.enableAnalytics !== false && (t.multipleBranchesEnabled === true || t.enablePharmacy === true),
    ).length
    const expireSoon = active.filter(
      (t) => t.enablePharmacy !== true && t.multipleBranchesEnabled !== true,
    )
    const mrr = monthlyRevenue
    const arr = mrr == null ? null : mrr * 12

    return {
      active: active.length,
      inactive: inactive.length,
      newHospitals,
      cancelledPlans,
      renewals,
      expireSoon,
      mrr,
      arr,
      monthlyRevenue: mrr,
    }
  }, [scopedTenants, monthlyRevenue, now])

  const healthServices: Array<{ name: string; status: HqHealthLevel; detail: string }> = useMemo(() => {
    const fb: HqHealthLevel = firebaseOk ? "healthy" : "offline"
    const api: HqHealthLevel = apiOk === null ? "warning" : apiOk ? "healthy" : "offline"
    return [
      { name: "Database", status: fb, detail: firebaseOk ? "Firestore reachable" : "Read failed" },
      { name: "Firebase", status: fb, detail: firebaseOk ? "Auth + Firestore up" : "Client offline" },
      { name: "Email", status: "warning", detail: "Not instrumented" },
      { name: "SMS", status: "warning", detail: "Not instrumented" },
      { name: "WhatsApp", status: "warning", detail: "Not instrumented" },
      {
        name: "Payment Gateway",
        status: apiOk === false ? "warning" : "warning",
        detail: "Collection via front desk · gateway health not instrumented",
      },
      { name: "API", status: api, detail: apiOk ? "Billing API responding" : "Billing API unreachable" },
      { name: "Cron Jobs", status: "warning", detail: "Not instrumented" },
      { name: "Storage", status: "warning", detail: "Usage metering not instrumented" },
    ]
  }, [firebaseOk, apiOk])

  const platformStatus = useMemo(() => {
    if (!firebaseOk) return { level: "down" as const, label: "Platform degraded" }
    if (business.inactive > 0 || apiOk === false) {
      return { level: "warn" as const, label: "Platform operational · attention needed" }
    }
    return { level: "ok" as const, label: "Platform healthy" }
  }, [firebaseOk, business.inactive, apiOk])

  const activities = useMemo(() => {
    const events: ActivityEvent[] = []
    for (const t of scopedTenants) {
      const created = parseDate(t.createdAt)
      if (created) {
        events.push({
          id: `add-${t.id}`,
          kind: "hospital_added",
          title: `Tenant onboarded · ${t.name}`,
          meta: `${t.code} · ${formatRelative(created.getTime())}`,
          at: created.getTime(),
        })
      }
      if (t.status !== "active") {
        const updated = parseDate(t.updatedAt) || created
        if (updated) {
          events.push({
            id: `sus-${t.id}`,
            kind: "hospital_suspended",
            title: `Hospital ${t.status} · ${t.name}`,
            meta: `${t.code} · ${formatRelative(updated.getTime())}`,
            at: updated.getTime(),
          })
        }
      }
    }
    if (tenantAdminCount > 0) {
      events.push({
        id: "admins",
        kind: "admin_note",
        title: focusedTenant
          ? `${tenantAdminCount} admin(s) on ${focusedTenant.name}`
          : `${tenantAdminCount} tenant administrators provisioned`,
        meta: focusedTenant ? "Selected tenant · operators" : "Customer success · operator directory",
        at: Date.now() - 60_000,
      })
    }
    if (!focusedTenant) {
      events.push({
        id: "subs",
        kind: "subscription_note",
        title: `${business.active} live subscriptions · ${business.expireSoon.length} incomplete module stacks`,
        meta: "Entitlement review recommended",
        at: Date.now() - 120_000,
      })
    }
    events.push({
      id: "backup",
      kind: "backup_note",
      title: focusedTenant ? `Snapshot · ${focusedTenant.name}` : "Firebase snapshot refreshed",
      meta: loading ? "Refreshing…" : focusedTenant ? "Tenant-scoped dashboard load complete" : "Command Center data load complete",
      at: Date.now(),
    })
    return events.sort((a, b) => b.at - a.at).slice(0, 12)
  }, [
    scopedTenants,
    tenantAdminCount,
    business.active,
    business.expireSoon.length,
    loading,
    focusedTenant,
  ])

  const fleetPreview = useMemo(() => {
    if (focusedTenant) return scopedTenants
    return tenants.slice(0, 6)
  }, [tenants, scopedTenants, focusedTenant])

  const inspectTenant = async (hospitalId: string, tab: PlatformTab = "patients") => {
    setSwitchingId(hospitalId)
    try {
      if (hospitalId !== activeHospitalId) await setActiveHospital(hospitalId)
      setActiveTab(tab)
      setSidebarOpen(false)
    } catch {
      setError("Failed to switch active tenant for inspection.")
    } finally {
      setSwitchingId(null)
    }
  }

  const go = (tab: PlatformTab) => {
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  if (contextLoading && tenants.length === 0 && loading) {
    return <HqSkeleton metrics={6} split />
  }

  const activityIcon = (kind: ActivityKind) => {
    switch (kind) {
      case "hospital_added":
        return <Building2 className="h-3.5 w-3.5" />
      case "hospital_suspended":
        return <Ban className="h-3.5 w-3.5" />
      case "admin_note":
        return <UserCog className="h-3.5 w-3.5" />
      case "subscription_note":
        return <CreditCard className="h-3.5 w-3.5" />
      case "backup_note":
        return <Database className="h-3.5 w-3.5" />
      default:
        return <Activity className="h-3.5 w-3.5" />
    }
  }

  return (
    <HqShell>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      {/* Hero */}
      <HqPageHeader
        variant="hero"
        eyebrow={
          focusedTenant
            ? `Tenant dashboard · ${focusedTenant.name}`
            : "Platform control · Command Center"
        }
        title={focusedTenant ? focusedTenant.name : "Harmony HMS Headquarters"}
        description={
          focusedTenant
            ? `Showing doctors, patients, appointments, branches, and paid collections for this tenant only. Switch the Tenant dropdown to inspect another hospital.`
            : "Select a tenant in the header to inspect one hospital. Without a selection, fleet-wide platform metrics are shown."
        }
        actions={
          <>
            <span
              className={`hq-ds-status-banner hq-ds-status-banner--${platformStatus.level}`}
              title="Derived from live Firebase + API checks"
            >
              {platformStatus.level === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {platformStatus.label}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadPlatformSnapshot()
                void refreshHospitals()
              }}
              loading={loading}
              loadingText="…"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={() => go("hospitals")}>
              Manage tenants
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      {/* Business Overview */}
      <HqSectionLabel>
        {focusedTenant ? `Business · ${focusedTenant.name}` : "Business overview"}
      </HqSectionLabel>
      <HqMetricGrid columns={6}>
        <HqMetricCard
          label="Monthly revenue"
          value={business.monthlyRevenue == null ? "—" : formatInr(business.monthlyRevenue)}
          hint={focusedTenant ? "paid MTD · this tenant" : "paid · this month"}
          icon={<IndianRupee className="h-3.5 w-3.5" />}
          onClick={() => go("billing")}
        />
        <HqMetricCard
          label="MRR"
          value={business.mrr == null ? "—" : formatInr(business.mrr)}
          hint={focusedTenant ? "tenant collection proxy" : "proxy · collections"}
          icon={<IndianRupee className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="ARR"
          value={business.arr == null ? "—" : formatInr(business.arr)}
          hint="MRR × 12"
          icon={<BarChart3 className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label={focusedTenant ? "Tenant status" : "Active tenants"}
          value={
            focusedTenant
              ? focusedTenant.status === "active"
                ? "Live"
                : String(focusedTenant.status || "—")
              : business.active
          }
          hint={focusedTenant ? focusedTenant.code || "selected" : "live customers"}
          icon={<Building2 className="h-3.5 w-3.5" />}
          onClick={() => go("hospitals")}
        />
        <HqMetricCard
          label={focusedTenant ? "Onboarded" : "New tenants"}
          value={
            focusedTenant
              ? (() => {
                  const c = parseDate(focusedTenant.createdAt)
                  return c
                    ? c.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "—"
                })()
              : business.newHospitals
          }
          hint={focusedTenant ? "created date" : "this month"}
          icon={<Plus className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Renewals"
          value={business.renewals}
          hint={focusedTenant ? "entitlement stack" : "entitled stacks"}
          icon={<CreditCard className="h-3.5 w-3.5" />}
        />
      </HqMetricGrid>
      <div className="grid gap-2 sm:grid-cols-2">
        <HqMetricCard
          label="Cancelled plans"
          value={business.cancelledPlans}
          hint="inactive · this month"
          icon={<Ban className="h-3.5 w-3.5" />}
          onClick={() => go("hospitals")}
        />
        <HqMetricCard
          label="Subscriptions · attention"
          value={business.expireSoon.length}
          hint="incomplete modules"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          onClick={() => go("hospitals")}
        />
      </div>

      <HqSectionLabel>
        {focusedTenant ? `Tenant overview · ${focusedTenant.name}` : "Platform overview"}
      </HqSectionLabel>
      <HqMetricGrid columns={6}>
        <HqMetricCard
          label="Doctors"
          value={platformCounts.doctors.toLocaleString("en-IN")}
          hint={focusedTenant ? "this tenant" : "sampled live tenants"}
          icon={<Stethoscope className="h-3.5 w-3.5" />}
          onClick={() => go("doctors")}
        />
        <HqMetricCard
          label="Patients"
          value={platformCounts.patients.toLocaleString("en-IN")}
          hint={focusedTenant ? "this tenant" : "sampled live tenants"}
          icon={<Users className="h-3.5 w-3.5" />}
          onClick={() => go("patients")}
        />
        <HqMetricCard
          label="Appointments"
          value={platformCounts.appointments.toLocaleString("en-IN")}
          hint={focusedTenant ? "this tenant" : "sampled live tenants"}
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          onClick={() => go("appointments")}
        />
        <HqMetricCard
          label="Revenue"
          value={business.monthlyRevenue == null ? "—" : formatInr(business.monthlyRevenue)}
          hint={focusedTenant ? "paid MTD · this tenant" : "paid MTD · platform sample"}
          icon={<IndianRupee className="h-3.5 w-3.5" />}
          onClick={() => go("billing")}
        />
        <HqMetricCard
          label="Branches"
          value={platformCounts.branches.toLocaleString("en-IN")}
          hint={focusedTenant ? "this tenant" : "platform total"}
          icon={<GitBranch className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Admins"
          value={tenantAdminCount.toLocaleString("en-IN")}
          hint={focusedTenant ? "this tenant" : "all tenant admins"}
          icon={<UserCog className="h-3.5 w-3.5" />}
          onClick={() => go("admins")}
        />
      </HqMetricGrid>

      {/* Platform Health */}
      <HqSectionLabel>Platform health</HqSectionLabel>
      <HqPanel
        title="Service status"
        subtitle="Open Monitoring for full probes, latency, and logs"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => go("monitoring")}>
            Open monitoring
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        }
      >
        <div className="hq-ds-health-grid p-3">
          {healthServices.map((s) => (
            <HqHealthCard key={s.name} name={s.name} status={s.status} detail={s.detail} />
          ))}
        </div>
      </HqPanel>

      {/* Quick Actions */}
      <HqSectionLabel>Quick actions</HqSectionLabel>
      <div className="hq-ds-quick-grid">
        {onOpenGlobalSearch && (
          <button type="button" className="hq-ds-quick-btn" onClick={onOpenGlobalSearch}>
            <Search className="h-4 w-4 text-cyan-700" />
            <span className="hq-ds-quick-btn-label">Global Search</span>
            <span className="hq-ds-quick-btn-hint">⌘K · all entities</span>
          </button>
        )}
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("activity")}>
          <Radio className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Live Activity</span>
          <span className="hq-ds-quick-btn-hint">Severity · feed · jump</span>
        </button>
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("analytics")}>
          <BarChart3 className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Business Analytics</span>
          <span className="hq-ds-quick-btn-hint">MRR · growth · usage</span>
        </button>
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("monitoring")}>
          <Activity className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Platform Monitoring</span>
          <span className="hq-ds-quick-btn-hint">Health · latency · logs</span>
        </button>
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("hospitals")}>
          <Building2 className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Add Tenant</span>
          <span className="hq-ds-quick-btn-hint">Onboard customer</span>
        </button>
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("subscriptions")}>
          <Layers className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Create Plan</span>
          <span className="hq-ds-quick-btn-hint">Subscription Center</span>
        </button>
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("admins")}>
          <Megaphone className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Broadcast Notice</span>
          <span className="hq-ds-quick-btn-hint">Via tenant admins</span>
        </button>
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("admins")}>
          <UserPlus className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Create Admin</span>
          <span className="hq-ds-quick-btn-hint">Provision operator</span>
        </button>
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("subscriptions")}>
          <CreditCard className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Subscription Center</span>
          <span className="hq-ds-quick-btn-hint">Plans · renewals · revenue</span>
        </button>
        <button type="button" className="hq-ds-quick-btn" onClick={() => go("account")}>
          <Settings className="h-4 w-4 text-cyan-700" />
          <span className="hq-ds-quick-btn-label">Global Settings</span>
          <span className="hq-ds-quick-btn-hint">Platform · integrations · security</span>
        </button>
      </div>

      <HqWorkspace
        primary={
          <HqPanel
            title="Live activities"
            subtitle="Derived from tenant lifecycle · refresh for latest"
            actions={
              <button
                type="button"
                onClick={() => go("activity")}
                className="text-[11px] font-semibold text-cyan-800 hover:underline"
              >
                Open Activity Center →
              </button>
            }
          >
            {activities.length === 0 ? (
              <HqEmptyState title="No recent activity" description="Onboard a tenant to start the platform feed." />
            ) : (
              <ul className="hq-ds-activity-list">
                {activities.map((a) => (
                  <HqActivityItem
                    key={a.id}
                    title={a.title}
                    meta={a.meta}
                    icon={activityIcon(a.kind)}
                  />
                ))}
              </ul>
            )}
          </HqPanel>
        }
        rail={
          <>
            <HqPanel
              title="Subscriptions · expire soon"
              subtitle="Tenants with incomplete module stacks"
              padded
            >
              {business.expireSoon.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  No incomplete stacks among live tenants. Review entitlements in Tenant directory.
                </p>
              ) : (
                <ul className="space-y-2">
                  {business.expireSoon.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">{t.name}</p>
                        <div className="mt-1">
                          <HqModuleChipRow
                            branches={t.multipleBranchesEnabled}
                            analytics={t.enableAnalytics}
                            pharmacy={t.enablePharmacy}
                          />
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => go("hospitals")}>
                        Fix
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </HqPanel>

            <HqPanel title="Inactive hospitals" subtitle="Customer health" padded>
              {business.inactive === 0 ? (
                <p className="text-[11px] text-slate-500">All known tenants are live.</p>
              ) : (
                <ul className="space-y-1.5">
                  {tenants
                    .filter((t) => t.status !== "active")
                    .slice(0, 5)
                    .map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium text-slate-700">{t.name}</span>
                        <StatusPill
                          label={t.status === "suspended" ? "Suspended" : "Inactive"}
                          variant="neutral"
                        />
                      </li>
                    ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => go("hospitals")}
                className="mt-2 text-[11px] font-semibold text-cyan-800 hover:underline"
              >
                Open tenant directory →
              </button>
            </HqPanel>

            <HqPanel title="Inspection lens" padded>
              <p className="truncate text-sm font-semibold text-slate-900">
                {activeHospital?.name || "No tenant selected"}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Day-to-day hospital screens use this customer only.
              </p>
              {userHospitals.length > 0 && (
                <select
                  value={activeHospitalId || ""}
                  onChange={(e) => {
                    const id = e.target.value
                    if (id) void setActiveHospital(id)
                  }}
                  className="hq-ds-input mt-3 h-9 w-full"
                >
                  {userHospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {(
                  [
                    ["patients", "Patients"],
                    ["doctors", "Doctors"],
                    ["appointments", "Appointments"],
                    ["billing", "Billing"],
                  ] as const
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => go(tab)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] font-semibold text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </HqPanel>

            <HqPanel
              title="Tenant fleet"
              subtitle={`${business.active} live · ${adminCount} admins`}
              actions={
                <Button type="button" variant="outline" size="sm" onClick={() => go("hospitals")}>
                  Directory
                </Button>
              }
            >
              {fleetPreview.length === 0 ? (
                <HqEmptyState
                  title="No tenants yet"
                  description="Onboard the first hospital customer."
                  actionLabel="Add Tenant"
                  onAction={() => go("hospitals")}
                />
              ) : (
                <ul className="hq-ds-list">
                  {fleetPreview.map((t) => (
                    <li key={t.id} className="hq-ds-list-row">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">{t.name}</p>
                        <p className="text-[10px] text-slate-400">{t.code}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={switchingId === t.id}
                        loadingText="…"
                        onClick={() => void inspectTenant(t.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect
                      </Button>
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
