"use client"

import Link from "next/link"
import { Button } from '@/shared/components'
import ClinicalStatusBadge from "@/features/doctor/clinical/ClinicalStatusBadge"
import ClinicalEmptyState from "@/features/doctor/clinical/ClinicalEmptyState"
import PatientAvatar from "@/features/doctor/clinical/PatientAvatar"
import type { Appointment, Admission } from "@/types/patient"
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Stethoscope,
  User,
} from "lucide-react"

function formatTime12(time?: string | null): string {
  if (!time || typeof time !== "string") return "--:--"

  const trimmed = time.trim()
  if (!trimmed) return "--:--"

  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampmMatch) {
    const [, hStr, mStr, suffix] = ampmMatch
    return `${Number(hStr)}:${mStr} ${suffix.toUpperCase()}`
  }

  const parts = trimmed.split(":")
  if (parts.length < 2) {
    return trimmed
  }

  const hours = Number(parts[0])
  const minutes = Number(parts[1].replace(/[^0-9]/g, ""))

  if (isNaN(hours) || isNaN(minutes)) {
    return trimmed
  }

  const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  const suffix = hours >= 12 ? "PM" : "AM"
  const m = minutes.toString().padStart(2, "0")

  return `${h}:${m} ${suffix}`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function formatIpdNo(ipdNo?: string | null): string {
  if (!ipdNo) return "IPD: N/A"
  const trimmed = ipdNo.trim()
  if (trimmed.toUpperCase().startsWith("IPD")) {
    return trimmed
  }
  return `IPD-${trimmed}`
}

export function formatDaysAdmitted(checkInAt?: string | null): string {
  if (!checkInAt) return "Admission date N/A"
  const checkInDate = new Date(checkInAt)
  if (isNaN(checkInDate.getTime())) return "Admission date N/A"

  const now = new Date()
  const checkInMidnight = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate())
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffTime = nowMidnight.getTime() - checkInMidnight.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return "Admitted today"
  if (diffDays === 1) return "Admitted 1 day ago"
  return `Admitted ${diffDays} days ago`
}

