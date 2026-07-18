"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  collection,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  IndianRupee,
  TrendingUp,
  Building2,
  Stethoscope,
  Users,
  RefreshCw,
  Percent,
  Layers,
  HardDrive,
  Server,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { auth, db } from "@/firebase/config"
import { useAuth } from "@/shared/hooks/useAuth"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { getHospitalCollection } from "@/shared/utils/firebase/hospital-queries"
import type { Hospital } from "@/types/hospital"
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
  deriveTenantPlan,
  type HqTenantPlan,
} from "@/features/admin/components/hq"

const PLAN_COLORS: Record<HqTenantPlan, string> = {
  Starter: "#94a3b8",
  Growth: "#0891b2",
  Enterprise: "#0f766e",
}

const CHART = {
  grid: "#e2e8f0",
  cyan: "#0891b2",
  teal: "#0d9488",
  slate: "#64748b",
  amber: "#d97706",
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

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
}

function lastNMonthKeys(n: number, now = new Date()) {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  return keys
}

function formatInr(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—"
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

function formatPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—"
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(1)}%`
}

function pctChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

type BillingRow = {
  hospitalId?: string | null
  totalAmount?: number
  status?: string
  paidAt?: unknown
  generatedAt?: unknown
  patientName?: string
}

type HospitalUsage = {
  id: string
  name: string
  code: string
  plan: HqTenantPlan
  status: string
  doctors: number
  patients: number
  appointments: number
  revenue: number
  activityScore: number
}

async function safeCount(hospitalId: string, name: "doctors" | "patients" | "appointments") {
  try {
    const snap = await getCountFromServer(getHospitalCollection(hospitalId, name))
    return snap.data().count
  } catch {
    return 0
  }
}

export default function BusinessAnalytics() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { isSuperAdmin, setActiveHospital } = useMultiHospital()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [records, setRecords] = useState<BillingRow[]>([])
  const [usage, setUsage] = useState<HospitalUsage[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const snap = await getDocs(query(collection(db, "hospitals"), orderBy("createdAt", "desc")))
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Hospital)
      setHospitals(list)

      let billing: BillingRow[] = []
      const currentUser = auth.currentUser
      if (currentUser) {
        const token = await currentUser.getIdToken()
        const res = await fetch("/api/admin/billing-records", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          billing = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
        }
      }
      setRecords(billing)

      const revenueByHospital = new Map<string, number>()
      for (const r of billing) {
        if (r?.status !== "paid") continue
        const hid = r.hospitalId ? String(r.hospitalId) : ""
        if (!hid) continue
        const amt = Number(r.totalAmount || 0)
        if (!Number.isFinite(amt)) continue
        revenueByHospital.set(hid, (revenueByHospital.get(hid) || 0) + amt)
      }

      const active = list.filter((h) => h.status === "active").slice(0, 20)
      const usageRows = await Promise.all(
        active.map(async (h) => {
          const [doctors, patients, appointments] = await Promise.all([
            safeCount(h.id, "doctors"),
            safeCount(h.id, "patients"),
            safeCount(h.id, "appointments"),
          ])
          const revenue = revenueByHospital.get(h.id) || 0
          return {
            id: h.id,
            name: h.name,
            code: h.code || "—",
            plan: deriveTenantPlan(h),
            status: h.status || "inactive",
            doctors,
            patients,
            appointments,
            revenue,
            activityScore: doctors * 2 + patients + appointments * 3,
          } satisfies HospitalUsage
        }),
      )
      setUsage(usageRows)
    } catch {
      setError("Failed to load business analytics.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && isSuperAdmin) void load()
  }, [user, isSuperAdmin, load])

  const metrics = useMemo(() => {
    const now = new Date()
    const keys = lastNMonthKeys(6, now)
    const thisMonth = monthKey(now)
    const prevMonth = keys.length >= 2 ? keys[keys.length - 2] : thisMonth

    const paidByMonth = new Map<string, number>()
    for (const r of records) {
      if (r?.status !== "paid") continue
      const paidAt = parseDate(r.paidAt || r.generatedAt)
      if (!paidAt) continue
      const amt = Number(r.totalAmount || 0)
      if (!Number.isFinite(amt)) continue
      const mk = monthKey(paidAt)
      paidByMonth.set(mk, (paidByMonth.get(mk) || 0) + amt)
    }

    const mrr = paidByMonth.get(thisMonth) || 0
    const prevMrr = paidByMonth.get(prevMonth) || 0
    const arr = mrr * 12
    const revenueGrowth = pctChange(mrr, prevMrr)

    const hospitalsByMonth = new Map<string, number>()
    for (const h of hospitals) {
      const c = parseDate(h.createdAt)
      if (!c) continue
      const mk = monthKey(c)
      hospitalsByMonth.set(mk, (hospitalsByMonth.get(mk) || 0) + 1)
    }

    const hospitalTrend = keys.map((k) => ({
      month: monthLabel(k),
      hospitals: hospitalsByMonth.get(k) || 0,
      cumulative: keys.slice(0, keys.indexOf(k) + 1).reduce((s, key) => s + (hospitalsByMonth.get(key) || 0), 0),
    }))

    // Approximate doctor/patient growth from current usage sampled evenly across months is weak;
    // instead build trend from hospital onboard counts + current fleet totals as series endpoints,
    // and monthly "new hospital capacity" proxy using created hospitals * average doctors/patients.
    const avgDoctors =
      usage.length > 0 ? usage.reduce((s, u) => s + u.doctors, 0) / usage.length : 0
    const avgPatients =
      usage.length > 0 ? usage.reduce((s, u) => s + u.patients, 0) / usage.length : 0

    let doctorCum = 0
    let patientCum = 0
    const clinicalTrend = keys.map((k) => {
      const added = hospitalsByMonth.get(k) || 0
      doctorCum += added * avgDoctors
      patientCum += added * avgPatients
      return {
        month: monthLabel(k),
        doctors: Math.round(doctorCum),
        patients: Math.round(patientCum),
        newHospitals: added,
      }
    })

    const revenueTrend = keys.map((k) => ({
      month: monthLabel(k),
      revenue: paidByMonth.get(k) || 0,
    }))

    const active = hospitals.filter((h) => h.status === "active")
    const inactive = hospitals.filter((h) => h.status !== "active")
    const newThisMonth = hospitals.filter((h) => {
      const c = parseDate(h.createdAt)
      return c ? monthKey(c) === thisMonth : false
    }).length
    const newPrevMonth = hospitals.filter((h) => {
      const c = parseDate(h.createdAt)
      return c ? monthKey(c) === prevMonth : false
    }).length
    const hospitalGrowth = pctChange(newThisMonth, newPrevMonth)

    const churnedThisMonth = inactive.filter((h) => {
      const u = parseDate(h.updatedAt) || parseDate(h.createdAt)
      return u ? monthKey(u) === thisMonth : false
    }).length
    const base = active.length + churnedThisMonth
    const churnRate = base > 0 ? (churnedThisMonth / base) * 100 : 0

    const renewable = active.filter((h) => {
      const plan = deriveTenantPlan(h)
      return plan === "Growth" || plan === "Enterprise"
    }).length
    const renewalRate = active.length > 0 ? (renewable / active.length) * 100 : 0

    const planDist: Array<{ name: HqTenantPlan; value: number; fill: string }> = (
      ["Starter", "Growth", "Enterprise"] as HqTenantPlan[]
    ).map((p) => ({
      name: p,
      value: active.filter((h) => deriveTenantPlan(h) === p).length,
      fill: PLAN_COLORS[p],
    }))

    const totalDoctors = usage.reduce((s, u) => s + u.doctors, 0)
    const totalPatients = usage.reduce((s, u) => s + u.patients, 0)
    const doctorGrowth = pctChange(totalDoctors, Math.max(totalDoctors - newThisMonth * avgDoctors, 0))
    const patientGrowth = pctChange(totalPatients, Math.max(totalPatients - newThisMonth * avgPatients, 0))

    const mostActive = [...usage].sort((a, b) => b.activityScore - a.activityScore).slice(0, 8)
    const topRevenue = [...usage].sort((a, b) => b.revenue - a.revenue).slice(0, 8)

    const usageBars = [...usage]
      .sort((a, b) => b.patients + b.doctors - (a.patients + a.doctors))
      .slice(0, 8)
      .map((u) => ({
        name: u.name.length > 14 ? `${u.name.slice(0, 12)}…` : u.name,
        doctors: u.doctors,
        patients: u.patients,
        appointments: u.appointments,
      }))

    return {
      mrr,
      arr,
      revenueGrowth,
      hospitalGrowth,
      doctorGrowth,
      patientGrowth,
      renewalRate,
      churnRate,
      newThisMonth,
      churnedThisMonth,
      activeCount: active.length,
      totalDoctors,
      totalPatients,
      revenueTrend,
      hospitalTrend,
      clinicalTrend,
      planDist,
      mostActive,
      topRevenue,
      usageBars,
      keys,
    }
  }, [hospitals, records, usage])

  const openHospital = async (id: string, tab = "hospitals") => {
    try {
      await setActiveHospital(id)
      router.push(`/admin-dashboard?tab=${tab}`)
    } catch {
      setError("Could not open hospital.")
    }
  }

  if (authLoading || (loading && hospitals.length === 0)) {
    return <HqSkeleton metrics={8} split />
  }

  if (!isSuperAdmin) {
    return (
      <HqEmptyState
        title="Platform access required"
        description="SaaS business analytics are available to platform super admins only."
      />
    )
  }

  return (
    <HqShell>
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}

      <HqPageHeader
        variant="hero"
        eyebrow="Business intelligence · Analytics"
        title="Platform business performance"
        description="MRR, growth, renewals, and hospital usage across the Harmony fleet — derived from live tenants and paid collection samples."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} loading={loading} loadingText="…">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />

      <HqSectionLabel>Revenue & retention</HqSectionLabel>
      <HqMetricGrid columns={4}>
        <HqMetricCard
          label="MRR"
          value={formatInr(metrics.mrr)}
          hint="proxy · paid MTD sample"
          icon={<IndianRupee className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="ARR"
          value={formatInr(metrics.arr)}
          hint="MRR × 12 annualized"
          icon={<IndianRupee className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Revenue growth"
          value={formatPct(metrics.revenueGrowth)}
          hint="MoM paid collections"
          icon={
            metrics.revenueGrowth >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )
          }
        />
        <HqMetricCard
          label="Renewal rate"
          value={formatPct(metrics.renewalRate)}
          hint="Growth/Enterprise share of live"
          icon={<Percent className="h-3.5 w-3.5" />}
        />
      </HqMetricGrid>

      <HqSectionLabel>Fleet growth</HqSectionLabel>
      <HqMetricGrid columns={4}>
        <HqMetricCard
          label="Tenant growth"
          value={formatPct(metrics.hospitalGrowth)}
          hint={`${metrics.newThisMonth} onboarded MTD`}
          icon={<Building2 className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Doctor growth"
          value={formatPct(metrics.doctorGrowth)}
          hint={`${metrics.totalDoctors.toLocaleString("en-IN")} across sample`}
          icon={<Stethoscope className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Patient growth"
          value={formatPct(metrics.patientGrowth)}
          hint={`${metrics.totalPatients.toLocaleString("en-IN")} across sample`}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <HqMetricCard
          label="Churn rate"
          value={formatPct(metrics.churnRate)}
          hint={`${metrics.churnedThisMonth} deactivated MTD`}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
      </HqMetricGrid>

      <HqSectionLabel>Trends</HqSectionLabel>
      <div className="grid gap-3 xl:grid-cols-2">
        <HqPanel title="Revenue trend" subtitle="Paid collections · last 6 months (billing sample)">
          <div className="hq-ds-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.revenueTrend}>
                <defs>
                  <linearGradient id="baRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.cyan} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART.cyan} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={52} />
                <Tooltip formatter={(v) => formatInr(typeof v === "number" ? v : Number(v) || 0)} />
                <Area type="monotone" dataKey="revenue" stroke={CHART.cyan} fill="url(#baRev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HqPanel>

        <HqPanel title="Tenant growth" subtitle="New tenants by month · cumulative onboard">
          <div className="hq-ds-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.hospitalTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="hospitals" name="New" stroke={CHART.teal} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cumulative" name="Cumulative (window)" stroke={CHART.slate} strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </HqPanel>

        <HqPanel title="Doctor & patient growth" subtitle="Estimated capacity from onboarded hospitals × fleet averages">
          <div className="hq-ds-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.clinicalTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="doctors" name="Doctors (est.)" stroke={CHART.cyan} fill={CHART.cyan} fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="patients" name="Patients (est.)" stroke={CHART.amber} fill={CHART.amber} fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HqPanel>

        <HqPanel title="Plan distribution" subtitle="Live tenants by derived plan pack">
          <div className="hq-ds-chart">
            {metrics.planDist.every((p) => p.value === 0) ? (
              <HqEmptyState title="No live tenants" description="Onboard a hospital to see plan mix." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.planDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {metrics.planDist.map((p) => (
                      <Cell key={p.name} fill={p.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </HqPanel>
      </div>

      <HqSectionLabel>Hospital performance</HqSectionLabel>
      <HqWorkspace
        primary={
          <div className="space-y-3">
            <HqPanel title="Most active hospitals" subtitle="Composite of doctors · patients · appointments">
              {metrics.mostActive.length === 0 ? (
                <HqEmptyState title="No usage sample" description="Active tenant metrics will appear here." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {metrics.mostActive.map((h, i) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          <span className="mr-1.5 tabular-nums text-slate-400">{i + 1}.</span>
                          {h.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {h.doctors} doctors · {h.patients} patients · {h.appointments} appts · {h.plan}
                        </p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => void openHospital(h.id, "patients")}>
                        Inspect
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </HqPanel>

            <HqPanel title="Hospital usage" subtitle="Doctors / patients / appointments by tenant">
              <div className="hq-ds-chart hq-ds-chart--lg">
                {metrics.usageBars.length === 0 ? (
                  <HqEmptyState title="No usage data" description="Counts load from active hospitals." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.usageBars}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={48} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={32} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="doctors" name="Doctors" fill={CHART.cyan} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="patients" name="Patients" fill={CHART.teal} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="appointments" name="Appointments" fill={CHART.amber} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </HqPanel>
          </div>
        }
        rail={
          <>
            <HqPanel title="Top revenue hospitals" subtitle="Paid collection sample by tenant" padded>
              {metrics.topRevenue.length === 0 ? (
                <p className="text-[11px] text-slate-500">No paid billing attributed to hospitals yet.</p>
              ) : (
                <ul className="space-y-2">
                  {metrics.topRevenue.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">{h.name}</p>
                        <p className="text-[10px] text-slate-500">{h.plan}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold tabular-nums text-cyan-800 hover:underline"
                        onClick={() => void openHospital(h.id, "billing")}
                      >
                        {formatInr(h.revenue)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </HqPanel>

            <HqPanel title="API usage" padded>
              <div className="flex items-start gap-2">
                <Server className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Not instrumented</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Request volume and latency quotas are not metered in this console. Use Platform Monitoring for API reachability.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => router.push("/admin-dashboard?tab=monitoring")}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Monitoring
                  </Button>
                </div>
              </div>
            </HqPanel>

            <HqPanel title="Storage usage" padded>
              <div className="flex items-start gap-2">
                <HardDrive className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Not instrumented</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Bucket metering is not available. Storage bucket metadata is listed under Global Settings → Storage.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => router.push("/admin-dashboard?tab=account")}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Settings
                  </Button>
                </div>
              </div>
            </HqPanel>

            <HqPanel title="About these metrics" padded>
              <p className="text-[11px] leading-relaxed text-slate-500">
                MRR/ARR are paid-collection proxies from the admin billing sample (not contracted subscription MRR).
                Renewal rate uses Growth/Enterprise entitlement share. Churn uses soft-deactivated hospitals this month.
              </p>
            </HqPanel>
          </>
        }
      />
    </HqShell>
  )
}
