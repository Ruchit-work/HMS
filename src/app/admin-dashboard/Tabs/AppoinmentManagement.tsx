'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useDebounce } from '@/hooks/useDebounce'
import { getDocs, doc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { getHospitalCollection } from '@/utils/firebase/hospital-queries'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import { InlineSpinner } from '@/components/ui/feedback/StatusComponents'
import EmptyState from '@/components/ui/feedback/EmptyState'
import AdminProtected from '@/components/AdminProtected'
import { ViewModal, DeleteModal } from '@/components/ui/overlays/Modals'
import { Appointment } from '@/types/patient'
import { Branch } from '@/types/branch'
import { SuccessToast } from '@/components/ui/feedback/StatusComponents'
import { formatDate, formatDateTime } from '@/utils/shared/date'
import { useTablePagination } from '@/hooks/useTablePagination'
import Pagination from '@/components/ui/navigation/Pagination'
import { Button } from '@/components/ui/Button'
import { FilterChip } from '@/components/ui/FilterChip'
import { TableShell } from '@/components/ui/layout/TableShell'
import { StatusPill, AvatarCell } from '@/components/ui/data/DataTable'
import { useNewItems } from '@/hooks/useNewItems'
import PrescriptionDisplay from '@/components/prescription/PrescriptionDisplay'
import DocumentListCompact from '@/components/documents/DocumentListCompact'
import ExcelJS from 'exceljs'

interface AppoinmentManagementProps {
    disableAdminGuard?: boolean
    /** When provided (receptionist dashboard), restrict view to this branch */
    receptionistBranchId?: string | null
    /** When provided (admin dashboard), filter appointments by this branch */
    selectedBranchId?: string
}

export default function AppoinmentManagement({
    disableAdminGuard = true,
    receptionistBranchId = null,
    selectedBranchId = "all"
}: AppoinmentManagementProps = {}) {
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 300)
    const { user, loading: authLoading } = useAuth()
    const { activeHospitalId } = useMultiHospital()
    const { isNew } = useNewItems('admin-appointments')
    const [sortField, setSortField] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all')
    const [timeRange, setTimeRange] = useState<'all' | 'today' | 'last10' | 'month' | 'year'>('all')
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
    // Use prop if provided (from admin dashboard), otherwise use local state (for backward compatibility)
    const [localSelectedBranchId, setLocalSelectedBranchId] = useState<string>('all')
    const effectiveSelectedBranchId = selectedBranchId !== undefined ? selectedBranchId : localSelectedBranchId
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [processingBulk, setProcessingBulk] = useState(false)
    const [exportOpen, setExportOpen] = useState(false)
    const [openActionId, setOpenActionId] = useState<string | null>(null)
    const [actionMenuAnchor, setActionMenuAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
    useEffect(() => {
        if (!openActionId) return
        const close = () => {
            setOpenActionId(null)
            setActionMenuAnchor(null)
        }
        document.addEventListener('click', close)
        return () => document.removeEventListener('click', close)
    }, [openActionId])

    useEffect(() => {
        if (!openActionId) return
        const close = () => {
            setOpenActionId(null)
            setActionMenuAnchor(null)
        }
        window.addEventListener('scroll', close, true)
        window.addEventListener('resize', close)
        return () => {
            window.removeEventListener('scroll', close, true)
            window.removeEventListener('resize', close)
        }
    }, [openActionId])

    const resetFilters = () => {
        setSelectedDoctorId('all')
        setTimeRange('all')
        setStatusFilter('all')
        setLocalSelectedBranchId('all')
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
            .filter((a) => a.status === 'completed')
            .reduce((s, a) => s + (a.paymentAmount || 0), 0)
        return {
            todayTotal: todayAppointments.length,
            completed,
            waiting,
            cancelled,
            revenueToday
        }
    }, [appointments, todayStr])

    const metrics = useMemo(() => {
        const parseDate = (value?: string) => {
            if (!value) return null
            const date = new Date(value)
            if (Number.isNaN(date.getTime())) return null
            date.setHours(0, 0, 0, 0)
            return date
        }

        const now = new Date()
        const startOfToday = new Date(now)
        startOfToday.setHours(0, 0, 0, 0)

        const upcoming = appointments.filter((appointment) => {
            const date = parseDate(appointment.appointmentDate)
            if (!date) return false
            const status = (appointment as any).status
            return (status === 'confirmed' || status === 'resrescheduled') && date >= startOfToday
        }).length

        const completedThisMonth = appointments.filter((appointment) => {
            const status = (appointment as any).status
            if (status !== 'completed') return false
            const date = parseDate(appointment.appointmentDate)
            if (!date) return false
            return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
        }).length

        return {
            total: appointments.length,
            upcoming,
            completedThisMonth,
            cancelled: statusCounts.cancelled
        }
    }, [appointments, statusCounts.cancelled])

    const summaryCards = useMemo(() => ([
        {
            title: 'Total Appointments',
            value: metrics.total.toLocaleString(),
            caption: `${filteredAppointments.length.toLocaleString()} showing with current filters`,
            icon: (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </span>
            )
        },
        {
            title: 'Upcoming Visits',
            value: metrics.upcoming.toLocaleString(),
            caption: 'Confirmed or rescheduled from today onward',
            icon: (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z" />
                    </svg>
                </span>
            )
        },
        {
            title: 'Completed This Month',
            value: metrics.completedThisMonth.toLocaleString(),
            caption: `${statusCounts.completed.toLocaleString()} completed overall`,
            icon: (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </span>
            )
        }
    ]), [filteredAppointments.length, metrics, statusCounts.completed])

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
            for (const apt of selectedAppointments) {
                if (apt.status === 'cancelled') continue
                const ref = doc(getHospitalCollection(activeHospitalId!, 'appointments'), apt.id)
                await updateDoc(ref, { status: 'cancelled', updatedAt: new Date().toISOString() })
            }
            setSuccessMessage(`Cancelled ${selectedAppointments.length} appointment(s)`)
            setSelectedIds(new Set())
            setTimeout(() => setSuccessMessage(null), 3000)
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
            setLoading(true)
            setError(null)
            const appointmentsRef = getHospitalCollection(activeHospitalId, 'appointments')
            
            const unsubscribe = onSnapshot(appointmentsRef, (snapshot) => {
                let appointmentsList = snapshot.docs
                    .map((doc) => ({
                        id: doc.id,
                        ...doc.data()
                    })) as Appointment[]
                
                // When used from receptionist dashboard, restrict to their branch
                // Also show appointments with null branchId (e.g., WhatsApp bookings without branch assignment)
                if (receptionistBranchId) {
                    appointmentsList = appointmentsList.filter(apt => {
                        const aptBranchId = (apt as any).branchId
                        return aptBranchId === receptionistBranchId || aptBranchId === null || aptBranchId === undefined
                    })
                }

                // Additional branch filter from admin UI
                if (!receptionistBranchId && effectiveSelectedBranchId !== 'all') {
                    appointmentsList = appointmentsList.filter(apt => apt.branchId === effectiveSelectedBranchId)
                }
                
                // Sort by newest first (createdAt descending, fallback to updatedAt)
                appointmentsList = appointmentsList.sort((a, b) => {
                    const aDate = a.createdAt || a.updatedAt || ''
                    const bDate = b.createdAt || b.updatedAt || ''
                    if (aDate < bDate) return 1
                    if (aDate > bDate) return -1
                    return 0
                })
                
                setAppointments(appointmentsList)
                setLastUpdated(new Date())
                setLoading(false)
            }, (error) => {

                setError(error.message)
                setLoading(false)
            })
            
            return unsubscribe
        } catch (error) {

            setError((error as Error).message)
            setLoading(false)
            return () => {}
        }
    }, [activeHospitalId, receptionistBranchId, effectiveSelectedBranchId])
    useEffect(() => {
        let unsubscribeAppointments: (() => void) | null = null

        // Set up real-time listener for appointments
        unsubscribeAppointments = setupRealtimeListener()
        
        // Fetch limited doctors list for dropdown (active doctors) - use hospital-scoped collection
        ;(async () => {
            if (!activeHospitalId) return
            try {
                const snap = await getDocs(getHospitalCollection(activeHospitalId, 'doctors'))
                const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[]
                const mapped = list.map(d => ({ id: d.id, firstName: d.firstName, lastName: d.lastName }))
                setDoctors(mapped)
            } catch {
                setDoctors([])
            }
        })()

        // Fetch branches
        ;(async () => {
            if (!activeHospitalId) return
            try {
                const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`)
                const data = await response.json()
                if (data.success && data.branches) {
                    setBranches(data.branches.map((b: Branch) => ({ id: b.id, name: b.name })))
                }
            } catch {

            }
        })()

        // Cleanup function
        return () => {
            if (unsubscribeAppointments) {
                unsubscribeAppointments()
            }
        }
    }, [activeHospitalId, user, authLoading, setupRealtimeListener, effectiveSelectedBranchId])

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

    // Protect component - only allow admins (moved after all hooks)
    if (authLoading) {
        return <LoadingSpinner message="Loading appointment management..." />
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
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="last10">Last 10 days</option>
                                <option value="month">This month</option>
                                <option value="year">This year</option>
                            </select>
                            {branches.length > 0 && !receptionistBranchId && (
                                <select value={effectiveSelectedBranchId} onChange={(e) => setLocalSelectedBranchId(e.target.value)} disabled={selectedBranchId !== undefined}
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

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">Appointment Records</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{filteredAppointments.length}</span>
                            </div>
                        </div>
                        {selectedIds.size > 0 && (
                            <div className="flex flex-wrap items-center gap-3 border-b border-amber-100 bg-amber-50/80 px-4 py-2 text-sm">
                                <span className="font-medium text-amber-800">{selectedIds.size} selected</span>
                                <Button type="button" variant="success" size="sm" onClick={handleBulkComplete} disabled={processingBulk}>Mark Completed</Button>
                                <Button type="button" variant="danger" size="sm" onClick={handleBulkCancel} disabled={processingBulk}>Cancel</Button>
                                <Button type="button" variant="link" size="sm" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
                            </div>
                        )}
                        <TableShell className="rounded-none border-0 shadow-none">
                            <table className="w-full min-w-[760px] table-fixed">
                                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white">
                                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        <th className="w-[3%] max-w-[40px] px-3 py-3.5 text-left">
                                            <input type="checkbox" checked={paginatedAppointments.length > 0 && selectedIds.size === paginatedAppointments.length} onChange={toggleSelectAllPage} className="rounded border-slate-300" />
                                        </th>
                                        <th className="w-[20%] cursor-pointer px-3 py-3.5 text-left hover:text-slate-600" onClick={() => handleSort('patientName')}>
                                            Patient {sortField === 'patientName' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                        </th>
                                        <th className="hidden w-[16%] cursor-pointer px-3 py-3.5 text-left hover:text-slate-600 sm:table-cell" onClick={() => handleSort('doctorName')}>
                                            Doctor {sortField === 'doctorName' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                        </th>
                                        <th className="w-[12%] cursor-pointer px-3 py-3.5 text-left hover:text-slate-600" onClick={() => handleSort('appointmentDate')}>
                                            Date &amp; Time {sortField === 'appointmentDate' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                        </th>
                                        <th className="hidden w-[7%] px-3 py-3.5 text-left lg:table-cell">Visit</th>
                                        <th className="hidden w-[8%] px-3 py-3.5 text-left lg:table-cell">Type</th>
                                        <th className="hidden w-[10%] px-3 py-3.5 text-left md:table-cell">Status</th>
                                        <th className="hidden w-[7%] px-3 py-3.5 text-left md:table-cell">Payment</th>
                                        <th className="hidden w-[7%] px-3 py-3.5 text-left md:table-cell">Amount</th>
                                        <th className="w-[10%] min-w-[88px] px-3 py-3.5 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={10} className="px-3 py-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    <InlineSpinner size="md" />
                                                    <p className="mt-2 text-sm text-slate-500">Loading appointments…</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan={10} className="px-3 py-12 text-center">
                                                <svg className="mb-2 h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                </svg>
                                                <p className="text-sm font-semibold text-red-600">Error loading appointments</p>
                                                <p className="text-xs text-slate-500">{error}</p>
                                            </td>
                                        </tr>
                                    ) : filteredAppointments.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-3 py-8">
                                                <EmptyState
                                                    illustration="appointments"
                                                    title={search ? 'No appointments found' : 'No appointments yet'}
                                                    description={search 
                                                        ? "We couldn't find any appointments matching your search criteria. Try adjusting your filters or search terms."
                                                        : "There are no appointments in the system yet. Appointments will appear here once they are created."}
                                                    action={search ? {
                                                        label: "Clear Filters",
                                                        onClick: resetFilters
                                                    } : undefined}
                                                />
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedAppointments.map((appointment) => {
                                            const itemIsNew = isNew(appointment)
                                            const nameParts = (appointment.patientName || 'N/A').trim().split(' ')
                                            const initials = nameParts.length >= 2
                                                ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
                                                : (appointment.patientName || 'N').charAt(0).toUpperCase()
                                            const docParts = (appointment.doctorName || '').trim().split(' ')
                                            const docInitials = docParts.length >= 2
                                                ? (docParts[0].charAt(0) + docParts[docParts.length - 1].charAt(0)).toUpperCase()
                                                : (appointment.doctorName || 'D').charAt(0).toUpperCase()
                                            const s = (appointment as any).status || ''
                                            const statusLabel = getStatusDisplayLabel(s)
                                            const statusCls = s === 'completed'
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                : s === 'confirmed' || s === 'whatsapp_pending'
                                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                : s === 'cancelled' || s === 'doctor_cancelled'
                                                ? 'bg-red-100 text-red-700 border border-red-200'
                                                : s === 'not_attended' || s === 'no_show'
                                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                                : s === 'pending'
                                                ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                                : s === 'waiting'
                                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                : s === 'in_consultation'
                                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                                            const payLabel = getPaymentStatusLabel(appointment)
                                            const payCls = payLabel === 'Paid'
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                : payLabel === 'Refunded'
                                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                                            return (
                                        <tr key={appointment.id}
                                                className={`transition-colors ${
                                                    itemIsNew
                                                        ? 'bg-yellow-50/50 border-l-4 border-yellow-400'
                                                        : 'hover:bg-slate-50/70'
                                                }`}
                                            >
                                                <td className="w-[3%] max-w-[40px] px-3 py-4 align-middle">
                                                    <input type="checkbox" checked={selectedIds.has(appointment.id)} onChange={() => toggleSelect(appointment.id)} className="rounded border-slate-300" aria-label={`Select ${appointment.patientName || 'appointment'}`} />
                                                </td>
                                                <td className="w-[20%] px-3 py-4">
                                                    <AvatarCell
                                                        name={appointment.patientName || 'N/A'}
                                                        sub={appointment.patientPhone || undefined}
                                                        color="cyan"
                                                    />
                                                </td>
                                                <td className="hidden w-[16%] px-3 py-4 sm:table-cell">
                                                    <AvatarCell
                                                        name={appointment.doctorName || 'N/A'}
                                                        sub={appointment.doctorSpecialization || undefined}
                                                        color="slate"
                                                        size="sm"
                                                    />
                                                </td>
                                                <td className="w-[12%] px-3 py-4">
                                                    <p className="text-sm font-semibold text-slate-900">{formatDate(appointment.appointmentDate)}</p>
                                                    <p className="text-xs text-slate-400">{appointment.appointmentTime || '—'}</p>
                                                </td>
                                                <td className="hidden w-[7%] px-3 py-4 lg:table-cell">
                                                    <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{getVisitType(appointment)}</span>
                                                </td>
                                                <td className="hidden w-[8%] px-3 py-4 lg:table-cell">
                                                    <span className="text-xs text-slate-600">{getAppointmentType(appointment)}</span>
                                                </td>
                                                <td className="hidden w-[10%] px-3 py-4 md:table-cell">
                                                    <StatusPill
                                                        label={statusLabel}
                                                        variant={
                                                            s === 'completed' ? 'success'
                                                            : s === 'confirmed' || s === 'whatsapp_pending' ? 'blue'
                                                            : s === 'cancelled' || s === 'doctor_cancelled' ? 'danger'
                                                            : s === 'waiting' ? 'warning'
                                                            : s === 'in_consultation' ? 'purple'
                                                            : 'neutral'
                                                        }
                                                    />
                                                </td>
                                                <td className="hidden w-[7%] px-3 py-4 md:table-cell">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${payCls}`}>{payLabel}</span>
                                                </td>
                                                <td className="hidden w-[7%] px-3 py-4 md:table-cell">
                                                    <span className="text-sm font-bold text-slate-900">₹{Number(appointment.paymentAmount || 0).toLocaleString('en-IN')}</span>
                                                </td>
                                                <td className="w-[10%] min-w-[88px] px-3 py-4">
                                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <button type="button" onClick={() => handleView(appointment)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                            View
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                if (openActionId === appointment.id) {
                                                                    setOpenActionId(null)
                                                                    setActionMenuAnchor(null)
                                                                } else {
                                                                    const rect = e.currentTarget.getBoundingClientRect()
                                                                    setActionMenuAnchor({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
                                                                    setOpenActionId(appointment.id)
                                                                }
                                                            }}
                                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                                            aria-label="More actions"
                                                        >
                                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </TableShell>

                        <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                pageSize={pageSize}
                                totalItems={filteredAppointments.length}
                                onPageChange={goToPage}
                                onPageSizeChange={setPageSize}
                                pageSizeOptions={[10, 15, 20]}
                                showPageSizeSelector={true}
                                itemLabel="appointments"
                            />
                    </div>
                </div>
            </div>

            {/* Appointment Details Modal */}
            <ViewModal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                title="Appointment Details"
                subtitle="Complete appointment information"
                headerColor="blue"
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                    {/* Patient Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">Patient Information</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient Name</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.patientName || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient Email</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.patientEmail || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient Phone</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.patientPhone || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Doctor Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">Doctor Information</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Doctor Name</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.doctorName || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialization</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.doctorSpecialization || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consultation Fee</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">₹{selectedAppointment?.totalConsultationFee || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* Appointment Details */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">Appointment Details</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Appointment Date</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDate(selectedAppointment?.appointmentDate || '')}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Appointment Time</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.appointmentTime || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Branch</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                                    {(selectedAppointment as any)?.branchName
                                      ? `${(selectedAppointment as any).branchName} (${(selectedAppointment as any).branchId || "no id"})`
                                      : "Not assigned"}
                                </p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                    selectedAppointment?.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    selectedAppointment?.status === 'confirmed' ? 'bg-cyan-100 text-cyan-800' :
                                    selectedAppointment?.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {selectedAppointment?.status || 'N/A'}
                                </span>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Amount</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">₹{selectedAppointment?.paymentAmount || 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* Documents Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <DocumentListCompact
                            patientId={selectedAppointment?.patientId}
                            patientUid={selectedAppointment?.patientUid}
                            appointmentId={selectedAppointment?.id}
                            title="Appointment Documents"
                            maxItems={5}
                        />
                    </div>

                    {/* Medical Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">Medical Information</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Chief Complaint</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.chiefComplaint || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Associated Symptoms</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.associatedSymptoms || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Medical History</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedAppointment?.medicalHistory || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Final Diagnosis - View-only for receptionist/admin */}
                    {selectedAppointment && (selectedAppointment as any).finalDiagnosis && (
                        <div className="bg-white rounded-lg shadow-sm border border-cyan-200 p-4 sm:p-6">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h4 className="text-base sm:text-lg font-semibold text-gray-900">Final Diagnosis</h4>
                            </div>
                            <div className="space-y-3">
                                <div className="flex flex-col space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diagnoses</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(selectedAppointment as any).finalDiagnosis.map((diagnosis: string, index: number) => (
                                            <span
                                                key={index}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-lg text-sm font-medium text-cyan-800"
                                            >
                                                {diagnosis}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {(selectedAppointment as any).customDiagnosis && (
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Diagnosis</label>
                                        <p className="text-sm font-medium text-gray-900 bg-cyan-50 border border-cyan-200 px-3 py-2 rounded-md">
                                            {(selectedAppointment as any).customDiagnosis}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Prescription & Notes - Only for completed appointments */}
                    {selectedAppointment && (
                        <PrescriptionDisplay 
                            appointment={selectedAppointment} 
                            variant="modal"
                            showPdfButton={true}
                        />
                    )}

                    {/* WhatsApp Notes - If available */}
                    {selectedAppointment?.whatsappPending && (selectedAppointment as any).whatsappNotes && (
                        <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-4 sm:p-6">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                                <h4 className="text-base sm:text-lg font-semibold text-gray-900">WhatsApp Notes</h4>
                            </div>
                            <div className="space-y-4">
                                <div className="flex flex-col space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Initial Message/Notes</label>
                                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md whitespace-pre-line">
                                        {(selectedAppointment as any).whatsappNotes || 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* System Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 lg:col-span-2">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                            </div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">System Information</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Appointment ID</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md font-mono">{selectedAppointment?.id}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created At</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDateTime(selectedAppointment?.createdAt || '')}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Updated At</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDateTime(selectedAppointment?.updatedAt || '')}</p>
                            </div>
                        </div>
                    </div>
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
            {typeof document !== 'undefined' && document.body && openActionId && actionMenuAnchor && (() => {
                const appointment = paginatedAppointments.find(a => a.id === openActionId)
                if (!appointment) return null
                const closeMenu = () => {
                    setOpenActionId(null)
                    setActionMenuAnchor(null)
                }
                const dropdownW = 192
                const top = actionMenuAnchor.top + actionMenuAnchor.height + 4
                const left = Math.max(8, Math.min(actionMenuAnchor.left + actionMenuAnchor.width - dropdownW, window.innerWidth - dropdownW - 8))
                return createPortal(
                    <div
                        className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
                        style={{ top, left }}
                        onClick={(e) => e.stopPropagation()}
                        role="menu"
                    >
                        <div className="border-b border-slate-100 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Actions</p>
                        </div>
                        {((appointment as any).status === 'pending' || (appointment as any).status === 'confirmed' || (appointment as any).status === 'whatsapp_pending') && (
                            <button type="button" role="menuitem" onClick={async () => { try { await updateDoc(doc(getHospitalCollection(activeHospitalId!, 'appointments'), appointment.id), { status: 'waiting', updatedAt: new Date().toISOString() }); setSuccessMessage('Checked in'); closeMenu(); setTimeout(() => setSuccessMessage(null), 2000); } catch (e) { setError((e as Error).message); } }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Check-in patient
                            </button>
                        )}
                        {(appointment as any).status === 'waiting' && (
                            <button type="button" role="menuitem" onClick={async () => { try { await updateDoc(doc(getHospitalCollection(activeHospitalId!, 'appointments'), appointment.id), { status: 'in_consultation', updatedAt: new Date().toISOString() }); setSuccessMessage('Consultation started'); closeMenu(); setTimeout(() => setSuccessMessage(null), 2000); } catch (e) { setError((e as Error).message); } }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                                <svg className="h-4 w-4 shrink-0 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                Start consultation
                            </button>
                        )}
                        {((appointment as any).status === 'in_consultation' || (appointment as any).status === 'waiting' || (appointment as any).status === 'confirmed') && (
                            <button type="button" role="menuitem" onClick={async () => { try { await updateDoc(doc(getHospitalCollection(activeHospitalId!, 'appointments'), appointment.id), { status: 'completed', updatedAt: new Date().toISOString() }); setSuccessMessage('Visit completed'); closeMenu(); setTimeout(() => setSuccessMessage(null), 2000); } catch (e) { setError((e as Error).message); } }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-emerald-700 hover:bg-emerald-50">
                                <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Complete visit
                            </button>
                        )}
                        {((appointment as any).status !== 'cancelled' && (appointment as any).status !== 'doctor_cancelled' && (appointment as any).status !== 'completed') && (
                            <button type="button" role="menuitem" onClick={async () => { closeMenu(); if (!confirm('Cancel this appointment?')) return; try { await updateDoc(doc(getHospitalCollection(activeHospitalId!, 'appointments'), appointment.id), { status: 'cancelled', updatedAt: new Date().toISOString() }); setSuccessMessage('Cancelled'); setTimeout(() => setSuccessMessage(null), 2000); } catch (e) { setError((e as Error).message); } }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">
                                <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                Cancel appointment
                            </button>
                        )}
                        {canMarkNotAttended(appointment) && (
                            <button type="button" role="menuitem" onClick={() => { closeMenu(); handleMarkNotAttended(appointment); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-amber-700 hover:bg-amber-50">
                                <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Mark not attended
                            </button>
                        )}
                        <div className="mt-1 border-t border-slate-100">
                            <button type="button" role="menuitem" onClick={() => { closeMenu(); handleDelete(appointment); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50">
                                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Delete record
                            </button>
                        </div>
                    </div>,
                    document.body
                )
            })()}
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