export function getInpatientRoundInfo(admission: Admission) {
  const rounds = Array.isArray(admission.doctorRounds) ? admission.doctorRounds : []
  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null

  let isRoundDoneToday = false
  let lastRoundText = "No rounds yet"

  if (lastRound && lastRound.roundAt) {
    const roundDate = new Date(lastRound.roundAt)
    if (!isNaN(roundDate.getTime())) {
      const todayStr = new Date().toDateString()
      if (roundDate.toDateString() === todayStr) {
        isRoundDoneToday = true
        lastRoundText = `Today at ${roundDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      } else {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        if (roundDate.toDateString() === yesterday.toDateString()) {
          lastRoundText = "Yesterday"
        } else {
          lastRoundText = roundDate.toLocaleDateString([], { month: "short", day: "numeric" })
        }
      }
    }
  }

  return {
    isRoundDoneToday,
    lastRoundText,
    lastRound,
    roundCount: rounds.length,
  }
}

interface MorningGreetingProps {
  doctorName: string
  specialization: string
  waitingCount: number
  pendingCount: number
  followUpCount: number
  reportsCount: number
  emergencyCount: number
  dateLabel: string
  onOpenQueue: () => void
  activeInpatientsCount?: number
  roundsDueCount?: number
  dischargeRequestsCount?: number
}

export function MorningGreeting({
  doctorName,
  specialization,
  waitingCount,
  pendingCount,
  followUpCount,
  reportsCount,
  emergencyCount,
  dateLabel,
  onOpenQueue,
  activeInpatientsCount = 0,
  roundsDueCount = 0,
  dischargeRequestsCount = 0,
}: MorningGreetingProps) {
  return (
    <section className="clinical-surface overflow-hidden">
      <div className="px-5 sm:px-6 py-5 bg-white border-b border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{dateLabel}</p>
            <h1 className="mt-1 text-2xl sm:text-[1.65rem] font-semibold text-slate-900 tracking-tight">
              {getGreeting()}, Dr. {doctorName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{specialization} · Clinic is open</p>
          </div>
          <Button type="button" variant="primary" onClick={onOpenQueue}>
            <Stethoscope className="w-4 h-4" />
            Start consultations
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-100">
        <PulseItem label="Waiting now" value={waitingCount} />
        <PulseItem label="Pending today" value={pendingCount} />
        <PulseItem label="Follow-ups" value={followUpCount} />
        <PulseItem label="Active IPD" value={activeInpatientsCount} />
        <PulseItem label="Rounds due" value={roundsDueCount} highlight={roundsDueCount > 0} />
      </div>
    </section>
  )
}

function PulseItem({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className={`px-4 py-3.5 ${highlight ? "bg-rose-50/60" : "bg-white"}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold tabular-nums text-slate-900 ${highlight ? "text-rose-800" : ""}`}>
        {value}
      </p>
    </div>
  )
}

interface NextPatientCardProps {
  patient: Appointment | null
  onStart: (appointment: Appointment) => void
  loadingId: string | null
}

export function NextPatientCard({ patient, onStart, loadingId }: NextPatientCardProps) {
  if (!patient) {
    return (
      <section className="clinical-surface h-full">
        <ClinicalEmptyState
          compact
          illustration="appointments"
          title="No patients in queue"
          description="Your schedule is clear for now."
          action={{ label: "View full queue", href: "/doctor-dashboard/appointments" }}
        />
      </section>
    )
  }

  const isUrgent = (patient.symptomSeverity ?? 0) >= 8

  return (
    <section className="clinical-surface overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Next patient</p>
        {isUrgent && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            Urgent
          </span>
        )}
      </div>
      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        <div className="flex items-start gap-4">
          <PatientAvatar name={patient.patientName} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-slate-900 truncate">{patient.patientName}</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4 shrink-0" />
              {formatTime12(patient.appointmentTime)}
              {patient.branchName && <span className="text-slate-400">· {patient.branchName}</span>}
            </p>
            <div className="mt-2">
              <ClinicalStatusBadge status={patient.status} size="sm" />
            </div>
          </div>
        </div>

        {patient.chiefComplaint && (
          <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Chief complaint
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{patient.chiefComplaint}</p>
          </div>
        )}

        <div className="mt-auto pt-5">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => onStart(patient)}
            loading={loadingId === patient.id}
            loadingText="Opening consultation…"
          >
            Begin consultation
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}

interface AppointmentQueueListProps {
  title: string
  subtitle?: string
  appointments: Appointment[]
  emptyTitle: string
  emptyDescription?: React.ReactNode
  onSelect: (appointment: Appointment) => void
  maxItems?: number
  showTime?: boolean
}

export function AppointmentQueueList({
  title,
  subtitle,
  appointments,
  emptyTitle,
  emptyDescription,
  onSelect,
  maxItems = 6,
  showTime = true,
}: AppointmentQueueListProps) {
  const items = appointments.slice(0, maxItems)

  return (
    <section className="clinical-surface overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">{appointments.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <User className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">{emptyTitle}</p>
          {emptyDescription && <div className="text-xs text-slate-500 mt-1">{emptyDescription}</div>}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 flex-1 overflow-y-auto">
          {items.map((apt) => (
            <li key={apt.id}>
              <button
                type="button"
                onClick={() => onSelect(apt)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <PatientAvatar name={apt.patientName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{apt.patientName}</p>
                  <p className="text-xs text-slate-500 truncate">{apt.chiefComplaint || "—"}</p>
                </div>
                {showTime && (
                  <span className="text-xs font-semibold text-slate-600 tabular-nums shrink-0">
                    {formatTime12(apt.appointmentTime)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface TodayScheduleTimelineProps {
  appointments: Appointment[]
  onSelect: (appointment: Appointment) => void
  onRefresh: () => void
}

export function TodayScheduleTimeline({
  appointments,
  onSelect,
  onRefresh,
}: TodayScheduleTimelineProps) {
  return (
    <section className="clinical-surface overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Today&apos;s schedule</h3>
          <p className="text-xs text-slate-500 mt-0.5">{appointments.length} confirmed visits</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Refresh schedule"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {appointments.length === 0 ? (
        <div className="py-12 text-center px-4">
          <p className="text-sm font-medium text-slate-600">No confirmed visits today</p>
          <p className="text-xs text-slate-500 mt-1">Check tomorrow&apos;s queue or refresh.</p>
        </div>
      ) : (
        <div className="p-4 space-y-2 max-h-[22rem] overflow-y-auto">
          {appointments.map((apt) => {
            const dateStr = apt.appointmentDate || ""
            const timeStr = apt.appointmentTime || ""
            const isPast = dateStr && timeStr ? new Date(`${dateStr}T${timeStr}`).getTime() < Date.now() : false
            return (
              <button
                key={apt.id}
                type="button"
                onClick={() => onSelect(apt)}
                className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  isPast
                    ? "border-slate-200 bg-slate-50/80 hover:bg-slate-100"
                    : "border-teal-200 bg-teal-50/40 hover:bg-teal-50"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isPast ? "bg-slate-200 text-slate-600" : "bg-[var(--color-primary)] text-white"
                  }`}
                >
                  {formatTime12(apt.appointmentTime).split(" ")[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{apt.patientName}</p>
                  <p className="text-xs text-slate-500 truncate">{apt.chiefComplaint}</p>
                </div>
                <ClinicalStatusBadge status={apt.status} size="sm" showDot={false} />
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

interface QuickClinicalActionsProps {
  pendingBadge?: number
}

export function QuickClinicalActions({ pendingBadge = 0 }: QuickClinicalActionsProps) {
  const actions = [
    { href: "/doctor-dashboard/appointments", label: "Queue", desc: "Pending visits", icon: Stethoscope, showBadge: true },
    { href: "/doctor-dashboard/inpatients", label: "Inpatients", desc: "Admitted patients", icon: User, showBadge: false },
  ]

  return (
    <section className="clinical-surface min-w-0 overflow-hidden h-full flex flex-col">
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 shrink-0">
        <h3 className="text-sm font-semibold text-slate-800 truncate">Quick clinical actions</h3>
      </div>
      <div className="p-3 sm:p-4 flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 gap-2">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2.5 min-w-0 overflow-hidden rounded-xl border border-slate-200 px-2.5 py-2.5 hover:border-teal-200 hover:bg-teal-50/40 transition-colors group"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                <action.icon className="w-4 h-4 shrink-0" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate min-w-0 flex-1">
                    {action.label}
                  </p>
                  {action.showBadge && pendingBadge > 0 && (
                    <span className="shrink-0 inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full bg-rose-100 px-1.5 text-[10px] font-bold text-rose-700 tabular-nums">
                      {pendingBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

interface ClinicNotificationsProps {
  emergencyCases: Appointment[]
  unsavedScheduleCount: number
  campaignCount: number
  onSelectPatient: (appointment: Appointment) => void
}

export function ClinicNotifications({
  emergencyCases,
  unsavedScheduleCount,
  campaignCount,
  onSelectPatient,
}: ClinicNotificationsProps) {
  const items: Array<{ id: string; tone: "error" | "warning" | "info"; title: string; body: string; action?: React.ReactNode }> = []

  emergencyCases.forEach((apt) => {
    items.push({
      id: `urgent-${apt.id}`,
      tone: "error",
      title: "Urgent case today",
      body: `${apt.patientName} — ${apt.chiefComplaint || "Review immediately"}`,
      action: (
        <button
          type="button"
          onClick={() => onSelectPatient(apt)}
          className="text-xs font-semibold text-rose-700 hover:underline"
        >
          Open
        </button>
      ),
    })
  })

  if (unsavedScheduleCount > 0) {
    items.push({
      id: "schedule-unsaved",
      tone: "warning",
      title: "Unsaved schedule changes",
      body: `${unsavedScheduleCount} blocked date(s) not saved yet.`,
    })
  }

  if (campaignCount > 0) {
    items.push({
      id: "campaigns",
      tone: "info",
      title: "Hospital announcements",
      body: `${campaignCount} active campaign${campaignCount !== 1 ? "s" : ""} for doctors.`,
    })
  }

  if (items.length === 0) {
    return (
      <section className="clinical-surface p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Notifications</h3>
        <p className="text-sm text-slate-500">No urgent alerts. You&apos;re caught up.</p>
      </section>
    )
  }

  const toneStyles = {
    error: "border-rose-200 bg-rose-50/80",
    warning: "border-amber-200 bg-amber-50/80",
    info: "border-sky-200 bg-sky-50/80",
  }

  return (
    <section className="clinical-surface overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
        <p className="text-xs text-slate-500 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} need attention</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className={`px-4 py-3 border-l-4 ${toneStyles[item.tone]}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.body}</p>
              </div>
              {item.action}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface ActiveInpatientsSectionProps {
  inpatients: Admission[]
  loading: boolean
  error: string | null
  onViewPatient: (admission: Admission) => void
  onStartRound: (admission: Admission) => void
}

export function ActiveInpatientsSection({
  inpatients,
  loading,
  error,
  onViewPatient,
  onStartRound,
}: ActiveInpatientsSectionProps) {
  const activeAdmissions = inpatients.filter(
    (patient) => patient.status === "admitted" || patient.status === "scheduled"
  )
  const displayedInpatients = activeAdmissions.slice(0, 3)
  const remainingCount = activeAdmissions.length - displayedInpatients.length

  return (
    <section className="clinical-surface overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-slate-800">Active Inpatients</h3>
          <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200/60 px-2.5 py-0.5 text-xs font-semibold text-teal-800 tabular-nums">
            {activeAdmissions.length} active
          </span>
        </div>
        <Link
          href="/doctor-dashboard/inpatients"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          View All Inpatients
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-slate-500">Loading active inpatients...</div>
      ) : error ? (
        <div className="p-4 text-xs text-rose-700 bg-rose-50 border-t border-rose-100">
          Unable to load inpatient summary: {error}
        </div>
      ) : activeAdmissions.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm font-medium text-slate-700">No active inpatients</p>
          <p className="text-xs text-slate-500 mt-1">You don&apos;t currently have any admitted patients assigned to you.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {displayedInpatients.map((patient) => {
              const roundInfo = getInpatientRoundInfo(patient)
              const daysAdmittedText = formatDaysAdmitted(patient.checkInAt)
              const ipdLabel = formatIpdNo(patient.ipdNo)
              const roomLabel = patient.roomNumber
                ? `Room ${patient.roomNumber}${patient.roomType && patient.roomType !== "custom" ? ` (${patient.roomType})` : ""}`
                : "No room assigned"
              const hasDischargeRequest = patient.dischargeRequest?.status === "pending"

              return (
                <div
                  key={patient.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 hover:border-teal-200 hover:shadow-sm transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {patient.patientName || "Unknown Patient"}
                          </p>
                          {patient.status === "scheduled" && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                              Pre-Booked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {patient.patientId ? `PID: ${patient.patientId}` : "PID: N/A"}
                        </p>
                      </div>
                      <PatientAvatar name={patient.patientName || undefined} size="sm" />
                    </div>

                    <div className="mt-3 text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-700 truncate">{ipdLabel}</span>
                        <span className="truncate text-slate-500">{roomLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-[11px]">
                        <span className="text-slate-500">{daysAdmittedText}</span>
                        <span className="text-slate-500 truncate">Last round: {roundInfo.lastRoundText}</span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                      {roundInfo.isRoundDoneToday ? (
                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          Round completed today
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Round pending today
                        </span>
                      )}

                      {hasDischargeRequest && (
                        <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                          Discharge requested
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => onViewPatient(patient)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-center"
                    >
                      View Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartRound(patient)}
                      className="flex-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors text-center"
                    >
                      {roundInfo.isRoundDoneToday ? "View Round" : "Start Round"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {remainingCount > 0 && (
            <div className="flex items-center justify-between pt-1 px-1">
              <span className="text-xs font-medium text-slate-500">+ {remainingCount} more patient{remainingCount > 1 ? "s" : ""}</span>
              <Link
                href="/doctor-dashboard/inpatients"
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                View All Inpatients →
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
