'use client'

import { useEffect, useState, useMemo } from 'react'
import { query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { getHospitalCollection } from '@/utils/firebase/hospital-queries'

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
  createdAt?: string
}

interface DoctorRow {
  id: string
  name: string
  status: 'available' | 'in_consultation' | 'not_available'
  nextSlot?: string
}

interface QueuePatient {
  id: string
  patientName: string
  doctorName: string
  waitingTime: string
  appointmentTime: string
}

interface IpdPatientRow {
  id: string
  patientName: string
  doctorName: string
  roomLabel: string
  checkInAt?: string
}

interface RecentActivity {
  id: string
  type: 'appointment' | 'whatsapp_booking' | 'billing' | 'completion' | 'patient_added'
  message: string
  timestamp: string
  priority: 'high' | 'medium' | 'low'
}

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  timestamp: string
  read: boolean
}

interface DashboardOverviewProps {
  onTabChange?: (tab: 'patients' | 'doctors' | 'appointments' | 'book-appointment' | 'admit-requests' | 'billing' | 'whatsapp-bookings') => void
  receptionistBranchId?: string | null
}

const statusBadgeClass: Record<string, string> = {
  confirmed: 'bg-amber-100 text-amber-800 border-amber-200',
  waiting: 'bg-amber-100 text-amber-800 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  not_attended: 'bg-rose-100 text-rose-700 border-rose-200',
  whatsapp_pending: 'bg-sky-100 text-sky-800 border-sky-200',
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

export default function DashboardOverview({ onTabChange, receptionistBranchId }: DashboardOverviewProps) {
  const { activeHospitalId } = useMultiHospital()
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    walkInPatients: 0,
    pendingWhatsAppBookings: 0,
    pendingBilling: 0,
    completedVisits: 0,
    doctorsAvailableToday: 0,
  })
  const [todayAppointments, setTodayAppointments] = useState<AppointmentRow[]>([])
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [queuePatients, setQueuePatients] = useState<QueuePatient[]>([])
  const [ipdStats, setIpdStats] = useState<IpdStats>({
    activeAdmissions: 0,
    pendingAdmissionRequests: 0,
    doctorRequestedDischarge: 0,
    dischargesToday: 0,
  })
  const [ipdPatients, setIpdPatients] = useState<IpdPatientRow[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  useEffect(() => {
    if (!activeHospitalId) return

    const appointmentsRef = getHospitalCollection(activeHospitalId, 'appointments')
    const doctorsRef = getHospitalCollection(activeHospitalId, 'doctors')
    const admissionsRef = getHospitalCollection(activeHospitalId, 'admissions')
    const admissionRequestsRef = getHospitalCollection(activeHospitalId, 'admission_requests')

    const unsubAppointments = onSnapshot(appointmentsRef, (snapshot) => {
      const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any))
      let filtered = receptionistBranchId ? all.filter((a) => a.branchId === receptionistBranchId) : all

      const today = filtered.filter((a) => a.appointmentDate === todayStr && a.status !== 'whatsapp_pending' && !a.whatsappPending)
      const whatsappPending = filtered.filter((a) => a.whatsappPending === true || a.status === 'whatsapp_pending')
      const pendingBilling = filtered.filter((a) => {
        const unpaid = (a.paymentStatus === 'unpaid' || a.paymentStatus === 'pending') && !a.paidAt
        const remaining = (a.remainingAmount || 0) > 0
        return (unpaid || remaining) && (a.status === 'confirmed' || a.status === 'completed')
      })
      const completedToday = today.filter((a) => a.status === 'completed')
      const uniquePatients = new Set(today.map((a) => a.patientId || a.patientUid))

      setStats({
        todayAppointments: today.length,
        walkInPatients: uniquePatients.size,
        pendingWhatsAppBookings: whatsappPending.length,
        pendingBilling: pendingBilling.length,
        completedVisits: completedToday.length,
        doctorsAvailableToday: 0, // set after doctors load
      })

      const timeline: AppointmentRow[] = today
        .map((a) => ({
          id: a.id,
          appointmentTime: a.appointmentTime || '—',
          patientName: a.patientName || '—',
          doctorName: a.doctorName || '—',
          status: a.status || 'confirmed',
          createdAt: a.createdAt,
        }))
        .sort((a, b) => String(a.appointmentTime).localeCompare(String(b.appointmentTime)))
      setTodayAppointments(timeline)

      const waiting = today.filter((a) => a.status === 'confirmed')
      const queue: QueuePatient[] = waiting.map((a) => {
        const t = a.appointmentTime ? String(a.appointmentTime) : ''
        return {
          id: a.id,
          patientName: a.patientName || '—',
          doctorName: a.doctorName || '—',
          appointmentTime: t,
          waitingTime: a.createdAt ? formatTime(a.createdAt) : '—',
        }
      })
      setQueuePatients(queue)

      const notifs: Notification[] = []
      if (whatsappPending.length > 0) {
        notifs.push({
          id: 'whatsapp-pending',
          title: 'WhatsApp Bookings Pending',
          message: `${whatsappPending.length} booking(s) need your attention`,
          type: 'warning',
          timestamp: new Date().toISOString(),
          read: false,
        })
      }
      if (pendingBilling.length > 5) {
        notifs.push({
          id: 'billing-pending',
          title: 'Pending Billing',
          message: `${pendingBilling.length} appointments have pending payments`,
          type: 'info',
          timestamp: new Date().toISOString(),
          read: false,
        })
      }
      setNotifications(notifs)

      const activities: RecentActivity[] = all
        .sort((x, y) => new Date(y.createdAt || 0).getTime() - new Date(x.createdAt || 0).getTime())
        .slice(0, 12)
        .map((a) => {
          const createdAt = new Date(a.createdAt || Date.now())
          if (a.whatsappPending || a.status === 'whatsapp_pending') {
            return { id: a.id, type: 'whatsapp_booking' as const, message: `WhatsApp booking from ${a.patientName || 'Unknown'}`, timestamp: createdAt.toISOString(), priority: 'high' as const }
          }
          if (a.status === 'completed') {
            return { id: a.id, type: 'completion' as const, message: `Visit completed – ${a.patientName}`, timestamp: createdAt.toISOString(), priority: 'low' as const }
          }
          if ((a.remainingAmount || 0) > 0) {
            return { id: a.id, type: 'billing' as const, message: `Pending payment ₹${a.remainingAmount} – ${a.patientName}`, timestamp: createdAt.toISOString(), priority: 'medium' as const }
          }
          return { id: a.id, type: 'appointment' as const, message: `Appointment booked – ${a.patientName}`, timestamp: createdAt.toISOString(), priority: 'medium' as const }
        })
      setRecentActivity(activities.slice(0, 8))
    })

    const unsubAdmissions = onSnapshot(admissionsRef, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any))
      const filtered = receptionistBranchId ? rows.filter((r) => r.branchId === receptionistBranchId) : rows
      const todayDate = new Date().toISOString().split('T')[0]
      const activeRows = filtered.filter((row) => {
        const status = String(row.status || '').toLowerCase()
        return status !== 'discharged' && status !== 'cancelled'
      })
      const doctorRequestedRows = filtered.filter((row) => {
        const status = String(row.status || '').toLowerCase()
        return status === 'doctor_requested_discharge' || row?.dischargeRequest?.status === 'requested'
      })
      const dischargesToday = filtered.filter((row) => {
        const status = String(row.status || '').toLowerCase()
        if (status !== 'discharged') return false
        const dischargedAtRaw = row.checkedOutAt || row.dischargedAt || row.updatedAt
        if (!dischargedAtRaw) return false
        const dischargedDate = new Date(dischargedAtRaw).toISOString().split('T')[0]
        return dischargedDate === todayDate
      })

      setIpdStats((prev) => ({
        ...prev,
        activeAdmissions: activeRows.length,
        doctorRequestedDischarge: doctorRequestedRows.length,
        dischargesToday: dischargesToday.length,
      }))

      const recentInpatients: IpdPatientRow[] = activeRows
        .sort((a, b) => new Date(b.checkInAt || 0).getTime() - new Date(a.checkInAt || 0).getTime())
        .slice(0, 6)
        .map((row) => ({
          id: row.id,
          patientName: row.patientName || 'Unknown patient',
          doctorName: row.doctorName || '—',
          roomLabel: row.roomNumber ? `${row.roomNumber} (${row.roomType || 'Room'})` : (row.roomType || 'Not assigned'),
          checkInAt: row.checkInAt,
        }))
      setIpdPatients(recentInpatients)
    })

    const unsubAdmissionRequests = onSnapshot(admissionRequestsRef, (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any))
      const filtered = receptionistBranchId ? rows.filter((r) => r.branchId === receptionistBranchId) : rows
      const pending = filtered.filter((row) => String(row.status || '').toLowerCase() === 'pending')
      setIpdStats((prev) => ({ ...prev, pendingAdmissionRequests: pending.length }))
    })

    getDocs(query(doctorsRef, where('status', '==', 'active')))
      .then((snap) => {
        setStats((prev) => ({ ...prev, doctorsAvailableToday: snap.size }))
        const list: DoctorRow[] = snap.docs.map((d) => {
          const data = d.data() as any
          const name = [data.firstName, data.lastName].filter(Boolean).join(' ') || 'Doctor'
          return {
            id: d.id,
            name,
            status: 'available' as const,
            nextSlot: undefined,
          }
        })
        setDoctors(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => {
      unsubAppointments()
      unsubAdmissions()
      unsubAdmissionRequests()
    }
  }, [activeHospitalId, receptionistBranchId, todayStr])

  const getStatusLabel = (status: string) => {
    if (status === 'confirmed') return 'Waiting'
    if (status === 'completed') return 'Completed'
    if (status === 'cancelled' || status === 'doctor_cancelled') return 'Cancelled'
    if (status === 'not_attended') return 'Not Attended'
    return status
  }

  if (loading && todayAppointments.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-sky-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Today's Appointments", value: stats.todayAppointments, iconBg: 'bg-sky-100', iconCl: 'text-sky-600', onClick: () => onTabChange?.('appointments') },
          { label: 'Walk-in Patients', value: stats.walkInPatients, iconBg: 'bg-emerald-100', iconCl: 'text-emerald-600', onClick: () => onTabChange?.('patients') },
          { label: 'WhatsApp Bookings', value: stats.pendingWhatsAppBookings, iconBg: 'bg-amber-100', iconCl: 'text-amber-600', onClick: () => onTabChange?.('whatsapp-bookings') },
          { label: 'Pending Billing', value: stats.pendingBilling, iconBg: 'bg-rose-100', iconCl: 'text-rose-600', onClick: () => onTabChange?.('billing') },
          { label: 'Completed Visits', value: stats.completedVisits, iconBg: 'bg-violet-100', iconCl: 'text-violet-600', onClick: () => onTabChange?.('appointments') },
          { label: 'Doctors Available', value: stats.doctorsAvailableToday, iconBg: 'bg-indigo-100', iconCl: 'text-indigo-600', onClick: () => onTabChange?.('doctors') },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left"
          >
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
              {card.label === "Today's Appointments" && <svg className={`h-5 w-5 ${card.iconCl}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              {card.label === 'Walk-in Patients' && <svg className={`h-5 w-5 ${card.iconCl}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
              {card.label === 'WhatsApp Bookings' && <svg className={`h-5 w-5 ${card.iconCl}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
              {card.label === 'Pending Billing' && <svg className={`h-5 w-5 ${card.iconCl}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {card.label === 'Completed Visits' && <svg className={`h-5 w-5 ${card.iconCl}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              {card.label === 'Doctors Available' && <svg className={`h-5 w-5 ${card.iconCl}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">IPD Admissions Snapshot</h2>
              <p className="text-sm text-slate-500 mt-0.5">Live inpatient and admission request status</p>
            </div>
            <button
              type="button"
              onClick={() => onTabChange?.('admit-requests')}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
            >
              Open IPD
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium text-slate-500">Active Admissions</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{ipdStats.activeAdmissions}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium text-slate-500">Pending Requests</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{ipdStats.pendingAdmissionRequests}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium text-slate-500">Doctor Requested Discharge</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{ipdStats.doctorRequestedDischarge}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium text-slate-500">Discharges Today</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{ipdStats.dischargesToday}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-lg font-semibold text-slate-900">Current Inpatients</h2>
            <p className="text-sm text-slate-500 mt-0.5">Recently admitted patients</p>
          </div>
          <div className="p-4 space-y-2 max-h-[220px] overflow-y-auto">
            {ipdPatients.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No active inpatients</p>
            ) : (
              ipdPatients.map((patient) => (
                <div key={patient.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{patient.patientName}</p>
                  <p className="text-xs text-slate-600">Doctor: {patient.doctorName}</p>
                  <p className="text-xs text-slate-500">Room: {patient.roomLabel}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 2. Today's Appointment Timeline */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Appointment Timeline</h2>
            <p className="text-sm text-slate-500 mt-0.5">Chronological order</p>
          </div>
          <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayAppointments.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No appointments today</td></tr>
                ) : (
                  todayAppointments.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.appointmentTime}</td>
                      <td className="px-4 py-3 text-slate-700">{row.patientName}</td>
                      <td className="px-4 py-3 text-slate-700">{row.doctorName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[row.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {getStatusLabel(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Doctor Availability Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-lg font-semibold text-slate-900">Doctor Availability</h2>
            <p className="text-sm text-slate-500 mt-0.5">Status for today</p>
          </div>
          <div className="p-4 space-y-2 max-h-[340px] overflow-y-auto">
            {doctors.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No doctors loaded</p>
            ) : (
              doctors.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <span className="font-medium text-slate-800">{doc.name}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    doc.status === 'available' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    doc.status === 'in_consultation' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {doc.status === 'available' ? 'Available' : doc.status === 'in_consultation' ? 'In Consultation' : 'Not Available'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 4. Patient Queue */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-lg font-semibold text-slate-900">Patient Queue</h2>
            <p className="text-sm text-slate-500 mt-0.5">Waiting patients</p>
          </div>
          <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Waiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queuePatients.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No one waiting</td></tr>
                ) : (
                  queuePatients.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{q.patientName}</td>
                      <td className="px-4 py-3 text-slate-700">{q.doctorName}</td>
                      <td className="px-4 py-3 text-slate-600">{q.waitingTime}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Quick Actions */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <p className="text-sm text-slate-500 mt-0.5">Frequent tasks</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button type="button" onClick={() => onTabChange?.('book-appointment')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-sky-200 hover:bg-sky-50/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-sky-100 flex items-center justify-center"><svg className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></div>
              <span className="text-xs font-medium text-slate-700 text-center">Book Appointment</span>
            </button>
            <button type="button" onClick={() => onTabChange?.('patients')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg></div>
              <span className="text-xs font-medium text-slate-700 text-center">Add Patient</span>
            </button>
            <button type="button" onClick={() => onTabChange?.('whatsapp-bookings')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-amber-200 hover:bg-amber-50/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
              <span className="text-xs font-medium text-slate-700 text-center">WhatsApp Booking</span>
            </button>
            <button type="button" onClick={() => onTabChange?.('billing')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-violet-200 hover:bg-violet-50/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center"><svg className="h-5 w-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
              <span className="text-xs font-medium text-slate-700 text-center">Create Billing</span>
            </button>
            <button type="button" onClick={() => onTabChange?.('book-appointment')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-teal-200 hover:bg-teal-50/50 transition-all">
              <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center"><svg className="h-5 w-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>
              <span className="text-xs font-medium text-slate-700 text-center">Walk-in Registration</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Notifications & 7. Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
              <p className="text-sm text-slate-500 mt-0.5">Alerts & messages</p>
            </div>
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-800">{notifications.filter((n) => !n.read).length} unread</span>
            )}
          </div>
          <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="font-medium">All caught up</p>
                <p className="text-sm mt-1">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`rounded-xl border-l-4 p-4 ${
                  n.type === 'error' ? 'border-rose-500 bg-rose-50' :
                  n.type === 'warning' ? 'border-amber-500 bg-amber-50' :
                  n.type === 'success' ? 'border-emerald-500 bg-emerald-50' : 'border-sky-500 bg-sky-50'
                }`}>
                  <p className="font-medium text-slate-900">{n.title}</p>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                  <p className="text-xs text-slate-500 mt-2">{formatTime(n.timestamp)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <p className="text-sm text-slate-500 mt-0.5">Latest system activity</p>
          </div>
          <div className="p-4 space-y-2 max-h-[280px] overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="font-medium">No recent activity</p>
              </div>
            ) : (
              recentActivity.map((act) => (
                <div key={act.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                  <span className="text-lg">{act.type === 'whatsapp_booking' ? '💬' : act.type === 'appointment' ? '📅' : act.type === 'billing' ? '💰' : act.type === 'completion' ? '✅' : '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{act.message}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatTime(act.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
