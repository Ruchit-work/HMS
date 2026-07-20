'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearch } from '@/shared/hooks/useSearch'
import { doc, deleteDoc, onSnapshot, updateDoc, query, where, orderBy, getDocs } from 'firebase/firestore'
import { auth } from '@/firebase/config'
import { useAuth } from '@/shared/hooks/useAuth'
import { useMultiHospital } from '@/providers/MultiHospitalProvider'
import { useBranchSelection } from '@/providers/BranchProvider'
import { useAdminHospitalDataOptional } from '@/providers/AdminHospitalDataProvider'
import { getHospitalCollection } from '@/shared/utils/firebase/hospital-queries'
import { authedFetchJson } from '@/shared/utils/authedFetch'
import { useHospitalBillingSettings } from '@/shared/hooks/useHospitalBillingSettings'
import { filterAppointmentsByBranch } from '@/shared/utils/branch/branchFilters'
import { fetchBranches } from '@/services/BranchService'
import {
  getAppointmentsCollectionPath,
  isAppointmentVisibleToReceptionist,
  logAppointmentQuery,
} from '@/shared/utils/appointments/appointmentSource'
import { SuccessToast } from '@/shared/components'
import { TabSkeleton } from '@/shared/components'
import AdminProtected from '@/features/auth/AdminProtected'
import { ViewModal, DeleteModal } from '@/shared/components'
import { Appointment } from '@/types/patient'
import { Branch } from '@/types/branch'
import { formatDate, formatDateTime } from '@/shared/utils/shared/date'
import { useTablePagination } from '@/shared/hooks/useTablePagination'
import {
  EnterpriseDataTable,
  StatusPill,
  AvatarCell,
  type EnterpriseColumn,
  type EnterpriseRowAction,
  type EnterpriseBulkAction,
  type StatusVariant,
} from '@/shared/components'
import { useNewItems } from '@/shared/hooks/useNewItems'
import PrescriptionDisplay from '@/features/prescription/PrescriptionDisplay'
import DocumentListCompact from '@/features/documents/DocumentListCompact'

interface AppoinmentManagementProps {
    disableAdminGuard?: boolean
    /** When provided (receptionist dashboard), restrict view to this branch */
    receptionistBranchId?: string | null
}

type AppointmentTimeRange = 'all' | 'today' | 'last10' | 'month' | 'year'

function formatLocalYmd(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/** Date bounds for Firestore queries (appointmentDate is stored as YYYY-MM-DD). */
function getAppointmentDateBounds(timeRange: AppointmentTimeRange): { start: string; end: string } {
    const now = new Date()
    const today = formatLocalYmd(now)

    switch (timeRange) {
        case 'today':
            return { start: today, end: today }
        case 'last10': {
            const past = new Date(now)
            past.setDate(past.getDate() - 10)
            return { start: formatLocalYmd(past), end: today }
        }
        case 'month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1)
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
            return { start: formatLocalYmd(start), end: formatLocalYmd(end) }
        }
        case 'year': {
            const start = new Date(now.getFullYear(), 0, 1)
            const end = new Date(now.getFullYear(), 11, 31)
            return { start: formatLocalYmd(start), end: formatLocalYmd(end) }
        }
        case 'all':
        default: {
            // Keep realtime viable: previous 12 months through next 90 days
            const start = new Date(now)
            start.setFullYear(start.getFullYear() - 1)
            const end = new Date(now)
            end.setDate(end.getDate() + 90)
            return { start: formatLocalYmd(start), end: formatLocalYmd(end) }
        }
    }
}

/** Collected money (paid / paidAt) that hasn't been refunded — such appointments must go through the refund workflow. */
function isPaidForCancellation(apt: Appointment): boolean {
    const paymentStatus = String((apt as any).paymentStatus || '').toLowerCase()
    if (paymentStatus === 'refunded') return false
    return paymentStatus === 'paid' || (Boolean(apt.paidAt) && String(apt.paidAt).trim() !== '')
}

