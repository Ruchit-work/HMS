'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { getDocs, doc, deleteDoc, onSnapshot } from 'firebase/firestore'
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
import { useNewItems } from '@/hooks/useNewItems'
import PrescriptionDisplay from '@/components/prescription/PrescriptionDisplay'
import DocumentListCompact from '@/components/documents/DocumentListCompact'

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
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
    const [sortField, setSortField] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteAppointment, setDeleteAppointment] = useState<Appointment | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    // New filters
    const [doctors, setDoctors] = useState<Array<{ id: string; firstName?: string; lastName?: string }>>([])
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all')
    const [timeRange, setTimeRange] = useState<'all' | 'today' | 'last10' | 'month' | 'year'>('all')
    const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'completed' | 'cancelled' | 'not_attended'>('all')
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
    // Use prop if provided (from admin dashboard), otherwise use local state (for backward compatibility)
    const [localSelectedBranchId, setLocalSelectedBranchId] = useState<string>('all')
    const effectiveSelectedBranchId = selectedBranchId !== undefined ? selectedBranchId : localSelectedBranchId

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
        const counts = { confirmed: 0, completed: 0, cancelled: 0, not_attended: 0 }
        appointments.forEach((apt) => {
            const status = (apt as any).status
            if (status === 'confirmed') counts.confirmed += 1
            if (status === 'completed') counts.completed += 1
            if (status === 'cancelled' || status === 'doctor_cancelled') counts.cancelled += 1
            if (status === 'not_attended') counts.not_attended += 1
        })
        return counts
    }, [appointments])

    const statusTabs = useMemo(() => ([
        { key: 'all' as const, label: 'All', count: appointments.length },
        { key: 'confirmed' as const, label: 'Confirmed', count: statusCounts.confirmed },
        { key: 'completed' as const, label: 'Completed', count: statusCounts.completed },
        { key: 'not_attended' as const, label: 'Not Attended', count: statusCounts.not_attended },
        { key: 'cancelled' as const, label: 'Cancelled', count: statusCounts.cancelled },
    ]), [appointments.length, statusCounts.cancelled, statusCounts.completed, statusCounts.confirmed, statusCounts.not_attended])

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
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
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
        
        // Optimistic update: Remove from UI immediately
        const previousAppointments = [...appointments]
        const previousFiltered = [...filteredAppointments]
        const deletedAppointment = deleteAppointment
        
        setAppointments(prev => prev.filter(a => a.id !== deleteAppointment.id))
        setFilteredAppointments(prev => prev.filter(a => a.id !== deleteAppointment.id))
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
            setFilteredAppointments(previousFiltered)
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
                setFilteredAppointments(appointmentsList)
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

    useEffect(() => {   
        let filtered = appointments
        // Text search (by name/email/spec) - using debounced search
        if (debouncedSearch) {
            filtered = filtered.filter(appointment =>
                appointment.patientName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                appointment.doctorName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                appointment.patientEmail?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                appointment.doctorSpecialization?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                appointment.patientId?.toLowerCase().includes(debouncedSearch.toLowerCase())
            )
        }
        // Doctor filter
        if (selectedDoctorId !== 'all') {
            filtered = filtered.filter(a => a.doctorId === selectedDoctorId)
        }
        // Time range filter
        if (timeRange !== 'all') {
            const now = new Date()
            filtered = filtered.filter(a => {
                if (!a.appointmentDate) return false
                const d = new Date(a.appointmentDate)
                if (timeRange === 'today') {
                    return d.toDateString() === now.toDateString()
                }
                if (timeRange === 'last10') {
                    const past = new Date(now)
                    past.setDate(past.getDate() - 10)
                    return d >= past && d <= now
                }
                if (timeRange === 'month') {
                    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
                }
                if (timeRange === 'year') {
                    return d.getFullYear() === now.getFullYear()
                }
                return true
            })
        }
        
        if (statusFilter !== 'all') {
            filtered = filtered.filter((appt) => {
                const status = (appt as any).status
                if (statusFilter === 'cancelled') {
                    return status === 'cancelled' || status === 'doctor_cancelled'
                }
                // Include whatsapp_pending appointments when filtering by 'confirmed' since they need to be confirmed
                if (statusFilter === 'confirmed') {
                    return status === 'confirmed' || status === 'whatsapp_pending'
                }
                return status === statusFilter
            })
        }

        // Apply sorting - default to newest first (createdAt descending) when no sortField is set
        filtered = [...filtered].sort((a, b) => {
            if (sortField) {
                let aValue = ''
                let bValue = ''
                
                switch (sortField) {
                    case 'patientName':
                        aValue = a.patientName?.toLowerCase() || ''
                        bValue = b.patientName?.toLowerCase() || ''
                        break
                    case 'doctorName':
                        aValue = a.doctorName?.toLowerCase() || ''
                        bValue = b.doctorName?.toLowerCase() || ''
                        break
                    case 'appointmentDate':
                        aValue = a.appointmentDate || ''
                        bValue = b.appointmentDate || ''
                        break
                    case 'status':
                        aValue = a.status?.toLowerCase() || ''
                        bValue = b.status?.toLowerCase() || ''
                        break
                    case 'createdAt':
                        aValue = a.createdAt || ''
                        bValue = b.createdAt || ''
                        break
                    case 'branch':
                        aValue = (a as any).branchName?.toLowerCase?.() || (a as any).branchId || ''
                        bValue = (b as any).branchName?.toLowerCase?.() || (b as any).branchId || ''
                        break
                    default:
                        return 0
                }
                
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
                return 0
            } else {
                // Default sort: newest first (createdAt descending, fallback to updatedAt)
                const aDate = a.createdAt || a.updatedAt || ''
                const bDate = b.createdAt || b.updatedAt || ''
                if (aDate < bDate) return 1
                if (aDate > bDate) return -1
                return 0
            }
        })
        
        setFilteredAppointments(filtered)
    }, [debouncedSearch, appointments, sortField, sortOrder, selectedDoctorId, timeRange, statusFilter])

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
                <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-purple-50 px-6 py-6">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" /> Appointment control  </span>
                            <h2 className="text-2xl font-bold text-slate-900">Appointment Workspace</h2>
                            <p className="max-w-xl text-sm text-slate-600">Track visits, manage follow-ups, and audit cancellations across the hospital in one place.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/80 px-3 py-2 text-xs font-semibold text-green-700 shadow-inner">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span>Live Updates Active</span>
                                {lastUpdatedDisplay && (
                                    <>
                                        <span className="text-green-600">•</span>
                                        <span className="text-green-600">Last update: {lastUpdatedDisplay}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {summaryCards.map((card) => (
                            <div key={card.title} className="flex items-center gap-4 rounded-xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur" >
                                {card.icon}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.title}</p>
                                    <p className="mt-1 text-xl font-semibold text-slate-900">{card.value}</p>
                                    <p className="text-xs text-slate-500">{card.caption}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6 px-6 py-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Doctor</label>
                                <select value={selectedDoctorId}  onChange={(e) => setSelectedDoctorId(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">All</option>
                                    {doctors.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {`${d.firstName || ''} ${d.lastName || ''}`.trim() || d.id}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time range</label>
                                <select value={timeRange}   onChange={(e) => setTimeRange(e.target.value as any)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">All</option>
                                    <option value="today">Today</option>
                                    <option value="last10">Last 10 days</option>
                                    <option value="month">This month</option>
                                    <option value="year">This year</option>
                                </select>
                            </div>
                            {/* Branch filter only for admin; receptionists are auto-restricted to their branch */}
                            {branches.length > 0 && !receptionistBranchId && (
                                <div>
                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Branch</label>
                                    <select value={effectiveSelectedBranchId} onChange={(e) => setLocalSelectedBranchId(e.target.value)} disabled={selectedBranchId !== undefined}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">All Branches</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="md:col-span-2 xl:col-span-2">
                                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Search</label>
                                <div className="relative">
                                    <input  type="text" value={search}
                                        onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient, doctor, email, specialization, or patient ID…"
                                        className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
                                <div className="flex flex-wrap gap-2">
                                    {statusTabs.map((tab) => {
                                        const active = statusFilter === tab.key
                                        return (
                                            <button key={tab.key}  type="button"   onClick={() => setStatusFilter(tab.key)}
                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                                    active
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                                                        : 'border-transparent bg-white text-slate-500 hover:border-slate-200 hover:text-slate-700' 
                                                           }`} >
                                                <span>{tab.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>Need a fresh start?</span>
                                <button type="button"   onClick={resetFilters}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>Reset filters   
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <span className="font-semibold text-slate-700">Appointment records</span>
                            <span className="text-xs text-slate-500">
                                Showing {filteredAppointments.length.toLocaleString()} result{filteredAppointments.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px]">
                                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                                    <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        <th className="px-3 py-3 text-left hover:bg-slate-50"   onClick={() => handleSort('patientName')} >
                                            <div className="inline-flex items-center gap-1">
                                                Patient ({filteredAppointments.length})
                                                {sortField === 'patientName' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                            </div>
                                        </th>
                                        <th className="hidden px-3 py-3 text-left hover:bg-slate-50 sm:table-cell" onClick={() => handleSort('doctorName')}>
                                            <div className="inline-flex items-center gap-1">
                                                Doctor   {sortField === 'doctorName' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                            </div>
                                        </th>
                                        <th className="px-3 py-3 text-left hover:bg-slate-50"onClick={() => handleSort('appointmentDate')}  >
                                            <div className="inline-flex items-center gap-1">
                                                Date & time  {sortField === 'appointmentDate' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                            </div>
                                        </th>
                                        <th className="px-3 py-3 text-left hover:bg-slate-50" onClick={() => handleSort('branch')} >
                                            <div className="inline-flex items-center gap-1">
                                                Branch
                                                {sortField === 'branch' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                            </div>
                                        </th>
                                        <th className="px-3 py-3 text-left hover:bg-slate-50"onClick={() => handleSort('status')} >
                                            <div className="inline-flex items-center gap-1">  Status
                                                {sortField === 'status' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                                            </div>
                                        </th>
                                        <th className="hidden px-3 py-3 text-left md:table-cell">Amount</th>
                                        <th className="px-3 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    <InlineSpinner size="md" />
                                                    <p className="mt-2 text-sm text-slate-500">Loading appointments…</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : error ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-12 text-center">
                                                <svg className="mb-2 h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                </svg>
                                                <p className="text-sm font-semibold text-red-600">Error loading appointments</p>
                                                <p className="text-xs text-slate-500">{error}</p>
                                            </td>
                                        </tr>
                                    ) : filteredAppointments.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-8">
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
                                            return (
                                        <tr key={appointment.id}
                                                className={`hover:bg-slate-50 relative ${
                                                    itemIsNew 
                                                        ? 'bg-yellow-50/50 border-l-4 border-yellow-400 animate-pulse-glow' 
                                                        : ''
                                                }`}
                                            >
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                                                            {appointment.patientName?.charAt(0) || 'P'}
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold text-slate-900">{appointment.patientName || 'N/A'}</span>
                                                            <span className="text-xs text-slate-500 sm:hidden">{appointment.doctorName || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="hidden px-3 py-4 sm:table-cell">
                                                    <div className="text-sm font-medium text-slate-900">{appointment.doctorName || 'N/A'}</div>
                                                    <div className="text-xs text-slate-500">{appointment.doctorSpecialization || 'N/A'}</div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="text-sm font-semibold text-slate-900">{formatDate(appointment.appointmentDate)}</div>
                                                    <div className="text-xs text-slate-500">{appointment.appointmentTime || 'N/A'}</div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="text-sm font-medium text-slate-900">
                                                        {(appointment as any).branchName || (appointment as any).branchId || 'Not Assigned'}
                                                    </div>
                                                    {(appointment as any).branchId && !(appointment as any).branchName && (
                                                        <div className="text-xs text-slate-400">ID: {(appointment as any).branchId}</div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-4">
                                                    {(() => {
                                                        const s = (appointment as any).status || 'N/A'
                                                        const label = s === 'resrescheduled' ? 'rescheduled' : s === 'not_attended' ? 'not attended' : s
                                                        const cls =
                                                            s === 'completed'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : s === 'confirmed'
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : s === 'cancelled' || s === 'doctor_cancelled'
                                                                ? 'bg-red-100 text-red-700'
                                                                : s === 'not_attended'
                                                                ? 'bg-orange-100 text-orange-700'
                                                                : s === 'resrescheduled'
                                                                ? 'bg-purple-100 text-purple-700'
                                                                : 'bg-slate-100 text-slate-700'
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
                                                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                                                                {label}
                                                            </span>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="hidden px-3 py-4 md:table-cell">
                                                    <div className="text-sm font-semibold text-slate-900">₹{Number(appointment.paymentAmount || 0).toLocaleString()}</div>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <button className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                                            onClick={() => handleView(appointment)}  type="button">
                                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                            <span className="hidden sm:inline">View</span>
                                                        </button>
                                                        {canMarkNotAttended(appointment) && (
                                                            <button className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                                                                onClick={() => handleMarkNotAttended(appointment)} type="button">
                                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                                <span className="hidden sm:inline">Not Attended</span>
                                                            </button>
                                                        )}
                                                        <button  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                                            onClick={() => handleDelete(appointment)}  type="button" >
                                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            <span className="hidden sm:inline">Delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

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
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    selectedAppointment?.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
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
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-4 sm:p-6">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700"
                                            >
                                                {diagnosis}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {(selectedAppointment as any).customDiagnosis && (
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Diagnosis</label>
                                        <p className="text-sm font-medium text-gray-900 bg-purple-50 border border-purple-200 px-3 py-2 rounded-md">
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