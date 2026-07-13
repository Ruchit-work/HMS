'use client'
import { db, auth } from '@/firebase/config'
import { where, query, doc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { getHospitalCollection } from '@/utils/firebase/hospital-queries'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import AdminProtected from '@/components/AdminProtected'
import { ViewModal, DeleteModal } from '@/components/ui/overlays/Modals'
import { RevealModal, useRevealModalClose } from '@/components/ui/overlays/RevealModal'
import DoctorProfileForm, { DoctorProfileFormValues } from '@/components/forms/DoctorProfileForm'
import { SuccessToast } from '@/components/ui/feedback/StatusComponents'
import { formatDate, formatDateTime } from '@/utils/shared/date'
import {
  EnterpriseDataTable,
  StatusPill,
  AvatarCell,
  type EnterpriseColumn,
  type EnterpriseRowAction,
} from '@/components/ui/enterprise-table'

interface Doctor {
    id: string
    firstName: string
    lastName: string
    email: string
    phoneNumber?: string
    gender: string
    specialization: string
    qualification: string
    experience: string
    consultationFee: number
    status: string
    branchIds?: string[]
    createdAt: string
    updatedAt: string
}

function AddDoctorModalContent({
    loading,
    error,
    onErrorClear,
    onSubmit,
    submitLabel,
}: {
    loading: boolean
    error: string | null
    onErrorClear: () => void
    onSubmit: (values: DoctorProfileFormValues) => void | Promise<void>
    submitLabel: string
}) {
    const requestClose = useRevealModalClose()
    return (
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-green-600 to-green-700 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold">Add Doctor</h3>
                        <p className="text-green-100 text-xs sm:text-sm">Add a new doctor to the system</p>
                    </div>
                </div>
                <button
                    onClick={requestClose}
                    className="text-white hover:text-green-200 transition-colors duration-200 p-2 hover:bg-white/20 rounded-lg"
                >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 overflow-y-auto max-h-[calc(95vh-200px)]">
                <DoctorProfileForm
                    mode="admin"
                    loading={loading}
                    externalError={error ?? undefined}
                    onErrorClear={onErrorClear}
                    onSubmit={onSubmit}
                    onCancel={requestClose}
                    submitLabel={submitLabel}
                />
            </div>
        </div>
    )
}

export default function DoctorManagement({ canDelete = true, canAdd = true, disableAdminGuard = true, selectedBranchId = "all" }: { canDelete?: boolean; canAdd?: boolean; disableAdminGuard?: boolean; selectedBranchId?: string } = {}) {
    const [doctors, setDoctors] = useState<Doctor[]>([])
    const [pendingDoctors, setPendingDoctors] = useState<Doctor[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteDoctor, setDeleteDoctor] = useState<Doctor | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active')
    const [showAddModal, setShowAddModal] = useState(false)
    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])

    const { user, loading: authLoading } = useAuth()
    const { activeHospitalId, isSuperAdmin } = useMultiHospital()

    const getBranchNames = (doctor: Doctor) => {
        const ids = doctor.branchIds || []
        if (ids.length === 0) return '—'
        return ids
            .map((id) => branches.find((b) => b.id === id)?.name ?? id)
            .filter(Boolean)
            .join(', ') || '—'
    }

    const filteredActiveDoctors = useMemo(() => {
        if (!search.trim()) return doctors
        const query = search.toLowerCase()
        return doctors.filter((doctor) =>
            `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(query) ||
            doctor.email.toLowerCase().includes(query) ||
            doctor.specialization.toLowerCase().includes(query)
        )
    }, [doctors, search])

    const filteredPendingDoctors = useMemo(() => {
        if (!search.trim()) return pendingDoctors
        const query = search.toLowerCase()
        return pendingDoctors.filter((doctor) =>
            `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(query) ||
            doctor.email.toLowerCase().includes(query) ||
            doctor.specialization.toLowerCase().includes(query)
        )
    }, [pendingDoctors, search])

    const displayedDoctors = useMemo(() => {
        const doctors = activeTab === 'active' ? filteredActiveDoctors : filteredPendingDoctors
        // Remove duplicates based on doctor ID
        const uniqueDoctors = doctors.filter((doctor, index, self) =>
            index === self.findIndex((d) => d.id === doctor.id)
        )
        return uniqueDoctors
    }, [activeTab, filteredActiveDoctors, filteredPendingDoctors])

    const metrics = useMemo(() => {
        const activeCount = doctors.length
        const pendingCount = pendingDoctors.length
        const total = activeCount + pendingCount
        const newThisMonth = doctors.filter((doctor) => {
            if (!doctor.createdAt) return false
            const created = new Date(doctor.createdAt)
            if (Number.isNaN(created.getTime())) return false
            const now = new Date()
            return (
                created.getFullYear() === now.getFullYear() &&
                created.getMonth() === now.getMonth()
            )
        }).length
        const specialists = doctors.filter((doctor) => doctor.specialization).length

        return { total, activeCount, pendingCount, newThisMonth, specialists }
    }, [doctors, pendingDoctors])

    const allowAdd = canAdd && !isSuperAdmin && user?.role === 'admin'

    const openAddDoctorModal = () => {
        setError(null)
        setShowAddModal(true)
    }

    const closeAddDoctorModal = () => {
        setShowAddModal(false)
    }

    const handleCreateDoctor = async (formValues: DoctorProfileFormValues) => {
        if (!allowAdd) return
        try {
            setLoading(true)
            setError(null)

            const doctorData = {
                firstName: formValues.firstName,
                lastName: formValues.lastName,
                email: formValues.email,
                phoneNumber: formValues.phoneNumber,
                gender: formValues.gender,
                specialization: formValues.specialization,
                qualification: formValues.qualification,
                experience: formValues.experience,
                consultationFee: formValues.consultationFee,
                status: formValues.status,
                branchIds: formValues.branchIds,
                visitingHours: formValues.visitingHours,
                branchTimings: formValues.branchTimings
            }

            // Get Firebase Auth token
            const currentUser = auth.currentUser
            if (!currentUser) {
                throw new Error("You must be logged in to create doctors")
            }

            const token = await currentUser.getIdToken()

            const response = await fetch('/api/admin/create-doctor', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ doctorData, password: formValues.password })
            })

            if (!response.ok) {
                let errorMessage = 'Failed to create doctor'
                try {
                    const errorData = await response.json()
                    errorMessage = errorData.error || errorMessage
                } catch {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`
                }
                throw new Error(errorMessage)
            }

            const result = await response.json()
            const doctorEntry: Doctor = {
                id: result.uid,
                ...doctorData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }

            setDoctors(prev => [...prev, doctorEntry])
            setShowAddModal(false)
            setSuccessMessage('Doctor added successfully! They can now log in with their email and password.')
            setTimeout(() => setSuccessMessage(null), 5000)
        } catch (error) {

            if (error instanceof Error) {
                setError(error.message)
            } else {
                setError('Failed to add doctor. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    const summaryCards = useMemo(() => [
        {
            title: 'Total Doctors',
            value: metrics.total.toLocaleString(),
            caption: 'Active and pending profiles recorded',
            delta: metrics.newThisMonth
                ? `+${metrics.newThisMonth} onboarded this month`
                : 'No new additions this month',
            deltaClass: metrics.newThisMonth ? 'text-emerald-600' : 'text-slate-500',
            iconClass: 'bg-cyan-100 text-cyan-700',
            icon: (
                <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </>
            )
        },
        {
            title: 'Active Specialists',
            value: metrics.activeCount.toLocaleString(),
            caption: `${metrics.specialists.toLocaleString()} distinct specializations covered`,
            delta: 'Fully verified and treating patients',
            deltaClass: 'text-cyan-700',
            iconClass: 'bg-emerald-100 text-emerald-600',
            icon: (
                <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m2 8H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6h6v4H9z" />
                </>
            )
        },
        {
            title: 'Pending Approval',
            value: metrics.pendingCount.toLocaleString(),
            caption: 'Awaiting admin verification',
            delta: metrics.pendingCount ? 'Action required' : 'Queue is clear',
            deltaClass: metrics.pendingCount ? 'text-orange-600' : 'text-slate-500',
            iconClass: 'bg-orange-100 text-orange-600',
            icon: (
                <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l2 2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6a9 9 0 110 18 9 9 0 010-18z" />
                </>
            )
        },
    ], [metrics])

    const headerHighlights = [
        { label: 'Total Doctors', value: metrics.total.toLocaleString() },
        { label: 'Active Specialists', value: metrics.activeCount.toLocaleString() },
        { label: 'Pending Approvals', value: metrics.pendingCount.toLocaleString() },
    ]
   
    const handleView = (doctor: Doctor) => {
        setSelectedDoctor(doctor)
        setShowViewModal(true)
    }
    const handleDelete = (doctor: Doctor) => {
        if (!canDelete) return
        setDeleteDoctor(doctor)
        setDeleteModal(true)
    }
    const handleDeleteConfirm = async () => {
        if (!canDelete || !deleteDoctor) return
        try {
            setLoading(true)
            setError(null)
            
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
                    body: JSON.stringify({ uid: deleteDoctor.id, userType: 'Doctor' })
                })
                
                if (!authDeleteResponse.ok) {
                    await authDeleteResponse.json().catch(() => ({}))

                    // Continue with Firestore deletion even if auth deletion fails
                }
            } catch {

                // Continue with Firestore deletion even if auth deletion fails
            }
            
            // Delete from Firestore - all locations for permanent deletion
            const doctorId = deleteDoctor.id
            
            // Get doctor's hospitalId if available, otherwise use activeHospitalId
            const doctorHospitalId = (deleteDoctor as any).hospitalId || activeHospitalId
            
            // Delete from main doctors collection
            const doctorRef = doc(db, 'doctors', doctorId)
            await deleteDoc(doctorRef).catch(() => {
                // Ignore if doesn't exist
            })
            
            // Delete from hospital-specific doctors collection
            if (doctorHospitalId) {
                const hospitalDoctorRef = getHospitalCollection(doctorHospitalId, 'doctors')
                const hospitalDoctorDocRef = doc(hospitalDoctorRef, doctorId)
                await deleteDoc(hospitalDoctorDocRef).catch(() => {
                    // Ignore if doesn't exist
                })
            }
            
            // Delete from users collection (for multi-hospital support)
            const userRef = doc(db, 'users', doctorId)
            await deleteDoc(userRef).catch(() => {
                // Ignore if doesn't exist
            })
            
            setDoctors(prev => prev.filter(d => d.id !== doctorId))
            setShowViewModal(false)
            setDeleteModal(false)
            setDeleteDoctor(null)
            setSuccessMessage('Doctor permanently deleted from all locations (database, authentication, and hospital collections)!')
            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setLoading(false)
        }
    }
    const setupRealtimeListeners = useCallback(() => {
        if (!activeHospitalId) return () => {}
        
        try {
            setLoading(true)
            const doctorsRef = getHospitalCollection(activeHospitalId, 'doctors')
            
            // Set up real-time listener for active doctors
            const activeQ = query(doctorsRef, where('status', '==', 'active'))
            const unsubscribeActive = onSnapshot(activeQ, (snapshot) => {
                let activeList = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            })) as Doctor[]
            
            // Filter by branch if selected
            if (selectedBranchId !== "all") {
                activeList = activeList.filter((doctor: any) => {
                    const branchIds = doctor.branchIds || []
                    return Array.isArray(branchIds) && branchIds.includes(selectedBranchId)
                })
            }
            
            setDoctors(activeList)
            }, (error) => {

                setError(error.message)
            })
            
            const pendingQ = query(doctorsRef, where('status', '==', 'pending'))
            const unsubscribePending = onSnapshot(pendingQ, (snapshot) => {
                let pendingList = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            })) as Doctor[]
            
            // Filter by branch if selected
            if (selectedBranchId !== "all") {
                pendingList = pendingList.filter((doctor: any) => {
                    const branchIds = doctor.branchIds || []
                    return Array.isArray(branchIds) && branchIds.includes(selectedBranchId)
                })
            }
            
            setPendingDoctors(pendingList)
                setLoading(false)
            }, (error) => {

                setError(error.message)
                setLoading(false)
            })
            
            return () => {
                unsubscribeActive()
                unsubscribePending()
            }
        } catch (error) {

            setError((error as Error).message)  
            setLoading(false)
            return () => {}
        }
    }, [activeHospitalId, selectedBranchId])
    
    const handleApproveDoctor = async (doctorId: string) => {
        // Only admins can approve doctors
        if (user?.role !== 'admin') {
            setError('Only admins can approve doctors')
            return
        }
        
        try {
            setLoading(true)
            setError(null)
            const doctorRef = doc(db, 'doctors', doctorId)
            await updateDoc(doctorRef, {
                status: 'active',
                updatedAt: new Date().toISOString(),
                approvedAt: new Date().toISOString()
            })
            
            // Update local state
            setPendingDoctors(prev => prev.filter(d => d.id !== doctorId))
            
            // Real-time listeners will automatically update the lists
            
            setSuccessMessage('Doctor approved successfully!')
            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setLoading(false)
        }
    }
    
    const handleRejectDoctor = async (doctorId: string) => {
        // Only admins can reject doctors
        if (user?.role !== 'admin') {
            setError('Only admins can reject doctors')
            return
        }
        
        if (!window.confirm('Are you sure you want to reject this doctor? This action cannot be undone.')) {
            return
        }
        
        try {
            setLoading(true)
            setError(null)
            
            // Delete from Firebase Auth first
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
                    body: JSON.stringify({ uid: doctorId, userType: 'Doctor' })
                })
                
                if (!authDeleteResponse.ok) {
                    await authDeleteResponse.json().catch(() => ({}))

                }
            } catch {

            }
            
            // Delete from Firestore - all locations for permanent deletion
            // Get doctor's hospitalId if available, otherwise use activeHospitalId
            const rejectedDoctor = pendingDoctors.find(d => d.id === doctorId)
            const doctorHospitalId = (rejectedDoctor as any)?.hospitalId || activeHospitalId
            
            // Delete from main doctors collection
            const doctorRef = doc(db, 'doctors', doctorId)
            await deleteDoc(doctorRef).catch(() => {
                // Ignore if doesn't exist
            })
            
            // Delete from hospital-specific doctors collection
            if (doctorHospitalId) {
                const hospitalDoctorRef = getHospitalCollection(doctorHospitalId, 'doctors')
                const hospitalDoctorDocRef = doc(hospitalDoctorRef, doctorId)
                await deleteDoc(hospitalDoctorDocRef).catch(() => {
                    // Ignore if doesn't exist
                })
            }
            
            // Delete from users collection (for multi-hospital support)
            const userRef = doc(db, 'users', doctorId)
            await deleteDoc(userRef).catch(() => {
                // Ignore if doesn't exist
            })
            
            // Update local state
            setPendingDoctors(prev => prev.filter(d => d.id !== doctorId))
            
            setSuccessMessage('Doctor permanently rejected and deleted from all locations!')
            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        if (!user || authLoading) return
        
        let unsubscribe: (() => void) | null = null
        unsubscribe = setupRealtimeListeners()
        
        return () => {
            if (unsubscribe) {
                unsubscribe()
            }
        }
    }, [setupRealtimeListeners, user, authLoading])

    // Ensure receptionists can't access pending tab
    useEffect(() => {
        if (user && user.role !== 'admin' && activeTab === 'pending') {
            setActiveTab('active')
        }
    }, [user, activeTab])

    // Fetch branches for resolving branch names
    useEffect(() => {
        if (!activeHospitalId) return
        let cancelled = false
        ;(async () => {
            try {
                const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`)
                const data = await response.json()
                if (!cancelled && data.success && data.branches) {
                    setBranches(data.branches.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name })))
                }
            } catch {
                if (!cancelled) setBranches([])
            }
        })()
        return () => { cancelled = true }
    }, [activeHospitalId])

    const doctorColumns: EnterpriseColumn<Doctor>[] = useMemo(
        () => [
            {
                key: 'doctor',
                header: `Doctor (${displayedDoctors.length})`,
                render: (doctor) => (
                    <div>
                        <AvatarCell
                            name={`${doctor.firstName} ${doctor.lastName}`}
                            color="emerald"
                        />
                        <p className="mt-0.5 text-xs text-slate-500 sm:hidden">{doctor.specialization}</p>
                    </div>
                ),
            },
            {
                key: 'specialization',
                header: 'Specialization',
                hideBelow: 'sm',
                render: (doctor) => (
                    <div className="text-sm text-slate-900">{doctor.specialization}</div>
                ),
            },
            {
                key: 'qualification',
                header: 'Qualification',
                hideBelow: 'md',
                render: (doctor) => (
                    <div className="text-sm text-slate-900">{doctor.qualification}</div>
                ),
            },
            {
                key: 'experience',
                header: 'Experience',
                hideBelow: 'lg',
                render: (doctor) => (
                    <div className="text-sm text-slate-900">{doctor.experience}</div>
                ),
            },
            {
                key: 'status',
                header: 'Status',
                render: (doctor) => (
                    <StatusPill
                        label={
                            doctor.status === 'active'
                                ? 'Active'
                                : doctor.status === 'pending'
                                  ? 'Pending'
                                  : 'Inactive'
                        }
                        variant={
                            doctor.status === 'active'
                                ? 'success'
                                : doctor.status === 'pending'
                                  ? 'warning'
                                  : 'neutral'
                        }
                    />
                ),
            },
            {
                key: 'branches',
                header: 'Branches',
                hideBelow: 'md',
                render: (doctor) => (
                    <div className="max-w-[140px] truncate text-sm text-slate-900" title={getBranchNames(doctor)}>
                        {getBranchNames(doctor)}
                    </div>
                ),
            },
            {
                key: 'createdAt',
                header: 'Created',
                hideBelow: 'lg',
                render: (doctor) => (
                    <>
                        <div className="text-sm font-medium text-slate-900">{formatDate(doctor.createdAt)}</div>
                        <div className="text-xs text-slate-500">Updated {formatDate(doctor.updatedAt)}</div>
                    </>
                ),
            },
        ],
        [displayedDoctors.length, branches]
    )

    const doctorRowActions: EnterpriseRowAction<Doctor>[] = useMemo(() => {
        const actions: EnterpriseRowAction<Doctor>[] = []
        if (user?.role === 'admin') {
            actions.push(
                {
                    label: 'Approve',
                    variant: 'success',
                    hidden: (doctor) => !(activeTab === 'pending' && doctor.status === 'pending'),
                    onClick: (doctor) => handleApproveDoctor(doctor.id),
                },
                {
                    label: 'Reject',
                    variant: 'danger',
                    hidden: (doctor) => !(activeTab === 'pending' && doctor.status === 'pending'),
                    onClick: (doctor) => handleRejectDoctor(doctor.id),
                }
            )
        }
        if (allowAdd) {
            actions.push({
                label: 'Delete',
                variant: 'danger',
                hidden: () => activeTab !== 'active',
                icon: (
                    <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                ),
                onClick: (doctor) => handleDelete(doctor),
            })
        }
        return actions
    }, [activeTab, allowAdd, user?.role])

    // Gate rendering by auth state (placed after all hooks)
    if (authLoading) {
        return <LoadingSpinner message="Loading doctor management..." />
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
            {successMessage && (
                <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />
            )}
            
            <div className="relative space-y-6">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="relative border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-cyan-50 px-6 py-6">
                        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 translate-x-12 -translate-y-8 rounded-full bg-cyan-100 opacity-40 blur-3xl" />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-3xl space-y-3">
                                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-800 shadow-sm">
                                    <span className="inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                                    Medical workforce
                                </span>
                                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Doctor Management</h2>
                                <p className="text-sm sm:text-base text-slate-600">
                                    Track verified specialists, manage pending approvals, and keep consultation fees in sync across the hospital.
                                </p>
                            </div>
                            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                                {allowAdd ? (
                                    <button
                                        onClick={openAddDoctorModal}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
                                        type="button"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                        Add doctor
                            </button>
                                ) : (
                                    <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-white/70 px-3 py-2 text-xs font-semibold text-cyan-700 shadow-inner">
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                        Registration handled centrally
                        </div>
                                )}
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-700">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span>Live Updates</span>
                            </div>   
                        </div>
                    </div>

                        <div className="relative mt-6 flex flex-wrap items-center gap-3">
                            {headerHighlights.map((item) => (
                                <div
                                    key={item.label}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-inner"
                                >
                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                    <span>{item.label}</span>
                                    <span className="text-slate-900">{item.value}</span>
                                </div>
                            ))}
                        </div>
                </div>

                    <div className="space-y-6 px-6 py-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            {summaryCards.map((card) => (
                                <div
                                    key={card.title}
                                    className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.title}</p>
                                            <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
                                            {card.delta && (
                                                <p className={`mt-2 text-xs font-semibold ${card.deltaClass}`}>{card.delta}</p>
                                            )}
                                            <p className="mt-2 text-xs text-slate-500">{card.caption}</p>
                                        </div>
                                        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${card.iconClass}`}>
                                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                {card.icon}
                                            </svg>
                                        </span>
                                    </div>
                                    <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-cyan-50 opacity-30" />
                                </div>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
                            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                                <div>
                                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        Search doctors
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search by name, email, specialization, or doctor ID…"
                                            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                {user?.role === 'admin' && (
                                    <div className="rounded-xl border border-dashed border-cyan-200 bg-white/70 px-4 py-3 text-xs text-slate-500">
                                        Keep an eye on pending approvals to ensure timely onboarding of new specialists.
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-slate-500">
                                    {displayedDoctors.length.toLocaleString()} doctor{displayedDoctors.length === 1 ? '' : 's'} match the current view.
                                </p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                                    Active
                                    {user?.role === 'admin' && (
                                        <>
                                            <span className="inline-flex h-2 w-2 rounded-full bg-orange-400" />
                                            Pending
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <EnterpriseDataTable
                            data={displayedDoctors}
                            columns={doctorColumns}
                            loading={loading}
                            loadingMessage="Loading doctors…"
                            error={error}
                            emptyTitle={
                                search
                                    ? `No ${activeTab === 'active' ? 'active' : 'pending'} doctors match your search`
                                    : activeTab === 'pending'
                                      ? 'No pending doctor approvals right now'
                                      : 'No doctors found'
                            }
                            emptyDescription={
                                search ? 'Try adjusting your keywords or clearing filters.' : undefined
                            }
                            toolbar={
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold text-slate-700">Doctor directory</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('active')}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                                activeTab === 'active'
                                                    ? 'border-cyan-500 bg-cyan-50 text-cyan-800 shadow-sm'
                                                    : 'border-transparent bg-white text-slate-500 hover:border-slate-200 hover:text-slate-700'
                                            }`}
                                        >
                                            Active ({metrics.activeCount})
                                        </button>
                                        {user?.role === 'admin' && (
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('pending')}
                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                                    activeTab === 'pending'
                                                        ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                                                        : 'border-transparent bg-white text-slate-500 hover:border-slate-200 hover:text-slate-700'
                                                }`}
                                            >
                                                Pending ({metrics.pendingCount})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            }
                            enableSearch={false}
                            enableFilters={false}
                            enableBulkSelection={false}
                            enablePagination={false}
                            enableSorting={false}
                            primaryAction={{
                                label: 'View',
                                icon: (
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                ),
                                onClick: handleView,
                            }}
                            rowActions={doctorRowActions}
                            itemLabel="doctors"
                            minWidth="min-w-[900px]"
                        />
                    </div>
                </div>
            </div>

            {/* Doctor Details Modal — same clinical overview pattern as Patient Profile */}
            <ViewModal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                title="Doctor Profile"
                subtitle="Clinical overview"
                headerColor="green"
            >
                <div className="space-y-5">
                    <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl font-bold text-emerald-700">
                            {selectedDoctor?.firstName?.charAt(0)}
                            {selectedDoctor?.lastName?.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        {selectedDoctor?.firstName} {selectedDoctor?.lastName}
                                    </h3>
                                    <p className="mt-0.5 font-mono text-xs text-slate-400">#{selectedDoctor?.id?.slice(0, 8)}</p>
                                </div>
                                <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                        selectedDoctor?.status === 'active'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : selectedDoctor?.status === 'pending'
                                              ? 'border-orange-200 bg-orange-50 text-orange-700'
                                              : 'border-slate-200 bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    {selectedDoctor?.status === 'active'
                                        ? 'Active'
                                        : selectedDoctor?.status === 'pending'
                                          ? 'Pending'
                                          : 'Inactive'}
                                </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedDoctor?.specialization && (
                                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                                        {selectedDoctor.specialization}
                                    </span>
                                )}
                                {selectedDoctor?.experience && (
                                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                                        {selectedDoctor.experience} exp.
                                    </span>
                                )}
                                {selectedDoctor?.gender && (
                                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium capitalize text-slate-700">
                                        {selectedDoctor.gender}
                                    </span>
                                )}
                                {selectedDoctor?.consultationFee != null && (
                                    <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                                        ₹{selectedDoctor.consultationFee}
                                    </span>
                                )}
                                {selectedDoctor?.phoneNumber && (
                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                                        <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        {selectedDoctor.phoneNumber}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Professional</p>
                            <div className="grid grid-cols-1 gap-3 text-sm">
                                <div>
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Specialization</p>
                                    <p className="text-slate-800">{selectedDoctor?.specialization || '—'}</p>
                                </div>
                                <div>
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Qualification</p>
                                    <p className="text-slate-800">{selectedDoctor?.qualification || '—'}</p>
                                </div>
                                <div>
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Experience</p>
                                    <p className="text-slate-800">{selectedDoctor?.experience || '—'}</p>
                                </div>
                                <div>
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Consultation Fee</p>
                                    <p className="text-slate-800">₹{selectedDoctor?.consultationFee ?? 0}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Contact & Branches</p>
                            <div className="grid grid-cols-1 gap-3 text-sm">
                                <div>
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Email</p>
                                    <p className="text-slate-800">{selectedDoctor?.email || '—'}</p>
                                </div>
                                <div>
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Phone</p>
                                    <p className="text-slate-800">{selectedDoctor?.phoneNumber || '—'}</p>
                                </div>
                                <div>
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Gender</p>
                                    <p className="capitalize text-slate-800">{selectedDoctor?.gender || '—'}</p>
                                </div>
                                <div>
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Assigned Branches</p>
                                    <p className="text-slate-800">{selectedDoctor ? getBranchNames(selectedDoctor) : '—'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <details className="group">
                        <summary className="flex cursor-pointer list-none select-none items-center gap-2 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600">
                            <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            System Information
                        </summary>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                            {[
                                { label: 'Doctor ID', value: selectedDoctor?.id || '—', mono: true },
                                { label: 'Status', value: selectedDoctor?.status || '—', mono: false },
                                { label: 'Created', value: formatDateTime(selectedDoctor?.createdAt || ''), mono: false },
                                { label: 'Last updated', value: formatDateTime(selectedDoctor?.updatedAt || ''), mono: false },
                            ].map(({ label, value, mono }) => (
                                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                                    <p className={`truncate text-slate-700 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            </ViewModal>

            {/* Delete Confirmation Modal */}
            <DeleteModal
                isOpen={deleteModal}
                onClose={() => setDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Doctor"
                subtitle="This action cannot be undone"
                itemType="doctor"
                itemDetails={{
                    name: `${deleteDoctor?.firstName || ''} ${deleteDoctor?.lastName || ''}`,
                    email: deleteDoctor?.email,
                    specialization: deleteDoctor?.specialization,
                    qualification: deleteDoctor?.qualification,
                    id: deleteDoctor?.id || ''
                }}
                loading={loading}
            />
            {/* Add Doctor Modal */}
            {showAddModal && (
                <RevealModal
                    isOpen={true}
                    onClose={closeAddDoctorModal}
                    contentClassName="p-0"
                >
                    <AddDoctorModalContent
                        loading={loading}
                        error={error}
                        onErrorClear={() => setError(null)}
                        onSubmit={handleCreateDoctor}
                        submitLabel={loading ? 'Adding Doctor...' : 'Add Doctor'}
                    />
                </RevealModal>
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