export default function AppoinmentManagement({
    disableAdminGuard = true,
    receptionistBranchId = null,
}: AppoinmentManagementProps = {}) {
    const { selectedBranchId, branches: contextBranches, isProvided: branchContextProvided } = useBranchSelection()
    const sharedHospitalData = useAdminHospitalDataOptional()
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(false)
    const hasLoadedAppointmentsRef = useRef(false)
    const [error, setError] = useState<string | null>(null)
    const { search, setSearch, debouncedSearch } = useSearch()
    const { user, loading: authLoading } = useAuth()
    const { activeHospitalId } = useMultiHospital()
    const { settings: billingSettings, refundsEnabled } = useHospitalBillingSettings()
    const { isNew } = useNewItems('admin-appointments')
    const [sortField, setSortField] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all')
    const [timeRange, setTimeRange] = useState<AppointmentTimeRange>('month')
    const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'confirmed' | 'waiting' | 'in_consultation' | 'completed' | 'not_attended' | 'cancelled'>('all')
    // Derived from appointments + search/filters (single source of truth so search always applies)
    const filteredAppointments = useMemo(() => {
        let filtered = appointments
        const searchTrimmed = (debouncedSearch || '').trim().toLowerCase()
        const getPatientDisplayName = (a: Appointment) =>
            a.patientName?.trim?.() ||
            (a as any).patient_name?.trim?.() ||
            [((a as any).patientFirstName as string)?.trim?.(), ((a as any).patientLastName as string)?.trim?.()].filter(Boolean).join(' ') ||
            ''
        if (searchTrimmed) {
            const searchDigits = searchTrimmed.replace(/\D/g, '')
            filtered = filtered.filter(appointment => {
                const patientName = getPatientDisplayName(appointment).toLowerCase()
                const phone = (appointment.patientPhone && String(appointment.patientPhone).replace(/\D/g, '')) || ''
                return (
                    patientName.includes(searchTrimmed) ||
                    (appointment.doctorName && appointment.doctorName.toLowerCase().includes(searchTrimmed)) ||
                    (appointment.patientEmail && appointment.patientEmail.toLowerCase().includes(searchTrimmed)) ||
                    (appointment.doctorSpecialization && appointment.doctorSpecialization.toLowerCase().includes(searchTrimmed)) ||
                    (appointment.patientId && appointment.patientId.toLowerCase().includes(searchTrimmed)) ||
                    (searchDigits.length >= 2 && phone.includes(searchDigits))
                )
            })
        }
        if (selectedDoctorId !== 'all') {
            filtered = filtered.filter(a => a.doctorId === selectedDoctorId)
        }
        if (timeRange !== 'all') {
            const now = new Date()
            filtered = filtered.filter(a => {
                if (!a.appointmentDate) return false
                const d = new Date(a.appointmentDate)
                if (timeRange === 'today') return d.toDateString() === now.toDateString()
                if (timeRange === 'last10') {
                    const past = new Date(now)
                    past.setDate(past.getDate() - 10)
                    return d >= past && d <= now
                }
                if (timeRange === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
                if (timeRange === 'year') return d.getFullYear() === now.getFullYear()
                return true
            })
        }
        if (statusFilter !== 'all') {
            filtered = filtered.filter((appt) => {
                const status = (appt as any).status
                if (statusFilter === 'cancelled') return status === 'cancelled' || status === 'doctor_cancelled'
                if (statusFilter === 'confirmed') return status === 'confirmed' || status === 'whatsapp_pending'
                if (statusFilter === 'scheduled') return status === 'pending'
                if (statusFilter === 'not_attended') return status === 'not_attended' || status === 'no_show'
                if (statusFilter === 'waiting' || statusFilter === 'in_consultation') return status === statusFilter
                return status === statusFilter
            })
        }
        return [...filtered].sort((a, b) => {
            if (sortField) {
                let aValue = '', bValue = ''
                switch (sortField) {
                    case 'patientName': aValue = a.patientName?.toLowerCase() || ''; bValue = b.patientName?.toLowerCase() || ''; break
                    case 'doctorName': aValue = a.doctorName?.toLowerCase() || ''; bValue = b.doctorName?.toLowerCase() || ''; break
                    case 'appointmentDate': aValue = a.appointmentDate || ''; bValue = b.appointmentDate || ''; break
                    case 'status': aValue = a.status?.toLowerCase() || ''; bValue = b.status?.toLowerCase() || ''; break
                    case 'createdAt': aValue = a.createdAt || ''; bValue = b.createdAt || ''; break
                    case 'branch': aValue = (a as any).branchName?.toLowerCase?.() || (a as any).branchId || ''; bValue = (b as any).branchName?.toLowerCase?.() || (b as any).branchId || ''; break
                    default: return 0
                }
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
                return 0
            }
            const aDate = a.createdAt || a.updatedAt || ''
            const bDate = b.createdAt || b.updatedAt || ''
            if (aDate < bDate) return 1
            if (aDate > bDate) return -1
            return 0
        })
    }, [appointments, debouncedSearch, sortField, sortOrder, selectedDoctorId, timeRange, statusFilter])
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteAppointment, setDeleteAppointment] = useState<Appointment | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [doctors, setDoctors] = useState<Array<{ id: string; firstName?: string; lastName?: string }>>([])
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
    // Branch Context (admin) or default "all" outside provider — same as prior prop default.
    const effectiveSelectedBranchId = selectedBranchId
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [processingBulk, setProcessingBulk] = useState(false)
    const [exportOpen, setExportOpen] = useState(false)

    const resetFilters = () => {
        setSelectedDoctorId('all')
        setTimeRange('all')
        setStatusFilter('all')
        setSearch('')
        setSortField('')
        setSortOrder('asc')
    }

    const statusCounts = useMemo(() => {
        const counts = {
            scheduled: 0,
            confirmed: 0,
            waiting: 0,
            in_consultation: 0,
            completed: 0,
            not_attended: 0,
            cancelled: 0
        }
        appointments.forEach((apt) => {
            const status = (apt as any).status
            if (status === 'pending') counts.scheduled += 1
            else if (status === 'confirmed' || status === 'whatsapp_pending') counts.confirmed += 1
            else if (status === 'waiting') counts.waiting += 1
            else if (status === 'in_consultation') counts.in_consultation += 1
            else if (status === 'completed') counts.completed += 1
            else if (status === 'not_attended' || status === 'no_show') counts.not_attended += 1
            else if (status === 'cancelled' || status === 'doctor_cancelled') counts.cancelled += 1
        })
        return counts
    }, [appointments])

    const statusTabs = useMemo(() => ([
        { key: 'all' as const, label: 'All', count: appointments.length },
        { key: 'scheduled' as const, label: 'Scheduled', count: statusCounts.scheduled },
        { key: 'confirmed' as const, label: 'Confirmed', count: statusCounts.confirmed },
        { key: 'waiting' as const, label: 'Waiting', count: statusCounts.waiting },
        { key: 'in_consultation' as const, label: 'In Consultation', count: statusCounts.in_consultation },
        { key: 'completed' as const, label: 'Completed', count: statusCounts.completed },
        { key: 'not_attended' as const, label: 'Not Attended', count: statusCounts.not_attended },
        { key: 'cancelled' as const, label: 'Cancelled', count: statusCounts.cancelled },
    ]), [appointments.length, statusCounts])

    const todayStr = useMemo(() => new Date().toDateString(), [])
    const todayAnalytics = useMemo(() => {
        const todayAppointments = appointments.filter((a) => a.appointmentDate && new Date(a.appointmentDate).toDateString() === todayStr)
        const completed = todayAppointments.filter((a) => a.status === 'completed').length
        const waiting = todayAppointments.filter((a) => (a as any).status === 'pending' || (a as any).status === 'confirmed' || (a as any).status === 'whatsapp_pending').length
        const cancelled = todayAppointments.filter((a) => (a as any).status === 'cancelled' || (a as any).status === 'doctor_cancelled').length
        const revenueToday = todayAppointments
            .filter((a) => {
                // Match dashboard / billing: only count money actually collected.
                // Never treat appointment completion alone as payment, and never
                // count refunded money as revenue.
                const status = String(a.paymentStatus || "").toLowerCase()
                if (status === "refunded") return false
                // keep_payment: cancelled appointment can still be paid revenue.
                return (
                    status === "paid" ||
                    (Boolean(a.paidAt) && String(a.paidAt).trim() !== "")
                )
            })
            .reduce((s, a) => s + (Number(a.paymentAmount) || 0), 0)
        return {
            todayTotal: todayAppointments.length,
            completed,
            waiting,
            cancelled,
            revenueToday
        }
    }, [appointments, todayStr])

    const lastUpdatedDisplay = useMemo(() => (
        lastUpdated ? lastUpdated.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null
    ), [lastUpdated])

    function getVisitType(apt: Appointment): string {
        if ((apt as any).whatsappPending) return 'WhatsApp'
        if ((apt as any).createdBy === 'receptionist') return 'Walk-in'
        return 'Online'
    }
    function getAppointmentType(apt: Appointment): string {
        const type = (apt as any).appointmentType
        if (type === 'follow_up' || type === 'follow-up') return 'Follow-up'
        if (type === 'emergency') return 'Emergency'
        return 'New Patient'
    }
    function getPaymentStatusLabel(apt: Appointment): string {
        const s = (apt as any).paymentStatus || apt.paymentStatus
        if (s === 'refunded') return 'Refunded'
        if (s === 'paid') return 'Paid'
        return 'Pending'
    }
    function getStatusDisplayLabel(status: string): string {
        if (status === 'resrescheduled') return 'Rescheduled'
        if (status === 'doctor_cancelled') return 'Cancelled'
        if (status === 'whatsapp_pending') return 'Confirmed'
        if (status === 'no_show') return 'Not Attended'
        if (status === 'in_consultation') return 'In Consultation'
        if (status === 'pending') return 'Scheduled'
        if (status === 'waiting') return 'Waiting'
        return status || '—'
    }

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const toggleSelectAllPage = () => {
        if (selectedIds.size === paginatedAppointments.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(paginatedAppointments.map((a) => a.id)))
        }
    }
    const selectedAppointments = useMemo(() => {
        const set = selectedIds
        return filteredAppointments.filter((a) => set.has(a.id))
    }, [filteredAppointments, selectedIds])

    const handleBulkCancel = async () => {
        if (selectedAppointments.length === 0) return
        setProcessingBulk(true)
        try {
            let cancelledCount = 0
            let skippedPaid = 0
            for (const apt of selectedAppointments) {
                const s = String((apt as any).status || '')
                if (s === 'cancelled' || s === 'doctor_cancelled' || s === 'completed' || s === 'refund_requested') continue
                // Paid appointments that require an interactive refund decision are skipped in bulk.
                if (
                    isPaidForCancellation(apt) &&
                    (billingSettings.paidAppointmentCancellation === 'disallow' ||
                        billingSettings.paidAppointmentCancellation === 'create_refund_request')
                ) {
                    skippedPaid += 1
                    continue
                }
                await authedFetchJson(
                    `/api/appointments/${apt.id}/cancel`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ hospitalId: activeHospitalId || null, action: 'cancel' }),
                    },
                    'Failed to cancel appointment'
                )
                cancelledCount += 1
            }
            setSuccessMessage(
                skippedPaid > 0
                    ? `Cancelled ${cancelledCount} appointment(s). Skipped ${skippedPaid} paid appointment(s) that need individual review.`
                    : `Cancelled ${cancelledCount} appointment(s)`
            )
            setSelectedIds(new Set())
            setTimeout(() => setSuccessMessage(null), 5000)
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setProcessingBulk(false)
        }
    }
    const handleBulkComplete = async () => {
        if (selectedAppointments.length === 0) return
        setProcessingBulk(true)
        try {
            for (const apt of selectedAppointments) {
                if (apt.status === 'completed') continue
                const ref = doc(getHospitalCollection(activeHospitalId!, 'appointments'), apt.id)
                await updateDoc(ref, { status: 'completed', updatedAt: new Date().toISOString() })
            }
            setSuccessMessage(`Marked ${selectedAppointments.length} as completed`)
            setSelectedIds(new Set())
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setProcessingBulk(false)
        }
    }
    const exportCSV = () => {
        const headers = ['Patient', 'Doctor', 'Date', 'Time', 'Visit Type', 'Appointment Type', 'Status', 'Payment', 'Amount']
        const rows = filteredAppointments.map((a) => [
            a.patientName,
            a.doctorName,
            a.appointmentDate,
            a.appointmentTime,
            getVisitType(a),
            getAppointmentType(a),
            getStatusDisplayLabel((a as any).status),
            getPaymentStatusLabel(a),
            a.paymentAmount ?? ''
        ])
        const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `appointments_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
        URL.revokeObjectURL(link.href)
        setExportOpen(false)
    }
    const exportExcel = async () => {
        const ExcelJS = (await import('exceljs')).default
        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet('Appointments')
        ws.columns = [
            { header: 'Patient', key: 'patient', width: 20 },
            { header: 'Doctor', key: 'doctor', width: 18 },
            { header: 'Date', key: 'date', width: 12 },
            { header: 'Time', key: 'time', width: 8 },
            { header: 'Visit Type', key: 'visitType', width: 12 },
            { header: 'Appointment Type', key: 'aptType', width: 14 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Payment', key: 'payment', width: 10 },
            { header: 'Amount', key: 'amount', width: 10 }
        ]
        ws.addRows(filteredAppointments.map((a) => ({
            patient: a.patientName,
            doctor: a.doctorName,
            date: a.appointmentDate,
            time: a.appointmentTime,
            visitType: getVisitType(a),
            aptType: getAppointmentType(a),
            status: getStatusDisplayLabel((a as any).status),
            payment: getPaymentStatusLabel(a),
            amount: a.paymentAmount ?? ''
        })))
        const buf = await wb.xlsx.writeBuffer()
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `appointments_${new Date().toISOString().split('T')[0]}.xlsx`
        link.click()
        URL.revokeObjectURL(link.href)
        setExportOpen(false)
    }
    const printReport = () => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) return
        printWindow.document.write(`
          <html><head><title>Appointments Report</title></head><body>
          <h1>Appointments Report</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
          <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Visit Type</th><th>Status</th><th>Payment</th><th>Amount</th></tr></thead>
          <tbody>
          ${filteredAppointments.slice(0, 500).map((a) => `<tr><td>${a.patientName}</td><td>${a.doctorName}</td><td>${a.appointmentDate}</td><td>${a.appointmentTime || ''}</td><td>${getVisitType(a)}</td><td>${getStatusDisplayLabel((a as any).status)}</td><td>${getPaymentStatusLabel(a)}</td><td>${a.paymentAmount ?? ''}</td></tr>`).join('')}
          </tbody></table></body></html>`)
        printWindow.document.close()
        printWindow.print()
        printWindow.close()
        setExportOpen(false)
    }

    const handleView = (appointment: Appointment) => {
        setSelectedAppointment(appointment)
        setShowViewModal(true)
    }
    const handleDelete = (appointment: Appointment) => {
        setDeleteAppointment(appointment)
        setDeleteModal(true)
    }
    const handleDeleteConfirm = async () => {
        if (!deleteAppointment) return
        
        // Optimistic update: Remove from UI immediately (filtered list is derived from appointments)
        const previousAppointments = [...appointments]
        const deletedAppointment = deleteAppointment
        
        setAppointments(prev => prev.filter(a => a.id !== deleteAppointment.id))
        setShowViewModal(false)
        setDeleteModal(false)
        setDeleteAppointment(null)
        
        try {
            setLoading(true)
            setError(null)

            if (!activeHospitalId) {
                throw new Error('Hospital context not available')
            }

            // Perform actual deletion
            const appointmentRef = doc(getHospitalCollection(activeHospitalId, 'appointments'), deletedAppointment.id)
            await deleteDoc(appointmentRef)

            setSuccessMessage('Appointment deleted successfully!')
            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)
        } catch (error) {
            // Rollback on error
            setAppointments(previousAppointments)
            setDeleteAppointment(deletedAppointment)
            setError((error as Error).message || 'Failed to delete appointment')
        } finally {
            setLoading(false)
        }
    }

    const handleMarkNotAttended = async (appointment: Appointment) => {
        if (!appointment) return
        
        // Check if appointment can be marked as not attended
        const currentStatus = appointment.status || ''
        if (currentStatus === 'completed' || currentStatus === 'cancelled') {
            setError(`Cannot mark ${currentStatus} appointment as not attended`)
            return
        }

        try {
            setLoading(true)
            setError(null)

            // Get Firebase Auth token
            const currentUser = auth.currentUser
            if (!currentUser) {
                throw new Error('You must be logged in to mark appointments')
            }

            const token = await currentUser.getIdToken()

            const response = await fetch(`/api/appointments/${appointment.id}/mark-not-attended`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ hospitalId: activeHospitalId || null }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to mark appointment as not attended')
            }

            setSuccessMessage('Appointment marked as not attended successfully!')
            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)

            // The real-time listener will automatically update the appointment status
        } catch (error: any) {
            setError(error?.message || 'Failed to mark appointment as not attended')
        } finally {
            setLoading(false)
        }
    }

    // Helper function to check if appointment can be marked as not attended
    const canMarkNotAttended = (appointment: Appointment): boolean => {
        const status = appointment.status || ''
        if (status === 'completed' || status === 'cancelled' || status === 'not_attended') {
            return false
        }

        // Check if appointment date is today or in the past
        const appointmentDate = new Date(appointment.appointmentDate + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        appointmentDate.setHours(0, 0, 0, 0)

        return appointmentDate <= today
    }
    const setupRealtimeListener = useCallback(() => {
        if (!activeHospitalId) return () => {}
        
        try {
            if (!hasLoadedAppointmentsRef.current) {
              setLoading(true)
            }
            setError(null)
            const appointmentsRef = getHospitalCollection(activeHospitalId, 'appointments')
            const { start, end } = getAppointmentDateBounds(timeRange)

            // Scoped realtime query — never subscribe to the entire hospital collection
            const appointmentsQuery =
                selectedDoctorId !== 'all'
                    ? query(
                        appointmentsRef,
                        where('doctorId', '==', selectedDoctorId),
                        where('appointmentDate', '>=', start),
                        where('appointmentDate', '<=', end),
                        orderBy('appointmentDate', 'desc')
                    )
                    : query(
                        appointmentsRef,
                        where('appointmentDate', '>=', start),
                        where('appointmentDate', '<=', end),
                        orderBy('appointmentDate', 'desc')
                    )
            
            const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
                let appointmentsList = snapshot.docs
                    .map((docSnap) => ({
                        id: docSnap.id,
                        ...docSnap.data()
                    })) as Appointment[]

                // When used from receptionist dashboard, apply unified branch visibility
                // (same hospital source; doctor-created appointments always visible)
                if (receptionistBranchId) {
                    appointmentsList = appointmentsList.filter((apt) =>
                        isAppointmentVisibleToReceptionist(apt as any, receptionistBranchId)
                    )
                }

                // Additional branch filter from admin UI
                if (!receptionistBranchId && effectiveSelectedBranchId !== 'all') {
                    appointmentsList = filterAppointmentsByBranch(
                        appointmentsList,
                        effectiveSelectedBranchId,
                        { unassigned: "exclude" }
                    )
                }

                // Sort by newest first (createdAt descending, fallback to updatedAt)
                appointmentsList = appointmentsList.sort((a, b) => {
                    const aDate = a.createdAt || a.updatedAt || ''
                    const bDate = b.createdAt || b.updatedAt || ''
                    if (aDate < bDate) return 1
                    if (aDate > bDate) return -1
                    return 0
                })

                logAppointmentQuery({
                    module: receptionistBranchId ? 'receptionist/appointments' : 'admin/appointments',
                    collection: getAppointmentsCollectionPath(activeHospitalId!),
                    filters: {
                        receptionistBranchId: receptionistBranchId || null,
                        selectedBranchId: effectiveSelectedBranchId,
                        timeRange,
                        appointmentDateStart: start,
                        appointmentDateEnd: end,
                        doctorId: selectedDoctorId !== 'all' ? selectedDoctorId : null,
                    },
                    count: appointmentsList.length,
                    empty: appointmentsList.length === 0,
                })

                setAppointments(appointmentsList)
                setLastUpdated(new Date())
                hasLoadedAppointmentsRef.current = true
                setLoading(false)
            }, (listenerError) => {

                setError(listenerError.message)
                setLoading(false)
            })
            
            return unsubscribe
        } catch (error) {

            setError((error as Error).message)
            setLoading(false)
            return () => {}
        }
    }, [activeHospitalId, receptionistBranchId, effectiveSelectedBranchId, timeRange, selectedDoctorId])
    useEffect(() => {
        const unsubscribeAppointments = setupRealtimeListener()
        return () => {
            unsubscribeAppointments()
        }
    }, [setupRealtimeListener])

    useEffect(() => {
        if (!activeHospitalId) return

        // Prefer shared admin hospital doctors; fallback fetch outside provider (receptionist).
        if (sharedHospitalData.isProvided) {
            setDoctors(
                sharedHospitalData.doctors.map((d) => ({
                    id: d.id,
                    firstName: d.firstName,
                    lastName: d.lastName,
                }))
            )
        } else {
            ;(async () => {
                try {
                    const snap = await getDocs(getHospitalCollection(activeHospitalId, 'doctors'))
                    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[]
                    setDoctors(list.map((d) => ({ id: d.id, firstName: d.firstName, lastName: d.lastName })))
                } catch {
                    setDoctors([])
                }
            })()
        }

        // Prefer Branch Context; fallback fetch outside provider.
        if (branchContextProvided) {
            setBranches(contextBranches.map((b) => ({ id: b.id, name: b.name })))
        } else {
            ;(async () => {
                try {
                    const result = await fetchBranches(activeHospitalId)
                    if (result.success) {
                        setBranches(result.branches.map((b: Branch) => ({ id: b.id, name: b.name })))
                    }
                } catch {
                    // ignore
                }
            })()
        }
    }, [
        activeHospitalId,
        sharedHospitalData.isProvided,
        sharedHospitalData.doctors,
        branchContextProvided,
        contextBranches,
    ])

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    // Use pagination hook
    const {
        currentPage,
        pageSize,
        totalPages,
        paginatedItems: paginatedAppointments,
        goToPage,
        setPageSize,
    } = useTablePagination(filteredAppointments, {
        initialPageSize: 10,
        resetOnFilterChange: true,
    })

    const appointmentStatusVariant = (s: string): StatusVariant => {
        if (s === 'completed') return 'success'
        if (s === 'confirmed' || s === 'whatsapp_pending') return 'blue'
        if (s === 'cancelled' || s === 'doctor_cancelled') return 'danger'
        if (s === 'waiting') return 'warning'
        if (s === 'in_consultation') return 'purple'
        return 'neutral'
    }

    const updateAppointmentStatus = useCallback(
        async (appointmentId: string, status: string, successMsg: string) => {
            try {
                await updateDoc(doc(getHospitalCollection(activeHospitalId!, 'appointments'), appointmentId), {
                    status,
                    updatedAt: new Date().toISOString(),
                })
                setSuccessMessage(successMsg)
                setTimeout(() => setSuccessMessage(null), 2000)
            } catch (e) {
                setError((e as Error).message)
            }
        },
        [activeHospitalId]
    )

    /**
     * Unified cancellation: unpaid appointments cancel directly; paid appointments
     * require an explicit refund request (admin approves it later). Both go through
     * the shared /api/appointments/[id]/cancel engine, which also syncs billing
     * fields and releases the booked slot.
     */
    const handleCancelAppointment = useCallback(
        async (appointment: Appointment) => {
            try {
                if (isPaidForCancellation(appointment)) {
                    const policy = billingSettings.paidAppointmentCancellation

                    if (policy === 'disallow') {
                        setError('This appointment has already been paid and cannot be cancelled.')
                        return
                    }

                    if (policy === 'create_refund_request') {
                        if (!refundsEnabled) {
                            setError('This hospital does not provide refunds.')
                            return
                        }
                        const ok = confirm(
                            'This appointment has already been paid.\n\n' +
                            'Would you like to create a refund request?\n\n' +
                            'OK — Create Refund Request\n' +
                            'Cancel — Keep the appointment'
                        )
                        if (!ok) return
                        await authedFetchJson(
                            `/api/appointments/${appointment.id}/cancel`,
                            {
                                method: 'POST',
                                body: JSON.stringify({ hospitalId: activeHospitalId || null, action: 'request_refund' }),
                            },
                            'Failed to create refund request'
                        )
                        setSuccessMessage('Refund request created — approve it from the Overview tab to complete the cancellation.')
                        setTimeout(() => setSuccessMessage(null), 5000)
                        return
                    }

                    const confirmMessage =
                        policy === 'auto_refund'
                            ? 'This appointment is paid. Cancel and automatically process a refund?'
                            : 'This appointment is paid. Cancel and keep the payment (no refund)?'
                    if (!confirm(confirmMessage)) return
                    const result = await authedFetchJson<{ message?: string }>(
                        `/api/appointments/${appointment.id}/cancel`,
                        {
                            method: 'POST',
                            body: JSON.stringify({ hospitalId: activeHospitalId || null, action: 'cancel' }),
                        },
                        'Failed to cancel appointment'
                    )
                    setSuccessMessage(result.message || 'Appointment cancelled')
                    setTimeout(() => setSuccessMessage(null), 4000)
                    return
                }

                if (!confirm('Cancel this appointment?')) return
                await authedFetchJson(
                    `/api/appointments/${appointment.id}/cancel`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ hospitalId: activeHospitalId || null, action: 'cancel' }),
                    },
                    'Failed to cancel appointment'
                )
                setSuccessMessage('Appointment cancelled')
                setTimeout(() => setSuccessMessage(null), 3000)
            } catch (e) {
                setError((e as Error).message)
            }
        },
        [activeHospitalId, billingSettings.paidAppointmentCancellation, refundsEnabled]
    )

    const appointmentColumns: EnterpriseColumn<Appointment>[] = useMemo(
        () => [
            {
                key: 'patientName',
                header: 'Patient',
                width: 'w-[20%]',
                sortable: true,
                render: (appointment) => (
                    <AvatarCell
                        name={appointment.patientName || 'N/A'}
                        sub={appointment.patientPhone || undefined}
                        color="cyan"
                    />
                ),
            },
            {
                key: 'doctorName',
                header: 'Doctor',
                width: 'w-[16%]',
                sortable: true,
                hideBelow: 'sm',
                render: (appointment) => (
                    <AvatarCell
                        name={appointment.doctorName || 'N/A'}
                        sub={appointment.doctorSpecialization || undefined}
                        color="slate"
                        size="sm"
                    />
                ),
            },
            {
                key: 'appointmentDate',
                header: 'Date & Time',
                width: 'w-[12%]',
                sortable: true,
                render: (appointment) => (
                    <>
                        <p className="text-sm font-semibold text-slate-900">{formatDate(appointment.appointmentDate)}</p>
                        <p className="text-xs text-slate-400">{appointment.appointmentTime || '—'}</p>
                    </>
                ),
            },
            {
                key: 'visit',
                header: 'Visit',
                width: 'w-[7%]',
                hideBelow: 'lg',
                render: (appointment) => (
                    <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {getVisitType(appointment)}
                    </span>
                ),
            },
            {
                key: 'type',
                header: 'Type',
                width: 'w-[8%]',
                hideBelow: 'lg',
                render: (appointment) => (
                    <span className="text-xs text-slate-600">{getAppointmentType(appointment)}</span>
                ),
            },
            {
                key: 'status',
                header: 'Status',
                width: 'w-[10%]',
                hideBelow: 'md',
                render: (appointment) => {
                    const s = (appointment as any).status || ''
                    return (
                        <StatusPill
                            label={getStatusDisplayLabel(s)}
                            variant={appointmentStatusVariant(s)}
                        />
                    )
                },
            },
            {
                key: 'payment',
                header: 'Payment',
                width: 'w-[7%]',
                hideBelow: 'md',
                render: (appointment) => {
                    const payLabel = getPaymentStatusLabel(appointment)
                    const payCls =
                        payLabel === 'Paid'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : payLabel === 'Refunded'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                    return (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${payCls}`}>
                            {payLabel}
                        </span>
                    )
                },
            },
            {
                key: 'amount',
                header: 'Amount',
                width: 'w-[7%]',
                hideBelow: 'md',
                render: (appointment) => (
                    <span className="text-sm font-bold text-slate-900">
                        ₹{Number(appointment.paymentAmount || 0).toLocaleString('en-IN')}
                    </span>
                ),
            },
        ],
        []
    )

    const appointmentRowActions: EnterpriseRowAction<Appointment>[] = useMemo(
        () => [
            {
                label: 'Check-in patient',
                hidden: (a) => {
                    const s = (a as any).status
                    return !(s === 'pending' || s === 'confirmed' || s === 'whatsapp_pending')
                },
                onClick: (a) => updateAppointmentStatus(a.id, 'waiting', 'Checked in'),
            },
            {
                label: 'Start consultation',
                hidden: (a) => (a as any).status !== 'waiting',
                onClick: (a) => updateAppointmentStatus(a.id, 'in_consultation', 'Consultation started'),
            },
            {
                label: 'Complete visit',
                variant: 'success',
                hidden: (a) => {
                    const s = (a as any).status
                    return !(s === 'in_consultation' || s === 'waiting' || s === 'confirmed')
                },
                onClick: (a) => updateAppointmentStatus(a.id, 'completed', 'Visit completed'),
            },
            {
                label: 'Cancel appointment',
                variant: 'danger',
                hidden: (a) => {
                    const s = (a as any).status
                    return s === 'cancelled' || s === 'doctor_cancelled' || s === 'completed' || s === 'refund_requested'
                },
                onClick: (a) => handleCancelAppointment(a),
            },
            {
                label: 'Mark not attended',
                variant: 'warning',
                hidden: (a) => !canMarkNotAttended(a),
                onClick: (a) => handleMarkNotAttended(a),
            },
            {
                label: 'Delete record',
                onClick: (a) => handleDelete(a),
            },
        ],
        [updateAppointmentStatus, handleCancelAppointment]
    )

    const appointmentBulkActions: EnterpriseBulkAction<Appointment>[] = useMemo(
        () => [
            {
                label: 'Mark Completed',
                variant: 'success',
                onClick: () => handleBulkComplete(),
            },
            {
                label: 'Cancel',
                variant: 'danger',
                onClick: () => handleBulkCancel(),
            },
        ],
        []
    )

    // Protect component - only allow admins (moved after all hooks)
    if (authLoading) {
        return <TabSkeleton variant="table" />
    }

    if (!user) {
        return null
    }

    // When disableAdminGuard=true, verify user is admin or receptionist
    if (disableAdminGuard && user.role !== "admin" && user.role !== "receptionist") {
        return (
            <div className="text-center py-12">
                <p className="text-red-600">Access denied. Admin or receptionist privileges required.</p>
            </div>
        )
    }

    const content = (
        <div className="relative">
            {/* Success Notification */}
            {successMessage && (
                <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                {/* ── Workspace Header ── */}
                <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="rx-section-title">Appointment Workspace</p>
                        <p className="rx-section-subtitle">Manage appointments, follow-ups, walk-ins and patient visits</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <span className="hidden text-xs text-slate-400 sm:inline">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live Sync
                            {lastUpdatedDisplay && <span className="hidden text-emerald-600 md:inline"> · {lastUpdatedDisplay}</span>}
                        </div>
                        <div className="relative">
                            <button type="button" onClick={() => setExportOpen(!exportOpen)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Export
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {exportOpen && (
                                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                                    <button type="button" onClick={exportCSV} className="block w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50">Export CSV</button>
                                    <button type="button" onClick={exportExcel} className="block w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50">Export Excel</button>
                                    <button type="button" onClick={printReport} className="block w-full px-4 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50">Print Report</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Today's KPI Cards ── */}
                <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 xl:grid-cols-5">
                    {([
                        { label: "Today's Appointments", value: todayAnalytics.todayTotal, iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'text-cyan-600', bg: 'bg-cyan-50', topBorder: 'border-t-2 border-t-cyan-500' },
                        { label: 'Completed', value: todayAnalytics.completed, iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-emerald-600', bg: 'bg-emerald-50', topBorder: 'border-t-2 border-t-emerald-500' },
                        { label: 'Waiting', value: todayAnalytics.waiting, iconPath: 'M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z', color: 'text-amber-600', bg: 'bg-amber-50', topBorder: 'border-t-2 border-t-amber-400' },
                        { label: 'Cancelled', value: todayAnalytics.cancelled, iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-red-600', bg: 'bg-red-50', topBorder: 'border-t-2 border-t-red-500' },
                        { label: 'Revenue Today', value: `₹${todayAnalytics.revenueToday.toLocaleString('en-IN')}`, iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-teal-600', bg: 'bg-teal-50', topBorder: 'border-t-2 border-t-teal-500' },
                    ] as const).map((kpi) => (
                        <div key={kpi.label} className={`flex items-start gap-3 bg-white px-5 py-4 transition-colors hover:bg-slate-50/60 ${kpi.topBorder}`}>
                            <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${kpi.bg}`}>
                                <svg className={`h-4 w-4 ${kpi.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={kpi.iconPath} />
                                </svg>
                            </div>
                            <div>
                                <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
                                <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{kpi.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-4 px-6 py-5">
                    {/* ── Filter Toolbar ── */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                            >
                                <option value="all">All Doctors</option>
                                {doctors.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {`${d.firstName || ''} ${d.lastName || ''}`.trim() || d.id}
                                    </option>
                                ))}
                            </select>
                            <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                            >
                                <option value="all">Last 12 months</option>
                                <option value="today">Today</option>
                                <option value="last10">Last 10 days</option>
                                <option value="month">This month</option>
                                <option value="year">This year</option>
                            </select>
                            {branches.length > 0 && !receptionistBranchId && (
                                <select value={effectiveSelectedBranchId} onChange={() => {}} disabled
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:opacity-50"
                                >
                                    <option value="all">All Branches</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            )}
                            <div className="relative flex-1 min-w-[200px]">
                                <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search patients, doctors, ID, phone… (Ctrl+K)"
                                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                                />
                            </div>
                            <button type="button" onClick={resetFilters}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Reset
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-1">
                                {statusTabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setStatusFilter(tab.key)}
                                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                            statusFilter === tab.key
                                                ? 'bg-cyan-600 text-white shadow-sm'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {tab.label}
                                        {tab.count > 0 && (
                                            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${statusFilter === tab.key ? 'bg-cyan-500 text-white' : 'bg-slate-300 text-slate-700'}`}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="shrink-0 text-xs text-slate-400">
                                {filteredAppointments.length.toLocaleString()} appointment{filteredAppointments.length === 1 ? '' : 's'}
                                {(search || statusFilter !== 'all') && ' found'}
                            </p>
                        </div>
                    </div>

                    <EnterpriseDataTable
                        data={paginatedAppointments}
                        columns={appointmentColumns}
                        loading={loading && appointments.length === 0}
                        loadingVariant="skeleton"
                        loadingMessage="Loading appointments…"
                        error={error}
                        emptyTitle={search ? 'No appointments found' : 'No appointments yet'}
                        emptyDescription={
                            search
                                ? "We couldn't find any appointments matching your search criteria. Try adjusting your filters or search terms."
                                : 'There are no appointments in the system yet. Appointments will appear here once they are created.'
                        }
                        emptyAction={search ? { label: 'Clear Filters', onClick: resetFilters } : undefined}
                        toolbar={
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-slate-900">Appointment Records</span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{filteredAppointments.length}</span>
                                </div>
                            </div>
                        }
                        enableSearch={false}
                        enableFilters={false}
                        selectable
                        selectedIds={selectedIds}
                        onToggleRow={toggleSelect}
                        onToggleAll={toggleSelectAllPage}
                        onClearSelection={() => setSelectedIds(new Set())}
                        bulkActions={appointmentBulkActions}
                        processingBulk={processingBulk}
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        getRowClassName={(appointment) =>
                            isNew(appointment) ? 'bg-yellow-50/50 border-l-4 border-yellow-400' : ''
                        }
                        primaryAction={{
                            label: 'View',
                            icon: (
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            ),
                            onClick: handleView,
                        }}
                        rowActions={appointmentRowActions}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        totalItems={filteredAppointments.length}
                        onPageChange={goToPage}
                        onPageSizeChange={setPageSize}
                        pageSizeOptions={[10, 15, 20]}
                        showPageSize
                        itemLabel="appointments"
                        minWidth="min-w-[760px]"
                    />
                </div>
            </div>

            {/* Appointment Details Modal — same clinical overview pattern as Patient Profile */}
            <ViewModal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                title="Appointment Profile"
                subtitle="Clinical overview"
                headerColor="blue"
            >
                <div className="space-y-5">
                    {(() => {
                        const apt = selectedAppointment
                        if (!apt) return null
                        const s = (apt as any).status || ''
                        const statusLabel = getStatusDisplayLabel(s)
                        const statusCls =
                            s === 'completed'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : s === 'confirmed' || s === 'whatsapp_pending'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : s === 'cancelled' || s === 'doctor_cancelled'
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                    : s === 'waiting'
                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                      : s === 'in_consultation'
                                        ? 'border-purple-200 bg-purple-50 text-purple-700'
                                        : 'border-slate-200 bg-slate-100 text-slate-500'
                        const nameParts = (apt.patientName || 'N/A').trim().split(' ')
                        const initials =
                            nameParts.length >= 2
                                ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
                                : (apt.patientName || 'N').charAt(0).toUpperCase()
                        const payLabel = getPaymentStatusLabel(apt)
                        return (
                            <>
                                <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-xl font-bold text-cyan-700">
                                        {initials}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">{apt.patientName || 'N/A'}</h3>
                                                <p className="mt-0.5 text-xs text-slate-400">
                                                    with {apt.doctorName || 'Doctor TBD'}
                                                    {apt.doctorSpecialization ? ` · ${apt.doctorSpecialization}` : ''}
                                                </p>
                                            </div>
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusCls}`}>
                                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                {statusLabel}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                                                {formatDate(apt.appointmentDate)}
                                                {apt.appointmentTime ? ` · ${apt.appointmentTime}` : ''}
                                            </span>
                                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                                                {getVisitType(apt)}
                                            </span>
                                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                                                {getAppointmentType(apt)}
                                            </span>
                                            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold ${
                                                payLabel === 'Paid'
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : payLabel === 'Refunded'
                                                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                      : 'border-slate-200 bg-white text-slate-700'
                                            }`}>
                                                {payLabel} · ₹{Number(apt.paymentAmount || 0).toLocaleString('en-IN')}
                                            </span>
                                            {apt.patientPhone && (
                                                <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                                                    <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                    {apt.patientPhone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Patient</p>
                                        <div className="grid grid-cols-1 gap-3 text-sm">
                                            <div>
                                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Name</p>
                                                <p className="text-slate-800">{apt.patientName || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Email</p>
                                                <p className="text-slate-800">{apt.patientEmail || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Phone</p>
                                                <p className="text-slate-800">{apt.patientPhone || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Doctor & Visit</p>
                                        <div className="grid grid-cols-1 gap-3 text-sm">
                                            <div>
                                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Doctor</p>
                                                <p className="text-slate-800">{apt.doctorName || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Specialization</p>
                                                <p className="text-slate-800">{apt.doctorSpecialization || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Consultation Fee</p>
                                                <p className="text-slate-800">₹{apt.totalConsultationFee || 0}</p>
                                            </div>
                                            <div>
                                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Branch</p>
                                                <p className="text-slate-800">
                                                    {(apt as any)?.branchName
                                                        ? `${(apt as any).branchName}`
                                                        : 'Not assigned'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Clinical Notes</p>
                                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Chief Complaint</p>
                                            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-800">
                                                {apt.chiefComplaint || '—'}
                                            </p>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Associated Symptoms</p>
                                            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-800">
                                                {apt.associatedSymptoms || '—'}
                                            </p>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Medical History</p>
                                            <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-800">
                                                {apt.medicalHistory || '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                    <DocumentListCompact
                                        patientId={apt.patientId}
                                        patientUid={apt.patientUid}
                                        appointmentId={apt.id}
                                        title="Documents"
                                        maxItems={5}
                                    />
                                </div>

                                {(apt as any).finalDiagnosis && (
                                    <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
                                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-cyan-700">Final Diagnosis</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(apt as any).finalDiagnosis.map((diagnosis: string, index: number) => (
                                                <span
                                                    key={index}
                                                    className="inline-flex items-center rounded-lg border border-cyan-200 bg-white px-3 py-1.5 text-sm font-medium text-cyan-800"
                                                >
                                                    {diagnosis}
                                                </span>
                                            ))}
                                        </div>
                                        {(apt as any).customDiagnosis && (
                                            <p className="mt-3 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-800">
                                                {(apt as any).customDiagnosis}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <PrescriptionDisplay
                                    appointment={apt}
                                    variant="modal"
                                    showPdfButton={true}
                                />

                                {apt.whatsappPending && (apt as any).whatsappNotes && (
                                    <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-700">WhatsApp Notes</p>
                                        <p className="whitespace-pre-line rounded-lg border border-orange-100 bg-white px-3 py-2 text-sm text-slate-800">
                                            {(apt as any).whatsappNotes}
                                        </p>
                                    </div>
                                )}

                                <details className="group">
                                    <summary className="flex cursor-pointer list-none select-none items-center gap-2 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600">
                                        <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        System Information
                                    </summary>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                                        {[
                                            { label: 'Appointment ID', value: apt.id || '—', mono: true },
                                            { label: 'Status', value: statusLabel, mono: false },
                                            { label: 'Created', value: formatDateTime(apt.createdAt || ''), mono: false },
                                            { label: 'Last updated', value: formatDateTime(apt.updatedAt || ''), mono: false },
                                        ].map(({ label, value, mono }) => (
                                            <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                                                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                                                <p className={`truncate text-slate-700 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </>
                        )
                    })()}
                </div>
            </ViewModal>

            {/* Delete Confirmation Modal */}
            <DeleteModal isOpen={deleteModal}
                onClose={() => setDeleteModal(false)}  onConfirm={handleDeleteConfirm}
                title="Delete Appointment"  subtitle="This action cannot be undone"  itemType="appointment"
                itemDetails={{
                    name: deleteAppointment?.patientName || 'N/A',
                    email: deleteAppointment?.patientEmail,
                    phone: deleteAppointment?.patientPhone,
                    specialization: deleteAppointment?.doctorSpecialization,
                    id: deleteAppointment?.id || '',
                    doctor: deleteAppointment?.doctorName,
                    date: formatDate(deleteAppointment?.appointmentDate || ''),
                    time: deleteAppointment?.appointmentTime,
                    status: deleteAppointment?.status
                }}
                loading={loading}
            />
        </div>
    )

    if (disableAdminGuard) {
        return content
    }

    return (
        <AdminProtected>
            {content}
        </AdminProtected>
    )
}