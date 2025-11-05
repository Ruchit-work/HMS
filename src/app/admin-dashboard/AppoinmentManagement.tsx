'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs,where,query,doc, deleteDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AdminProtected from '@/components/AdminProtected'
import ViewModal from '@/components/ui/ViewModal'
import DeleteModal from '@/components/ui/DeleteModal'
import { Appointment } from '@/types/patient'

export default function AppoinmentManagement({ disableAdminGuard = true }: { disableAdminGuard?: boolean } = {}) {
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const { user, loading: authLoading } = useAuth()
    const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
    const [sortField, setSortField] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deleteAppointment, setDeleteAppointment] = useState<Appointment | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
        try {
            setLoading(true)
            setError(null)
            const appointmentRef = doc(db, 'appointments', deleteAppointment.id)
            await deleteDoc(appointmentRef)
            setAppointments(prev => prev.filter(a => a.id !== deleteAppointment.id))
            setFilteredAppointments(prev => prev.filter(a => a.id !== deleteAppointment.id))
            setShowViewModal(false)
            setDeleteModal(false)
            setDeleteAppointment(null)
            setSuccessMessage('Appointment deleted successfully!')
            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setLoading(false)
        }
    }
    const fetchAppointments = async () => {
        try {
            setLoading(true)
            setError(null)
            const appointmentsRef = collection(db, 'appointments')
            // Fetch ALL appointments (not just confirmed ones)
            const snapshot = await getDocs(appointmentsRef)
            const appointmentsList = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            })) as Appointment[]
            setAppointments(appointmentsList)
            setFilteredAppointments(appointmentsList)
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        fetchAppointments()
    }, [])

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
        if (search) {
            filtered = filtered.filter(appointment =>
                appointment.patientName?.toLowerCase().includes(search.toLowerCase()) ||
                appointment.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
                appointment.patientEmail?.toLowerCase().includes(search.toLowerCase()) ||
                appointment.doctorSpecialization?.toLowerCase().includes(search.toLowerCase())
            )
        }
        
        // Apply sorting
        if (sortField) {
            filtered = [...filtered].sort((a, b) => {
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
                    default:
                        return 0
                }
                
                if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
                if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
                return 0
            })
        }
        
        setFilteredAppointments(filtered)
    }, [search, appointments, sortField, sortOrder])

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
                                <h3 className="text-lg font-semibold text-gray-900">Appointment Management</h3>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                <div className="relative flex-1 sm:flex-none">
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search appointments..."
                                        className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <button 
                                    className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                                    onClick={fetchAppointments}
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
                        <table className="w-full min-w-[1000px]">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th 
                                        className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('patientName')}
                                    >
                                        Patient ({filteredAppointments.length})
                                        {sortField === 'patientName' && (
                                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </th>
                                    <th 
                                        className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hidden sm:table-cell"
                                        onClick={() => handleSort('doctorName')}
                                    >
                                        Doctor
                                        {sortField === 'doctorName' && (
                                            <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </th>
                                    <th 
                                        className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('appointmentDate')}
                                    >
                                        Date & Time
                                        {sortField === 'appointmentDate' && (
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
                                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Amount</th>
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
                                                <p className="text-sm text-gray-500">Loading appointments...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 sm:px-6 py-12 text-center">
                                            <svg className="w-12 h-12 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                            <p className="text-sm text-red-600 mb-2">Error loading appointments</p>
                                            <p className="text-xs text-gray-500">{error}</p>
                                        </td>
                                    </tr>
                                ) : filteredAppointments.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 sm:px-6 py-12 text-center">
                                            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-sm text-gray-500 mb-1">
                                                {search ? 'No appointments found matching your search' : 'No appointments found'}
                                            </p>
                                            {search && (
                                                <p className="text-xs text-gray-400">
                                                    Try searching with different keywords
                                                </p>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAppointments.map((appointment) => (
                                        <tr className="hover:bg-gray-50 transition-colors" key={appointment.id}>
                                            {/* Patient Info */}
                                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10">
                                                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                            <span className="text-xs sm:text-sm font-medium text-blue-600">
                                                                {appointment.patientName?.charAt(0) || 'P'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="ml-2 sm:ml-4">
                                                        <div className="text-xs sm:text-sm text-gray-900">{appointment.patientName || 'N/A'}</div>
                                                        <div className="text-xs text-gray-500 sm:hidden">{appointment.doctorName || 'N/A'}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Doctor Info */}
                                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                                                <div className="text-sm text-gray-900">{appointment.doctorName || 'N/A'}</div>
                                                <div className="text-sm text-gray-500">{appointment.doctorSpecialization || 'N/A'}</div>
                                            </td>
                                            
                                            {/* Date & Time */}
                                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {formatDate(appointment.appointmentDate)}
                                                </div>
                                                <div className="text-sm text-gray-500">{appointment.appointmentTime || 'N/A'}</div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                                    appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {appointment.status || 'N/A'}
                                                </span>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                                <div className="text-sm text-gray-900">₹{appointment.paymentAmount || 0}</div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-1 sm:gap-2">
                                                    {/* View Button */}
                                                    <button 
                                                        className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-md hover:bg-blue-200 hover:text-blue-800 transition-colors"
                                                        onClick={() => handleView(appointment)}
                                                    >
                                                        <svg className="w-3 h-3 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        <span className="hidden sm:inline">View</span>
                                                    </button>
                                                    
                                                    {/* Delete Button */}
                                                    <button 
                                                        className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 hover:text-red-800 transition-colors"
                                                        onClick={() => handleDelete(appointment)}
                                                    >
                                                        <svg className="w-3 h-3 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        <span className="hidden sm:inline">Delete</span>
                                                    </button>
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
                                Showing <span className="font-medium">{filteredAppointments.length}</span> appointments
                            </p>
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
                <DeleteModal
                    isOpen={deleteModal}
                    onClose={() => setDeleteModal(false)}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Appointment"
                    subtitle="This action cannot be undone"
                    itemType="appointment"
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