"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore"
import {
  CreditCard,
  IndianRupee,
  Building2,
  AlertTriangle,
  Ban,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Clock,
  CheckCircle2,
  Layers,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { auth, db } from "@/firebase/config"
import { useAuth } from "@/hooks/useAuth"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import type { Hospital } from "@/types/hospital"
import { Button } from "@/components/ui/Button"
import { FilterChip } from "@/components/ui/FilterChip"
import { ConfirmDialog } from "@/components/ui/overlays/Modals"
import { RevealModal, useRevealModalClose } from "@/components/ui/overlays/RevealModal"
import Notification from "@/components/ui/feedback/Notification"
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
  HqModuleChipRow,
  HqTenantAvatar,
  deriveTenantPlan,
  type HqTenantPlan,
} from "@/components/hq"

const PLAN_CATALOG: Array<{
  id: HqTenantPlan
  priceLabel: string
  blurb: string
  modules: { branches: boolean; analytics: boolean; pharmacy: boolean }
}> = [
  {
    id: "Starter",
    priceLabel: "Core ops",
    blurb: "Single-site hospital with analytics foundation.",
    modules: { branches: false, analytics: true, pharmacy: false },
  },
  {
    id: "Growth",
    priceLabel: "Scale",
    blurb: "Multi-branch or pharmacy-ready growth stack.",
    modules: { branches: true, analytics: true, pharmacy: false },
  },
  {
    id: "Enterprise",
    priceLabel: "Full platform",
    blurb: "Branches + Analytics + Pharmacy entitlements.",
    modules: { branches: true, analytics: true, pharmacy: true },
  },
]

type SubStatus = "trial" | "active" | "pending_renewal" | "expired" | "cancelled" | "upgrade_request"

