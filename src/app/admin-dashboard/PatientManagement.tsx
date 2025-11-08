'use client'

import { useState, useEffect, useCallback } from 'react'
// import { PageHeader } from '@/components/ui/PageHeader'
import { collection, getDocs,where,query,doc, deleteDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { bloodGroups } from '@/constants/signup'
import AdminProtected from '@/components/AdminProtected'
import ViewModal from '@/components/ui/ViewModal'
import DeleteModal from '@/components/ui/DeleteModal'
import OTPVerificationModal from '@/components/form/OTPVerificationModal'
import PasswordRequirements, { isPasswordValid } from '@/components/form/PasswordRequirements'
// import toast from 'react-hot-toast'

interface Patient {
    status: string
    id: string
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
}

export default function PatientManagement({ canDelete = true, canAdd = true, disableAdminGuard = true }: { canDelete?: boolean; canAdd?: boolean; disableAdminGuard?: boolean } = {}) {
    const [patients, setPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
 
    const { user, loading: authLoading } = useAuth()
    const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
    const [sortField, setSortField] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [newPatient, setNewPatient] = useState<Partial<Patient>>({
        status: 'active',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: '',
        bloodGroup: '',
        address: '',
        dateOfBirth: ''
    })
    const [otpModalOpen, setOtpModalOpen] = useState(false)
    const todayStr = new Date().toISOString().split('T')[0]
    const [newPatientPassword, setNewPatientPassword] = useState('')
    const [newPatientPasswordConfirm, setNewPatientPasswordConfirm] = useState('')




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
                const authDeleteResponse = await fetch('/api/admin/delete-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
            setFilteredPatients(prev => prev.filter(p => p.id !== deletePatient.id))
            
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
            setPatients(patientsList)
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

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    useEffect(() => {   
        let filtered = patients
        if (search){
            filtered = filtered.filter(patient =>
                `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
                patient.email.toLowerCase().includes(search.toLowerCase()) ||
                patient.phone.toLowerCase().includes(search.toLowerCase())
            )
        }
        
        // Apply sorting
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
        
        setFilteredPatients(filtered)
    }, [search, patients, sortField, sortOrder])
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
                        {/* <h3 className="text-lg font-semibold text-gray-900">Patient Management</h3> */}
                        {canAdd && (
                            <button onClick={() => setShowAddModal(true)} className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden sm:inline">Add Patient</span>
                            <span className="sm:hidden">Add</span>
                        </button>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative flex-1 sm:flex-none">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search patients..."
                                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <button 
                            className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                            onClick={fetchPatients}
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

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                    <thead className="bg-gray-50">
                        <tr>
                            <th 
                                className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('name')}   >
                                Patient ({filteredPatients.length})
                                {sortField === 'name' && (
                                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </th>
                            <th 
                                className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hidden sm:table-cell"
                                onClick={() => handleSort('email')}
                            >
                                Contact
                                {sortField === 'email' && (
                                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Medical Info</th>
                            <th 
                                className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hidden lg:table-cell"
                                onClick={() => handleSort('createdAt')}
                            >
                                Created At
                                {sortField === 'createdAt' && (
                                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </th>
                            <th 
                                className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('status')}
                            >
                                Status
                                {sortField === 'status' && (
                                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                )}
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-3 sm:px-6 py-12 text-center">
                                    <div className="flex flex-col items-center">
                                        <svg className="w-8 h-8 animate-spin text-blue-600 mb-2" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <p className="text-sm text-gray-500">Loading patients...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={6} className="px-3 sm:px-6 py-12 text-center">
                                    <svg className="w-12 h-12 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                    <p className="text-sm text-red-600 mb-2">Error loading patients</p>
                                    <p className="text-xs text-gray-500">{error}</p>
                                </td>
                            </tr>
                        ) : filteredPatients.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 sm:px-6 py-12 text-center">
                                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p className="text-sm text-gray-500 mb-1">
                                        {search ? 'No patients found matching your search' : 'No patients found'}
                                    </p>
                                    {search && (
                                        <p className="text-xs text-gray-400">
                                            Try searching with different keywords
                                        </p>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            filteredPatients.map((patient) => (
                        <tr className="hover:bg-gray-50 transition-colors" key={patient.id}>
                            {/* Patient Info */}
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <span className="text-xs sm:text-sm font-medium text-blue-600">{patient.firstName.charAt(0)}</span>
                                        </div>
                                    </div>
                                    <div className="ml-2 sm:ml-4">
                                        <div className="text-xs sm:text-sm text-gray-900">{patient.firstName} {patient.lastName}</div>
                                        <div className="text-xs text-gray-500 sm:hidden">{patient.email}</div>
                                    </div>
                                </div>
                            </td>

                            {/* Contact Info */}
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                                <div className="text-sm text-gray-900">{patient.email}</div>
                                <div className="text-sm text-gray-500">{patient.phone}</div>
                            </td>
                            
                            {/* Medical Info */}
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                <div className="text-sm text-gray-900">{patient.gender}</div>
                                <div className="text-sm text-gray-500">{patient.bloodGroup}</div>
                            </td>

                            {/* Created/Updated Info */}
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                                <div className="text-sm text-gray-900">
                                    Created: {formatDate(patient.createdAt)}
                                </div>
                                <div className="text-sm text-gray-500">
                                    Updated: {formatDate(patient.updatedAt)}
                                </div>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    {patient.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-1 sm:gap-2">
                                    {/* View Button */}
                                    <button className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-md hover:bg-blue-200 hover:text-blue-800 transition-colors" onClick={() => handleView(patient)}>
                                        <svg className="w-3 h-3 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        <span className="hidden sm:inline">View</span>
                                    </button>
                                    
                                    {/* Delete Button (hidden/disabled when canDelete is false) */}
                                    {canDelete ? (
                                    <button className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 hover:text-red-800 transition-colors"
                                    onClick={() => handleDelete(patient)}>
                                        <svg className="w-3 h-3 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span className="hidden sm:inline">Delete</span>
                                    </button>
                                    ) : null}
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
                        Showing <span className="font-medium">{filteredPatients.length}</span> patients
                    </p>
                </div>
            </div>
            {/* Patient Details Modal */}
            <ViewModal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                title="Patient Details"
                subtitle="Complete patient information"
                headerColor="blue"  >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                    {/* Personal Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h4 className="text-base sm:text-lg font-semibold text-gray-900">Personal Information</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedPatient?.firstName} {selectedPatient?.lastName}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedPatient?.email}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedPatient?.phone}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedPatient?.gender}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Blood Group</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedPatient?.bloodGroup}</p>
                            </div>
                        </div>
                    </div>

                    {/* Additional Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center space-x-2 mb-4">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900">Additional Information</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{selectedPatient?.address || 'N/A'}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date of Birth</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDate(selectedPatient?.dateOfBirth || '')}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created By</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md capitalize">{selectedPatient?.createdBy || 'N/A'}</p>
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
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient ID</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md font-mono">{selectedPatient?.id}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                    selectedPatient?.status === 'active' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {selectedPatient?.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Created At</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDateTime(selectedPatient?.createdAt || '')}</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Updated</label>
                                <p className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{formatDateTime(selectedPatient?.updatedAt || '')}</p>
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
                title="Delete Patient"
                subtitle="This action cannot be undone"
                itemType="patient"
                itemDetails={{
                    name: `${deletePatient?.firstName || ''} ${deletePatient?.lastName || ''}`,
                    email: deletePatient?.email,
                    phone: deletePatient?.phone,
                    id: deletePatient?.id || ''
                }}
                loading={loading}
            />
        </div>
        {/* Add Patient Modal */}
        {canAdd && showAddModal && (
            <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden transform transition-all duration-300 ease-out">
                    <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg sm:text-xl font-bold">Add Patient</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-white hover:text-blue-200 transition-colors duration-200 p-2 hover:bg-white hover:bg-opacity-20 rounded-lg">
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                    <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 overflow-y-auto max-h-[calc(95vh-200px)]">
                        <form onSubmit={async (e) => {
                            e.preventDefault()
                            try {
                                setLoading(true)
                                setError(null)
                                // Basic required fields check
                                if (!newPatient.firstName || !newPatient.lastName || !newPatient.email) {
                                    setError('Please fill in first name, last name, and email')
                                    setLoading(false)
                                    return
                                }
                                // Password validation (required)
                                if (!isPasswordValid(newPatientPassword)) {
                                    setError('Password does not meet requirements')
                                    setLoading(false)
                                    return
                                }
                                if (newPatientPassword !== newPatientPasswordConfirm) {
                                    setError('Passwords do not match')
                                    setLoading(false)
                                    return
                                }
                                // If phone provided, open OTP modal first
                                if ((newPatient.phone || '').trim()) {
                                    setOtpModalOpen(true)
                                    setLoading(false)
                                    return
                                }
                                const payload = {
                                    ...newPatient,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    createdBy: 'admin',
                                    status: newPatient.status || 'active'
                                } as any
                                const res = await fetch('/api/receptionist/create-patient', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ patientData: payload, password: newPatientPassword })
                                })
                                if (!res.ok) {
                                    const data = await res.json().catch(() => ({}))
                                    throw new Error(data?.error || 'Failed to create patient')
                                }
                                // Refresh list
                                await fetchPatients()
                                setShowAddModal(false)
                                setSuccessMessage('Patient added successfully!')
                                setTimeout(() => setSuccessMessage(null), 3000)
                            } catch (err) {
                                setError((err as Error).message)
                            } finally {
                                setLoading(false)
                            }
                        }} className="space-y-6">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                                <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">First Name *</label>
                                        <input className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatient.firstName || ''} onChange={(e) => setNewPatient(p => ({ ...p, firstName: e.target.value }))} />
                                    </div>
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Name *</label>
                                        <input className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatient.lastName || ''} onChange={(e) => setNewPatient(p => ({ ...p, lastName: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email *</label>
                                    <input type="email" className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatient.email || ''} onChange={(e) => setNewPatient(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</label>
                                        <input className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatient.phone || ''} onChange={(e) => setNewPatient(p => ({ ...p, phone: e.target.value }))} />
                                    </div>
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
                                        <select className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatient.gender || ''} onChange={(e) => setNewPatient(p => ({ ...p, gender: e.target.value }))}>
                                            <option value="">Select</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password *</label>
                                        <input type="password" className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatientPassword} onChange={(e) => setNewPatientPassword(e.target.value)} />
                                        <div className="pt-1"><PasswordRequirements password={newPatientPassword} /></div>
                                    </div>
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirm Password *</label>
                                        <input type="password" className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatientPasswordConfirm} onChange={(e) => setNewPatientPasswordConfirm(e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Blood Group</label>
                                        <select className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatient.bloodGroup || ''} onChange={(e) => setNewPatient(p => ({ ...p, bloodGroup: e.target.value }))}>
                                            <option value="">Select</option>
                                            {bloodGroups.map(bg => (<option key={bg} value={bg}>{bg}</option>))}
                                        </select>
                                    </div>
                                    <div className="flex flex-col space-y-1">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Birthday</label>
                                        <input type="date" max={todayStr} className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" value={newPatient.dateOfBirth || ''} onChange={(e) => setNewPatient(p => ({ ...p, dateOfBirth: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</label>
                                    <textarea className="w-full px-3 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none" rows={3} value={newPatient.address || ''} onChange={(e) => setNewPatient(p => ({ ...p, address: e.target.value }))} />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center">
                                        <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                                        <p className="text-sm text-red-600">{error}</p>
                                    </div>
                                </div>
                            )}

                            <div className="px-0 sm:px-0 py-2 flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 sm:px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium text-sm sm:text-base">Cancel</button>
                                <button type="submit" disabled={loading} className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium shadow-sm hover:shadow-md text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Adding...' : 'Add Patient'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )}
        {/* OTP verification modal before saving new patient */}
        {otpModalOpen && (
            <OTPVerificationModal
                isOpen={otpModalOpen}
                onClose={() => setOtpModalOpen(false)}
                phone={newPatient.phone || ''}
                onVerified={async () => {
                    try {
                        setLoading(true)
                        if (!isPasswordValid(newPatientPassword)) { setError('Password does not meet requirements'); setLoading(false); return }
                        if (newPatientPassword !== newPatientPasswordConfirm) { setError('Passwords do not match'); setLoading(false); return }
                        const payload = {
                            ...newPatient,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            createdBy: 'admin',
                            status: newPatient.status || 'active'
                        } as any
                        const res = await fetch('/api/receptionist/create-patient', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ patientData: payload, password: newPatientPassword })
                        })
                        if (!res.ok) {
                            const data = await res.json().catch(() => ({}))
                            throw new Error(data?.error || 'Failed to create patient')
                        }
                        await fetchPatients()
                        setOtpModalOpen(false)
                        setShowAddModal(false)
                        setSuccessMessage('Patient added successfully!')
                        setTimeout(() => setSuccessMessage(null), 3000)
                    } catch (err) {
                        setError((err as Error).message)
                    } finally {
                        setLoading(false)
                    }
                }}
            />
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