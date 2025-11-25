'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
// import { PageHeader } from '@/components/ui/PageHeader'
import { collection, getDocs,where,query,doc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AdminProtected from '@/components/AdminProtected'
import ViewModal from '@/components/ui/ViewModal'
import DeleteModal from '@/components/ui/DeleteModal'
import OTPVerificationModal from '@/components/forms/OTPVerificationModal'
import PatientProfileForm, { PatientProfileFormValues } from '@/components/forms/PatientProfileForm'
import { calculateAge, formatDate, formatDateTime } from '@/utils/date'
import SuccessToast from '@/components/ui/SuccessToast'
import { useTablePagination } from '@/hooks/useTablePagination'
import Pagination from '@/components/ui/Pagination'
import RefreshButton from '@/components/ui/RefreshButton'
// import toast from 'react-hot-toast'

interface Patient {
    status: string
    id: string
    patientId?: string
    firstName: string
    lastName: string
    email: string
    phone: string
    gender: string
    bloodGroup: string
    address: string
    dateOfBirth: string
    createdBy: string
    createdAt: string
    updatedAt: string
    appointmentDetails?: {
        total: number
        upcoming: number
        nextAppointment?: {
            date: string
            time: string
            doctorName: string
            status: string
            chiefComplaint?: string
            medicalHistory?: string
        }
    }
}

export default function PatientManagement({ canDelete = true, canAdd = true, disableAdminGuard = true }: { canDelete?: boolean; canAdd?: boolean; disableAdminGuard?: boolean } = {}) {
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
 
    const { user, loading: authLoading } = useAuth()
    const [sortField, setSortField] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showOtpModal, setShowOtpModal] = useState(false)
    const [pendingPatientValues, setPendingPatientValues] = useState<PatientProfileFormValues | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const handleView = (patient: Patient) => {
        setSelectedPatient(patient)
        setShowViewModal(true)
    }
    const handleDelete = (patient: Patient) => {
        if (!canDelete) return
        setDeletePatient(patient)
        setDeleteModal(true)
    }
    const handleDeleteConfirm = async () => {
        if (!canDelete || !deletePatient) return
        
        try {
            setLoading(true)
            setError(null) // Clear any previous errors
            
            // First, delete from Firebase Auth
            try {
                // Get Firebase Auth token
                const currentUser = auth.currentUser
                if (!currentUser) {
                    throw new Error("You must be logged in to delete users")
                }

                const token = await currentUser.getIdToken()

                const authDeleteResponse = await fetch('/api/admin/delete-user', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ uid: deletePatient.id, userType: 'Patient' })
                })
                
                if (!authDeleteResponse.ok) {
                    const authError = await authDeleteResponse.json().catch(() => ({}))
                    console.warn('Failed to delete from auth:', authError)
                    // Continue with Firestore deletion even if auth deletion fails
                }
            } catch (authError) {
                console.error('Error deleting from auth:', authError)
                // Continue with Firestore deletion even if auth deletion fails
            }
            
            // Then delete from Firestore
            const patientRef = doc(db, 'patients', deletePatient.id)
            await deleteDoc(patientRef)
            
            // Update local state
            setPatients(prev => prev.filter(p => p.id !== deletePatient.id))
            
            // Close modal
            setDeleteModal(false)
            setDeletePatient(null)
            
            // Show success message
            setSuccessMessage('Patient deleted successfully from database and authentication!')
            
            // Auto-hide success message after 3 seconds
            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)
            
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setLoading(false)
        }
    }
    const fetchPatients = useCallback(async () => {
        try{
            setLoading(true)
            const patientsRef = collection(db,'patients')
            const q = query(patientsRef, where('status','in',['active','inactive']))
            const snapshot = await getDocs(q)
            const patientsList = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            })) as Patient[]
            
            // Fetch appointments for each patient
            const appointmentsRef = collection(db, 'appointments')
            const appointmentsSnapshot = await getDocs(appointmentsRef)
            const allAppointments = appointmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            
            // Group appointments by patient ID
            const appointmentsByPatient = new Map<string, any[]>()
            allAppointments.forEach((apt: any) => {
                const patientId = apt.patientId || apt.patientUid || ''
                if (patientId) {
                    if (!appointmentsByPatient.has(patientId)) {
                        appointmentsByPatient.set(patientId, [])
                    }
                    appointmentsByPatient.get(patientId)!.push(apt)
                }
            })
            
            // Add appointment details to each patient
            const patientsWithAppointments = patientsList.map(patient => {
                const patientAppointments = [
                    ...(appointmentsByPatient.get(patient.id) || []),
                    ...(patient.patientId ? (appointmentsByPatient.get(patient.patientId) || []) : [])
                ]
                
                // Remove duplicates
                const uniqueAppointments = Array.from(
                    new Map(patientAppointments.map(apt => [apt.id, apt])).values()
                )
                
                // Filter upcoming appointments (confirmed/pending and date >= today)
                const today = new Date().toISOString().split('T')[0]
                const upcoming = uniqueAppointments.filter((apt: any) => {
                    const isUpcoming = apt.appointmentDate >= today
                    const isActiveStatus = ['confirmed', 'pending', 'whatsapp_pending'].includes(apt.status)
                    return isUpcoming && isActiveStatus
                })
                
                // Find next appointment
                const nextAppointment = upcoming.length > 0
                    ? upcoming.sort((a: any, b: any) => {
                        const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}`).getTime()
                        const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime || '00:00'}`).getTime()
                        return dateA - dateB
                    })[0]
                    : null
                
                return {
                    ...patient,
                    appointmentDetails: {
                        total: uniqueAppointments.length,
                        upcoming: upcoming.length,
                        nextAppointment: nextAppointment ? {
                            date: nextAppointment.appointmentDate,
                            time: nextAppointment.appointmentTime || '',
                            doctorName: nextAppointment.doctorName || 'To be assigned',
                            status: nextAppointment.status,
                            chiefComplaint: nextAppointment.chiefComplaint || '',
                            medicalHistory: nextAppointment.medicalHistory || ''
                        } : undefined
                    }
                }
            })
            
            setPatients(patientsWithAppointments)
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {   
        if (!user || authLoading) return
        fetchPatients()
    }, [fetchPatients, user, authLoading])

    const metrics = useMemo(() => {
        const total = patients.length
        const active = patients.filter(patient => patient.status === 'active').length
        const inactive = patients.filter(patient => patient.status === 'inactive').length
        const newThisMonth = patients.filter(patient => {
            if (!patient.createdAt) return false
            const created = new Date(patient.createdAt)
            if (Number.isNaN(created.getTime())) return false
            const now = new Date()
            return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
        }).length
        const ages = patients
            .map(patient => calculateAge(patient.dateOfBirth))
            .filter((age): age is number => typeof age === 'number' && !Number.isNaN(age))
        const averageAge = ages.length ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length) : null
        return { total, active, inactive, newThisMonth, averageAge }
    }, [patients])

    const filteredPatients = useMemo(() => {
        let filtered = [...patients]

        if (search){
            const searchLower = search.toLowerCase()
            filtered = filtered.filter(patient =>
                `${patient.firstName || ""} ${patient.lastName || ""}`.toLowerCase().includes(searchLower) ||
                (patient.email || "").toLowerCase().includes(searchLower) ||
                (patient.phone || "").toLowerCase().includes(searchLower) ||
                (patient.patientId ? patient.patientId.toLowerCase().includes(searchLower) : false)
            )
        }
        
        if (statusFilter !== 'all') {
            filtered = filtered.filter(patient => patient.status === statusFilter)
        }
        
        if (sortField) {
            filtered = [...filtered].sort((a, b) => {
                let aValue = ''
                let bValue = ''
                
                switch (sortField) {
                    case 'name':
                        aValue = `${a.firstName} ${a.lastName}`.toLowerCase()
                        bValue = `${b.firstName} ${b.lastName}`.toLowerCase()
                        break
                    case 'email':
                        aValue = a.email.toLowerCase()
                        bValue = b.email.toLowerCase()
                        break
                    case 'createdAt':
                        aValue = a.createdAt
                        bValue = b.createdAt
                        break
                    case 'status':
                        aValue = a.status.toLowerCase()
                        bValue = b.status.toLowerCase()
                        break
                    default:
                        return 0
                }
                
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
                return 0
            })
        }
        
        return filtered
    }, [patients, search, sortField, sortOrder, statusFilter])

    // Use pagination hook
    const {
        currentPage,
        pageSize,
        totalPages,
        paginatedItems: paginatedPatients,
        goToPage,
        setPageSize,
    } = useTablePagination(filteredPatients, {
        initialPageSize: 10,
        resetOnFilterChange: true,
    })

    const allowAdd = canAdd && user?.role !== "admin"

    const openAddPatientModal = () => {
        setError(null)
        setShowAddModal(true)
    }

    const closeAddPatientModal = () => {
        setShowAddModal(false)
        setShowOtpModal(false)
        setPendingPatientValues(null)
    }

    const finalizePatientCreation = async (values: PatientProfileFormValues) => {
        try {
            setLoading(true)
            setError(null)

            const normalizedCountryCode = (values.countryCode || '+91').trim() || '+91'
            const normalizedPhone = values.phone.trim()

            const payload = {
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                phone: `${normalizedCountryCode}${normalizedPhone}`,
                phoneCountryCode: normalizedCountryCode,
                phoneNumber: normalizedPhone,
                gender: values.gender,
                bloodGroup: values.bloodGroup,
                address: values.address,
                dateOfBirth: values.dateOfBirth,
                status: values.status ?? 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: user?.role ?? 'admin'
            }

            // Get Firebase Auth token
            const currentUser = auth.currentUser
            if (!currentUser) {
                throw new Error("You must be logged in to create patients")
            }

            const token = await currentUser.getIdToken()

            const res = await fetch('/api/receptionist/create-patient', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ patientData: payload, password: values.password })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data?.error || 'Failed to create patient')
            }

            await fetchPatients()
            setShowAddModal(false)
            setShowOtpModal(false)
            setPendingPatientValues(null)
            setSuccessMessage('Patient added successfully!')
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleCreatePatient = async (values: PatientProfileFormValues) => {
        if (!allowAdd) return
        const phoneValue = values.phone.trim()
        if (!phoneValue) {
            setError('Phone number is required for OTP verification.')
            return
        }
        setPendingPatientValues(values)
        setShowOtpModal(true)
    }

    const handleOtpVerified = async () => {
        if (!pendingPatientValues) return
        await finalizePatientCreation(pendingPatientValues)
    }

    const summaryCards = useMemo(() => [
        {
            title: 'Total Patients',
            value: metrics.total.toLocaleString(),
            caption: 'All registered patients in the system',
            delta: metrics.newThisMonth ? `+${metrics.newThisMonth} this month` : 'No new registrations this month',
            deltaClass: metrics.newThisMonth ? 'text-emerald-600' : 'text-slate-500',
            iconClass: 'bg-blue-100 text-blue-600',
            icon: (
                <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </>
            )
        },
        {
            title: 'Active Patients',
            value: metrics.active.toLocaleString(),
            caption: 'Patients with active portal access',
            delta: `${metrics.inactive.toLocaleString()} inactive`,
            deltaClass: 'text-blue-600',
            iconClass: 'bg-emerald-100 text-emerald-600',
            icon: (
                <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-.895 3-2s-1.343-2-3-2-3 .895-3 2 1.343 2 3 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
                </>
            )
        },
        {
            title: 'New This Month',
            value: metrics.newThisMonth.toLocaleString(),
            caption: 'Registrations in the current month',
            delta: metrics.total ? `${Math.round((metrics.newThisMonth / Math.max(metrics.total, 1)) * 100)}% of total` : '—',
            deltaClass: 'text-purple-600',
            iconClass: 'bg-purple-100 text-purple-600',
            icon: (
                <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z" />
                </>
            )
        },
        {
            title: 'Average Age',
            value: metrics.averageAge !== null ? `${metrics.averageAge} yrs` : '—',
            caption: 'Based on recorded date of birth',
            delta: metrics.averageAge !== null ? 'Calculated from verified records' : 'Missing DOB for many patients',
            deltaClass: metrics.averageAge !== null ? 'text-slate-500' : 'text-amber-600',
            iconClass: 'bg-orange-100 text-orange-600',
            icon: (
                <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </>
            )
        },
    ], [metrics])

    const statusTabs = [
        { key: 'all' as const, label: 'All' },
        { key: 'active' as const, label: 'Active' },
        { key: 'inactive' as const, label: 'Inactive' },
    ]

    const headerHighlights = [
        { label: 'Total Patients', value: metrics.total.toLocaleString() },
        { label: 'Active Patients', value: metrics.active.toLocaleString() },
        { label: 'Inactive Patients', value: metrics.inactive.toLocaleString() },
    ]

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }
    
    useEffect(() => {
        if (!allowAdd && showAddModal) {
            closeAddPatientModal()
        }
    }, [allowAdd, showAddModal])
    if (authLoading) {
        return <LoadingSpinner message="Loading patient management..." />
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
      <>
        <div className="relative space-y-6">
          {successMessage && (
            <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50 px-6 py-6">
              <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 translate-x-12 -translate-y-8 rounded-full bg-blue-100 opacity-40 blur-3xl" />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl space-y-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 shadow-sm">
                    <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />  Patient registry  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">  Patient Management</h2>
                  <p className="text-sm sm:text-base text-slate-600">
                    Maintain accurate patient records, oversee status changes,
                    and keep clinical teams in sync.    </p>
                </div>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  {allowAdd ? (
                    <button     onClick={openAddPatientModal}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                      type="button" >
                      <svg className="h-4 w-4" fill="none"    stroke="currentColor"   viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Add patient
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white/70 px-3 py-2 text-xs font-semibold text-blue-600 shadow-inner">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
                      Registrations handled by reception team
                    </div>
                  )}
                  <RefreshButton
                    onClick={fetchPatients}
                    loading={loading}
                    variant="outline"
                    label="Refresh"
                  />
                </div>
              </div>

              <div className="relative mt-6 flex flex-wrap items-center gap-3">
                {headerHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-inner"
                  >
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <span>{item.label}</span>
                    <span className="text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card) => (
                  <div
                    key={card.title}
                    className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {card.title}
                        </p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">
                          {card.value}
                        </p>
                        {card.delta && (
                          <p
                            className={`mt-2 text-xs font-semibold ${card.deltaClass}`}
                          >
                            {card.delta}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          {card.caption}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.iconClass}`}
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          {card.icon}
                        </svg>
                      </span>
                    </div>
                    <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-blue-50 opacity-30" />
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
                <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Search patients
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email, phone, or patient ID…"
                        className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg
                          className="h-4 w-4 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Rows per page
                    </label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {[10, 15, 20].map((size) => (
                        <option key={size} value={size}>
                          {size} rows
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {statusTabs.map((tab) => {
                        const active = statusFilter === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setStatusFilter(tab.key)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              active
                                ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                                : "border-transparent bg-white text-slate-500 hover:border-slate-200 hover:text-slate-700"
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    {filteredPatients.length.toLocaleString()} patient
                    {filteredPatients.length === 1 ? "" : "s"} match the current
                    filters
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">
                    Patient directory
                  </span>
                  <span className="text-xs text-slate-500">
                    {filteredPatients.length.toLocaleString()} total
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                      <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th
                          className="px-3 py-3 text-left hover:bg-slate-50"
                          onClick={() => handleSort("name")}
                        >
                          <div className="inline-flex items-center gap-1">
                            Patient ({filteredPatients.length})
                            {sortField === "name" && (
                              <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="hidden px-3 py-3 text-left hover:bg-slate-50 sm:table-cell"
                          onClick={() => handleSort("email")}
                        >
                          <div className="inline-flex items-center gap-1">
                            Contact
                            {sortField === "email" && (
                              <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th className="hidden px-3 py-3 text-left md:table-cell">
                          Medical info
                        </th>
                        <th
                          className="hidden px-3 py-3 text-left hover:bg-slate-50 lg:table-cell"
                          onClick={() => handleSort("createdAt")}
                        >
                          <div className="inline-flex items-center gap-1">
                            Created
                            {sortField === "createdAt" && (
                              <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-3 py-3 text-left hover:bg-slate-50"
                          onClick={() => handleSort("status")}
                        >
                          <div className="inline-flex items-center gap-1">
                            Status
                            {sortField === "status" && (
                              <span>{sortOrder === "asc" ? "↑" : "↓"}</span>
                            )}
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-12 text-center">
                            <div className="flex flex-col items-center">
                              <svg
                                className="mb-2 h-8 w-8 animate-spin text-blue-600"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              <p className="text-sm text-slate-500">
                                Loading patients…
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : error ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-12 text-center">
                            <svg
                              className="mb-2 h-12 w-12 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                            <p className="text-sm font-semibold text-red-600">
                              Error loading patients
                            </p>
                            <p className="text-xs text-slate-500">{error}</p>
                          </td>
                        </tr>
                      ) : paginatedPatients.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-12 text-center">
                            <svg
                              className="mb-2 h-12 w-12 text-slate-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                            <p className="mb-1 text-sm text-slate-500">
                              {search
                                ? "No patients match the current search"
                                : "No patients found for this view"}
                            </p>
                            {search && (
                              <p className="text-xs text-slate-400">
                                Try adjusting your filters or search keywords.
                              </p>
                            )}
                          </td>
                        </tr>
                      ) : (
                        paginatedPatients.map((patient) => {
                          const statusClass =
                            patient.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600";
                          return (
                            <tr className="hover:bg-slate-50" key={patient.id}>
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                                    {patient.firstName.charAt(0)}
                                  </span>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-900">
                                      {patient.firstName} {patient.lastName}
                                    </span>
                                    <span className="text-xs text-slate-500 sm:hidden">
                                      {patient.email}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden px-3 py-4 sm:table-cell">
                                <div className="text-sm font-medium text-slate-900">
                                  {patient.email}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {patient.phone || "—"}
                                </div>
                              </td>
                              <td className="hidden px-3 py-4 md:table-cell">
                                <div className="text-sm text-slate-900">
                                  {patient.gender || "—"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {patient.bloodGroup || "—"}
                                </div>
                              </td>
                              <td className="hidden px-3 py-4 lg:table-cell">
                                <div className="text-sm font-medium text-slate-900">
                                  {formatDate(patient.createdAt)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Updated {formatDate(patient.updatedAt)}
                                </div>
                              </td>
                              <td className="px-3 py-4">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}
                                >
                                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                                  {patient.status === "active"
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </td>
                              <td className="px-3 py-4">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                    onClick={() => handleView(patient)}
                                    type="button"
                                  >
                                    <svg
                                      className="h-3.5 w-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                      />
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                      />
                                    </svg>
                                    <span className="hidden sm:inline">
                                      View
                                    </span>
                                  </button>
                                  {canDelete && (
                                    <button
                                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                      onClick={() => handleDelete(patient)}
                                      type="button"
                                    >
                                      <svg
                                        className="h-3.5 w-3.5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                      <span className="hidden sm:inline">
                                        Delete
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={filteredPatients.length}
                  onPageChange={goToPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[10, 15, 20]}
                  showPageSizeSelector={false}
                  itemLabel="patients"
                />
              </div>
            </div>
          </div>
          {/* Patient Details Modal */}
          <ViewModal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Patient Details"
            subtitle="Complete patient information"
            headerColor="blue"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
              {/* Personal Information */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                    Personal Information
                  </h4>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Full Name
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {selectedPatient?.firstName} {selectedPatient?.lastName}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Email
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {selectedPatient?.email}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Phone
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {selectedPatient?.phone}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Gender
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {selectedPatient?.gender}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Blood Group
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {selectedPatient?.bloodGroup}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    Additional Information
                  </h4>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Address
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {selectedPatient?.address || "N/A"}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Date of Birth
                    </label>
                    {selectedPatient?.dateOfBirth ? (
                      <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                        {formatDate(selectedPatient.dateOfBirth)}
                        {(() => {
                          const age = calculateAge(selectedPatient.dateOfBirth);
                          return age !== null ? (
                            <span className="ml-2 text-xs text-teal-700 font-semibold bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
                              {age} years
                            </span>
                          ) : null;
                        })()}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-gray-500 bg-gray-50 px-3 py-2 rounded-md">
                        Not provided
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Created By
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md capitalize">
                      {selectedPatient?.createdBy || "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-orange-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    System Information
                  </h4>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Patient ID
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md font-mono">
                      {selectedPatient?.patientId || "Not assigned"}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </label>
                    <span
                      className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        selectedPatient?.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {selectedPatient?.status === "active"
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Created At
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {formatDateTime(selectedPatient?.createdAt || "")}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Last Updated
                    </label>
                    <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                      {formatDateTime(selectedPatient?.updatedAt || "")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Appointment Information */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    Appointment Information
                  </h4>
                </div>
                {selectedPatient?.appointmentDetails ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
                          Total Appointments
                        </div>
                        <div className="text-2xl font-bold text-blue-900">
                          {selectedPatient.appointmentDetails.total}
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                          Upcoming Appointments
                        </div>
                        <div className="text-2xl font-bold text-green-900">
                          {selectedPatient.appointmentDetails.upcoming}
                        </div>
                      </div>
                    </div>
                    {selectedPatient.appointmentDetails.nextAppointment ? (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                          Next Appointment
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">📅 Date:</span>
                            <span className="text-sm text-gray-700">
                              {formatDate(selectedPatient.appointmentDetails.nextAppointment.date)}
                              {selectedPatient.appointmentDetails.nextAppointment.time && (
                                <span className="ml-2">
                                  at {selectedPatient.appointmentDetails.nextAppointment.time}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">👨‍⚕️ Doctor:</span>
                            <span className="text-sm text-gray-700">
                              {selectedPatient.appointmentDetails.nextAppointment.doctorName}
                            </span>
                          </div>
                          {selectedPatient.appointmentDetails.nextAppointment.chiefComplaint && (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-gray-900">💬 Chief Complaint / Symptoms:</span>
                              <span className="text-sm text-gray-700 bg-white px-3 py-2 rounded-md border border-gray-200">
                                {selectedPatient.appointmentDetails.nextAppointment.chiefComplaint}
                              </span>
                            </div>
                          )}
                          {selectedPatient.appointmentDetails.nextAppointment.medicalHistory && (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-gray-900">📋 Medical History:</span>
                              <span className="text-sm text-gray-700 bg-white px-3 py-2 rounded-md border border-gray-200">
                                {selectedPatient.appointmentDetails.nextAppointment.medicalHistory}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">Status:</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                              selectedPatient.appointmentDetails.nextAppointment.status === "confirmed"
                                ? "bg-blue-100 text-blue-700"
                                : selectedPatient.appointmentDetails.nextAppointment.status === "pending" || selectedPatient.appointmentDetails.nextAppointment.status === "whatsapp_pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {selectedPatient.appointmentDetails.nextAppointment.status === "whatsapp_pending" ? "Pending" : selectedPatient.appointmentDetails.nextAppointment.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                        <p className="text-sm text-gray-500">
                          {selectedPatient.appointmentDetails.total > 0
                            ? "No upcoming appointments"
                            : "No appointments booked yet"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">Loading appointment information...</p>
                  </div>
                )}
              </div>
            </div>
          </ViewModal>
          {/* Delete Confirmation Modal */}
          <DeleteModal
            isOpen={deleteModal}
            onClose={() => setDeleteModal(false)}
            onConfirm={handleDeleteConfirm}
            title="Delete Patient"
            subtitle="This action cannot be undone"
            itemType="patient"
            itemDetails={{
              name: `${deletePatient?.firstName || ""} ${
                deletePatient?.lastName || ""
              }`,
              email: deletePatient?.email,
              phone: deletePatient?.phone,
              id: deletePatient?.id || "",
            }}
            loading={loading}
          />
        </div>
        {/* Add Patient Modal */}
        {allowAdd && showAddModal && (
          <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden transform transition-all duration-300 ease-out">
              <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold">
                      Add Patient
                    </h3>
                    <p className="text-blue-100 text-xs sm:text-sm">
                      Create a new patient record
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeAddPatientModal}
                  className="text-white hover:text-blue-200 transition-colors duration-200 p-2 hover:bg-white/20 rounded-lg"
                >
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 overflow-y-auto max-h-[calc(95vh-200px)]">
                <PatientProfileForm
                  mode="admin"
                  loading={loading}
                  externalError={error ?? undefined}
                  onErrorClear={() => setError(null)}
                  onSubmit={handleCreatePatient}
                  onCancel={closeAddPatientModal}
                  enableCountryCode={false}
                  submitLabel={loading ? "Adding Patient..." : "Send OTP"}
                />
              </div>
            </div>
          </div>
        )}
        {allowAdd && showOtpModal && pendingPatientValues && (
          <OTPVerificationModal
            isOpen={showOtpModal}
            onClose={() => {
              setShowOtpModal(false);
            }}
            phone={pendingPatientValues.phone}
            countryCode={pendingPatientValues.countryCode}
            onVerified={handleOtpVerified}
            onChangePhone={() => {
              setShowOtpModal(false);
            }}
          />
        )}
      </>
    );

    if (disableAdminGuard) {
        return content
    }

    return (
        <AdminProtected>
            {content}
        </AdminProtected>
    );
}