'use client'
import { db } from '@/firebase/config'
import { getDocs, where, query, collection, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AdminProtected from '@/components/AdminProtected'
import ViewModal from '@/components/ui/ViewModal'
import DeleteModal from '@/components/ui/DeleteModal'
import { specializationCategories, qualifications } from '@/constants/signup'

interface Doctor {
    id: string
    firstName: string
    lastName: string
    email: string
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
    const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([])
    const [filteredPendingDoctors, setFilteredPendingDoctors] = useState<Doctor[]>([])
    const [sortField, setSortField] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteDoctor, setDeleteDoctor] = useState<Doctor | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active')
    const [showAddModal, setShowAddModal] = useState(false)
    const [newDoctor, setNewDoctor] = useState({
        firstName: '',
        lastName: '',
        email: '',
        gender: '',
        specialization: '',
        qualification: '',
        experience: '',
        consultationFee: '',
        password: '',
        status: 'active'
    })
    const [specializationCategory, setSpecializationCategory] = useState('')
    const [customSpecialization, setCustomSpecialization] = useState('')
    const [customQualification, setCustomQualification] = useState('')
    const [showSpecializationDropdown, setShowSpecializationDropdown] = useState(false)
    const [showQualificationDropdown, setShowQualificationDropdown] = useState(false)

    const { user, loading: authLoading } = useAuth()

   
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
                const authDeleteResponse = await fetch('/api/admin/delete-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
            setFilteredDoctors(prev => prev.filter(d => d.id !== deleteDoctor.id))
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
    const fetchDoctors = useCallback(async () => {
        try {
            setLoading(true)
            const doctorsRef = collection(db, 'doctors')
            
            // Fetch active doctors
            const activeQ = query(doctorsRef, where('status', '==', 'active'))
            const activeSnapshot = await getDocs(activeQ)
            const activeList = activeSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            })) as Doctor[]
            setDoctors(activeList)
            setFilteredDoctors(activeList)
            
            // Fetch pending doctors
            const pendingQ = query(doctorsRef, where('status', '==', 'pending'))
            const pendingSnapshot = await getDocs(pendingQ)
            const pendingList = pendingSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            })) as Doctor[]
            setPendingDoctors(pendingList)
            setFilteredPendingDoctors(pendingList)
        } catch (error) {
            setError((error as Error).message)  
        } finally {
            setLoading(false)
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
            setFilteredPendingDoctors(prev => prev.filter(d => d.id !== doctorId))
            
            // Refresh active doctors list
            await fetchDoctors()
            
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
                const authDeleteResponse = await fetch('/api/admin/delete-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
            setFilteredPendingDoctors(prev => prev.filter(d => d.id !== doctorId))
            
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
        fetchDoctors()
    }, [fetchDoctors, user, authLoading])

    // Ensure receptionists can't access pending tab
    useEffect(() => {
        if (user && user.role !== 'admin' && activeTab === 'pending') {
            setActiveTab('active')
        }
    }, [user, activeTab])


    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element
            const isDropdownButton = target.closest('[data-dropdown-toggle]')
            const isDropdownMenu = target.closest('[id*="Dropdown"]')
            const isDropdownItem = target.closest('button[type="button"]')
            
            if (!isDropdownButton && !isDropdownMenu && !isDropdownItem) {
                setShowSpecializationDropdown(false)
                setShowQualificationDropdown(false)
            }
        }

        if (showSpecializationDropdown || showQualificationDropdown) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showSpecializationDropdown, showQualificationDropdown])
    const addDoctor = async () => {
        setNewDoctor({
            firstName: '',
            lastName: '',
            email: '',
            gender: '',
            specialization: '',
            qualification: '',
            experience: '',
            consultationFee: '',
            password: '',
            status: 'active'
        })
        setSpecializationCategory('')
        setCustomSpecialization('')
        setCustomQualification('')
        setShowAddModal(true)
    }
    
    const handleCloseAddModal = () => {
        setShowAddModal(false)
        setNewDoctor({
            firstName: '',
            lastName: '',
            email: '',
            gender: '',
            specialization: '',
            qualification: '',
            experience: '',
            consultationFee: '',
            password: '',
            status: 'active'
        })
        setSpecializationCategory('')
        setCustomSpecialization('')
        setCustomQualification('')
    }
    
    const handleAddDoctorSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        // Basic validation
        const hasSpecialization = specializationCategory === "other" ? customSpecialization.trim() : newDoctor.specialization.trim()
        if (!newDoctor.firstName.trim() || !newDoctor.lastName.trim() || !newDoctor.email.trim() || !newDoctor.gender.trim() || !hasSpecialization || !newDoctor.qualification.trim() || !newDoctor.experience.trim() || !newDoctor.consultationFee.trim() || !newDoctor.password.trim()) {
            setError('Please fill in all required fields including password')
            return
        }

        // Password validation
        if (newDoctor.password.length < 6) {
            setError('Password must be at least 6 characters long')
            return
        }
        
        try {
            setLoading(true)
            setError(null)
            
            // Use custom values if "Other" category was selected
            const finalSpecialization = specializationCategory === "other" ? customSpecialization : newDoctor.specialization
            const finalQualification = newDoctor.qualification === "Other" ? customQualification : newDoctor.qualification

            const doctorData = {
                firstName: newDoctor.firstName,
                lastName: newDoctor.lastName,
                email: newDoctor.email,
                gender: newDoctor.gender,
                specialization: finalSpecialization,
                qualification: finalQualification,
                experience: newDoctor.experience,
                consultationFee: parseInt(newDoctor.consultationFee) || 500,
                status: newDoctor.status
            }
            
            // Call the server API to create doctor (no redirect issues!)
            const response = await fetch('/api/admin/create-doctor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    doctorData,
                    password: newDoctor.password
                })
            })
            
            if (!response.ok) {
                let errorMessage = 'Failed to create doctor'
                try {
                    const errorData = await response.json()
                    errorMessage = errorData.error || errorMessage
                } catch (jsonError) {
                    // If response is not JSON, use status text
                    errorMessage = `Server error: ${response.status} ${response.statusText}`
                }
                throw new Error(errorMessage)
            }
            
            const result = await response.json()
            
            // Add the new doctor to the local state
            const newDoctorWithId = {
                id: result.uid,  // Use Firebase Auth UID as ID
                ...doctorData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: "admin"
            }
            
            setDoctors(prev => [...prev, newDoctorWithId])
            setFilteredDoctors(prev => [...prev, newDoctorWithId])
            
            setShowAddModal(false)
            setSuccessMessage('Doctor added successfully! They can now log in with their email and password.')
            setTimeout(() => {
                setSuccessMessage(null)
            }, 5000)
            
        } catch (error) {
            console.error('Error adding doctor:', error)
            if (error instanceof Error) {
                if (error.message.includes('email-already-in-use')) {
                    setError('A doctor with this email already exists')
                } else if (error.message.includes('weak-password')) {
                    setError('Password is too weak. Please use at least 6 characters')
                } else if (error.message.includes('invalid-email')) {
                    setError('Please enter a valid email address')
                } else {
                    setError(`Failed to add doctor: ${error.message}`)
                }
            } else {
                setError('Failed to add doctor. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        let filtered = doctors

    if (search) {
      filtered = filtered.filter(doctor =>
        `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(search.toLowerCase())
      )
    }

    setFilteredDoctors(filtered)
  }, [search, doctors])
    
    useEffect(() => {
        let filtered = pendingDoctors

        if (search) {
          filtered = filtered.filter(doctor =>
            `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
            doctor.specialization.toLowerCase().includes(search.toLowerCase())
          )
        }

        setFilteredPendingDoctors(filtered)
    }, [search, pendingDoctors])
    // Date formatting helper functions
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        } catch (error) {
            return 'Invalid Date'
        }
    }
    
    const formatDateTime = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return new Date(dateString).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch (error) {
            return 'Invalid Date'
        }
    }

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
            <div className="relative">
            {/* Success Notification */}
            {successMessage && (
                <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 transform transition-all duration-300 ease-in-out animate-pulse"
                     style={{
                         animation: 'slideInRight 0.3s ease-out'
                     }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">{successMessage}</span>
                    <button 
                        onClick={() => setSuccessMessage(null)}
                        className="ml-2 text-green-200 hover:text-white"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">Doctor Management</h3>
                            {canAdd && (
                            <button className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                            onClick={addDoctor}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span className="hidden sm:inline">Add Doctor</span>
                            </button>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="relative flex-1 sm:flex-none">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search doctors..."
                                    className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <button 
                                className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                                onClick={fetchDoctors}
                                disabled={loading}
                            >
                                {loading ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                )}
                                <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
                                <span className="sm:hidden">{loading ? '...' : '↻'}</span>
                            </button>   
                        </div>
                    </div>
                </div>

                {/* Tabs - Only show Pending tab to admins */}
                <div className="px-4 sm:px-6 pt-4 border-b border-gray-200">
                    <div className="flex space-x-1">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                                activeTab === 'active'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            Active Doctors ({doctors.length})
                        </button>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative ${
                                    activeTab === 'pending'
                                        ? 'bg-orange-600 text-white'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                }`}
                            >
                                Pending Approval ({pendingDoctors.length})
                                {pendingDoctors.length > 0 && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
            <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                    <thead className="bg-gray-50">
                        <tr>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Doctor ({activeTab === 'active' ? filteredDoctors.length : filteredPendingDoctors.length})
                                </th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Specialization</th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Qualification</th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Experience</th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center">
                                            <svg className="w-8 h-8 animate-spin text-blue-600 mb-2" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <p className="text-sm text-gray-500">Loading doctors...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <svg className="w-12 h-12 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        <p className="text-sm text-red-600 mb-2">Error loading doctors</p>
                                        <p className="text-xs text-gray-500">{error}</p>
                                </td>
                                </tr>
                            ) : (activeTab === 'active' ? filteredDoctors.length : filteredPendingDoctors.length) === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <p className="text-sm text-gray-500 mb-1">
                                            {search 
                                                ? `No ${activeTab === 'active' ? 'active' : 'pending'} doctors found matching your search` 
                                                : activeTab === 'pending' 
                                                    ? 'No pending doctor approvals' 
                                                    : 'No doctors found'}
                                        </p>
                                        {search && (
                                            <p className="text-xs text-gray-400">
                                                Try searching with different keywords
                                            </p>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                (activeTab === 'active' ? filteredDoctors : filteredPendingDoctors).map((doctor) => (
                            <tr className="hover:bg-gray-50 transition-colors" key={doctor.id}>
                                        {/* Doctor Info */}
                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-green-100 flex items-center justify-center">
                                                        <span className="text-xs sm:text-sm font-medium text-green-600">{doctor.firstName.charAt(0)}</span>
                                                    </div>
                                                </div>
                                                <div className="ml-2 sm:ml-4">
                                                    <div className="text-xs sm:text-sm text-gray-900">{doctor.firstName} {doctor.lastName}</div>
                                                    <div className="text-xs text-gray-500 sm:hidden">{doctor.specialization}</div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Specialization */}
                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                                            <div className="text-sm text-gray-900">{doctor.specialization}</div>
                                        </td>
                                        
                                        {/* Qualification */}
                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                            <div className="text-sm text-gray-900">{doctor.qualification}</div>
                                        </td>

                                        {/* Experience */}
                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                            <div className="text-sm text-gray-900">{doctor.experience}</div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                doctor.status === 'active' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : doctor.status === 'pending'
                                                    ? 'bg-orange-100 text-orange-800'
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {doctor.status === 'active' ? 'Active' : doctor.status === 'pending' ? 'Pending' : 'Inactive'}
                                            </span>
                                        </td>

                                        {/* Created At */}
                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                            <div className="text-sm text-gray-900">
                                                Created: {formatDate(doctor.createdAt)}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Updated: {formatDate(doctor.updatedAt)}
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1 sm:gap-2">
                                                {/* View Button */}
                                                <button 
                                                    className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-md hover:bg-blue-200 hover:text-blue-800 transition-colors"
                                                    onClick={() => handleView(doctor)}
                                                >
                                                    <svg className="w-3 h-3 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                                    <span className="hidden sm:inline">View</span>
                                    </button>
                                                
                                                {/* Approve/Reject buttons for pending doctors - Only admins can see and use these */}
                                                {activeTab === 'pending' && doctor.status === 'pending' && user?.role === 'admin' ? (
                                                    <>
                                                        <button 
                                                            className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-md hover:bg-green-200 hover:text-green-800 transition-colors"
                                                            onClick={() => handleApproveDoctor(doctor.id)}
                                                            disabled={loading}
                                                        >
                                                            <svg className="w-3 h-3 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            <span className="hidden sm:inline">Approve</span>
                                                        </button>
                                                        <button 
                                                            className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 hover:text-red-800 transition-colors"
                                                            onClick={() => handleRejectDoctor(doctor.id)}
                                                            disabled={loading}
                                                        >
                                                            <svg className="w-3 h-3 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                            <span className="hidden sm:inline">Reject</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    /* Delete Button (hidden/disabled when canDelete is false) */
                                                    canDelete && activeTab === 'active' ? (
                                                <button 
                                                    className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 hover:text-red-800 transition-colors"
                                                    onClick={() => handleDelete(doctor)}
                                                >
                                                    <svg className="w-3 h-3 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                                    <span className="hidden sm:inline">Delete</span>
                                    </button>
                                                    ) : null
                                                )}
                                            </div>
                                </td>
                            </tr>
                                ))
                            )}
                    </tbody>
                </table>
            </div>

                {/* Footer */}
                <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                        <p className="text-xs sm:text-sm text-gray-700">
                            Showing <span className="font-medium">{activeTab === 'active' ? filteredDoctors.length : filteredPendingDoctors.length}</span> {activeTab === 'active' ? 'active' : 'pending'} doctors
                        </p>
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
                        {/* Modal Header */}
                        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-green-600 to-green-700 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
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
                                    onClick={handleCloseAddModal}
                                    className="text-white hover:text-green-200 transition-colors duration-200 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
                                >
                                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 overflow-y-auto max-h-[calc(95vh-200px)]">
                            <form onSubmit={handleAddDoctorSubmit} className="space-y-6">
                                {/* Basic Information */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col space-y-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">First Name *</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
                                                <input 
                                                    type="text" 
                                                    value={newDoctor.firstName}
                                                    onChange={(e) => setNewDoctor(prev => ({ ...prev, firstName: e.target.value }))}
                                                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200"
                                                    placeholder="John"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col space-y-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Name *</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">👤</span>
                                                <input 
                                                    type="text" 
                                                    value={newDoctor.lastName}
                                                    onChange={(e) => setNewDoctor(prev => ({ ...prev, lastName: e.target.value }))}
                                                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200"
                                                    placeholder="Smith"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email Address *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📧</span>
                                            <input 
                                                type="email" 
                                                value={newDoctor.email}
                                                onChange={(e) => setNewDoctor(prev => ({ ...prev, email: e.target.value }))}
                                                className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200"
                                                placeholder="doctor@hospital.com"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender *</label>
                                        <div className="grid grid-cols-3 gap-3 mt-2">
                                            <label className={`flex items-center justify-center gap-2 px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all ${newDoctor.gender === "Male"
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-gray-300 hover:border-green-400 hover:bg-gray-50 text-gray-700'
                                            }`}>
                                                <input type="radio" name="gender" value="Male" checked={newDoctor.gender === "Male"}
                                                    onChange={(e) => setNewDoctor(prev => ({ ...prev, gender: e.target.value }))} className="sr-only" />
                                                <span className="text-lg">👨</span>
                                                <span className="text-sm font-semibold">Male</span>
                                            </label>

                                            <label className={`flex items-center justify-center gap-2 px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all ${newDoctor.gender === "Female"
                                                ? 'border-pink-500 bg-pink-50 text-pink-700'
                                                : 'border-gray-300 hover:border-pink-400 hover:bg-gray-50 text-gray-700'
                                            }`}>
                                                <input type="radio" name="gender" value="Female" checked={newDoctor.gender === "Female"}
                                                    onChange={(e) => setNewDoctor(prev => ({ ...prev, gender: e.target.value }))} className="sr-only" />
                                                <span className="text-lg">👩</span>
                                                <span className="text-sm font-semibold">Female</span>
                                            </label>

                                            <label className={`flex items-center justify-center gap-2 px-3 py-2.5 border-2 rounded-lg cursor-pointer transition-all ${newDoctor.gender === "Other"
                                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50 text-gray-700'
                                            }`}>
                                                <input type="radio" name="gender" value="Other" checked={newDoctor.gender === "Other"}
                                                    onChange={(e) => setNewDoctor(prev => ({ ...prev, gender: e.target.value }))} className="sr-only" />
                                                <span className="text-lg">⚧️</span>
                                                <span className="text-sm font-semibold">Other</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Professional Information */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Professional Information</h4>
                                    
                                    {/* Specialization */}
                                    <div className="mb-4">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialization *</label>
                                        
                                        {/* Show selected specialization if already chosen */}
                                        {(newDoctor.specialization || (specializationCategory === "other" && customSpecialization)) && (
                                            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 mb-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">✅</span>
                                                        <span className="text-sm font-semibold text-green-800">
                                                            {specializationCategory === "other" ? customSpecialization : newDoctor.specialization}
                                                        </span>
                                                    </div>
                                                    <button type="button"
                                                        onClick={() => {
                                                            setNewDoctor(prev => ({ ...prev, specialization: '' }))
                                                            setSpecializationCategory('')
                                                            setCustomSpecialization('')
                                                        }}
                                                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                                                    > Change </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 1: Category Dropdown (only if no specialization selected) */}
                                        {!newDoctor.specialization && (
                                            <div>
                                                <p className="text-xs text-gray-600 mb-2">Step 1: Select medical field</p>
                                                <div className="relative">
                                                    <button
                                                        id="specializationDropdownButton"
                                                        data-dropdown-toggle="specializationDropdown"
                                                        onClick={() => {
                                                            console.log('Specialization dropdown clicked, current state:', showSpecializationDropdown)
                                                            setShowSpecializationDropdown(!showSpecializationDropdown)
                                                            setShowQualificationDropdown(false)
                                                        }}
                                                        className="w-full pl-12 pr-10 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 text-left flex items-center justify-between hover:border-green-400 transition-all duration-200"
                                                        type="button">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🩺</span>
                                                        <span className="text-gray-700">
                                                            {specializationCategory
                                                                ? specializationCategories.find(cat => cat.id === specializationCategory)?.name || "Medical Field"
                                                                : "Select Medical Field"
                                                            }
                                                        </span>
                                                        <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showSpecializationDropdown ? 'rotate-180' : ''}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                                                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
                                                        </svg>
                                                    </button>

                                                    {/* Dropdown menu */}
                                                    <div
                                                        id="specializationDropdown"
                                                        className={`z-10 absolute top-full left-0 right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 ${showSpecializationDropdown ? 'block' : 'hidden'}`}
                                                    >
                                                        <ul className="py-2 text-sm text-gray-700 max-h-48 overflow-y-auto">
                                                            <li>
                                                                <button type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault()
                                                                        e.stopPropagation()
                                                                        console.log('Clearing specialization category')
                                                                        setSpecializationCategory('')
                                                                        setShowSpecializationDropdown(false)
                                                                    }}
                                                                    className="w-full text-left block px-4 py-2 hover:bg-gray-100 text-gray-500"
                                                                > Select Medical Field </button>
                                                            </li>
                                                            {specializationCategories.map((cat) => (
                                                                <li key={cat.id}>
                                                                    <button type="button"
                                                                        onClick={(e) => {
                                                                            e.preventDefault()
                                                                            e.stopPropagation()
                                                                            console.log('Selected category:', cat.id, cat.name)
                                                                            setSpecializationCategory(cat.id)
                                                                            setShowSpecializationDropdown(false)
                                                                        }}
                                                                        className="w-full text-left block px-4 py-2 hover:bg-gray-100"
                                                                    >{cat.name} </button>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Step 2: Specialization Selection */}
                                        {!newDoctor.specialization && specializationCategory && specializationCategory !== "other" && (
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs text-gray-600 font-medium">Step 2: Choose specialization</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSpecializationCategory('')}
                                                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                                                    >
                                                        ← Change field
                                                    </button>
                                                </div>
                                                <div className="border-2 border-green-200 bg-green-50/30 rounded-lg p-3">
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {specializationCategories
                                                            .find(cat => cat.id === specializationCategory)
                                                            ?.specializations.map((spec) => (
                                                                <button
                                                                    key={spec}
                                                                    type="button"
                                                                    onClick={() => setNewDoctor(prev => ({ ...prev, specialization: spec }))}
                                                                    className="text-left px-4 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all text-sm font-medium text-gray-800 hover:shadow-md"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                                                        {spec}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Custom specialization input */}
                                        {specializationCategory === "other" && (
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs text-gray-600 font-medium">Step 2: Enter specialization</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSpecializationCategory('')}
                                                        className="text-xs text-green-600 hover:text-green-800 font-medium"
                                                    >
                                                        ← Change field
                                                    </button>
                                                </div>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">✏️</span>
                                                    <input
                                                        type="text"
                                                        value={customSpecialization}
                                                        onChange={(e) => {
                                                            setCustomSpecialization(e.target.value)
                                                            // Don't set specialization to "Other" yet, wait for form submission
                                                        }}
                                                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200"
                                                        placeholder="Enter specialization (e.g., Sports Medicine)"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Qualification */}
                                    <div className="mb-4">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Qualification *</label>
                                        <div className="relative">
                                            <button
                                                id="qualificationDropdownButton"
                                                data-dropdown-toggle="qualificationDropdown"
                                                onClick={() => {
                                                    console.log('Qualification dropdown clicked, current state:', showQualificationDropdown)
                                                    setShowQualificationDropdown(!showQualificationDropdown)
                                                    setShowSpecializationDropdown(false)
                                                }}
                                                className="w-full pl-12 pr-10 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 text-left flex items-center justify-between hover:border-green-400 transition-all duration-200"
                                                type="button"
                                            >
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🎓</span>
                                                <span className="text-gray-700">
                                                    {newDoctor.qualification || "Select Qualification"}
                                                </span>
                                                <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showQualificationDropdown ? 'rotate-180' : ''}`} aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 4 4 4-4" />
                                                </svg>
                                            </button>

                                            {/* Dropdown menu */}
                                            <div
                                                id="qualificationDropdown"
                                                className={`z-10 absolute top-full left-0 right-0 mt-1 bg-white divide-y divide-gray-100 rounded-lg shadow-lg border border-gray-200 ${showQualificationDropdown ? 'block' : 'hidden'}`}
                                            >
                                                <ul className="py-2 text-sm text-gray-700 max-h-60 overflow-y-auto">
                                                    <li>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                console.log('Clearing qualification')
                                                                setNewDoctor(prev => ({ ...prev, qualification: '' }))
                                                                setShowQualificationDropdown(false)
                                                            }}
                                                            className="w-full text-left block px-4 py-2 hover:bg-gray-100 text-gray-500"
                                                        >
                                                            Select Qualification
                                                        </button>
                                                    </li>
                                                    {qualifications.map((qual) => (
                                                        <li key={qual}>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    console.log('Selected qualification:', qual)
                                                                    setNewDoctor(prev => ({ ...prev, qualification: qual }))
                                                                    setShowQualificationDropdown(false)
                                                                }}
                                                                className="w-full text-left block px-4 py-2 hover:bg-gray-100"
                                                            >
                                                                {qual}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {newDoctor.qualification === "Other" && (
                                            <div className="relative mt-3">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">✏️</span>
                                                <input
                                                    type="text"
                                                    value={customQualification}
                                                    onChange={(e) => setCustomQualification(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200"
                                                    placeholder="Enter qualification"
                                                    required
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Experience and Fee */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col space-y-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Experience *</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">⏱️</span>
                                                <input 
                                                    type="text" 
                                                    value={newDoctor.experience}
                                                    onChange={(e) => setNewDoctor(prev => ({ ...prev, experience: e.target.value }))}
                                                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200"
                                                    placeholder="5 years"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col space-y-1">
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consultation Fee (₹) *</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">💰</span>
                                                <input 
                                                    type="number" 
                                                    value={newDoctor.consultationFee}
                                                    onChange={(e) => setNewDoctor(prev => ({ ...prev, consultationFee: e.target.value }))}
                                                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200"
                                                    placeholder="500"
                                                    min="0"
                                                    step="50"
                                                    required
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">Per consultation</p>
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div className="mt-4">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                                        <select 
                                            value={newDoctor.status}
                                            onChange={(e) => setNewDoctor(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 transition-all duration-200"
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>

                                    {/* Password */}
                                    <div className="mt-4">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                                            <input 
                                                type="password" 
                                                value={newDoctor.password}
                                                onChange={(e) => setNewDoctor(prev => ({ ...prev, password: e.target.value }))}
                                                className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white text-gray-900 placeholder:text-gray-400 transition-all duration-200"
                                                placeholder="Enter password (min 6 characters)"
                                                minLength={6}
                                                required
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Doctor will use this password to log in</p>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                            <p className="text-sm text-red-600">{error}</p>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-4 sm:px-8 py-4 bg-white border-t border-gray-200 flex justify-end space-x-3">
                            <button
                                onClick={handleCloseAddModal}
                                className="px-4 sm:px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium text-sm sm:text-base"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddDoctorSubmit}
                                disabled={loading}
                                className="px-4 sm:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium shadow-sm hover:shadow-md text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Adding Doctor...' : 'Add Doctor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
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