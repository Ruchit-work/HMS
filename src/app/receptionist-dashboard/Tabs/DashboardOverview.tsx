'use client'

import { useEffect, useState, useMemo } from 'react'
import { query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { getHospitalCollection } from '@/utils/firebase/hospital-queries'
import {
  CalendarDays, Users, MessageCircle, ReceiptText, CheckCircle2, Stethoscope,
  BedDouble, Clock, AlertTriangle, CalendarPlus, UserPlus, ChevronRight,
  TrendingUp, TrendingDown, Minus, ArrowRight, Bell,
  type LucideIcon,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  todayAppointments: number
  walkInPatients: number
  pendingWhatsAppBookings: number
  pendingBilling: number
  completedVisits: number
  doctorsAvailableToday: number
}

interface IpdStats {
  activeAdmissions: number
  pendingAdmissionRequests: number
  doctorRequestedDischarge: number
  dischargesToday: number
}

interface AppointmentRow {
  id: string
  appointmentTime: string
  patientName: string
  doctorName: string
  status: string
}

interface DoctorRow {
  id: string
  name: string
  status: 'available' | 'in_consultation' | 'not_available'
}

interface QueuePatient {
  id: string
  patientName: string
  doctorName: string
  appointmentTime: string
  minutesPastScheduled: number
}

interface IpdPatientRow {
  id: string
  patientName: string
  doctorName: string
  roomLabel: string
  checkInAt?: string
}

interface PendingPaymentRow {
  id: string
  patientName: string
  doctorName: string
  appointmentDate: string
  appointmentTime: string
  remainingAmount: number
}

interface RecentActivity {
  id: string
  type: 'appointment' | 'whatsapp_booking' | 'billing' | 'completion' | 'patient_added'
  message: string
  timestamp: string
  priority: 'high' | 'medium' | 'low'
}

interface DashboardOverviewProps {
  onTabChange?: (tab: 'patients' | 'doctors' | 'appointments' | 'book-appointment' | 'admit-requests' | 'billing' | 'whatsapp-bookings') => void
  receptionistBranchId?: string | null
  userName?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** How many minutes past the scheduled appointmentTime (HH:MM) it is right now */
function minutesPastScheduled(appointmentTime: string): number {
  if (!appointmentTime) return 0
  const [h, m] = appointmentTime.split(':').map(Number)
  const now = new Date()
  const scheduled = new Date()
  scheduled.setHours(h, m, 0, 0)
  return Math.round((now.getTime() - scheduled.getTime()) / 60_000)
}

/**
 * Returns the operational status of an appointment slot:
 * 'done' | 'missed' | 'now' (±10 min) | 'overdue' (>10 min late, not seen)
 * | 'upcoming'
 */
function apptTimingStatus(
  appointmentTime: string,
  status: string
): 'done' | 'missed' | 'now' | 'overdue' | 'upcoming' {
  if (status === 'completed') return 'done'
  if (status === 'cancelled' || status === 'not_attended') return 'missed'
  const mins = minutesPastScheduled(appointmentTime)
  if (mins < -10) return 'upcoming'
  if (mins <= 10) return 'now'
  return 'overdue'
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

function trendIcon(pct: number) {
  if (pct > 3) return <TrendingUp className="w-3 h-3" />
  if (pct < -3) return <TrendingDown className="w-3 h-3" />
  return <Minus className="w-3 h-3" />
}

function trendColor(pct: number): string {
  if (pct > 3) return 'text-emerald-600'
  if (pct < -3) return 'text-rose-500'
  return 'text-slate-400'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    confirmed:        ['rx-badge rx-badge--confirmed', 'Waiting'],
    waiting:          ['rx-badge rx-badge--waiting', 'Waiting'],
    completed:        ['rx-badge rx-badge--completed', 'Done'],
    cancelled:        ['rx-badge rx-badge--cancelled', 'Cancelled'],
    not_attended:     ['rx-badge rx-badge--not_attended', 'No-show'],
    whatsapp_pending: ['rx-badge rx-badge--whatsapp_pending', 'WhatsApp'],
  }
  const [cls, label] = map[status] ?? ['rx-badge rx-badge--cancelled', status]
  return <span className={cls}>{label}</span>
}

function TimingBadge({ timing }: { timing: ReturnType<typeof apptTimingStatus> }) {
  const map: Record<string, [string, string]> = {
    done:     ['rx-badge rx-badge--completed', 'Done'],
    missed:   ['rx-badge rx-badge--missed', 'Missed'],
    now:      ['rx-badge rx-badge--now', 'Now'],
    overdue:  ['rx-badge rx-badge--overdue', 'Overdue'],
    upcoming: ['rx-badge rx-badge--upcoming', 'Upcoming'],
  }
  const [cls, label] = map[timing]
  return <span className={cls}>{label}</span>
}

interface MetricCardProps {
  icon: LucideIcon
  iconBg: string
  iconCl: string
  value: number | string
  label: string
  subInfo?: string
  subInfoVariant?: 'normal' | 'urgent' | 'good'
  trend?: number          // % vs yesterday (optional)
  urgent?: boolean
  onClick: () => void
}

function MetricCard({
  icon: Icon, iconBg, iconCl, value, label, subInfo,
  subInfoVariant = 'normal', trend, urgent, onClick,
}: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rx-metric-card text-left group ${urgent ? 'rx-metric-card--warning' : ''}`}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconCl}`} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor(trend)}`}>
            {trendIcon(trend)}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[1.625rem] font-bold text-slate-900 tabular-nums leading-none">{value}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5 leading-snug">{label}</p>
      {subInfo && (
        <p className={`rx-metric-subtext ${
          subInfoVariant === 'urgent' ? 'rx-metric-subtext--urgent' :
          subInfoVariant === 'good'   ? 'rx-metric-subtext--good' : ''
        }`}>
          {subInfo}
        </p>
      )}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardOverview({
  onTabChange,
  receptionistBranchId,
  userName = 'there',
}: DashboardOverviewProps) {
  const { activeHospitalId } = useMultiHospital()

  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0, walkInPatients: 0, pendingWhatsAppBookings: 0,
    pendingBilling: 0, completedVisits: 0, doctorsAvailableToday: 0,
  })
  const [ipdStats, setIpdStats] = useState<IpdStats>({
    activeAdmissions: 0, pendingAdmissionRequests: 0,
    doctorRequestedDischarge: 0, dischargesToday: 0,
  })
  const [todayAppointments, setTodayAppointments] = useState<AppointmentRow[]>([])
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [queuePatients, setQueuePatients] = useState<QueuePatient[]>([])
  const [ipdPatients, setIpdPatients] = useState<IpdPatientRow[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentRow[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [yesterdayCount, setYesterdayCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  const todayLong = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // ── Derived: appointment trend vs yesterday ──────────────────────────────
  const appointmentTrend = useMemo(() => {
    if (yesterdayCount === null || yesterdayCount === 0) return undefined
    return Math.round(((stats.todayAppointments - yesterdayCount) / yesterdayCount) * 100)
  }, [stats.todayAppointments, yesterdayCount])

  // ── Derived: longest queue wait ──────────────────────────────────────────
  const longestWait = useMemo(() => {
    if (queuePatients.length === 0) return 0
    return Math.max(...queuePatients.map((q) => q.minutesPastScheduled))
  }, [queuePatients])

  // ── Derived: hospital system alerts ─────────────────────────────────────
  const systemAlerts = useMemo(() => {
    const alerts: { id: string; message: string; action: string; tab: Parameters<NonNullable<typeof onTabChange>>[0] }[] = []
    if (ipdStats.doctorRequestedDischarge > 0)
      alerts.push({ id: 'discharge', message: `${ipdStats.doctorRequestedDischarge} patient${ipdStats.doctorRequestedDischarge > 1 ? 's' : ''} ready for discharge — billing required`, action: 'Process discharge', tab: 'admit-requests' })
    if (queuePatients.length >= 8)
      alerts.push({ id: 'queue', message: `High queue: ${queuePatients.length} patients waiting — longest wait ${longestWait}m`, action: 'View queue', tab: 'appointments' })
    if (stats.pendingWhatsAppBookings >= 3)
      alerts.push({ id: 'whatsapp', message: `${stats.pendingWhatsAppBookings} WhatsApp bookings awaiting doctor assignment`, action: 'Assign now', tab: 'whatsapp-bookings' })
    if (ipdStats.pendingAdmissionRequests >= 2)
      alerts.push({ id: 'ipd', message: `${ipdStats.pendingAdmissionRequests} IPD admission requests need your review`, action: 'Review', tab: 'admit-requests' })
    return alerts
  }, [ipdStats, queuePatients, longestWait, stats.pendingWhatsAppBookings])

  // ── Data fetching ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeHospitalId) return

    const appointmentsRef = getHospitalCollection(activeHospitalId, 'appointments')
    const doctorsRef      = getHospitalCollection(activeHospitalId, 'doctors')
    const admissionsRef   = getHospitalCollection(activeHospitalId, 'admissions')
    const admissionReqRef = getHospitalCollection(activeHospitalId, 'admission_requests')

    // Yesterday count (one-time fetch for trend)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    getDocs(query(appointmentsRef, where('appointmentDate', '==', yesterdayStr)))
      .then((snap) => setYesterdayCount(snap.size))
      .catch(() => setYesterdayCount(null))

    // Appointments real-time
    const unsubAppointments = onSnapshot(appointmentsRef, (snapshot) => {
      const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
      const filtered = receptionistBranchId
        ? all.filter((a) => a.branchId === receptionistBranchId)
        : all

      const today = filtered.filter(
        (a) => a.appointmentDate === todayStr && a.status !== 'whatsapp_pending' && !a.whatsappPending
      )
      const whatsappPending = filtered.filter((a) => a.whatsappPending === true || a.status === 'whatsapp_pending')
      const pendingBillingList = filtered.filter((a) => {
        const unpaid = (a.paymentStatus === 'unpaid' || a.paymentStatus === 'pending') && !a.paidAt
        const remaining = ((a.remainingAmount as number) || 0) > 0
        return (unpaid || remaining) && (a.status === 'confirmed' || a.status === 'completed')
      })
      const completedToday = today.filter((a) => a.status === 'completed')
      const uniquePatients = new Set(today.map((a) => a.patientId || a.patientUid))

      setStats((prev) => ({
        ...prev,
        todayAppointments: today.length,
        walkInPatients: uniquePatients.size,
        pendingWhatsAppBookings: whatsappPending.length,
        pendingBilling: pendingBillingList.length,
        completedVisits: completedToday.length,
      }))

      // Today's schedule (sorted by time)
      const timeline: AppointmentRow[] = today
        .map((a) => ({
          id: a.id,
          appointmentTime: (a.appointmentTime as string) || '—',
          patientName: (a.patientName as string) || '—',
          doctorName: (a.doctorName as string) || '—',
          status: (a.status as string) || 'confirmed',
        }))
        .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime))
      setTodayAppointments(timeline)

      // Waiting queue (confirmed today, sorted: most overdue first)
      const waiting = today.filter((a) => a.status === 'confirmed')
      const queue: QueuePatient[] = waiting
        .map((a) => ({
          id: a.id,
          patientName: (a.patientName as string) || '—',
          doctorName: (a.doctorName as string) || '—',
          appointmentTime: (a.appointmentTime as string) || '',
          minutesPastScheduled: minutesPastScheduled((a.appointmentTime as string) || ''),
        }))
        .sort((a, b) => b.minutesPastScheduled - a.minutesPastScheduled)
      setQueuePatients(queue)

      // Pending payments list (sorted by amount desc)
      const paymentList: PendingPaymentRow[] = pendingBillingList
        .map((a) => ({
          id: a.id,
          patientName: (a.patientName as string) || '—',
          doctorName: (a.doctorName as string) || '—',
          appointmentDate: (a.appointmentDate as string) || '',
          appointmentTime: (a.appointmentTime as string) || '',
          remainingAmount: (a.remainingAmount as number) || 0,
        }))
        .sort((a, b) => b.remainingAmount - a.remainingAmount)
        .slice(0, 8)
      setPendingPayments(paymentList)

      // Recent activity feed
      const activities: RecentActivity[] = all
        .sort((x, y) =>
          new Date((y.createdAt as string) || 0).getTime() -
          new Date((x.createdAt as string) || 0).getTime()
        )
        .slice(0, 12)
        .map((a) => {
          const ts = new Date((a.createdAt as string) || Date.now())
          if (a.whatsappPending || a.status === 'whatsapp_pending')
            return { id: a.id, type: 'whatsapp_booking' as const, message: `WhatsApp booking — ${(a.patientName as string) || 'Unknown'}`, timestamp: ts.toISOString(), priority: 'high' as const }
          if (a.status === 'completed')
            return { id: a.id, type: 'completion' as const, message: `Visit completed — ${a.patientName}`, timestamp: ts.toISOString(), priority: 'low' as const }
          if (((a.remainingAmount as number) || 0) > 0)
            return { id: a.id, type: 'billing' as const, message: `Payment pending ₹${a.remainingAmount} — ${a.patientName}`, timestamp: ts.toISOString(), priority: 'medium' as const }
          return { id: a.id, type: 'appointment' as const, message: `Appointment booked — ${a.patientName}`, timestamp: ts.toISOString(), priority: 'low' as const }
        })
      setRecentActivity(activities.slice(0, 8))
    })

    // Admissions real-time
    const unsubAdmissions = onSnapshot(admissionsRef, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
      const filtered = receptionistBranchId ? rows.filter((r) => r.branchId === receptionistBranchId) : rows
      const todayDate = new Date().toISOString().split('T')[0]
      const activeRows = filtered.filter((r) => {
        const s = String(r.status || '').toLowerCase()
        return s !== 'discharged' && s !== 'cancelled'
      })
      const dischargeRequests = filtered.filter((r) => {
        const s = String(r.status || '').toLowerCase()
        return s === 'doctor_requested_discharge' || (r.dischargeRequest as Record<string, unknown>)?.status === 'requested'
      })
      const dischargesToday = filtered.filter((r) => {
        if (String(r.status || '').toLowerCase() !== 'discharged') return false
        const raw = r.checkedOutAt || r.dischargedAt || r.updatedAt
        return raw ? new Date(raw as string).toISOString().split('T')[0] === todayDate : false
      })
      setIpdStats((prev) => ({
        ...prev,
        activeAdmissions: activeRows.length,
        doctorRequestedDischarge: dischargeRequests.length,
        dischargesToday: dischargesToday.length,
      }))
      setIpdPatients(
        activeRows
          .sort((a, b) =>
            new Date((b.checkInAt as string) || 0).getTime() -
            new Date((a.checkInAt as string) || 0).getTime()
          )
          .slice(0, 6)
          .map((r) => ({
            id: r.id,
            patientName: (r.patientName as string) || 'Unknown',
            doctorName: (r.doctorName as string) || '—',
            roomLabel: r.roomNumber
              ? `Room ${r.roomNumber} · ${(r.roomType as string) || ''}`
              : (r.roomType as string) || 'Not assigned',
            checkInAt: r.checkInAt as string | undefined,
          }))
      )
    })

    // Admission requests real-time
    const unsubAdmissionReqs = onSnapshot(admissionReqRef, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
      const filtered = receptionistBranchId ? rows.filter((r) => r.branchId === receptionistBranchId) : rows
      const pending = filtered.filter((r) => String(r.status || '').toLowerCase() === 'pending')
      setIpdStats((prev) => ({ ...prev, pendingAdmissionRequests: pending.length }))
    })

    // Doctors (one-time, then mark loading done)
    getDocs(query(doctorsRef, where('status', '==', 'active')))
      .then((snap) => {
        setStats((prev) => ({ ...prev, doctorsAvailableToday: snap.size }))
        setDoctors(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>
            return {
              id: d.id,
              name: [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Doctor',
              status: 'available' as const,
            }
          })
        )
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => {
      unsubAppointments()
      unsubAdmissions()
      unsubAdmissionReqs()
    }
  }, [activeHospitalId, receptionistBranchId, todayStr])

  if (loading && todayAppointments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent" />
      </div>
    )
  }

  const waitingCount = queuePatients.length
  const overdueCount = queuePatients.filter((q) => q.minutesPastScheduled > 15).length

  // Quick actions — workflow-ordered by urgency
  const quickActions = [
    {
      icon: CalendarPlus, label: 'Book Appointment', description: 'Schedule a new visit',
      iconBg: 'bg-cyan-50', iconCl: 'text-cyan-600',
      badge: 0, urgent: false, tab: 'book-appointment' as const,
    },
    {
      icon: UserPlus, label: 'Register Patient', description: 'Create new patient record',
      iconBg: 'bg-emerald-50', iconCl: 'text-emerald-600',
      badge: 0, urgent: false, tab: 'patients' as const,
    },
    {
      icon: MessageCircle,
      label: 'WhatsApp Queue',
      description: stats.pendingWhatsAppBookings > 0
        ? `${stats.pendingWhatsAppBookings} booking${stats.pendingWhatsAppBookings > 1 ? 's' : ''} need doctor assignment`
        : 'All bookings assigned',
      iconBg: 'bg-amber-50', iconCl: 'text-amber-600',
      badge: stats.pendingWhatsAppBookings, urgent: stats.pendingWhatsAppBookings > 0,
      tab: 'whatsapp-bookings' as const,
    },
    {
      icon: ReceiptText,
      label: 'Collect Payment',
      description: stats.pendingBilling > 0
        ? `${stats.pendingBilling} appointment${stats.pendingBilling > 1 ? 's' : ''} with pending bills`
        : 'All payments settled',
      iconBg: 'bg-rose-50', iconCl: 'text-rose-600',
      badge: stats.pendingBilling, urgent: stats.pendingBilling > 5,
      tab: 'billing' as const,
    },
    {
      icon: BedDouble,
      label: 'IPD Admissions',
      description: ipdStats.pendingAdmissionRequests > 0
        ? `${ipdStats.pendingAdmissionRequests} request${ipdStats.pendingAdmissionRequests > 1 ? 's' : ''} pending review`
        : `${ipdStats.activeAdmissions} patients admitted`,
      iconBg: 'bg-blue-50', iconCl: 'text-blue-600',
      badge: ipdStats.pendingAdmissionRequests, urgent: ipdStats.doctorRequestedDischarge > 0,
      tab: 'admit-requests' as const,
    },
    {
      icon: Users, label: 'Patient Records', description: 'Search & manage all patients',
      iconBg: 'bg-slate-100', iconCl: 'text-slate-600',
      badge: 0, urgent: false, tab: 'patients' as const,
    },
  ]

  // Sort quick actions: urgent first
  const sortedActions = [...quickActions].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))

  return (
    <div className="space-y-5">

      {/* ── 1. GREETING ──────────────────────────────────────────────────────── */}
      <div className="rx-greeting">
        <h2 className="rx-greeting-name">
          {getGreeting()}, {userName}
        </h2>
        <p className="rx-greeting-context">
          Reception Desk&ensp;·&ensp;{todayLong}
        </p>
      </div>

      {/* ── 2. TODAY'S OPERATIONS ────────────────────────────────────────────── */}
      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Today&rsquo;s Operations
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            icon={CalendarDays}
            iconBg="bg-cyan-50" iconCl="text-cyan-600"
            value={stats.todayAppointments}
            label="Appointments Today"
            trend={appointmentTrend}
            subInfo={
              stats.todayAppointments > 0
                ? `${waitingCount} waiting · ${stats.completedVisits} done`
                : 'No appointments yet'
            }
            onClick={() => onTabChange?.('appointments')}
          />
          <MetricCard
            icon={Clock}
            iconBg={waitingCount > 5 ? 'bg-rose-50' : 'bg-amber-50'}
            iconCl={waitingCount > 5 ? 'text-rose-600' : 'text-amber-600'}
            value={waitingCount}
            label="Waiting Now"
            urgent={waitingCount > 5}
            subInfo={
              waitingCount === 0
                ? 'No one waiting'
                : longestWait > 30
                ? `Longest wait: ${longestWait}m`
                : longestWait > 0
                ? `Max wait: ${longestWait}m`
                : 'Just arrived'
            }
            subInfoVariant={longestWait > 30 ? 'urgent' : 'normal'}
            onClick={() => onTabChange?.('appointments')}
          />
          <MetricCard
            icon={MessageCircle}
            iconBg="bg-amber-50" iconCl="text-amber-600"
            value={stats.pendingWhatsAppBookings}
            label="WhatsApp Queue"
            urgent={stats.pendingWhatsAppBookings > 0}
            subInfo={
              stats.pendingWhatsAppBookings > 0
                ? 'Need doctor assignment'
                : 'All assigned'
            }
            subInfoVariant={stats.pendingWhatsAppBookings > 0 ? 'urgent' : 'good'}
            onClick={() => onTabChange?.('whatsapp-bookings')}
          />
          <MetricCard
            icon={ReceiptText}
            iconBg="bg-rose-50" iconCl="text-rose-600"
            value={stats.pendingBilling}
            label="Pending Billing"
            urgent={stats.pendingBilling > 0}
            subInfo={
              stats.pendingBilling > 0
                ? 'Payments awaiting collection'
                : 'All settled'
            }
            subInfoVariant={stats.pendingBilling > 0 ? 'urgent' : 'good'}
            onClick={() => onTabChange?.('billing')}
          />
          <MetricCard
            icon={BedDouble}
            iconBg="bg-blue-50" iconCl="text-blue-600"
            value={ipdStats.activeAdmissions}
            label="IPD Active"
            urgent={ipdStats.doctorRequestedDischarge > 0}
            subInfo={
              ipdStats.doctorRequestedDischarge > 0
                ? `${ipdStats.doctorRequestedDischarge} discharge pending`
                : `${ipdStats.dischargesToday} discharged today`
            }
            subInfoVariant={ipdStats.doctorRequestedDischarge > 0 ? 'urgent' : 'normal'}
            onClick={() => onTabChange?.('admit-requests')}
          />
          <MetricCard
            icon={Stethoscope}
            iconBg="bg-slate-100" iconCl="text-slate-600"
            value={stats.doctorsAvailableToday}
            label="Doctors Active"
            subInfo={
              stats.doctorsAvailableToday > 0
                ? `${stats.doctorsAvailableToday} scheduled today`
                : 'None on schedule'
            }
            onClick={() => onTabChange?.('doctors')}
          />
        </div>
      </section>

      {/* ── 3 + 4. QUICK ACTIONS + WAITING QUEUE ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 3. Quick Actions */}
        <div className="rx-section-card">
          <div className="rx-section-header">
            <div>
              <p className="rx-section-title">Quick Actions</p>
              <p className="rx-section-subtitle">Frequent tasks</p>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {sortedActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onTabChange?.(action.tab)}
                className={`rx-action-item ${action.urgent ? 'rx-action-item--urgent' : ''}`}
              >
                <div className={`w-9 h-9 rounded-lg ${action.iconBg} flex items-center justify-center shrink-0`}>
                  <action.icon className={`w-4 h-4 ${action.iconCl}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${action.urgent ? 'text-amber-900' : 'text-slate-800'}`}>
                    {action.label}
                  </p>
                  <p className={`text-xs mt-0.5 leading-snug ${action.urgent ? 'text-amber-700' : 'text-slate-500'}`}>
                    {action.description}
                  </p>
                </div>
                {action.badge > 0 ? (
                  <span className={`shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center ${
                    action.urgent ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {action.badge > 99 ? '99+' : action.badge}
                  </span>
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Waiting Queue */}
        <div className="lg:col-span-2 rx-section-card">
          <div className="rx-section-header">
            <div>
              <p className="rx-section-title">Waiting Queue</p>
              <p className="rx-section-subtitle">
                {waitingCount === 0
                  ? 'No patients waiting'
                  : `${waitingCount} patient${waitingCount > 1 ? 's' : ''} waiting${overdueCount > 0 ? ` · ${overdueCount} past due` : ''}`}
              </p>
            </div>
            <span className={`rx-badge ${
              waitingCount === 0 ? 'rx-badge--completed' :
              overdueCount > 0 ? 'rx-badge--overdue' : 'rx-badge--confirmed'
            }`}>
              {waitingCount === 0 ? 'All clear' : `${waitingCount} waiting`}
            </span>
          </div>

          {waitingCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" />
              <p className="text-sm font-medium text-slate-500">No one in queue</p>
              <p className="text-xs mt-1">All patients have been attended to</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[360px] overflow-y-auto">
              {queuePatients.map((q, i) => {
                const isUrgent = q.minutesPastScheduled > 30
                const isWarning = q.minutesPastScheduled > 15 && !isUrgent
                return (
                  <div
                    key={q.id}
                    className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                      isUrgent ? 'rx-queue-row--rose' :
                      isWarning ? 'rx-queue-row--amber' : 'rx-queue-row--normal'
                    }`}
                  >
                    {/* Position number */}
                    <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                      isUrgent ? 'bg-rose-100 text-rose-700' :
                      isWarning ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {i + 1}
                    </span>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{q.patientName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Dr. {q.doctorName}
                        {q.appointmentTime ? ` · Scheduled ${q.appointmentTime}` : ''}
                      </p>
                    </div>

                    {/* Wait time */}
                    <div className="text-right shrink-0">
                      {q.minutesPastScheduled > 0 ? (
                        <>
                          <p className={`text-sm font-bold tabular-nums ${
                            isUrgent ? 'text-rose-600' :
                            isWarning ? 'text-amber-600' : 'text-slate-700'
                          }`}>
                            {q.minutesPastScheduled}m
                          </p>
                          <p className={`text-xs ${
                            isUrgent ? 'text-rose-500 font-medium' :
                            isWarning ? 'text-amber-500' : 'text-slate-400'
                          }`}>
                            {isUrgent ? 'Past due' : isWarning ? 'Delayed' : 'Overdue'}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400">On time</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 5 + 7. TODAY'S APPOINTMENTS + DOCTOR AVAILABILITY ────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* 5. Today's Appointments */}
        <div className="xl:col-span-2 rx-section-card">
          <div className="rx-section-header">
            <div>
              <p className="rx-section-title">Today&rsquo;s Appointments</p>
              <p className="rx-section-subtitle">
                {todayAppointments.length} scheduled · {stats.completedVisits} completed
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTabChange?.('appointments')}
              className="flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-800 transition-colors"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                <tr>
                  {['Time', 'Patient', 'Doctor', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {todayAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-sm">
                      No appointments scheduled today
                    </td>
                  </tr>
                ) : (
                  todayAppointments.map((row) => {
                    const timing = apptTimingStatus(row.appointmentTime, row.status)
                    const isNow = timing === 'now'
                    const isOverdue = timing === 'overdue'
                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isNow ? 'bg-cyan-50/60 hover:bg-cyan-50' :
                          isOverdue ? 'bg-rose-50/40 hover:bg-rose-50/60' :
                          'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900 whitespace-nowrap">
                          {row.appointmentTime}
                          {isNow && (
                            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse align-middle" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{row.patientName}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{row.doctorName}</td>
                        <td className="px-4 py-3">
                          {timing === 'done' || timing === 'missed'
                            ? <StatusBadge status={timing === 'done' ? 'completed' : 'not_attended'} />
                            : <TimingBadge timing={timing} />
                          }
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 7. Doctor Availability */}
        <div className="rx-section-card">
          <div className="rx-section-header">
            <div>
              <p className="rx-section-title">Doctor Availability</p>
              <p className="rx-section-subtitle">{stats.doctorsAvailableToday} doctors active today</p>
            </div>
          </div>

          <div className="p-3 space-y-1.5 max-h-[360px] overflow-y-auto">
            {doctors.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">No doctors loaded</div>
            ) : (
              doctors.map((doc) => (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    doc.status === 'available'
                      ? 'bg-emerald-50/40 border-emerald-100'
                      : doc.status === 'in_consultation'
                      ? 'bg-amber-50/40 border-amber-100'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    doc.status === 'available' ? 'bg-emerald-500' :
                    doc.status === 'in_consultation' ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <span className="flex-1 text-sm font-medium text-slate-800 truncate">{doc.name}</span>
                  <span className={`text-xs font-medium ${
                    doc.status === 'available' ? 'text-emerald-600' :
                    doc.status === 'in_consultation' ? 'text-amber-600' : 'text-slate-400'
                  }`}>
                    {doc.status === 'available' ? 'Available' :
                     doc.status === 'in_consultation' ? 'Busy' : 'Away'}
                  </span>
                </div>
              ))
            )}

            {/* IPD inpatients sub-section */}
            {ipdPatients.length > 0 && (
              <>
                <div className="pt-3 pb-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
                    Current Inpatients
                  </p>
                </div>
                {ipdPatients.map((p) => (
                  <div key={p.id} className="px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
                    <p className="text-sm font-semibold text-slate-900">{p.patientName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.doctorName} · {p.roomLabel}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 6 + 8. PENDING PAYMENTS + RECENT ACTIVITY ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 6. Pending Payments */}
        <div className="rx-section-card">
          <div className="rx-section-header">
            <div>
              <p className="rx-section-title">Pending Payments</p>
              <p className="rx-section-subtitle">
                {stats.pendingBilling === 0
                  ? 'All payments collected'
                  : `${stats.pendingBilling} appointment${stats.pendingBilling > 1 ? 's' : ''} with outstanding balance`}
              </p>
            </div>
            {stats.pendingBilling > 0 && (
              <button
                type="button"
                onClick={() => onTabChange?.('billing')}
                className="flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-800 transition-colors"
              >
                Collect all <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {stats.pendingBilling === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" />
              <p className="text-sm font-medium text-slate-500">All payments collected</p>
              <p className="text-xs mt-1">Nothing pending at the moment</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[280px] overflow-y-auto">
              {pendingPayments.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-400 text-center">Loading...</div>
              ) : (
                pendingPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{p.patientName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {p.doctorName}
                        {p.appointmentDate && ` · ${p.appointmentDate}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {p.remainingAmount > 0 ? (
                        <p className="text-sm font-bold text-rose-600 tabular-nums">
                          ₹{p.remainingAmount.toLocaleString('en-IN')}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 font-medium">Unpaid</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 8. Recent Activity */}
        <div className="rx-section-card">
          <div className="rx-section-header">
            <div>
              <p className="rx-section-title">Recent Activity</p>
              <p className="rx-section-subtitle">Latest system updates</p>
            </div>
            {recentActivity.filter((a) => a.priority === 'high').length > 0 && (
              <span className="rx-badge rx-badge--overdue">
                {recentActivity.filter((a) => a.priority === 'high').length} urgent
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-50 max-h-[280px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Bell className="w-7 h-7 mb-2 text-slate-300" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((act) => {
                const iconMap = {
                  whatsapp_booking: { bg: 'bg-amber-100', cl: 'text-amber-600', Icon: MessageCircle },
                  completion:       { bg: 'bg-emerald-100', cl: 'text-emerald-600', Icon: CheckCircle2 },
                  billing:          { bg: 'bg-rose-100', cl: 'text-rose-600', Icon: ReceiptText },
                  appointment:      { bg: 'bg-slate-100', cl: 'text-slate-500', Icon: CalendarDays },
                  patient_added:    { bg: 'bg-blue-100', cl: 'text-blue-600', Icon: UserPlus },
                }
                const { bg, cl, Icon } = iconMap[act.type] ?? iconMap.appointment
                return (
                  <div key={act.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors">
                    <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${cl}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 leading-snug">{act.message}</p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(act.timestamp)}
                      </p>
                    </div>
                    {act.priority === 'high' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-2.5" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ── 9. HOSPITAL ALERTS ───────────────────────────────────────────────── */}
      {systemAlerts.length > 0 && (
        <section className="rx-section-card border-amber-200">
          <div className="rx-section-header" style={{ background: '#fffbeb' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <p className="rx-section-title text-amber-900">Hospital Alerts</p>
                <p className="rx-section-subtitle text-amber-700/80">
                  {systemAlerts.length} item{systemAlerts.length > 1 ? 's' : ''} requiring attention
                </p>
              </div>
            </div>
            <span className="rx-nav-badge rx-nav-badge--amber">{systemAlerts.length}</span>
          </div>
          <div className="p-4 space-y-2.5">
            {systemAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50 border border-amber-100"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="flex-1 text-sm text-amber-900 leading-snug">{alert.message}</p>
                <button
                  type="button"
                  onClick={() => onTabChange?.(alert.tab)}
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap transition-colors"
                >
                  {alert.action} <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
