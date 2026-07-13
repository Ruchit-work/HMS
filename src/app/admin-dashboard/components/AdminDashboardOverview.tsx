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
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/firebase/config"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
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
import NotificationBadge from "@/components/ui/feedback/NotificationBadge"

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
  selectedBranchId: string
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
  selectedBranchId: _selectedBranchId,
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
  const [roomsInventory, setRoomsInventory] = useState<Room[]>([])
  const [activeAdmissionsCount, setActiveAdmissionsCount] = useState(0)

  // Read-only rooms inventory for resource widgets (no seed / no mutations).
  useEffect(() => {
    let cancelled = false
    getDocs(collection(db, "rooms"))
      .then((snap) => {
        if (cancelled) return
        const rooms = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() as Omit<Room, "id"> & Partial<Room> & { isArchived?: boolean; hospitalId?: string }
            return { ...data, id: docSnap.id } as Room & { isArchived?: boolean; hospitalId?: string }
          })
          .filter((room) => {
            if ((room as Room & { isArchived?: boolean }).isArchived) return false
            const roomHospital = (room as Room & { hospitalId?: string }).hospitalId
            // Include global rooms (no hospitalId) and rooms tagged to this hospital
            if (!activeHospitalId || !roomHospital) return true
            return roomHospital === activeHospitalId
          })
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
      setActiveAdmissionsCount(0)
      return
    }
    let cancelled = false
    getDocs(getHospitalCollection(activeHospitalId, "admissions"))
      .then((snap) => {
        if (cancelled) return
        const active = snap.docs.filter((d) => {
          const status = String(d.data()?.status || "").toLowerCase()
          return status === "admitted" || status === "scheduled"
        }).length
        setActiveAdmissionsCount(active)
        if (process.env.NODE_ENV === "development") {
          console.info("[admin-dashboard] admissions", {
            hospitalId: activeHospitalId,
            total: snap.size,
            active,
          })
        }
      })
      .catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[admin-dashboard] admissions query failed", err)
        }
        if (!cancelled) setActiveAdmissionsCount(0)
      })
    return () => {
      cancelled = true
    }
  }, [activeHospitalId])

  const branchPerformance = useMemo(() => {
    if (branches.length === 0) return []
    return branches.map((branch) => {
      const apts = filteredAppointments.filter((a) => (a as Appointment & { branchId?: string }).branchId === branch.id)
      const revenue = apts
        .filter((a) => isPaidAppointment(a))
        .reduce((s, a) => s + getPaidAmount(a), 0)
      return { branchId: branch.id, branchName: branch.name, visits: apts.length, revenue }
    })
  }, [branches, filteredAppointments])

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

    const hasRoomInventory = roomsInventory.length > 0
    const totalBeds = hasRoomInventory ? roomsInventory.length : occupiedFromAdmissions
    const occupiedBeds = hasRoomInventory
      ? roomsInventory.filter((r) => r.status === "occupied").length
      : occupiedFromAdmissions
    const availableRooms = hasRoomInventory
      ? roomsInventory.filter((r) => r.status === "available").length
      : null
    const maintenanceRooms = roomsInventory.filter((r) => r.status === "maintenance").length

    const icuRooms = roomsInventory.filter(isIcuRoom)
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
  }, [filteredAppointments, roomsInventory, activeAdmissionsCount])

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

      {/* 6. Branches (only when relevant) */}
      {branches.length > 0 && (
        <div className="admin-ov-grid">
          <SectionLabel>Branch performance</SectionLabel>
          <div className="col-span-12">
            <Panel title="Branches" subtitle="Visits and revenue by location">
              {branchPerformance.length === 0 ? (
                <EmptyBlock title="No branch activity" description="Metrics appear once appointments are booked." />
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="admin-ov-table">
                    <thead>
                      <tr>
                        <th>Branch</th>
                        <th className="text-right">Visits</th>
                        <th className="text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchPerformance.map((b) => (
                        <tr key={b.branchId}>
                          <td className="font-medium text-slate-900">{b.branchName}</td>
                          <td className="text-right tabular-nums">{b.visits}</td>
                          <td className="text-right tabular-nums font-medium text-slate-900">₹{b.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
