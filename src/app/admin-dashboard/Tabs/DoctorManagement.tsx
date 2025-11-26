'use client'
import { db, auth } from '@/firebase/config'
import { getDocs, where, query, collection, doc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AdminProtected from '@/components/AdminProtected'
import ViewModal from '@/components/ui/ViewModal'
import DeleteModal from '@/components/ui/DeleteModal'
import DoctorProfileForm, { DoctorProfileFormValues } from '@/components/forms/DoctorProfileForm'
import SuccessToast from '@/components/ui/SuccessToast'
import { formatDate, formatDateTime } from '@/utils/date'

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
    createdAt: string
    updatedAt: string
}
export default function DoctorManagement({ canDelete = true, canAdd = true, disableAdminGuard = true }: { canDelete?: boolean; canAdd?: boolean; disableAdminGuard?: boolean } = {}) {
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

    const { user, loading: authLoading } = useAuth()

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

    const displayedDoctors = activeTab === 'active' ? filteredActiveDoctors : filteredPendingDoctors

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

    const allowAdd = canAdd && user?.role === 'admin'

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
                status: formValues.status
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
            console.error('Error adding doctor:', error)
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
            iconClass: 'bg-blue-100 text-blue-600',
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
            deltaClass: 'text-blue-600',
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
                    const authError = await authDeleteResponse.json().catch(() => ({}))
                    console.warn('Failed to delete from auth:', authError)
                    // Continue with Firestore deletion even if auth deletion fails
                }
            } catch (authError) {
                console.error('Error deleting from auth:', authError)
                // Continue with Firestore deletion even if auth deletion fails
            }
            
            // Then delete from Firestore
            const doctorRef = doc(db, 'doctors', deleteDoctor.id)
            await deleteDoc(doctorRef)
            setDoctors(prev => prev.filter(d => d.id !== deleteDoctor.id))
            setShowViewModal(false)
            setDeleteModal(false)
            setDeleteDoctor(null)
            setSuccessMessage('Doctor deleted successfully from database and authentication!')
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
        try {
            setLoading(true)
            const doctorsRef = collection(db, 'doctors')
            
            // Set up real-time listener for active doctors
            const activeQ = query(doctorsRef, where('status', '==', 'active'))
            const unsubscribeActive = onSnapshot(activeQ, (snapshot) => {
                console.log(`[Admin Doctors] Real-time update: ${snapshot.docs.length} active doctors`)
                const activeList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                })) as Doctor[]
                setDoctors(activeList)
            }, (error) => {
                console.error('Error in active doctors listener:', error)
                setError(error.message)
            })
            
            // Set up real-time listener for pending doctors
            const pendingQ = query(doctorsRef, where('status', '==', 'pending'))
            const unsubscribePending = onSnapshot(pendingQ, (snapshot) => {
                console.log(`[Admin Doctors] Real-time update: ${snapshot.docs.length} pending doctors`)
                const pendingList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                })) as Doctor[]
                setPendingDoctors(pendingList)
                setLoading(false)
            }, (error) => {
                console.error('Error in pending doctors listener:', error)
                setError(error.message)
                setLoading(false)
            })
            
            return () => {
                unsubscribeActive()
                unsubscribePending()
            }
        } catch (error) {
            console.error("Error setting up doctors listeners:", error)
            setError((error as Error).message)
            setLoading(false)
            return () => {}
        }
    }, [])
    
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
                    const authError = await authDeleteResponse.json().catch(() => ({}))
                    console.warn('Failed to delete from auth:', authError)
                }
            } catch (authError) {
                console.error('Error deleting from auth:', authError)
            }
            
            // Delete from Firestore
            const doctorRef = doc(db, 'doctors', doctorId)
            await deleteDoc(doctorRef)
            
            // Update local state
            setPendingDoctors(prev => prev.filter(d => d.id !== doctorId))
            
            setSuccessMessage('Doctor rejected and removed successfully!')
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
                    <div className="relative border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50 px-6 py-6">
                        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 translate-x-12 -translate-y-8 rounded-full bg-blue-100 opacity-40 blur-3xl" />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-3xl space-y-3">
                                <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700 shadow-sm">
                                    <span className="inline-flex h-2 w-2 rounded-full bg-blue-500" />
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
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                                        type="button"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                        Add doctor
                            </button>
                                ) : (
                                    <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white/70 px-3 py-2 text-xs font-semibold text-blue-600 shadow-inner">
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
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
                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
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
                                    <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-blue-50 opacity-30" />
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
                                            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                {user?.role === 'admin' && (
                                    <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 px-4 py-3 text-xs text-slate-500">
                                        Keep an eye on pending approvals to ensure timely onboarding of new specialists.
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-slate-500">
                                    {displayedDoctors.length.toLocaleString()} doctor{displayedDoctors.length === 1 ? '' : 's'} match the current view.
                                </p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="inline-flex h-2 w-2 rounded-full bg-blue-400" />
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

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
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

            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px]">
                                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                                        <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <th className="px-3 py-3 text-left">Doctor ({displayedDoctors.length})</th>
                                            <th className="hidden px-3 py-3 text-left sm:table-cell">Specialization</th>
                                            <th className="hidden px-3 py-3 text-left md:table-cell">Qualification</th>
                                            <th className="hidden px-3 py-3 text-left lg:table-cell">Experience</th>
                                            <th className="px-3 py-3 text-left">Status</th>
                                            <th className="hidden px-3 py-3 text-left lg:table-cell">Created</th>
                                            <th className="px-3 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center">
                                                        <svg className="mb-2 h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                                        <p className="text-sm text-slate-500">Loading doctors…</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                                    <svg className="mb-2 h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                                    <p className="text-sm font-semibold text-red-600">Error loading doctors</p>
                                                    <p className="text-xs text-slate-500">{error}</p>
                                </td>
                                </tr>
                                        ) : displayedDoctors.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                                    <svg className="mb-2 h-12 w-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                                    <p className="mb-1 text-sm text-slate-500">
                                            {search 
                                                            ? `No ${activeTab === 'active' ? 'active' : 'pending'} doctors match your search`
                                                : activeTab === 'pending' 
                                                                ? 'No pending doctor approvals right now'
                                                    : 'No doctors found'}
                                        </p>
                                        {search && (
                                                        <p className="text-xs text-slate-400">
                                                            Try adjusting your keywords or clearing filters.
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                            displayedDoctors.map((doctor) => (
                                                <tr className="hover:bg-slate-50" key={doctor.id}>
                                                    <td className="px-3 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-600">
                                                                {doctor.firstName.charAt(0)}
                                                            </span>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-slate-900">
                                                                    {doctor.firstName} {doctor.lastName}
                                                                </span>
                                                                <span className="text-xs text-slate-500 sm:hidden">{doctor.specialization}</span>
                                                </div>
                                            </div>
                                        </td>
                                                    <td className="hidden px-3 py-4 sm:table-cell">
                                                        <div className="text-sm text-slate-900">{doctor.specialization}</div>
                                        </td>
                                                    <td className="hidden px-3 py-4 md:table-cell">
                                                        <div className="text-sm text-slate-900">{doctor.qualification}</div>
                                        </td>
                                                    <td className="hidden px-3 py-4 lg:table-cell">
                                                        <div className="text-sm text-slate-900">{doctor.experience}</div>
                                        </td>
                                                    <td className="px-3 py-4">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                doctor.status === 'active' 
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : doctor.status === 'pending'
                                                                    ? 'bg-orange-100 text-orange-700'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }`}
                                                        >
                                                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                                                            {doctor.status === 'active'
                                                                ? 'Active'
                                                                : doctor.status === 'pending'
                                                                ? 'Pending'
                                                                : 'Inactive'}
                                            </span>
                                        </td>
                                                    <td className="hidden px-3 py-4 lg:table-cell">
                                                        <div className="text-sm font-medium text-slate-900">{formatDate(doctor.createdAt)}</div>
                                                        <div className="text-xs text-slate-500">Updated {formatDate(doctor.updatedAt)}</div>
                                        </td>
                                                    <td className="px-3 py-4">
                                                        <div className="flex items-center gap-1.5">
                                                <button 
                                                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                                                    onClick={() => handleView(doctor)}
                                                                type="button"
                                                >
                                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                                    <span className="hidden sm:inline">View</span>
                                    </button>
                                                {activeTab === 'pending' && doctor.status === 'pending' && user?.role === 'admin' ? (
                                                    <>
                                                        <button 
                                                                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                                            onClick={() => handleApproveDoctor(doctor.id)}
                                                            disabled={loading}
                                                                        type="button"
                                                        >
                                                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span className="hidden sm:inline">Approve</span>
                                                        </button>
                                                        <button 
                                                                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                                            onClick={() => handleRejectDoctor(doctor.id)}
                                                            disabled={loading}
                                                                        type="button"
                                                        >
                                                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                            <span className="hidden sm:inline">Reject</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                                allowAdd &&
                                                                activeTab === 'active' && (
                                                <button 
                                                                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                                    onClick={() => handleDelete(doctor)}
                                                                        type="button"
                                                >
                                                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                                    <span className="hidden sm:inline">Delete</span>
                                    </button>
                                                                )
                                                )}
                                            </div>
                                </td>
                            </tr>
                                ))
                            )}
                    </tbody>
                </table>
            </div>

                            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    Showing{' '}
                                    <span className="font-semibold text-slate-800">{displayedDoctors.length}</span>{' '}
                                    {activeTab === 'active' ? 'active' : 'pending'} doctors
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
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
                    </div>
                </div>
            </div>

            {/* Doctor Details Modal */}
            <ViewModal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                title="Doctor Details"
                subtitle="Complete doctor information"
                headerColor="green"
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                    {/* Personal Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">Personal Information</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedDoctor?.firstName} {selectedDoctor?.lastName}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedDoctor?.email}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedDoctor?.gender}</p>
                            </div>
                        </div>
                    </div>

                    {/* Professional Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900">Professional Information</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialization</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedDoctor?.specialization}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Qualification</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedDoctor?.qualification}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Experience</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedDoctor?.experience}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consultation Fee</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">₹{selectedDoctor?.consultationFee}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                    selectedDoctor?.status === 'active' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {selectedDoctor?.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* System Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900">System Information</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Doctor ID</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md font-mono">{selectedDoctor?.id}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created At</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDateTime(selectedDoctor?.createdAt || '')}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Updated</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDateTime(selectedDoctor?.updatedAt || '')}</p>
                            </div>
                        </div>
                    </div>
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
                <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden transform transition-all duration-300 ease-out">
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
                                onClick={closeAddDoctorModal}
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
                                onErrorClear={() => setError(null)}
                                onSubmit={handleCreateDoctor}
                                onCancel={closeAddDoctorModal}
                                submitLabel={loading ? 'Adding Doctor...' : 'Add Doctor'}
                                                />
                                            </div>
                                                </div>
                                            </div>
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