type SubscriptionRow = Hospital & {
  plan: HqTenantPlan
  renewalDate: Date | null
  subStatus: SubStatus
  created: Date | null
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

function addYears(d: Date, years: number) {
  const next = new Date(d)
  next.setFullYear(next.getFullYear() + years)
  return next
}

function daysUntil(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDate(d: Date | null) {
  if (!d) return "—"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
}

function deriveSubStatus(h: Hospital, renewal: Date | null, created: Date | null): SubStatus {
  if (h.status !== "active") return "cancelled"
  const plan = deriveTenantPlan(h)
  if (plan === "Starter" && created && Date.now() - created.getTime() < 30 * 86_400_000) {
    return "trial"
  }
  if (plan === "Starter") return "upgrade_request"
  if (renewal) {
    const days = daysUntil(renewal)
    if (days < 0) return "expired"
    if (days <= 45) return "pending_renewal"
  }
  return "active"
}

function planModules(plan: HqTenantPlan) {
  return PLAN_CATALOG.find((p) => p.id === plan)!.modules
}

function statusPill(status: SubStatus) {
  const map: Record<SubStatus, { label: string; cls: string }> = {
    trial: { label: "Trial", cls: "hq-ds-mini-pill--warning" },
    active: { label: "Active", cls: "hq-ds-mini-pill--success" },
    pending_renewal: { label: "Pending renewal", cls: "hq-ds-mini-pill--warning" },
    expired: { label: "Expired", cls: "hq-ds-mini-pill--danger" },
    cancelled: { label: "Cancelled", cls: "hq-ds-mini-pill--neutral" },
    upgrade_request: { label: "Upgrade request", cls: "hq-ds-mini-pill--warning" },
  }
  return map[status]
}

function EntitlementFormModal({
  open,
  title,
  description,
  hospital,
  plan,
  setPlan,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  description: string
  hospital: Hospital | null
  plan: HqTenantPlan
  setPlan: (p: HqTenantPlan) => void
  saving: boolean
  onClose: () => void
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <RevealModal isOpen={open} onClose={onClose} closeOnOverlayClick contentClassName="max-w-md w-full mx-4">
      <EntitlementFormBody
        title={title}
        description={description}
        hospital={hospital}
        plan={plan}
        setPlan={setPlan}
        saving={saving}
        onSubmit={onSubmit}
      />
    </RevealModal>
  )
}

function EntitlementFormBody({
  title,
  description,
  hospital,
  plan,
  setPlan,
  saving,
  onSubmit,
}: {
  title: string
  description: string
  hospital: Hospital | null
  plan: HqTenantPlan
  setPlan: (p: HqTenantPlan) => void
  saving: boolean
  onSubmit: (e: FormEvent) => void
}) {
  const requestClose = useRevealModalClose()
  const mods = planModules(plan)

  return (
    <div className="hq-ds-dialog max-w-md w-full">
      <div className="hq-ds-dialog-header">
        <p className="hq-ds-eyebrow">Revenue management · Subscriptions</p>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        {hospital && (
          <p className="mt-2 text-xs font-semibold text-slate-700">
            {hospital.name} · {hospital.code}
          </p>
        )}
      </div>
      <form onSubmit={onSubmit} className="hq-ds-dialog-body space-y-3">
        <div className="space-y-1.5">
          {PLAN_CATALOG.map((p) => (
            <label
              key={p.id}
              className={[
                "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5",
                plan === p.id ? "border-cyan-300 bg-cyan-50/50" : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <input
                type="radio"
                name="plan"
                checked={plan === p.id}
                onChange={() => setPlan(p.id)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className={`hq-ds-plan-pill hq-ds-plan-pill--${p.id.toLowerCase()}`}>{p.id}</span>
                  <span className="text-[11px] text-slate-500">{p.priceLabel}</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{p.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
          <p className="hq-ds-section-label mb-1.5">Modules applied</p>
          <HqModuleChipRow
            branches={mods.branches}
            analytics={mods.analytics}
            pharmacy={mods.pharmacy}
          />
          <p className="mt-2 text-[10px] text-slate-400">
            Uses existing hospital entitlement APIs — no new billing backend.
          </p>
        </div>
        <div className="hq-ds-dialog-footer">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving} loadingText="Saving…">
            Apply plan
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function SubscriptionCenter() {
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const { isSuperAdmin, setActiveHospital, refreshHospitals } = useMultiHospital()

  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState(0)
  const [annualRevenue, setAnnualRevenue] = useState(0)
  const [revenueTrend, setRevenueTrend] = useState<Array<{ month: string; revenue: number }>>([])
  const [statusFilter, setStatusFilter] = useState<"all" | SubStatus>("all")
  const [planFilter, setPlanFilter] = useState<"all" | HqTenantPlan>("all")
  const [search, setSearch] = useState("")

  const [actionHospital, setActionHospital] = useState<Hospital | null>(null)
  const [actionMode, setActionMode] = useState<"upgrade" | "downgrade" | "renew" | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<HqTenantPlan>("Growth")
  const [saving, setSaving] = useState(false)
  const [suspendTarget, setSuspendTarget] = useState<Hospital | null>(null)
  const [suspending, setSuspending] = useState(false)
  const [createPlanOpen, setCreatePlanOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const snap = await getDocs(query(collection(db, "hospitals"), orderBy("createdAt", "desc")))
      setHospitals(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Hospital))

      const user = auth.currentUser
      if (user) {
        const token = await user.getIdToken()
        const res = await fetch("/api/admin/billing-records", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
          const now = new Date()
          const thisMonth = monthKey(now)
          const thisYear = now.getFullYear()
          let monthSum = 0
          let yearSum = 0
          const byMonth = new Map<string, number>()

          for (const r of records) {
            if (r?.status !== "paid") continue
            const paidAt = parseDate(r.paidAt || r.generatedAt)
            if (!paidAt) continue
            const amt = Number(r.totalAmount || 0)
            if (!Number.isFinite(amt)) continue
            const mk = monthKey(paidAt)
            byMonth.set(mk, (byMonth.get(mk) || 0) + amt)
            if (mk === thisMonth) monthSum += amt
            if (paidAt.getFullYear() === thisYear) yearSum += amt
          }

          setMonthlyRevenue(monthSum)
          setAnnualRevenue(yearSum)

          const keys: string[] = []
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            keys.push(monthKey(d))
          }
          setRevenueTrend(keys.map((k) => ({ month: monthLabel(k), revenue: byMonth.get(k) || 0 })))
        }
      }
    } catch {
      setError("Failed to load subscription center data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isSuperAdmin) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  const rows: SubscriptionRow[] = useMemo(() => {
    return hospitals.map((h) => {
      const created = parseDate(h.createdAt)
      const renewal = created ? addYears(created, 1) : null
      return {
        ...h,
        plan: deriveTenantPlan(h),
        renewalDate: renewal,
        subStatus: deriveSubStatus(h, renewal, created),
        created,
      }
    })
  }, [hospitals])

  const kpis = useMemo(() => {
    const trials = rows.filter((r) => r.subStatus === "trial").length
    const expired = rows.filter((r) => r.subStatus === "expired").length
    const pending = rows.filter((r) => r.subStatus === "pending_renewal").length
    const cancelled = rows.filter((r) => r.subStatus === "cancelled").length
    const upgrades = rows.filter((r) => r.subStatus === "upgrade_request").length
    const byPlan = {
      Starter: rows.filter((r) => r.plan === "Starter" && r.status === "active").length,
      Growth: rows.filter((r) => r.plan === "Growth" && r.status === "active").length,
      Enterprise: rows.filter((r) => r.plan === "Enterprise" && r.status === "active").length,
    }
    return { trials, expired, pending, cancelled, upgrades, byPlan }
  }, [rows])

  const renewalTrend = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const label = d.toLocaleDateString("en-IN", { month: "short" })
      const count = rows.filter((r) => {
        if (!r.renewalDate || r.status !== "active") return false
        return (
          r.renewalDate.getFullYear() === d.getFullYear() &&
          r.renewalDate.getMonth() === d.getMonth()
        )
      }).length
      return { month: label, renewals: count }
    })
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.subStatus !== statusFilter) return false
      if (planFilter !== "all" && r.plan !== planFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.plan.toLowerCase().includes(q)
      )
    })
  }, [rows, statusFilter, planFilter, search])

  const openAction = (h: Hospital, mode: "upgrade" | "downgrade" | "renew") => {
    setActionHospital(h)
    setActionMode(mode)
    const current = deriveTenantPlan(h)
    if (mode === "upgrade") {
      setSelectedPlan(current === "Starter" ? "Growth" : "Enterprise")
    } else if (mode === "downgrade") {
      setSelectedPlan(current === "Enterprise" ? "Growth" : "Starter")
    } else {
      setSelectedPlan(current)
    }
  }

  const applyPlan = async (e: FormEvent) => {
    e.preventDefault()
    if (!actionHospital) return
    setSaving(true)
    setError(null)
    try {
      const user = auth.currentUser
      if (!user) throw new Error("Not authenticated")
      const token = await user.getIdToken()
      const mods = planModules(selectedPlan)
      const res = await fetch(`/api/hospitals/${actionHospital.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: actionHospital.name,
          code: actionHospital.code,
          address: actionHospital.address,
          phone: actionHospital.phone,
          email: actionHospital.email || "",
          multipleBranchesEnabled: mods.branches,
          enableAnalytics: mods.analytics,
          enablePharmacy: mods.pharmacy,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed to update subscription")
      setSuccess(
        actionMode === "renew"
          ? `Renewed ${actionHospital.name} on ${selectedPlan}.`
          : `Updated ${actionHospital.name} to ${selectedPlan}.`,
      )
      setActionHospital(null)
      setActionMode(null)
      await load()
      await refreshHospitals()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  const suspend = async () => {
    if (!suspendTarget) return
    setSuspending(true)
    setError(null)
    try {
      const user = auth.currentUser
      if (!user) throw new Error("Not authenticated")
      const token = await user.getIdToken()
      const res = await fetch(`/api/hospitals/${suspendTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed to suspend")
      setSuccess(`Suspended ${suspendTarget.name}.`)
      setSuspendTarget(null)
      await load()
      await refreshHospitals()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Suspend failed")
    } finally {
      setSuspending(false)
    }
  }

  const refund = async (h: Hospital) => {
    try {
      await setActiveHospital(h.id)
      setSuccess(`Opened billing inspection for ${h.name}. Process refunds from tenant billing records.`)
      router.push("/admin-dashboard?tab=billing")
    } catch {
      setError("Could not open billing for refund inspection.")
    }
  }

  const createPlanApply = () => {
    const mods = planModules(selectedPlan)
    try {
      sessionStorage.setItem(
        "hq-subscription-plan-preset",
        JSON.stringify({
          plan: selectedPlan,
          multipleBranchesEnabled: mods.branches,
          enableAnalytics: mods.analytics,
          enablePharmacy: mods.pharmacy,
        }),
      )
    } catch {
      /* ignore */
    }
    setCreatePlanOpen(false)
    setSuccess(`${selectedPlan} plan ready — continue in Tenant Management to onboard a hospital.`)
    router.push("/admin-dashboard?tab=hospitals")
  }

  if (authLoading || (loading && hospitals.length === 0)) {
    return <HqSkeleton metrics={6} split />
  }

  if (!isSuperAdmin) {
    return (
      <HqEmptyState
        title="Platform access required"
        description="Only platform super admins can manage Harmony subscriptions."
      />
    )
  }

  return (
    <HqShell>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}
      {success && <Notification type="success" message={success} onClose={() => setSuccess(null)} />}

      <HqPageHeader
        variant="hero"
        eyebrow="Revenue management · Subscription Center"
        title="Subscription Management"
        description="Plans, renewals, and revenue posture across every hospital tenant — organized like a SaaS billing control plane."
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} loading={loading} loadingText="…">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setSelectedPlan("Growth")
                setCreatePlanOpen(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Plan
            </Button>
          </>
        }
      />

      <HqSectionLabel>Revenue overview</HqSectionLabel>
      <HqMetricGrid columns={6}>
        <HqMetricCard label="Monthly revenue" value={formatInr(monthlyRevenue)} hint="paid MTD" icon={<IndianRupee className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Annual revenue" value={formatInr(annualRevenue)} hint="paid YTD" icon={<IndianRupee className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Trial hospitals" value={kpis.trials} hint="starter · 30d" icon={<Clock className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Expired plans" value={kpis.expired} hint="past renewal" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Pending renewals" value={kpis.pending} hint="≤ 45 days" icon={<RefreshCw className="h-3.5 w-3.5" />} />
        <HqMetricCard label="Cancelled" value={kpis.cancelled} hint="inactive" icon={<Ban className="h-3.5 w-3.5" />} />
      </HqMetricGrid>
      <div className="grid gap-2 sm:grid-cols-2">
        <HqMetricCard label="Upgrade requests" value={kpis.upgrades} hint="starter stacks" icon={<ArrowUpRight className="h-3.5 w-3.5" />} />
        <HqMetricCard
          label="Active plans"
          value={`${kpis.byPlan.Starter}S · ${kpis.byPlan.Growth}G · ${kpis.byPlan.Enterprise}E`}
          hint="live mix"
          icon={<Layers className="h-3.5 w-3.5" />}
        />
      </div>

      <HqSectionLabel>Plans</HqSectionLabel>
      <div className="hq-ds-tenant-grid">
        {PLAN_CATALOG.map((p) => (
          <div key={p.id} className="hq-ds-tenant-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className={`hq-ds-plan-pill hq-ds-plan-pill--${p.id.toLowerCase()}`}>{p.id}</span>
                <p className="mt-2 text-sm font-semibold text-slate-900">{p.priceLabel}</p>
                <p className="mt-0.5 text-xs text-slate-500">{p.blurb}</p>
              </div>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{kpis.byPlan[p.id]}</p>
            </div>
            <HqModuleChipRow
              branches={p.modules.branches}
              analytics={p.modules.analytics}
              pharmacy={p.modules.pharmacy}
            />
            <div className="hq-ds-tenant-actions">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedPlan(p.id)
                  setCreatePlanOpen(true)
                }}
              >
                Use plan
              </Button>
            </div>
          </div>
        ))}
      </div>

      <HqSectionLabel>Trends</HqSectionLabel>
      <div className="grid gap-3 xl:grid-cols-2">
        <HqPanel title="Revenue chart" subtitle="Paid collections · last 6 months (billing records)">
          <div className="hq-ds-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="subRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0891b2" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={48} />
                <Tooltip formatter={(v) => formatInr(typeof v === "number" ? v : Number(v) || 0)} />
                <Area type="monotone" dataKey="revenue" stroke="#0e7490" fill="url(#subRev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HqPanel>
        <HqPanel title="Renewal trends" subtitle="Anniversary renewals by month (next 6)">
          <div className="hq-ds-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={renewalTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Bar dataKey="renewals" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </HqPanel>
      </div>

      <HqSectionLabel>Subscriptions</HqSectionLabel>
      <HqToolbar
        leading={
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hospitals…"
              className="hq-ds-input hq-ds-input--search"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="hq-ds-input w-auto max-w-[11rem]"
            >
              <option value="all">All statuses</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="pending_renewal">Pending renewals</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="upgrade_request">Upgrade requests</option>
            </select>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)}
              className="hq-ds-input w-auto max-w-[9rem]"
            >
              <option value="all">All plans</option>
              <option value="Starter">Starter</option>
              <option value="Growth">Growth</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </>
        }
        trailing={
          <div className="flex flex-wrap gap-1">
            <FilterChip active={statusFilter === "pending_renewal"} onClick={() => setStatusFilter((s) => (s === "pending_renewal" ? "all" : "pending_renewal"))}>
              Renewals
            </FilterChip>
            <FilterChip active={statusFilter === "upgrade_request"} onClick={() => setStatusFilter((s) => (s === "upgrade_request" ? "all" : "upgrade_request"))}>
              Upgrades
            </FilterChip>
          </div>
        }
      />

      <HqWorkspace
        primary={
          <HqPanel title="Subscription directory" subtitle={`${filtered.length} customers`}>
            {filtered.length === 0 ? (
              <HqEmptyState title="No subscriptions match" description="Adjust filters or onboard a tenant." />
            ) : (
              <ul className="hq-ds-list">
                {filtered.map((r) => {
                  const pill = statusPill(r.subStatus)
                  return (
                    <li key={r.id} className="hq-ds-list-row">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <HqTenantAvatar name={r.name} code={r.code} size="sm" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-slate-900">{r.name}</p>
                            <span className={`hq-ds-plan-pill hq-ds-plan-pill--${r.plan.toLowerCase()}`}>{r.plan}</span>
                            <span className={`hq-ds-mini-pill ${pill.cls}`}>{pill.label}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Renewal {formatDate(r.renewalDate)}
                            {r.renewalDate ? ` · ${daysUntil(r.renewalDate)}d` : ""}
                          </p>
                          <div className="mt-1">
                            <HqModuleChipRow
                              branches={r.multipleBranchesEnabled}
                              analytics={r.enableAnalytics}
                              pharmacy={r.enablePharmacy}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => openAction(r, "upgrade")}>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Upgrade
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => openAction(r, "downgrade")}>
                          <ArrowDownRight className="h-3.5 w-3.5" />
                          Downgrade
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => openAction(r, "renew")}>
                          <RefreshCw className="h-3.5 w-3.5" />
                          Renew
                        </Button>
                        {r.status === "active" && (
                          <Button type="button" size="sm" variant="outline" onClick={() => setSuspendTarget(r)}>
                            <Ban className="h-3.5 w-3.5" />
                            Suspend
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="outline" onClick={() => void refund(r)}>
                          Refund
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </HqPanel>
        }
        rail={
          <>
            <HqPanel title="Quick actions" padded>
              <div className="space-y-1.5">
                <Button type="button" size="sm" className="w-full justify-start" onClick={() => setCreatePlanOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Create Plan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/admin-dashboard?tab=hospitals")}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Onboard hospital
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setStatusFilter("pending_renewal")}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Review renewals
                </Button>
              </div>
            </HqPanel>
            <HqPanel title="Plan mix" padded>
              <div className="space-y-2">
                {PLAN_CATALOG.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className={`hq-ds-plan-pill hq-ds-plan-pill--${p.id.toLowerCase()}`}>{p.id}</span>
                    <span className="font-semibold tabular-nums text-slate-800">{kpis.byPlan[p.id]} live</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                Plans map to existing module entitlements (Branches · Analytics · Pharmacy).
              </p>
            </HqPanel>
          </>
        }
      />

      <EntitlementFormModal
        open={!!actionMode && !!actionHospital}
        title={
          actionMode === "upgrade"
            ? "Upgrade subscription"
            : actionMode === "downgrade"
              ? "Downgrade subscription"
              : "Renew subscription"
        }
        description="Applies module entitlements via the existing hospital update API."
        hospital={actionHospital}
        plan={selectedPlan}
        setPlan={setSelectedPlan}
        saving={saving}
        onClose={() => {
          setActionMode(null)
          setActionHospital(null)
        }}
        onSubmit={applyPlan}
      />

      <RevealModal
        isOpen={createPlanOpen}
        onClose={() => setCreatePlanOpen(false)}
        closeOnOverlayClick
        contentClassName="max-w-md w-full mx-4"
      >
        <div className="hq-ds-dialog max-w-md w-full">
          <div className="hq-ds-dialog-header">
            <p className="hq-ds-eyebrow">Revenue management · Subscriptions</p>
            <h3 className="text-sm font-semibold text-slate-900">Create / select plan</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Choose a plan pack to apply when onboarding the next hospital tenant.
            </p>
          </div>
          <div className="hq-ds-dialog-body space-y-3">
            {PLAN_CATALOG.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPlan(p.id)}
                className={[
                  "w-full rounded-lg border px-3 py-2.5 text-left transition",
                  selectedPlan === p.id ? "border-cyan-300 bg-cyan-50/50" : "border-slate-200 hover:border-slate-300",
                ].join(" ")}
              >
                <span className={`hq-ds-plan-pill hq-ds-plan-pill--${p.id.toLowerCase()}`}>{p.id}</span>
                <p className="mt-1 text-xs text-slate-600">{p.blurb}</p>
              </button>
            ))}
          </div>
          <div className="hq-ds-dialog-footer">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreatePlanOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={createPlanApply}>
                <CreditCard className="h-3.5 w-3.5" />
                Continue to tenants
              </Button>
          </div>
        </div>
      </RevealModal>

      <ConfirmDialog
        isOpen={!!suspendTarget}
        title="Suspend subscription"
        message={
          suspendTarget
            ? `Suspend ${suspendTarget.name}? The tenant will be set inactive (existing deactivate flow).`
            : ""
        }
        confirmText="Suspend"
        cancelText="Cancel"
        onConfirm={() => void suspend()}
        onCancel={() => setSuspendTarget(null)}
        confirmLoading={suspending}
      />
    </HqShell>
  )
}
