"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  BedDouble,
  IndianRupee,
  Receipt,
  CalendarDays,
  Stethoscope,
  Siren,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  RotateCcw,
  DoorOpen,
  HeartPulse,
  Building2,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Pill,
  FileText,
  LogIn,
  CalendarPlus,
  BarChart3,
  UserCog,
  type LucideIcon,
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
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/firebase/config"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"
import { useBranchSelection } from "@/providers/BranchProvider"
import {
  filterByBranchField,
  filterBranchesBySelection,
  isAllBranches,
  isUnassignedBranchValue,
} from "@/utils/branch/branchFilters"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import type { Appointment, Room } from "@/types/patient"
import type { TrendPoint } from "@/utils/analytics/dashboardCalculations"
import type { RevenueTrendPoint } from "@/utils/analytics/dashboardCalculations"
import {
  formatLocalYmd,
  getPaidAmount,
  isPaidAppointment,
  isSameLocalDay,
  revenueDateKey,
} from "@/utils/analytics/dashboardCalculations"
import { NotificationBadge, EnterpriseDataTable, StatusPill } from '@/shared/components'
import type { EnterpriseColumn } from '@/shared/components'
import { useAdminHospitalDataOptional } from "@/providers/AdminHospitalDataProvider"
import { useSearch } from "@/hooks/useSearch"
import { useTablePagination } from "@/hooks/useTablePagination"
export interface DashboardStatsForOverview {
  totalPatients: number
  totalDoctors: number
  totalAppointments: number
  todayAppointments: number
  todayRevenue: number
  yesterdayRevenue?: number
  completedAppointments: number
  pendingAppointments: number
  totalRevenue: number
  monthlyRevenue: number
  weeklyRevenue: number
  activeDoctorsToday: number
  appointmentTrends: { weekly: TrendPoint[]; monthly: TrendPoint[]; yearly: TrendPoint[] }
  appointmentTotals: { weekly: number; monthly: number; yearly: number }
  commonConditions: { condition: string; count: number }[]
  mostPrescribedMedicines: Array<{ medicineName: string; prescriptionCount: number; percentage: number }>
  revenueTrend: { weekly: RevenueTrendPoint[]; monthly: RevenueTrendPoint[]; yearly: RevenueTrendPoint[] }
  topDepartments: Array<{ department: string; count: number }>
}

type AdminTabId =
  | "overview"
  | "patients"
  | "doctors"
  | "campaigns"
  | "appointments"
  | "billing"
  | "analytics"
  | "hospitals"
  | "admins"
  | "monitoring"
  | "subscriptions"
  | "activity"
  | "branches"
  | "staff"
  | "account"

interface AdminDashboardOverviewProps {
  displayStats: DashboardStatsForOverview
  trendView: "weekly" | "monthly" | "yearly"
  setTrendView: (v: "weekly" | "monthly" | "yearly") => void
  filteredAppointments: Appointment[]
  /** Already-loaded patients for insight cards (branch-filtered). */
  filteredPatients?: Array<Record<string, unknown> & { id?: string; createdAt?: string }>
  branches: Array<{ id: string; name: string }>
  filteredRecentAppointments: Appointment[]
  showRecentAppointments: boolean
  setShowRecentAppointments: (v: boolean) => void
  pendingRefunds: any[]
  onApproveRefund: (r: any) => void
  processingRefundId: string | null
  setActiveTab: React.Dispatch<React.SetStateAction<AdminTabId>>
  setSidebarOpen: (open: boolean) => void
  overviewBadge?: { displayCount: number }
  systemAlerts?: { lowStockCount?: number; doctorUnavailableCount?: number }
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="admin-ov-section-label col-span-12">
      {children}
    </p>
  )
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`admin-ov-panel ${className}`}>
      <div className="admin-ov-panel-header">
        <div className="min-w-0">
          <h3 className="admin-ov-panel-title">{title}</h3>
          {subtitle ? <p className="admin-ov-panel-subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={`admin-ov-panel-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="admin-ov-empty">
      <div className="admin-ov-empty-icon" aria-hidden>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
        </svg>
      </div>
      <p className="admin-ov-empty-title">{title}</p>
      <p className="admin-ov-empty-desc">{description}</p>
    </div>
  )
}

function OpsEmpty({ title }: { title: string }) {
  return (
    <div className="admin-ov-ops-empty">
      <p>{title}</p>
    </div>
  )
}

type KpiTone = "cyan" | "emerald" | "amber" | "teal" | "sky" | "slate" | "rose" | "violet"
type TrendDirection = "up" | "down" | "flat"

function pctChange(today: number, yesterday: number): number | null {
  if (yesterday === 0 && today === 0) return 0
  if (yesterday === 0) return null
  return Math.round(((today - yesterday) / yesterday) * 100)
}

function trendFromDelta(delta: number | null): TrendDirection {
  if (delta === null || delta === 0) return "flat"
  return delta > 0 ? "up" : "down"
}

function isSameDay(value: unknown, day: Date): boolean {
  return isSameLocalDay(value, day)
}

function isEmergencyAppointment(apt: Appointment): boolean {
  const severity = typeof apt.symptomSeverity === "number" ? apt.symptomSeverity : 0
  if (severity >= 8) return true
  const text = `${apt.chiefComplaint || ""} ${apt.associatedSymptoms || ""}`.toLowerCase()
  return /emergency|trauma|critical|accident|cardiac|stroke/.test(text)
}

function minutesPastScheduled(appointmentTime: string): number {
  if (!appointmentTime) return 0
  const [h, m] = appointmentTime.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  const now = new Date()
  const scheduled = new Date()
  scheduled.setHours(h, m, 0, 0)
  return Math.round((now.getTime() - scheduled.getTime()) / 60_000)
}

type TimingStatus = "done" | "missed" | "now" | "overdue" | "upcoming"

function apptTimingStatus(appointmentTime: string, status: string): TimingStatus {
  if (status === "completed") return "done"
  if (status === "cancelled" || status === "not_attended" || status === "no_show") return "missed"
  const mins = minutesPastScheduled(appointmentTime)
  if (mins < -10) return "upcoming"
  if (mins <= 10) return "now"
  return "overdue"
}

function OpsStatusBadge({
  label,
  tone,
}: {
  label: string
  tone: "cyan" | "amber" | "green" | "rose" | "slate" | "violet"
}) {
  return <span className={`admin-ov-chip admin-ov-chip--${tone}`}>{label}</span>
}

function OpsRow({
  primary,
  secondary,
  meta,
  badge,
  highlight,
}: {
  primary: string
  secondary: string
  meta?: string
  badge?: ReactNode
  highlight?: "rose" | "amber" | "none"
}) {
  return (
    <div
      className={`admin-ov-ops-row ${
        highlight === "rose" ? "admin-ov-ops-row--rose" : highlight === "amber" ? "admin-ov-ops-row--amber" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="admin-ov-ops-primary">{primary}</p>
        <p className="admin-ov-ops-secondary">{secondary}</p>
      </div>
      <div className="admin-ov-ops-meta shrink-0">
        {meta ? <span className="admin-ov-ops-meta-text">{meta}</span> : null}
        {badge}
      </div>
    </div>
  )
}

function FinanceMetricCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone: KpiTone
  hint?: string
}) {
  return (
    <div className={`admin-ov-fin-card admin-ov-fin-card--${tone}`}>
      <div className="admin-ov-fin-card-top">
        <span className="admin-ov-fin-card-icon" aria-hidden>
          <Icon className="w-4 h-4" strokeWidth={2} />
        </span>
      </div>
      <p className="admin-ov-fin-card-value">{value}</p>
      <p className="admin-ov-fin-card-label">{label}</p>
      {hint ? <p className="admin-ov-fin-card-hint">{hint}</p> : null}
    </div>
  )
}

function formatCompactInr(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(amount >= 10_000 ? 0 : 1)}k`
  return `₹${amount.toLocaleString("en-IN")}`
}

function FinanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0]?.value || 0)
  return (
    <div className="admin-ov-fin-tooltip">
      <p className="admin-ov-fin-tooltip-label">{label}</p>
      <p className="admin-ov-fin-tooltip-value">₹{value.toLocaleString("en-IN")}</p>
    </div>
  )
}

function BranchMetricTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
  formatValue?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  const value = Number(payload[0]?.value || 0)
  const display = formatValue ? formatValue(value) : value.toLocaleString("en-IN")
  return (
    <div className="admin-ov-fin-tooltip">
      <p className="admin-ov-fin-tooltip-label">{label}</p>
      <p className="admin-ov-fin-tooltip-value">{display}</p>
    </div>
  )
}

type BranchChartPoint = { name: string; value: number }

/** Compact bar chart panel — reuses existing Recharts BarChart (no new libs). */
function BranchAnalyticsChart({
  title,
  subtitle,
  data,
  color,
  formatValue,
  emptyTitle,
}: {
  title: string
  subtitle: string
  data: BranchChartPoint[]
  color: string
  formatValue?: (value: number) => string
  emptyTitle?: string
}) {
  const hasPositive = data.some((d) => d.value > 0)
  const showEmpty = data.length === 0 || (Boolean(emptyTitle) && !hasPositive)
  return (
    <Panel title={title} subtitle={subtitle}>
      <div className="admin-ov-fin-chart admin-ov-fin-chart--sm">
        {showEmpty ? (
          <EmptyBlock
            title={emptyTitle || "No data yet"}
            description="Metrics appear once branch activity is recorded."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={data.length > 4 ? -20 : 0}
                textAnchor={data.length > 4 ? "end" : "middle"}
                height={data.length > 4 ? 48 : 28}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v) =>
                  formatValue ? formatValue(Number(v)).replace(/^₹/, "") : String(v)
                }
              />
              <Tooltip content={<BranchMetricTooltip formatValue={formatValue} />} />
              <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  )
}

function isIcuRoom(room: Room): boolean {
  const custom = String(room.customRoomTypeName || "").toLowerCase()
  const attrs = room.attributes || {}
  const attrText = `${attrs.ward || ""} ${attrs.category || ""} ${attrs.unit || ""}`.toLowerCase()
  return (
    custom.includes("icu") ||
    custom.includes("intensive") ||
    attrText.includes("icu") ||
    String(room.roomNumber || "").toLowerCase().includes("icu")
  )
}

function ResourceCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone,
  progress,
  badge,
}: {
  label: string
  value: string | number
  sublabel?: string
  icon: LucideIcon
  tone: KpiTone
  progress?: number | null
  badge?: { label: string; tone: "cyan" | "amber" | "green" | "rose" | "slate" | "violet" }
}) {
  const pct = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)))
  return (
    <div className={`admin-ov-res-card admin-ov-res-card--${tone}`}>
      <div className="admin-ov-res-card-top">
        <span className="admin-ov-res-card-icon" aria-hidden>
          <Icon className="w-4 h-4" strokeWidth={2} />
        </span>
        {badge ? <OpsStatusBadge label={badge.label} tone={badge.tone} /> : null}
      </div>
      <p className="admin-ov-res-card-value">{value}</p>
      <p className="admin-ov-res-card-label">{label}</p>
      {sublabel ? <p className="admin-ov-res-card-sub">{sublabel}</p> : null}
      {pct != null ? (
        <div className="admin-ov-res-progress" aria-label={`${label} ${pct}%`}>
          <div className="admin-ov-res-progress-track">
            <div className="admin-ov-res-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="admin-ov-res-progress-pct">{pct}%</span>
        </div>
      ) : null}
    </div>
  )
}

type BranchOverallStatus = "healthy" | "busy" | "critical"

type BranchPerformanceCardData = {
  branchId: string
  branchName: string
  /** Unique patients with appointments today (OPD + other). */
  todayPatients: number
  opdToday: number
  ipdCurrent: number | null
  revenueToday: number | null
  bedOccupancy: string
  bedOccupancyPct: number | null
  availableDoctors: number | null
  waitingQueue: number
  emergencyCases: number
  status: BranchOverallStatus
}

type BranchComparisonRow = {
  id: string
  branchName: string
  todayPatients: number
  revenueToday: number | null
  availableDoctors: number | null
  bedOccupancy: string
  bedOccupancyPct: number | null
  waitingQueue: number
  emergencyCases: number
  status: BranchOverallStatus
}

function branchStatusLabel(status: BranchOverallStatus): string {
  if (status === "critical") return "🔴 Critical"
  if (status === "busy") return "🟡 Busy"
  return "🟢 Healthy"
}

function branchStatusTone(status: BranchOverallStatus): "green" | "amber" | "rose" {
  if (status === "critical") return "rose"
  if (status === "busy") return "amber"
  return "green"
}

function deriveBranchOverallStatus(input: {
  waitingQueue: number
  emergencyCases: number
  bedOccupancyPct: number | null
}): BranchOverallStatus {
  const { waitingQueue, emergencyCases, bedOccupancyPct } = input
  if (
    (emergencyCases > 0 && waitingQueue >= 3) ||
    waitingQueue >= 8 ||
    (bedOccupancyPct != null && bedOccupancyPct >= 90)
  ) {
    return "critical"
  }
  if (
    waitingQueue >= 4 ||
    emergencyCases > 0 ||
    (bedOccupancyPct != null && bedOccupancyPct >= 70)
  ) {
    return "busy"
  }
  return "healthy"
}

/** Compact enterprise card for one branch — reuses admin Panel card shell. */
function BranchPerformanceCard({ data }: { data: BranchPerformanceCardData }) {
  const metrics: Array<{ label: string; value: string }> = [
    { label: "Today's OPD", value: String(data.opdToday) },
    {
      label: "Current IPD",
      value: data.ipdCurrent == null ? "—" : String(data.ipdCurrent),
    },
    {
      label: "Today's Revenue",
      value: data.revenueToday == null ? "—" : formatCompactInr(data.revenueToday),
    },
    { label: "Bed Occupancy", value: data.bedOccupancy },
    {
      label: "Available Doctors",
      value: data.availableDoctors == null ? "—" : String(data.availableDoctors),
    },
    { label: "Waiting Queue", value: String(data.waitingQueue) },
    { label: "Emergency Cases", value: String(data.emergencyCases) },
  ]

  return (
    <Panel
      title={data.branchName}
      subtitle="Branch performance"
      action={<OpsStatusBadge label={branchStatusLabel(data.status)} tone={branchStatusTone(data.status)} />}
      className="admin-ov-branch-card h-full"
      bodyClassName="!pt-2"
    >
      <div className="admin-ov-branch-metrics">
        {metrics.map((m) => (
          <div key={m.label} className="admin-ov-branch-metric">
            <span className="admin-ov-branch-metric-label">{m.label}</span>
            <span className="admin-ov-branch-metric-value">{m.value}</span>
          </div>
        ))}
        <div className="admin-ov-branch-metric admin-ov-branch-metric--status">
          <span className="admin-ov-branch-metric-label">Overall Status</span>
          <span className="admin-ov-branch-metric-value">{branchStatusLabel(data.status)}</span>
        </div>
      </div>
    </Panel>
  )
}

type BranchRankingEntry = {
  rank: number
  branchName: string
  value: string
}

/** Compact top-N ranking card — reuses admin Panel shell. */
function BranchRankingCard({
  title,
  subtitle,
  icon: Icon,
  tone,
  items,
}: {
  title: string
  subtitle?: string
  icon: LucideIcon
  tone: KpiTone
  items: BranchRankingEntry[]
}) {
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      action={
        <span className={`admin-ov-res-card-icon admin-ov-kpi-icon admin-ov-kpi--${tone}`} aria-hidden>
          <Icon className="w-4 h-4" strokeWidth={2} />
        </span>
      }
      className="admin-ov-branch-rank h-full"
      bodyClassName="!pt-1"
    >
      {items.length === 0 ? (
        <OpsEmpty title="No ranking data yet" />
      ) : (
        <ol className="admin-ov-branch-rank-list">
          {items.map((item) => (
            <li key={`${title}-${item.rank}-${item.branchName}`} className="admin-ov-branch-rank-item">
              <span className="admin-ov-branch-rank-pos">{item.rank}</span>
              <span className="admin-ov-branch-rank-name">{item.branchName}</span>
              <span className="admin-ov-branch-rank-value">{item.value}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function topBranchRankings(
  rows: BranchComparisonRow[],
  getValue: (row: BranchComparisonRow) => number | null,
  order: "asc" | "desc",
  formatValue: (value: number) => string,
  limit = 5
): BranchRankingEntry[] {
  const sorted = [...rows].sort((a, b) => {
    const av = getValue(a)
    const bv = getValue(b)
    if (av == null && bv == null) return a.branchName.localeCompare(b.branchName)
    if (av == null) return 1
    if (bv == null) return -1
    const delta = order === "desc" ? bv - av : av - bv
    return delta !== 0 ? delta : a.branchName.localeCompare(b.branchName)
  })

  return sorted
    .filter((row) => getValue(row) != null)
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      branchName: row.branchName,
      value: formatValue(getValue(row) as number),
    }))
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return "—"
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

type ActivityKind =
  | "patient_registered"
  | "appointment_booked"
  | "consultation_completed"
  | "patient_admitted"
  | "patient_discharged"
  | "invoice_generated"
  | "medicine_stock"
  | "refund_requested"

type ActivityTone = "cyan" | "emerald" | "amber" | "teal" | "violet" | "rose" | "sky" | "slate"

const ACTIVITY_META: Record<
  ActivityKind,
  { label: string; tone: ActivityTone; Icon: LucideIcon }
> = {
  patient_registered: { label: "Patient Registered", tone: "emerald", Icon: UserPlus },
  appointment_booked: { label: "Appointment Booked", tone: "cyan", Icon: CalendarDays },
  consultation_completed: { label: "Consultation Completed", tone: "teal", Icon: CheckCircle2 },
  patient_admitted: { label: "Patient Admitted", tone: "violet", Icon: LogIn },
  patient_discharged: { label: "Patient Discharged", tone: "sky", Icon: BedDouble },
  invoice_generated: { label: "Invoice Generated", tone: "amber", Icon: FileText },
  medicine_stock: { label: "Medicine Stock Updated", tone: "slate", Icon: Pill },
  refund_requested: { label: "Refund Requested", tone: "rose", Icon: RotateCcw },
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  comparisonLabel,
  trendPct,
  invertTrend = false,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone: KpiTone
  comparisonLabel: string
  trendPct: number | null
  /** When true, upward movement is treated as negative (e.g. pending bills, emergencies). */
  invertTrend?: boolean
}) {
  const direction = trendFromDelta(trendPct)
  const isPositive =
    direction === "flat"
      ? null
      : invertTrend
        ? direction === "down"
        : direction === "up"

  return (
    <div className={`admin-ov-kpi admin-ov-kpi--${tone}`}>
      <div className="admin-ov-kpi-top">
        <span className="admin-ov-kpi-icon" aria-hidden>
          <Icon className="w-4 h-4" strokeWidth={2} />
        </span>
        <span
          className={`admin-ov-kpi-trend ${
            isPositive === true
              ? "admin-ov-kpi-trend--up"
              : isPositive === false
                ? "admin-ov-kpi-trend--down"
                : "admin-ov-kpi-trend--flat"
          }`}
        >
          {direction === "up" ? (
            <TrendingUp className="w-3 h-3" />
          ) : direction === "down" ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
          {trendPct === null ? "—" : `${Math.abs(trendPct)}%`}
        </span>
      </div>
      <p className="admin-ov-kpi-value">{value}</p>
      <p className="admin-ov-kpi-label">{label}</p>
      <p className="admin-ov-kpi-compare">{comparisonLabel}</p>
    </div>
  )
}

export default function AdminDashboardOverview({
  displayStats,
  trendView,
  setTrendView,
  filteredAppointments,
  filteredPatients = [],
  branches,
  filteredRecentAppointments: _filteredRecentAppointments,
  showRecentAppointments: _showRecentAppointments,
  setShowRecentAppointments: _setShowRecentAppointments,
  pendingRefunds,
  onApproveRefund,
  processingRefundId,
  setActiveTab,
  setSidebarOpen,
  overviewBadge = { displayCount: 0 },
  systemAlerts = {},
}: AdminDashboardOverviewProps) {
  const { activeHospitalId } = useMultiHospital()
  const { selectedBranchId, branches: contextBranches } = useBranchSelection()
  const branchList = branches.length > 0 ? branches : contextBranches
  const sharedHospitalData = useAdminHospitalDataOptional()
  const {
    searchTerm: branchCompareSearch,
    setSearchTerm: setBranchCompareSearch,
    debouncedSearchTerm: branchCompareDebouncedSearch,
  } = useSearch()
  const [branchCompareSortField, setBranchCompareSortField] = useState("branchName")
  const [branchCompareSortOrder, setBranchCompareSortOrder] = useState<"asc" | "desc">("asc")
  const [roomsInventory, setRoomsInventory] = useState<Array<Room & { branchId?: string | null }>>([])
  const [activeAdmissions, setActiveAdmissions] = useState<
    Array<{ id: string; branchId?: string | null }>
  >([])

  // Read-only rooms inventory for resource widgets (no seed / no mutations).
  useEffect(() => {
    let cancelled = false
    if (!activeHospitalId) {
      setRoomsInventory([])
      return
    }
    getDocs(query(collection(db, "rooms"), where("hospitalId", "==", activeHospitalId)))
      .then((snap) => {
        if (cancelled) return
        const rooms = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() as Omit<Room, "id"> & Partial<Room> & {
              isArchived?: boolean
              hospitalId?: string
              branchId?: string | null
            }
            return { ...data, id: docSnap.id } as Room & {
              isArchived?: boolean
              hospitalId?: string
              branchId?: string | null
            }
          })
          .filter((room) => !(room as Room & { isArchived?: boolean }).isArchived)
        setRoomsInventory(rooms)
        if (process.env.NODE_ENV === "development") {
          console.info("[admin-dashboard] rooms inventory", {
            hospitalId: activeHospitalId,
            count: rooms.length,
            available: rooms.filter((r) => r.status === "available").length,
            occupied: rooms.filter((r) => r.status === "occupied").length,
          })
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[admin-dashboard] rooms query failed", err)
        }
        if (!cancelled) setRoomsInventory([])
      })
    return () => {
      cancelled = true
    }
  }, [activeHospitalId])

  // Live IPD occupancy from hospital-scoped admissions (status admitted).
  useEffect(() => {
    if (!activeHospitalId) {
      setActiveAdmissions([])
      return
    }
    let cancelled = false
    getDocs(
      query(
        getHospitalCollection(activeHospitalId, "admissions"),
        where("status", "in", ["admitted", "scheduled"])
      )
    )
      .then((snap) => {
        if (cancelled) return
        setActiveAdmissions(
          snap.docs.map((d) => {
            const data = d.data() as { branchId?: string | null }
            return { id: d.id, branchId: data.branchId ?? null }
          })
        )
        if (process.env.NODE_ENV === "development") {
          console.info("[admin-dashboard] admissions", {
            hospitalId: activeHospitalId,
            active: snap.size,
          })
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[admin-dashboard] admissions query failed", err)
        }
        if (!cancelled) setActiveAdmissions([])
      })
    return () => {
      cancelled = true
    }
  }, [activeHospitalId])

  /** Scope rooms/admissions to Branch Context without re-querying. */
  const scopedRoomsInventory = useMemo(() => {
    const roomsHaveBranch = roomsInventory.some((r) => !isUnassignedBranchValue(r.branchId))
    if (roomsHaveBranch) {
      return filterByBranchField(roomsInventory, selectedBranchId, (r) => r.branchId, "keep")
    }
    // Untagged room inventory is hospital-wide — use only for "All Branches".
    if (isAllBranches(selectedBranchId)) return roomsInventory
    return []
  }, [roomsInventory, selectedBranchId])

  const activeAdmissionsCount = useMemo(
    () => filterByBranchField(activeAdmissions, selectedBranchId, (a) => a.branchId, "keep").length,
    [activeAdmissions, selectedBranchId]
  )

  const branchPerformanceCards = useMemo((): BranchPerformanceCardData[] => {
    const scopedBranches = filterBranchesBySelection(branchList, selectedBranchId)
    if (scopedBranches.length === 0) return []

    const today = new Date()
    const waitingStatuses = new Set(["confirmed", "pending", "rescheduled", "resrescheduled"])
    const roomsHaveBranch = roomsInventory.some((r) => !isUnassignedBranchValue(r.branchId))
    const admissionsHaveBranch = activeAdmissions.some((a) => !isUnassignedBranchValue(a.branchId))
    const doctors = sharedHospitalData.isProvided ? sharedHospitalData.doctors : []
    const billingRecords = sharedHospitalData.isProvided ? sharedHospitalData.billingRecords : []
    const doctorsLoaded = sharedHospitalData.isProvided && !sharedHospitalData.loading
    const billingLoaded =
      sharedHospitalData.isProvided && !sharedHospitalData.billingLoading && !sharedHospitalData.loading

    return scopedBranches.map((branch) => {
      const branchApts = filteredAppointments.filter(
        (a) => (a as Appointment & { branchId?: string | null }).branchId === branch.id
      )
      const todayApts = branchApts.filter(
        (a) =>
          isSameDay(a.appointmentDate, today) &&
          a.status !== "cancelled" &&
          a.status !== "whatsapp_pending" &&
          !(a as Appointment & { whatsappPending?: boolean }).whatsappPending
      )

      const opdToday = todayApts
        .filter((a) => !a.admissionId)
        .reduce((set, a) => {
          if (a.patientId) set.add(a.patientId)
          return set
        }, new Set<string>()).size

      const todayPatients = todayApts.reduce((set, a) => {
        if (a.patientId) set.add(a.patientId)
        return set
      }, new Set<string>()).size

      let ipdCurrent: number | null = null
      if (admissionsHaveBranch) {
        ipdCurrent = activeAdmissions.filter((a) => a.branchId === branch.id).length
      } else {
        const fromApts = branchApts.filter(
          (a) => Boolean(a.admissionId) && a.status !== "cancelled" && a.status !== "completed"
        ).length
        ipdCurrent = fromApts > 0 ? fromApts : filteredAppointments.length === 0 ? null : 0
      }

      let revenueToday: number | null = null
      if (billingLoaded && billingRecords.length > 0) {
        revenueToday = billingRecords
          .filter((r) => {
            if (String(r.status || "").toLowerCase() !== "paid") return false
            if (r.branchId !== branch.id) return false
            return isSameLocalDay(r.paidAt, today)
          })
          .reduce((sum, r) => sum + Number(r.totalAmount || 0), 0)
      } else if (branchApts.length > 0 || filteredAppointments.length > 0) {
        revenueToday = todayApts
          .filter((a) => isPaidAppointment(a))
          .reduce((sum, a) => sum + getPaidAmount(a), 0)
      }

      let bedOccupancy = "—"
      let bedOccupancyPct: number | null = null
      if (roomsHaveBranch) {
        const branchRooms = roomsInventory.filter((r) => r.branchId === branch.id)
        if (branchRooms.length > 0) {
          const occupied = branchRooms.filter((r) => r.status === "occupied").length
          bedOccupancyPct = Math.round((occupied / branchRooms.length) * 100)
          bedOccupancy = `${bedOccupancyPct}%`
        }
      }

      let availableDoctors: number | null = null
      if (doctorsLoaded) {
        availableDoctors = doctors.filter((d) => {
          const branchIds = (d as { branchIds?: string[] | null }).branchIds || []
          if (!Array.isArray(branchIds) || !branchIds.includes(branch.id)) return false
          const status = String((d as { status?: string }).status || "").toLowerCase()
          return status === "" || status === "active" || status === "approved"
        }).length
      }

      const waitingQueue = todayApts.filter((a) =>
        waitingStatuses.has(String(a.status || "").toLowerCase())
      ).length
      const emergencyCases = todayApts.filter(isEmergencyAppointment).length
      const status = deriveBranchOverallStatus({
        waitingQueue,
        emergencyCases,
        bedOccupancyPct,
      })

      return {
        branchId: branch.id,
        branchName: branch.name,
        todayPatients,
        opdToday,
        ipdCurrent,
        revenueToday,
        bedOccupancy,
        bedOccupancyPct,
        availableDoctors,
        waitingQueue,
        emergencyCases,
        status,
      }
    })
  }, [
    branchList,
    selectedBranchId,
    filteredAppointments,
    roomsInventory,
    activeAdmissions,
    sharedHospitalData.isProvided,
    sharedHospitalData.loading,
    sharedHospitalData.billingLoading,
    sharedHospitalData.doctors,
    sharedHospitalData.billingRecords,
  ])

  const branchComparisonRows = useMemo((): BranchComparisonRow[] => {
    return branchPerformanceCards.map((card) => ({
      id: card.branchId,
      branchName: card.branchName,
      todayPatients: card.todayPatients,
      revenueToday: card.revenueToday,
      availableDoctors: card.availableDoctors,
      bedOccupancy: card.bedOccupancy,
      bedOccupancyPct: card.bedOccupancyPct,
      waitingQueue: card.waitingQueue,
      emergencyCases: card.emergencyCases,
      status: card.status,
    }))
  }, [branchPerformanceCards])

  const filteredBranchComparisonRows = useMemo(() => {
    const q = branchCompareDebouncedSearch.trim().toLowerCase()
    let rows = branchComparisonRows
    if (q) {
      rows = rows.filter(
        (r) =>
          r.branchName.toLowerCase().includes(q) ||
          branchStatusLabel(r.status).toLowerCase().includes(q)
      )
    }

    const dir = branchCompareSortOrder === "asc" ? 1 : -1
    const cmpNullable = (a: number | null, b: number | null) => {
      if (a == null && b == null) return 0
      if (a == null) return 1
      if (b == null) return -1
      return (a - b) * dir
    }

    return [...rows].sort((a, b) => {
      switch (branchCompareSortField) {
        case "todayPatients":
          return (a.todayPatients - b.todayPatients) * dir
        case "revenueToday":
          return cmpNullable(a.revenueToday, b.revenueToday)
        case "availableDoctors":
          return cmpNullable(a.availableDoctors, b.availableDoctors)
        case "bedOccupancy":
          return cmpNullable(a.bedOccupancyPct, b.bedOccupancyPct)
        case "waitingQueue":
          return (a.waitingQueue - b.waitingQueue) * dir
        case "emergencyCases":
          return (a.emergencyCases - b.emergencyCases) * dir
        case "status": {
          const rank = { healthy: 0, busy: 1, critical: 2 }
          return (rank[a.status] - rank[b.status]) * dir
        }
        case "branchName":
        default:
          return a.branchName.localeCompare(b.branchName) * dir
      }
    })
  }, [
    branchComparisonRows,
    branchCompareDebouncedSearch,
    branchCompareSortField,
    branchCompareSortOrder,
  ])

  const {
    currentPage: branchComparePage,
    pageSize: branchComparePageSize,
    totalPages: branchCompareTotalPages,
    paginatedItems: paginatedBranchComparisonRows,
    goToPage: goToBranchComparePage,
    setPageSize: setBranchComparePageSize,
  } = useTablePagination(filteredBranchComparisonRows, {
    initialPageSize: 10,
    resetOnFilterChange: true,
  })

  const handleBranchCompareSort = (field: string) => {
    if (branchCompareSortField === field) {
      setBranchCompareSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setBranchCompareSortField(field)
      setBranchCompareSortOrder(field === "branchName" ? "asc" : "desc")
    }
  }

  const branchComparisonColumns = useMemo((): EnterpriseColumn<BranchComparisonRow>[] => {
    return [
      {
        key: "branchName",
        header: "Branch",
        sortable: true,
        width: "w-[16%]",
        render: (row) => (
          <span className="font-semibold text-slate-900">{row.branchName}</span>
        ),
      },
      {
        key: "todayPatients",
        header: "Today's Patients",
        sortable: true,
        align: "right",
        width: "w-[11%]",
        render: (row) => (
          <span className="tabular-nums text-slate-800">{row.todayPatients}</span>
        ),
      },
      {
        key: "revenueToday",
        header: "Today's Revenue",
        sortable: true,
        align: "right",
        width: "w-[12%]",
        hideBelow: "sm",
        render: (row) => (
          <span className="tabular-nums font-medium text-slate-900">
            {row.revenueToday == null ? "—" : formatCompactInr(row.revenueToday)}
          </span>
        ),
      },
      {
        key: "availableDoctors",
        header: "Doctors Available",
        sortable: true,
        align: "right",
        width: "w-[11%]",
        hideBelow: "md",
        render: (row) => (
          <span className="tabular-nums text-slate-800">
            {row.availableDoctors == null ? "—" : row.availableDoctors}
          </span>
        ),
      },
      {
        key: "bedOccupancy",
        header: "Bed Occupancy",
        sortable: true,
        align: "right",
        width: "w-[11%]",
        hideBelow: "md",
        render: (row) => (
          <span className="tabular-nums text-slate-800">{row.bedOccupancy}</span>
        ),
      },
      {
        key: "waitingQueue",
        header: "Waiting Queue",
        sortable: true,
        align: "right",
        width: "w-[11%]",
        hideBelow: "lg",
        render: (row) => (
          <span className="tabular-nums text-slate-800">{row.waitingQueue}</span>
        ),
      },
      {
        key: "emergencyCases",
        header: "Emergency Cases",
        sortable: true,
        align: "right",
        width: "w-[11%]",
        hideBelow: "lg",
        render: (row) => (
          <span className="tabular-nums text-slate-800">{row.emergencyCases}</span>
        ),
      },
      {
        key: "status",
        header: "Overall Status",
        sortable: true,
        width: "w-[14%]",
        render: (row) => (
          <StatusPill
            label={branchStatusLabel(row.status)}
            variant={
              row.status === "critical"
                ? "danger"
                : row.status === "busy"
                  ? "warning"
                  : "success"
            }
          />
        ),
      },
    ]
  }, [])

  const branchRankings = useMemo(() => {
    const rows = branchComparisonRows
    return {
      highestRevenue: topBranchRankings(
        rows,
        (r) => r.revenueToday,
        "desc",
        (v) => formatCompactInr(v)
      ),
      highestPatientVolume: topBranchRankings(
        rows,
        (r) => r.todayPatients,
        "desc",
        (v) => `${v} patient${v === 1 ? "" : "s"}`
      ),
      bestBedUtilization: topBranchRankings(
        rows,
        (r) => r.bedOccupancyPct,
        "desc",
        (v) => `${v}%`
      ),
      fastestQueue: topBranchRankings(
        rows,
        (r) => r.waitingQueue,
        "asc",
        (v) => (v === 0 ? "Queue clear" : `${v} waiting`)
      ),
    }
  }, [branchComparisonRows])

  /** Executive charts — same cached branch metrics; reacts to Branch Context selection. */
  const executiveBranchCharts = useMemo(() => {
    const rows = branchComparisonRows
    const shortName = (name: string) =>
      name.length > 12 ? `${name.slice(0, 11)}…` : name

    return {
      revenueByBranch: rows.map((r) => ({
        name: shortName(r.branchName),
        value: r.revenueToday ?? 0,
      })),
      patientsByBranch: rows.map((r) => ({
        name: shortName(r.branchName),
        value: r.todayPatients,
      })),
      bedOccupancyByBranch: rows.map((r) => ({
        name: shortName(r.branchName),
        value: r.bedOccupancyPct ?? 0,
      })),
      waitingQueueByBranch: rows.map((r) => ({
        name: shortName(r.branchName),
        value: r.waitingQueue,
      })),
      doctorsByBranch: rows.map((r) => ({
        name: shortName(r.branchName),
        value: r.availableDoctors ?? 0,
      })),
      hasBedData: rows.some((r) => r.bedOccupancyPct != null),
      hasDoctorData: rows.some((r) => r.availableDoctors != null),
      hasRevenueData: rows.some((r) => (r.revenueToday ?? 0) > 0),
    }
  }, [branchComparisonRows])

  /** KPI metrics derived only from already-loaded appointment data (no API changes). */
  const hospitalKpis = useMemo(() => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const onDay = (day: Date) =>
      filteredAppointments.filter(
        (a) =>
          isSameDay(a.appointmentDate, day) &&
          a.status !== "cancelled" &&
          a.status !== "whatsapp_pending" &&
          !(a as Appointment & { whatsappPending?: boolean }).whatsappPending
      )

    const todayApts = onDay(today)
    const yesterdayApts = onDay(yesterday)

    const opdOn = (apts: Appointment[]) =>
      apts.filter((a) => !a.admissionId).reduce((set, a) => {
        if (a.patientId) set.add(a.patientId)
        return set
      }, new Set<string>()).size

    const ipdCurrent = filteredAppointments.filter(
      (a) =>
        Boolean(a.admissionId) &&
        a.status !== "cancelled" &&
        a.status !== "completed"
    ).length

    const ipdYesterday = yesterdayApts.filter((a) => Boolean(a.admissionId)).length

    const pendingBills = filteredAppointments.filter((a) => {
      const unpaid = a.paymentStatus === "unpaid" || a.paymentStatus === "pending"
      const remaining = (a.remainingAmount || 0) > 0
      return (unpaid || remaining) && (a.status === "confirmed" || a.status === "completed")
    }).length

    const pendingBillsYesterday = yesterdayApts.filter((a) => {
      const unpaid = a.paymentStatus === "unpaid" || a.paymentStatus === "pending"
      const remaining = (a.remainingAmount || 0) > 0
      return unpaid || remaining
    }).length

    // Occupied beds inferred from admission-linked appointments + live admissions.
    const bedOccupiedToday = Math.max(
      filteredAppointments.filter(
        (a) => Boolean(a.admissionId) && a.status !== "cancelled" && a.status !== "completed"
      ).length,
      activeAdmissionsCount
    )
    const bedOccupiedYesterday = yesterdayApts.filter((a) => Boolean(a.admissionId)).length

    const doctorsToday = new Set(todayApts.map((a) => a.doctorId).filter(Boolean)).size
    const doctorsYesterday = new Set(yesterdayApts.map((a) => a.doctorId).filter(Boolean)).size

    const emergencyToday = todayApts.filter(isEmergencyAppointment).length
    const emergencyYesterday = yesterdayApts.filter(isEmergencyAppointment).length

    const todayOpd = opdOn(todayApts)
    const yesterdayOpd = opdOn(yesterdayApts)
    // Revenue comes from page.tsx unified billing (admission + appointment collections),
    // matching Reception Billing "Today's Collection".
    const todayRevenue = Number(displayStats.todayRevenue || 0)
    const yesterdayRevenue = Number(displayStats.yesterdayRevenue || 0)

    const compare = (todayVal: number, yesterdayVal: number, unit = "") => {
      const delta = todayVal - yesterdayVal
      if (delta === 0) return `Same as yesterday`
      const sign = delta > 0 ? "+" : ""
      return `${sign}${delta}${unit} vs yesterday`
    }

    return {
      opd: {
        value: todayOpd,
        trend: pctChange(todayOpd, yesterdayOpd),
        compare: compare(todayOpd, yesterdayOpd),
      },
      ipd: {
        value: ipdCurrent,
        trend: pctChange(ipdCurrent, ipdYesterday),
        compare: compare(ipdCurrent, ipdYesterday),
      },
      revenue: {
        value: todayRevenue,
        trend: pctChange(todayRevenue, yesterdayRevenue),
        compareText:
          yesterdayRevenue === todayRevenue
            ? "Same as yesterday"
            : `${todayRevenue >= yesterdayRevenue ? "+" : "−"}₹${Math.abs(todayRevenue - yesterdayRevenue).toLocaleString()} vs yesterday`,
      },
      pendingBills: {
        value: pendingBills,
        trend: pctChange(pendingBills, pendingBillsYesterday),
        compare: compare(pendingBills, pendingBillsYesterday),
      },
      bedOccupancy: {
        value: bedOccupiedToday,
        trend: pctChange(bedOccupiedToday, bedOccupiedYesterday),
        compare: compare(bedOccupiedToday, bedOccupiedYesterday),
      },
      appointments: {
        value: todayApts.length,
        trend: pctChange(todayApts.length, yesterdayApts.length),
        compare: compare(todayApts.length, yesterdayApts.length),
      },
      doctors: {
        value: doctorsToday || displayStats.activeDoctorsToday,
        trend: pctChange(doctorsToday || displayStats.activeDoctorsToday, doctorsYesterday),
        compare: compare(doctorsToday || displayStats.activeDoctorsToday, doctorsYesterday),
      },
      emergency: {
        value: emergencyToday,
        trend: pctChange(emergencyToday, emergencyYesterday),
        compare: compare(emergencyToday, emergencyYesterday),
      },
    }
  }, [filteredAppointments, displayStats.activeDoctorsToday, displayStats.todayRevenue, displayStats.yesterdayRevenue, activeAdmissionsCount])

  /** Operations widgets — presentation-only views of already-loaded appointments. */
  const hospitalOperations = useMemo(() => {
    const today = new Date()

    const todayApts = filteredAppointments
      .filter(
        (a) =>
          isSameDay(a.appointmentDate, today) &&
          a.status !== "whatsapp_pending" &&
          !(a as Appointment & { whatsappPending?: boolean }).whatsappPending
      )
      .sort((a, b) => (a.appointmentTime || "").localeCompare(b.appointmentTime || ""))

    const timeline = todayApts.slice(0, 10).map((a) => {
      const timing = apptTimingStatus(a.appointmentTime || "", a.status)
      return {
        id: a.id,
        time: a.appointmentTime || "—",
        patientName: a.patientName || "Unknown",
        doctorName: a.doctorName || "—",
        status: a.status,
        timing,
      }
    })

    const waitingStatuses = new Set(["confirmed", "pending", "rescheduled", "resrescheduled"])
    const waitingQueue = todayApts
      .filter((a) => waitingStatuses.has(String(a.status || "").toLowerCase()))
      .map((a) => {
        const waitMins = minutesPastScheduled(a.appointmentTime || "")
        return {
          id: a.id,
          patientName: a.patientName || "Unknown",
          doctorName: a.doctorName || "—",
          appointmentTime: a.appointmentTime || "",
          waitMins,
          overdue: waitMins > 15,
          urgent: waitMins > 30,
        }
      })
      .sort((a, b) => b.waitMins - a.waitMins)
      .slice(0, 8)

    const consultingDoctors = (() => {
      const byDoctor = new Map<
        string,
        { doctorId: string; doctorName: string; specialization: string; patientName: string; since: string }
      >()
      todayApts
        .filter((a) => {
          if (a.status === "completed" || a.status === "cancelled") return false
          const timing = apptTimingStatus(a.appointmentTime || "", a.status)
          return timing === "now" || timing === "overdue"
        })
        .forEach((a) => {
          if (!a.doctorId || byDoctor.has(a.doctorId)) return
          byDoctor.set(a.doctorId, {
            doctorId: a.doctorId,
            doctorName: a.doctorName || "Doctor",
            specialization: a.doctorSpecialization || "—",
            patientName: a.patientName || "Patient",
            since: a.appointmentTime || "—",
          })
        })
      return Array.from(byDoctor.values()).slice(0, 8)
    })()

    const recentAdmissions = filteredAppointments
      .filter((a) => Boolean(a.admissionId) && a.status !== "cancelled")
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        patientName: a.patientName || "Unknown",
        doctorName: a.doctorName || "—",
        when: a.updatedAt || a.createdAt || a.appointmentDate,
        status: a.status,
      }))

    const todaysDischarges = filteredAppointments
      .filter(
        (a) =>
          Boolean(a.admissionId) &&
          a.status === "completed" &&
          (isSameDay(a.updatedAt, today) || isSameDay(a.appointmentDate, today))
      )
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        patientName: a.patientName || "Unknown",
        doctorName: a.doctorName || "—",
        when: a.updatedAt || a.appointmentDate,
      }))

    const emergencyPatients = todayApts
      .filter(isEmergencyAppointment)
      .filter((a) => a.status !== "cancelled" && a.status !== "completed")
      .slice(0, 6)
      .map((a) => ({
        id: a.id,
        patientName: a.patientName || "Unknown",
        doctorName: a.doctorName || "Unassigned",
        time: a.appointmentTime || "—",
        severity: typeof a.symptomSeverity === "number" ? a.symptomSeverity : null,
        status: a.status,
      }))

    const overdueCount = waitingQueue.filter((q) => q.overdue).length

    return {
      timeline,
      waitingQueue,
      consultingDoctors,
      recentAdmissions,
      todaysDischarges,
      emergencyPatients,
      overdueCount,
      waitingCount: waitingQueue.length,
    }
  }, [filteredAppointments])

  /** Financial overview — presentation of already-loaded revenue / billing / refund data. */
  const financialOverview = useMemo(() => {
    const pendingBills = filteredAppointments.filter((a) => {
      const unpaid = a.paymentStatus === "unpaid" || a.paymentStatus === "pending"
      const remaining = (a.remainingAmount || 0) > 0
      return (unpaid || remaining) && (a.status === "confirmed" || a.status === "completed")
    })

    const pendingBillAmount = pendingBills.reduce(
      (sum, a) => sum + (a.remainingAmount || getPaidAmount(a) || 0),
      0
    )

    const insuranceClaims = filteredAppointments.filter((a) => {
      const method = String(a.paymentMethod || "").toLowerCase()
      const claimStatus = String((a as Appointment & { insuranceClaimStatus?: string }).insuranceClaimStatus || "").toLowerCase()
      return method.includes("insurance") || claimStatus === "pending" || claimStatus === "submitted"
    }).length

    const refundAmount = pendingRefunds.reduce((sum, r) => sum + Number(r.paymentAmount || 0), 0)

    const periodBars = [
      { name: "Today", revenue: displayStats.todayRevenue },
      { name: "Week", revenue: displayStats.weeklyRevenue },
      { name: "Month", revenue: displayStats.monthlyRevenue },
    ]

    const trendSeries = (displayStats.revenueTrend[trendView] || []).map((p) => ({
      name: p.label,
      revenue: p.revenue,
    }))

    return {
      pendingBillsCount: pendingBills.length,
      pendingBillAmount,
      insuranceClaims,
      refundCount: pendingRefunds.length,
      refundAmount,
      periodBars,
      trendSeries,
    }
  }, [filteredAppointments, displayStats, pendingRefunds, trendView])

  /** Hospital resources — UI presentation from rooms inventory + admissions. */
  const hospitalResources = useMemo(() => {
    const today = new Date()
    const occupiedFromAdmissions = Math.max(
      filteredAppointments.filter(
        (a) => Boolean(a.admissionId) && a.status !== "cancelled" && a.status !== "completed"
      ).length,
      activeAdmissionsCount
    )

    const hasRoomInventory = scopedRoomsInventory.length > 0
    const totalBeds = hasRoomInventory ? scopedRoomsInventory.length : occupiedFromAdmissions
    const occupiedBeds = hasRoomInventory
      ? scopedRoomsInventory.filter((r) => r.status === "occupied").length
      : occupiedFromAdmissions
    const availableRooms = hasRoomInventory
      ? scopedRoomsInventory.filter((r) => r.status === "available").length
      : null
    const maintenanceRooms = scopedRoomsInventory.filter((r) => r.status === "maintenance").length

    const icuRooms = scopedRoomsInventory.filter(isIcuRoom)
    const icuTotal = icuRooms.length
    const icuOccupied = icuRooms.filter((r) => r.status === "occupied").length
    const icuPct = icuTotal > 0 ? (icuOccupied / icuTotal) * 100 : 0

    const bedPct = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : occupiedFromAdmissions > 0 ? 100 : 0

    const otInUse = filteredAppointments.filter((a) => {
      const hasOt = Boolean((a as Appointment & { operationPackage?: unknown }).operationPackage)
      return hasOt && isSameDay(a.appointmentDate, today) && a.status !== "cancelled" && a.status !== "completed"
    }).length

    const otStatus =
      otInUse > 0
        ? { label: "In use", tone: "amber" as const, detail: `${otInUse} procedure${otInUse === 1 ? "" : "s"} today` }
        : { label: "Available", tone: "green" as const, detail: "No active OT bookings" }

    // Ambulance fleet is not in current client datasets — show standby status for UI completeness.
    const ambulanceStatus = {
      label: "Standby",
      tone: "cyan" as const,
      detail: "Fleet status not linked",
    }

    return {
      totalBeds,
      occupiedBeds,
      availableRooms,
      maintenanceRooms,
      bedPct,
      icuTotal,
      icuOccupied,
      icuPct,
      otStatus,
      otInUse,
      ambulanceStatus,
      hasRoomInventory,
    }
  }, [filteredAppointments, scopedRoomsInventory, activeAdmissionsCount])

  /** Doctor & patient insights — presentation from already-loaded appointments/patients. */
  const doctorPatientInsights = useMemo(() => {
    const today = new Date()
    const todayApts = filteredAppointments.filter(
      (a) =>
        isSameDay(a.appointmentDate, today) &&
        a.status !== "whatsapp_pending" &&
        !(a as Appointment & { whatsappPending?: boolean }).whatsappPending
    )

    const doctorsOnline = new Set(todayApts.map((a) => a.doctorId).filter(Boolean)).size

    const completedToday = todayApts.filter((a) => a.status === "completed")
    const patientsSeenToday = new Set(completedToday.map((a) => a.patientId).filter(Boolean)).size

    const actionableToday = todayApts.filter((a) => a.status !== "cancelled")
    const completionRate =
      actionableToday.length > 0
        ? Math.round((completedToday.length / actionableToday.length) * 100)
        : 0

    const durationMins = completedToday
      .map((a) => {
        if (!a.createdAt || !a.updatedAt) return null
        const mins = (new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime()) / 60_000
        if (!Number.isFinite(mins) || mins <= 0 || mins > 180) return null
        return mins
      })
      .filter((m): m is number => m != null)
    const avgConsultationMins =
      durationMins.length > 0
        ? Math.round(durationMins.reduce((s, m) => s + m, 0) / durationMins.length)
        : null

    const loadByDoctor = new Map<
      string,
      { doctorId: string; doctorName: string; specialization: string; total: number; completed: number; waiting: number }
    >()
    todayApts.forEach((a) => {
      if (!a.doctorId) return
      if (!loadByDoctor.has(a.doctorId)) {
        loadByDoctor.set(a.doctorId, {
          doctorId: a.doctorId,
          doctorName: a.doctorName || "Doctor",
          specialization: a.doctorSpecialization || "—",
          total: 0,
          completed: 0,
          waiting: 0,
        })
      }
      const row = loadByDoctor.get(a.doctorId)!
      if (a.status === "cancelled") return
      row.total++
      if (a.status === "completed") row.completed++
      if (a.status === "confirmed" || a.status === "pending") row.waiting++
    })

    const overloadedDoctors = Array.from(loadByDoctor.values())
      .filter((d) => d.total >= 6 || d.waiting >= 3)
      .sort((a, b) => b.total - a.total || b.waiting - a.waiting)
      .slice(0, 6)
      .map((d) => ({
        ...d,
        loadPct: Math.min(100, Math.round((d.total / 10) * 100)),
      }))

    const newPatients = filteredPatients.filter((p) => isSameDay(String(p.createdAt || ""), today)).length

    const patientVisitCounts = new Map<string, number>()
    filteredAppointments.forEach((a) => {
      if (!a.patientId || a.status === "cancelled") return
      patientVisitCounts.set(a.patientId, (patientVisitCounts.get(a.patientId) || 0) + 1)
    })

    const returningPatients = todayApts.filter((a) => {
      if (!a.patientId) return false
      return (patientVisitCounts.get(a.patientId) || 0) > 1
    }).reduce((set, a) => {
      if (a.patientId) set.add(a.patientId)
      return set
    }, new Set<string>()).size

    const followUpsToday = todayApts.filter((a) => {
      const text = `${a.chiefComplaint || ""} ${a.medicalHistory || ""}`.toLowerCase()
      const looksLikeFollowUp = /follow[\s-]?up|review|revisit|followup/.test(text)
      const returning = a.patientId ? (patientVisitCounts.get(a.patientId) || 0) > 1 : false
      return looksLikeFollowUp || returning
    }).length

    const highPriority = todayApts.filter((a) => {
      if (a.status === "cancelled" || a.status === "completed") return false
      const severity = typeof a.symptomSeverity === "number" ? a.symptomSeverity : 0
      return severity >= 6 || isEmergencyAppointment(a)
    })

    const criticalAlerts = todayApts
      .filter((a) => {
        if (a.status === "cancelled" || a.status === "completed") return false
        const severity = typeof a.symptomSeverity === "number" ? a.symptomSeverity : 0
        const overdue =
          (a.status === "confirmed" || a.status === "pending") &&
          minutesPastScheduled(a.appointmentTime || "") > 30
        return severity >= 8 || isEmergencyAppointment(a) || overdue
      })
      .slice(0, 6)
      .map((a) => {
        const severity = typeof a.symptomSeverity === "number" ? a.symptomSeverity : null
        const wait = minutesPastScheduled(a.appointmentTime || "")
        const reason =
          severity != null && severity >= 8
            ? `Severity ${severity}`
            : isEmergencyAppointment(a)
              ? "Emergency indicators"
              : wait > 30
                ? `Wait ${wait}m`
                : "Needs attention"
        return {
          id: a.id,
          patientName: a.patientName || "Unknown",
          doctorName: a.doctorName || "—",
          reason,
          time: a.appointmentTime || "—",
        }
      })

    return {
      doctorsOnline: doctorsOnline || displayStats.activeDoctorsToday,
      patientsSeenToday,
      completionRate,
      avgConsultationMins,
      overloadedDoctors,
      newPatients,
      returningPatients,
      followUpsToday,
      highPriorityCount: highPriority.length,
      criticalAlerts,
    }
  }, [filteredAppointments, filteredPatients, displayStats.activeDoctorsToday])

  /** Live activity timeline — newest first, derived from already-loaded records. */
  const hospitalActivity = useMemo(() => {
    type ActivityItem = {
      id: string
      kind: ActivityKind
      title: string
      detail: string
      timestamp: string
    }

    const events: ActivityItem[] = []

    filteredPatients.forEach((p) => {
      const createdAt = String(p.createdAt || "")
      if (!createdAt) return
      const name =
        [p.firstName, p.lastName].filter(Boolean).map(String).join(" ").trim() ||
        String(p.name || p.email || "Patient")
      events.push({
        id: `reg-${p.id || createdAt}`,
        kind: "patient_registered",
        title: "Patient Registered",
        detail: name,
        timestamp: createdAt,
      })
    })

    filteredAppointments.forEach((a) => {
      const bookedAt = a.createdAt || a.appointmentDate
      if (bookedAt) {
        events.push({
          id: `book-${a.id}`,
          kind: "appointment_booked",
          title: "Appointment Booked",
          detail: `${a.patientName || "Patient"} · Dr. ${a.doctorName || "—"}`,
          timestamp: bookedAt,
        })
      }

      if (a.status === "completed" && (a.updatedAt || a.createdAt)) {
        events.push({
          id: `done-${a.id}`,
          kind: "consultation_completed",
          title: "Consultation Completed",
          detail: `${a.patientName || "Patient"} · Dr. ${a.doctorName || "—"}`,
          timestamp: a.updatedAt || a.createdAt,
        })
      }

      if (a.admissionId && a.status !== "cancelled") {
        events.push({
          id: `admit-${a.id}`,
          kind: "patient_admitted",
          title: "Patient Admitted",
          detail: `${a.patientName || "Patient"} · Dr. ${a.doctorName || "—"}`,
          timestamp: a.createdAt || a.updatedAt || a.appointmentDate,
        })
      }

      if (a.admissionId && a.status === "completed" && (a.updatedAt || a.createdAt)) {
        events.push({
          id: `discharge-${a.id}`,
          kind: "patient_discharged",
          title: "Patient Discharged",
          detail: `${a.patientName || "Patient"} · Dr. ${a.doctorName || "—"}`,
          timestamp: a.updatedAt || a.createdAt,
        })
      }

      const paidAt = a.paidAt || (isPaidAppointment(a) ? a.updatedAt || a.createdAt : "")
      if (paidAt && isPaidAppointment(a)) {
        events.push({
          id: `inv-${a.id}`,
          kind: "invoice_generated",
          title: "Invoice Generated",
          detail: `${a.patientName || "Patient"} · ₹${getPaidAmount(a).toLocaleString("en-IN")}`,
          timestamp: paidAt,
        })
      }
    })

    pendingRefunds.forEach((r) => {
      if (!r.createdAt) return
      events.push({
        id: `refund-${r.id}`,
        kind: "refund_requested",
        title: "Refund Requested",
        detail: `${r.patientName || r.patientId || "Patient"} · ₹${Number(r.paymentAmount || 0).toLocaleString("en-IN")}`,
        timestamp: String(r.createdAt),
      })
    })

    if ((systemAlerts.lowStockCount ?? 0) > 0) {
      events.push({
        id: "stock-alert",
        kind: "medicine_stock",
        title: "Medicine Stock Updated",
        detail: `${systemAlerts.lowStockCount} item(s) flagged low stock`,
        timestamp: new Date().toISOString(),
      })
    }

    return events
      .filter((e) => e.timestamp && !Number.isNaN(new Date(e.timestamp).getTime()))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 40)
  }, [filteredAppointments, filteredPatients, pendingRefunds, systemAlerts.lowStockCount])

  const availableBedsDisplay =
    hospitalResources.availableRooms == null ? "—" : hospitalResources.availableRooms
  const availableBedsTone =
    hospitalResources.availableRooms == null
      ? "slate"
      : hospitalResources.availableRooms === 0
        ? "rose"
        : "sky"

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    console.info("[admin-dashboard] overview rendered values", {
      todayKey: formatLocalYmd(new Date()),
      appointmentsLoaded: filteredAppointments.length,
      appointmentsToday: hospitalKpis.appointments.value,
      waiting: hospitalOperations.waitingCount,
      revenueToday: hospitalKpis.revenue.value,
      displayStatsTodayRevenue: displayStats.todayRevenue,
      doctorsOnline: doctorPatientInsights.doctorsOnline,
      bedsAvailable: availableBedsDisplay,
      critical: doctorPatientInsights.criticalAlerts.length,
      activityEvents: hospitalActivity.length,
    })
  }, [
    filteredAppointments.length,
    hospitalKpis,
    hospitalOperations.waitingCount,
    displayStats.todayRevenue,
    doctorPatientInsights.doctorsOnline,
    doctorPatientInsights.criticalAlerts.length,
    availableBedsDisplay,
    hospitalActivity.length,
  ])

  const hasAlerts =
    pendingRefunds.length > 0 ||
    (systemAlerts.lowStockCount ?? 0) > 0 ||
    (systemAlerts.doctorUnavailableCount ?? 0) > 0 ||
    doctorPatientInsights.criticalAlerts.length > 0 ||
    doctorPatientInsights.overloadedDoctors.length > 0 ||
    hospitalOperations.overdueCount > 0

  const trendSelect = (
    <select
      value={trendView}
      onChange={(e) => setTrendView(e.target.value as "weekly" | "monthly" | "yearly")}
      className="admin-ov-select"
      aria-label="Trend period"
    >
      <option value="weekly">This Week</option>
      <option value="monthly">This Month</option>
      <option value="yearly">This Year</option>
    </select>
  )

  const quickActions = [
    { id: "register-patient", label: "Register Patient", description: "New patient record", icon: UserPlus, tone: "emerald" as const, tab: "patients" as AdminTabId },
    { id: "book-appointment", label: "Book Appointment", description: "Schedule OPD visit", icon: CalendarPlus, tone: "cyan" as const, tab: "appointments" as AdminTabId },
    { id: "admit-patient", label: "Admit Patient", description: "IPD admission", icon: LogIn, tone: "violet" as const, tab: "patients" as AdminTabId },
    { id: "generate-invoice", label: "Generate Invoice", description: "Billing & payments", icon: FileText, tone: "amber" as const, tab: "billing" as AdminTabId },
    { id: "add-doctor", label: "Add Doctor", description: "Clinician profiles", icon: Stethoscope, tone: "teal" as const, tab: "doctors" as AdminTabId },
    { id: "manage-staff", label: "Manage Staff", description: "Reception & pharmacy", icon: UserCog, tone: "sky" as const, tab: "staff" as AdminTabId },
    { id: "view-reports", label: "View Reports", description: "Analytics hub", icon: BarChart3, tone: "slate" as const, tab: "analytics" as AdminTabId },
  ]

  return (
    <div className="admin-ov">
      {/* Critical attention */}
      {hasAlerts && (
        <div className="admin-ov-grid">
          <div className="col-span-12 admin-ov-alert">
            <div className="flex items-start gap-3">
              <div className="admin-ov-alert-icon">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="text-sm font-semibold text-amber-950">Command attention</h4>
                  {pendingRefunds.length > 0 && overviewBadge.displayCount > 0 && (
                    <span className="relative inline-flex">
                      <NotificationBadge count={overviewBadge.displayCount} size="sm" position="top-right" />
                    </span>
                  )}
                </div>
                <ul className="text-sm text-amber-900/80 space-y-0.5">
                  {hospitalOperations.overdueCount > 0 && (
                    <li>
                      <span className="font-medium">{hospitalOperations.overdueCount}</span> delayed patients in waiting queue
                    </li>
                  )}
                  {doctorPatientInsights.criticalAlerts.length > 0 && (
                    <li>
                      <span className="font-medium">{doctorPatientInsights.criticalAlerts.length}</span> critical patient alert
                      {doctorPatientInsights.criticalAlerts.length !== 1 ? "s" : ""}
                    </li>
                  )}
                  {doctorPatientInsights.overloadedDoctors.length > 0 && (
                    <li>
                      <span className="font-medium">{doctorPatientInsights.overloadedDoctors.length}</span> overloaded doctor
                      {doctorPatientInsights.overloadedDoctors.length !== 1 ? "s" : ""}
                    </li>
                  )}
                  {pendingRefunds.length > 0 && (
                    <li>
                      <span className="font-medium">{pendingRefunds.length}</span> pending refund request
                      {pendingRefunds.length !== 1 ? "s" : ""}
                    </li>
                  )}
                  {(systemAlerts.lowStockCount ?? 0) > 0 && (
                    <li>
                      Low medicine stock: <span className="font-medium">{systemAlerts.lowStockCount}</span> item(s)
                    </li>
                  )}
                  {(systemAlerts.doctorUnavailableCount ?? 0) > 0 && (
                    <li>
                      <span className="font-medium">{systemAlerts.doctorUnavailableCount}</span> doctor(s) unavailable
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. At a glance — answers the six command questions */}
      <div className="admin-ov-grid">
        <SectionLabel>At a glance</SectionLabel>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <KpiCard
            label="Appointments Today"
            value={hospitalKpis.appointments.value}
            icon={CalendarDays}
            tone="cyan"
            trendPct={hospitalKpis.appointments.trend}
            comparisonLabel={hospitalKpis.appointments.compare}
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <KpiCard
            label="Waiting / Bottlenecks"
            value={hospitalOperations.waitingCount}
            icon={Clock}
            tone={hospitalOperations.overdueCount > 0 ? "rose" : "amber"}
            trendPct={null}
            comparisonLabel={
              hospitalOperations.overdueCount > 0
                ? `${hospitalOperations.overdueCount} delayed`
                : hospitalOperations.waitingCount === 0
                  ? "Queue clear"
                  : "Patients waiting"
            }
            invertTrend
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <KpiCard
            label="Critical Patients"
            value={doctorPatientInsights.criticalAlerts.length || hospitalKpis.emergency.value}
            icon={Siren}
            tone="rose"
            trendPct={hospitalKpis.emergency.trend}
            comparisonLabel={hospitalKpis.emergency.compare}
            invertTrend
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <KpiCard
            label="Today's Revenue"
            value={
              hospitalKpis.revenue.value > 0
                ? `₹${hospitalKpis.revenue.value.toLocaleString()}`
                : filteredAppointments.length === 0
                  ? "—"
                  : "₹0"
            }
            icon={IndianRupee}
            tone="teal"
            trendPct={hospitalKpis.revenue.trend}
            comparisonLabel={
              hospitalKpis.revenue.value > 0
                ? hospitalKpis.revenue.compareText
                : filteredAppointments.length === 0
                  ? "No appointment data loaded"
                  : "No paid visits attributed to today"
            }
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <KpiCard
            label="Beds Available"
            value={availableBedsDisplay}
            icon={BedDouble}
            tone={availableBedsTone}
            trendPct={hospitalResources.hasRoomInventory ? hospitalKpis.bedOccupancy.trend : null}
            comparisonLabel={
              hospitalResources.hasRoomInventory
                ? `${hospitalResources.occupiedBeds} occupied · ${hospitalResources.totalBeds || "—"} total`
                : activeAdmissionsCount > 0
                  ? `${activeAdmissionsCount} active admissions · inventory not configured`
                  : "Room inventory not configured"
            }
            invertTrend
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <KpiCard
            label="Doctors Online"
            value={
              doctorPatientInsights.doctorsOnline > 0
                ? doctorPatientInsights.doctorsOnline
                : hospitalKpis.appointments.value === 0
                  ? "—"
                  : 0
            }
            icon={Stethoscope}
            tone={doctorPatientInsights.overloadedDoctors.length > 0 ? "amber" : "emerald"}
            trendPct={hospitalKpis.doctors.trend}
            comparisonLabel={
              doctorPatientInsights.overloadedDoctors.length > 0
                ? `${doctorPatientInsights.overloadedDoctors.length} overloaded`
                : doctorPatientInsights.doctorsOnline > 0
                  ? hospitalKpis.doctors.compare
                  : hospitalKpis.appointments.value === 0
                    ? "No clinic activity today"
                    : hospitalKpis.doctors.compare
            }
          />
        </div>
      </div>

      {/* Branch Performance — compact cards directly below KPIs */}
      {branchPerformanceCards.length > 0 && (
        <div className="admin-ov-grid">
          <SectionLabel>Branch Performance</SectionLabel>
          {branchPerformanceCards.map((card) => (
            <div
              key={card.branchId}
              className="col-span-12 sm:col-span-6 xl:col-span-4"
            >
              <BranchPerformanceCard data={card} />
            </div>
          ))}
        </div>
      )}

      {/* Branch Comparison — reusable DataTable below performance cards */}
      {branchComparisonRows.length > 0 && (
        <div className="admin-ov-grid">
          <SectionLabel>Branch Comparison</SectionLabel>
          <div className="col-span-12">
            <Panel
              title="Branch Comparison"
              subtitle="Side-by-side operational metrics across locations"
              bodyClassName="!p-0"
            >
              <EnterpriseDataTable
                data={paginatedBranchComparisonRows}
                columns={branchComparisonColumns}
                emptyTitle={
                  branchCompareDebouncedSearch.trim()
                    ? "No matching branches"
                    : "No branches to compare"
                }
                emptyDescription={
                  branchCompareDebouncedSearch.trim()
                    ? "Try a different search term."
                    : "Branch metrics appear once locations are configured."
                }
                search={{
                  value: branchCompareSearch,
                  onChange: setBranchCompareSearch,
                  placeholder: "Search branches…",
                }}
                enableSearch
                enableSorting
                enablePagination
                enableBulkSelection={false}
                enableRowActions={false}
                sortField={branchCompareSortField}
                sortOrder={branchCompareSortOrder}
                onSort={handleBranchCompareSort}
                currentPage={branchComparePage}
                totalPages={branchCompareTotalPages}
                pageSize={branchComparePageSize}
                totalItems={filteredBranchComparisonRows.length}
                onPageChange={goToBranchComparePage}
                onPageSizeChange={setBranchComparePageSize}
                pageSizeOptions={[5, 10, 15]}
                itemLabel="branches"
                minWidth="720px"
                variant="flat"
              />
            </Panel>
          </div>
        </div>
      )}

      {/* Branch Rankings — top 5 lists from already-loaded branch metrics */}
      {branchComparisonRows.length > 0 && (
        <div className="admin-ov-grid">
          <SectionLabel>Branch Rankings</SectionLabel>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <BranchRankingCard
              title="Highest Revenue"
              subtitle="Today's collections"
              icon={IndianRupee}
              tone="teal"
              items={branchRankings.highestRevenue}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <BranchRankingCard
              title="Highest Patient Volume"
              subtitle="Unique patients today"
              icon={CalendarDays}
              tone="cyan"
              items={branchRankings.highestPatientVolume}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <BranchRankingCard
              title="Best Bed Utilization"
              subtitle="Occupied vs inventory"
              icon={BedDouble}
              tone="violet"
              items={branchRankings.bestBedUtilization}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 xl:col-span-3">
            <BranchRankingCard
              title="Fastest Queue"
              subtitle="Lowest waiting count"
              icon={Clock}
              tone="emerald"
              items={branchRankings.fastestQueue}
            />
          </div>
        </div>
      )}

      {/* Executive Branch Analytics — existing Recharts; cached branch data only */}
      {branchComparisonRows.length > 0 && (
        <div className="admin-ov-grid">
          <SectionLabel>Executive Branch Analytics</SectionLabel>
          <div className="col-span-12 lg:col-span-6 xl:col-span-4">
            <BranchAnalyticsChart
              title="Revenue by Branch"
              subtitle="Today's paid collections"
              data={executiveBranchCharts.revenueByBranch}
              color="#0d9488"
              formatValue={(v) => formatCompactInr(v)}
              emptyTitle={
                executiveBranchCharts.hasRevenueData
                  ? undefined
                  : "No revenue attributed to branches yet"
              }
            />
          </div>
          <div className="col-span-12 lg:col-span-6 xl:col-span-4">
            <BranchAnalyticsChart
              title="Patients by Branch"
              subtitle="Unique patients today"
              data={executiveBranchCharts.patientsByBranch}
              color="#0891b2"
              formatValue={(v) => v.toLocaleString("en-IN")}
            />
          </div>
          <div className="col-span-12 lg:col-span-6 xl:col-span-4">
            <BranchAnalyticsChart
              title="Bed Occupancy by Branch"
              subtitle="Occupied share of inventory"
              data={executiveBranchCharts.bedOccupancyByBranch}
              color="#7c3aed"
              formatValue={(v) => `${v}%`}
              emptyTitle={
                executiveBranchCharts.hasBedData
                  ? undefined
                  : "Bed occupancy not available by branch"
              }
            />
          </div>
          <div className="col-span-12 lg:col-span-6 xl:col-span-6">
            <BranchAnalyticsChart
              title="Waiting Queue by Branch"
              subtitle="Patients waiting today"
              data={executiveBranchCharts.waitingQueueByBranch}
              color="#d97706"
              formatValue={(v) => v.toLocaleString("en-IN")}
            />
          </div>
          <div className="col-span-12 lg:col-span-6 xl:col-span-6">
            <BranchAnalyticsChart
              title="Doctors Available by Branch"
              subtitle="Active clinicians assigned"
              data={executiveBranchCharts.doctorsByBranch}
              color="#059669"
              formatValue={(v) => v.toLocaleString("en-IN")}
              emptyTitle={
                executiveBranchCharts.hasDoctorData
                  ? undefined
                  : "Doctor availability not loaded yet"
              }
            />
          </div>
        </div>
      )}

      {/* 2. Quick actions */}
      <div className="admin-ov-grid">
        <SectionLabel>Quick actions</SectionLabel>
        <div className="col-span-12 admin-ov-quick-grid">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                type="button"
                className={`admin-ov-quick-card admin-ov-quick-card--${action.tone}`}
                onClick={() => {
                  setActiveTab(action.tab)
                  setSidebarOpen(false)
                }}
              >
                <span className="admin-ov-quick-icon" aria-hidden>
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </span>
                <span className="admin-ov-quick-copy">
                  <span className="admin-ov-quick-title">{action.label}</span>
                  <span className="admin-ov-quick-desc">{action.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Decision center — bottlenecks, critical, overloaded */}
      <div className="admin-ov-grid">
        <SectionLabel>Decision center</SectionLabel>

        <div className="col-span-12 lg:col-span-4">
          <Panel
            title="Operational Bottlenecks"
            subtitle={
              hospitalOperations.waitingCount === 0
                ? "Queue clear"
                : `${hospitalOperations.waitingCount} waiting${hospitalOperations.overdueCount > 0 ? ` · ${hospitalOperations.overdueCount} delayed` : ""}`
            }
            action={
              hospitalOperations.overdueCount > 0 ? (
                <OpsStatusBadge label="Bottleneck" tone="rose" />
              ) : (
                <OpsStatusBadge label="Stable" tone="green" />
              )
            }
            bodyClassName="!p-0"
          >
            {hospitalOperations.waitingQueue.length === 0 ? (
              <OpsEmpty title="No queue bottlenecks" />
            ) : (
              <div className="admin-ov-ops-list">
                {hospitalOperations.waitingQueue.map((q, i) => (
                  <OpsRow
                    key={q.id}
                    primary={`${i + 1}. ${q.patientName}`}
                    secondary={`Dr. ${q.doctorName}${q.appointmentTime ? ` · ${q.appointmentTime}` : ""}`}
                    meta={q.waitMins > 0 ? `${q.waitMins}m` : "On time"}
                    badge={
                      <OpsStatusBadge
                        label={q.urgent ? "Past due" : q.overdue ? "Delayed" : "Waiting"}
                        tone={q.urgent ? "rose" : q.overdue ? "amber" : "cyan"}
                      />
                    }
                    highlight={q.urgent ? "rose" : q.overdue ? "amber" : "none"}
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="col-span-12 sm:col-span-6 lg:col-span-4">
          <Panel
            title="Critical Patients"
            subtitle={
              doctorPatientInsights.criticalAlerts.length === 0
                ? "No critical alerts"
                : `${doctorPatientInsights.criticalAlerts.length} needing attention`
            }
            action={
              doctorPatientInsights.criticalAlerts.length > 0 ? (
                <OpsStatusBadge label="Critical" tone="rose" />
              ) : (
                <OpsStatusBadge label="Clear" tone="green" />
              )
            }
            bodyClassName="!p-0"
          >
            {doctorPatientInsights.criticalAlerts.length === 0 ? (
              <OpsEmpty title="No critical patients right now" />
            ) : (
              <div className="admin-ov-ops-list">
                {doctorPatientInsights.criticalAlerts.map((c) => (
                  <OpsRow
                    key={c.id}
                    primary={c.patientName}
                    secondary={`Dr. ${c.doctorName} · ${c.reason}`}
                    meta={c.time}
                    badge={<OpsStatusBadge label="Critical" tone="rose" />}
                    highlight="rose"
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="col-span-12 sm:col-span-6 lg:col-span-4">
          <Panel
            title="Overloaded Doctors"
            subtitle={
              doctorPatientInsights.overloadedDoctors.length === 0
                ? "Workload balanced"
                : `${doctorPatientInsights.overloadedDoctors.length} above capacity`
            }
            action={
              <button type="button" className="admin-ov-link" onClick={() => setActiveTab("doctors")}>
                Doctors →
              </button>
            }
            bodyClassName="!p-0"
          >
            {doctorPatientInsights.overloadedDoctors.length === 0 ? (
              <OpsEmpty title="No overloaded doctors" />
            ) : (
              <div className="admin-ov-ops-list">
                {doctorPatientInsights.overloadedDoctors.map((d) => (
                  <div key={d.doctorId} className="admin-ov-ops-row admin-ov-ops-row--rose">
                    <div className="min-w-0 flex-1">
                      <p className="admin-ov-ops-primary">{d.doctorName}</p>
                      <p className="admin-ov-ops-secondary">
                        {d.specialization} · {d.total} visits · {d.waiting} waiting
                      </p>
                      <div className="admin-ov-res-progress mt-1.5">
                        <div className="admin-ov-res-progress-track">
                          <div
                            className="admin-ov-res-progress-fill"
                            style={{ width: `${d.loadPct}%`, background: "#e11d48" }}
                          />
                        </div>
                        <span className="admin-ov-res-progress-pct">{d.loadPct}%</span>
                      </div>
                    </div>
                    <OpsStatusBadge label="Overloaded" tone="rose" />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* 4. Resources + Financial */}
      <div className="admin-ov-grid">
        <SectionLabel>Capacity & revenue</SectionLabel>

        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <ResourceCard
            label="Total Beds"
            value={hospitalResources.totalBeds}
            icon={Building2}
            tone="slate"
            sublabel={hospitalResources.hasRoomInventory ? "Configured inventory" : "From admissions"}
            badge={hospitalResources.hasRoomInventory ? { label: "Inventory", tone: "slate" } : { label: "Estimated", tone: "amber" }}
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <ResourceCard
            label="Occupied Beds"
            value={hospitalResources.occupiedBeds}
            icon={BedDouble}
            tone={hospitalResources.bedPct >= 85 ? "rose" : "violet"}
            sublabel={`${Math.round(hospitalResources.bedPct)}% occupancy`}
            progress={hospitalResources.bedPct}
            badge={
              hospitalResources.bedPct >= 85
                ? { label: "High", tone: "rose" }
                : { label: "Stable", tone: "green" }
            }
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <ResourceCard
            label="Available Rooms"
            value={hospitalResources.availableRooms == null ? "—" : hospitalResources.availableRooms}
            icon={DoorOpen}
            tone="teal"
            sublabel={
              hospitalResources.hasRoomInventory
                ? "Ready for assignment"
                : "Configure rooms to track availability"
            }
            progress={
              hospitalResources.hasRoomInventory && hospitalResources.totalBeds > 0
                ? ((hospitalResources.availableRooms || 0) / Math.max(hospitalResources.totalBeds, 1)) * 100
                : null
            }
            badge={
              !hospitalResources.hasRoomInventory
                ? { label: "N/A", tone: "slate" }
                : (hospitalResources.availableRooms || 0) > 0
                  ? { label: "Open", tone: "green" }
                  : { label: "Full", tone: "rose" }
            }
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <ResourceCard
            label="ICU Occupancy"
            value={hospitalResources.icuTotal > 0 ? `${hospitalResources.icuOccupied}/${hospitalResources.icuTotal}` : "—"}
            icon={HeartPulse}
            tone={hospitalResources.icuPct >= 80 ? "rose" : "cyan"}
            sublabel={hospitalResources.icuTotal > 0 ? `${Math.round(hospitalResources.icuPct)}% critical care` : "No ICU configured"}
            progress={hospitalResources.icuTotal > 0 ? hospitalResources.icuPct : 0}
            badge={
              hospitalResources.icuTotal === 0
                ? { label: "N/A", tone: "slate" }
                : hospitalResources.icuPct >= 80
                  ? { label: "Critical", tone: "rose" }
                  : { label: "Managed", tone: "cyan" }
            }
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <FinanceMetricCard
            label="Revenue Today"
            value={
              displayStats.todayRevenue > 0 || filteredAppointments.length > 0
                ? formatCompactInr(displayStats.todayRevenue)
                : "—"
            }
            icon={IndianRupee}
            tone="teal"
            hint={
              displayStats.todayRevenue > 0
                ? "Collected today"
                : filteredAppointments.length === 0
                  ? "No appointment data loaded"
                  : "No paid visits attributed to today"
            }
          />
        </div>
        <div className="col-span-6 sm:col-span-4 lg:col-span-2">
          <FinanceMetricCard
            label="Pending Bills"
            value={String(financialOverview.pendingBillsCount)}
            icon={Receipt}
            tone="amber"
            hint={
              financialOverview.pendingBillAmount > 0
                ? `${formatCompactInr(financialOverview.pendingBillAmount)} outstanding`
                : "All settled"
            }
          />
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Panel title="Revenue Trends" subtitle="Collection pattern" action={trendSelect}>
            <div className="admin-ov-fin-chart">
              {financialOverview.trendSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={financialOverview.trendSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v) => formatCompactInr(Number(v)).replace("₹", "")}
                    />
                    <Tooltip content={<FinanceTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0d9488"
                      strokeWidth={2.5}
                      fill="url(#adminRevenueFill)"
                      dot={{ r: 3, fill: "#0d9488", strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyBlock title="No revenue trend data" description="Trends appear after completed paid visits." />
              )}
            </div>
          </Panel>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Panel title="Period Snapshot" subtitle="Today · Week · Month">
            <div className="admin-ov-fin-chart admin-ov-fin-chart--sm">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialOverview.periodBars} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<FinanceTooltip />} />
                  <Bar dataKey="revenue" fill="#0891b2" radius={[6, 6, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="admin-ov-fin-period-list">
              {financialOverview.periodBars.map((row) => (
                <div key={row.name} className="admin-ov-fin-period-row">
                  <span>{row.name}</span>
                  <strong>₹{row.revenue.toLocaleString("en-IN")}</strong>
                </div>
              ))}
              <div className="admin-ov-fin-period-row">
                <span>Refunds pending</span>
                <strong>{financialOverview.refundCount}</strong>
              </div>
            </div>
          </Panel>
        </div>

        {financialOverview.refundCount > 0 && (
          <div className="col-span-12">
            <Panel
              title="Refund Requests"
              subtitle={`${financialOverview.refundCount} awaiting approval · ${formatCompactInr(financialOverview.refundAmount)}`}
              action={
                <button type="button" className="admin-ov-link" onClick={() => setActiveTab("billing")}>
                  Billing →
                </button>
              }
              bodyClassName="!p-0"
            >
              <div className="admin-ov-ops-list">
                {pendingRefunds.slice(0, 5).map((r) => (
                  <div key={r.id} className="admin-ov-ops-row">
                    <div className="min-w-0 flex-1">
                      <p className="admin-ov-ops-primary">{r.patientName || r.patientId}</p>
                      <p className="admin-ov-ops-secondary">
                        Dr. {r.doctorName || r.doctorId}
                        {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString("en-IN")}` : ""}
                      </p>
                    </div>
                    <div className="admin-ov-ops-meta shrink-0">
                      <span className="admin-ov-ops-meta-text">₹{Number(r.paymentAmount || 0).toLocaleString("en-IN")}</span>
                      <button
                        type="button"
                        onClick={() => onApproveRefund(r)}
                        disabled={processingRefundId === r.id}
                        className="admin-ov-approve"
                      >
                        {processingRefundId === r.id ? "Approving…" : "Approve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </div>

      {/* 5. Live activity */}
      <div className="admin-ov-grid">
        <SectionLabel>Live activity</SectionLabel>
        <div className="col-span-12 xl:col-span-8">
          <Panel
            title="Hospital Activity Timeline"
            subtitle={hospitalActivity.length > 0 ? `${hospitalActivity.length} recent events` : "Operational event stream"}
            action={<OpsStatusBadge label="Live" tone="green" />}
            bodyClassName="!p-0"
          >
            {hospitalActivity.length === 0 ? (
              <OpsEmpty title="No recent hospital activity yet" />
            ) : (
              <div className="admin-ov-timeline" role="list">
                {hospitalActivity.slice(0, 18).map((event, index) => {
                  const meta = ACTIVITY_META[event.kind]
                  const Icon = meta.Icon
                  const chipTone =
                    meta.tone === "emerald"
                      ? "green"
                      : meta.tone === "violet"
                        ? "violet"
                        : meta.tone === "sky"
                          ? "cyan"
                          : meta.tone === "rose"
                            ? "rose"
                            : meta.tone === "amber"
                              ? "amber"
                              : meta.tone === "teal"
                                ? "teal"
                                : meta.tone === "slate"
                                  ? "slate"
                                  : "cyan"
                  return (
                    <div key={event.id} className="admin-ov-timeline-item" role="listitem">
                      <div className="admin-ov-timeline-rail" aria-hidden>
                        <span className={`admin-ov-timeline-dot admin-ov-timeline-dot--${meta.tone}`}>
                          <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                        </span>
                        {index < Math.min(hospitalActivity.length, 18) - 1 ? <span className="admin-ov-timeline-line" /> : null}
                      </div>
                      <div className="admin-ov-timeline-body">
                        <div className="admin-ov-timeline-head">
                          <p className="admin-ov-timeline-title">{event.title}</p>
                          <time className="admin-ov-timeline-time" dateTime={event.timestamp}>
                            {formatRelativeTime(event.timestamp)}
                          </time>
                        </div>
                        <p className="admin-ov-timeline-detail">{event.detail}</p>
                        <span className={`admin-ov-chip admin-ov-chip--${chipTone}`}>{meta.label}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="col-span-12 xl:col-span-4">
          <Panel
            title="Today's Schedule Pulse"
            subtitle={`${hospitalOperations.timeline.length} appointments on timeline`}
            action={
              <button type="button" className="admin-ov-link" onClick={() => setActiveTab("appointments")}>
                Appointments →
              </button>
            }
            bodyClassName="!p-0"
          >
            {hospitalOperations.timeline.length === 0 ? (
              <OpsEmpty title="No appointments scheduled today" />
            ) : (
              <div className="admin-ov-ops-list">
                {hospitalOperations.timeline.slice(0, 8).map((row) => {
                  const timingTone =
                    row.timing === "overdue"
                      ? "rose"
                      : row.timing === "now"
                        ? "cyan"
                        : row.timing === "done"
                          ? "green"
                          : row.timing === "missed"
                            ? "slate"
                            : "amber"
                  const timingLabel =
                    row.timing === "overdue"
                      ? "Overdue"
                      : row.timing === "now"
                        ? "Now"
                        : row.timing === "done"
                          ? "Done"
                          : row.timing === "missed"
                            ? "Missed"
                            : "Upcoming"
                  return (
                    <OpsRow
                      key={row.id}
                      primary={row.patientName}
                      secondary={`Dr. ${row.doctorName}`}
                      meta={row.time}
                      badge={<OpsStatusBadge label={timingLabel} tone={timingTone} />}
                      highlight={row.timing === "overdue" ? "rose" : row.timing === "now" ? "amber" : "none"}
                    />
                  )
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
