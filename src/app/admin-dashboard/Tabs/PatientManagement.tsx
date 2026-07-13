"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
// import { PageHeader } from '@/components/ui/PageHeader'
import { where, query, doc, deleteDoc, onSnapshot, collection, getDocs, type DocumentData, type QueryDocumentSnapshot, type QuerySnapshot } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { useDebounce } from '@/hooks/useDebounce'
import { getHospitalCollection } from '@/utils/firebase/hospital-queries'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import AdminProtected from '@/components/AdminProtected'
import { ViewModal, DeleteModal } from '@/components/ui/overlays/Modals'
import { RevealModal, useRevealModalClose } from '@/components/ui/overlays/RevealModal'
import OTPVerificationModal from '@/components/forms/OTPVerificationModal'
import PatientProfileForm, { PatientProfileFormValues } from '@/components/forms/PatientProfileForm'
import { calculateAge, formatDate, formatDateTime } from '@/utils/shared/date'
import { SuccessToast } from '@/components/ui/feedback/StatusComponents'
import { useTablePagination } from '@/hooks/useTablePagination'
import DocumentListCompact from '@/components/documents/DocumentListCompact'
import {
  EnterpriseDataTable,
  StatusPill,
  type EnterpriseColumn,
  type EnterpriseRowAction,
} from '@/components/ui/enterprise-table'
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
        appointments?: Array<{
            id: string
            appointmentDate?: string
            appointmentTime?: string
            doctorName?: string
            status?: string
            chiefComplaint?: string
            medicalHistory?: string
        }>
        nextAppointment?: {
            date: string
            time: string
            doctorName: string
            status: string
            chiefComplaint?: string
            medicalHistory?: string
        }
    }
    defaultBranchId?: string
    defaultBranchName?: string
}

interface PatientManagementProps {
    canDelete?: boolean
    canAdd?: boolean
    disableAdminGuard?: boolean
    /** When provided, receptionist views will be filtered to this branch */
    receptionistBranchId?: string | null
    /** When provided (admin dashboard), filter patients by this branch */
    selectedBranchId?: string
}

type BranchOption = { id: string; name: string }

type ReportFilterType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'all'

function GenerateReportModalContent({
  reportFilter,
  setReportFilter,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  reportFormat,
  setReportFormat,
  generatingReport,
  error,
  onGenerate,
}: {
  reportFilter: ReportFilterType
  setReportFilter: (v: ReportFilterType) => void
  customStartDate: string
  setCustomStartDate: (v: string) => void
  customEndDate: string
  setCustomEndDate: (v: string) => void
  reportFormat: 'pdf' | 'excel'
  setReportFormat: (v: 'pdf' | 'excel') => void
  generatingReport: boolean
  error: string | null
  onGenerate: () => void
}) {
  const requestClose = useRevealModalClose()
  return (
    <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-200 bg-gradient-to-r from-green-50 to-cyan-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Generate Patient Report</h3>
          <button
            onClick={requestClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="px-6 py-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Date Range</label>
          <select
            value={reportFilter}
            onChange={(e) => setReportFilter(e.target.value as ReportFilterType)}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="daily">Daily (Today)</option>
            <option value="weekly">Weekly (Last 7 days)</option>
            <option value="monthly">Monthly (Current month)</option>
            <option value="yearly">Yearly (Current year)</option>
            <option value="custom">Custom Range</option>
            <option value="all">All Patients</option>
          </select>
        </div>
        {reportFilter === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Report Format</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="pdf"
                checked={reportFormat === 'pdf'}
                onChange={(e) => setReportFormat(e.target.value as 'pdf')}
                className="h-4 w-4 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-slate-700">PDF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="excel"
                checked={reportFormat === 'excel'}
                onChange={(e) => setReportFormat(e.target.value as 'excel')}
                className="h-4 w-4 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-slate-700">Excel (.xlsx)</span>
            </label>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex justify-end gap-3">
          <button
            onClick={requestClose}
            disabled={generatingReport}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onGenerate}
            disabled={generatingReport}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {generatingReport ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddPatientModalContent({
  loading,
  error,
  onErrorClear,
  onSubmit,
  receptionistBranchId,
  submitLabel,
}: {
  loading: boolean
  error: string | null
  onErrorClear: () => void
  onSubmit: (values: PatientProfileFormValues) => void | Promise<void>
  receptionistBranchId: string | null
  submitLabel: string
}) {
  const requestClose = useRevealModalClose()
  const handleCancel = () => {
    requestClose()
  }
  return (
    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden">
      <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-cyan-600 to-teal-700 text-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold">Add Patient</h3>
            <p className="text-cyan-100 text-xs sm:text-sm">Create a new patient record</p>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="text-white hover:text-cyan-200 transition-colors duration-200 p-2 hover:bg-white/20 rounded-lg"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="px-4 sm:px-8 py-4 sm:py-6 bg-gray-50 overflow-y-auto max-h-[calc(95vh-200px)]">
        <PatientProfileForm
          mode="admin"
          loading={loading}
          externalError={error ?? undefined}
          onErrorClear={onErrorClear}
          onSubmit={onSubmit}
          onCancel={handleCancel}
          enableCountryCode={false}
          receptionistMode={receptionistBranchId != null}
          initialValues={receptionistBranchId != null ? { password: '123456' } : undefined}
          submitLabel={submitLabel}
        />
      </div>
    </div>
  )
}

export default function PatientManagement({
    canDelete = true,
    canAdd = true,
    disableAdminGuard = true,
    receptionistBranchId = null,
    selectedBranchId = "all"
}: PatientManagementProps = {}) {
    const [patients, setPatients] = useState<Patient[]>([])
    const [legacyPatients, setLegacyPatients] = useState<Patient[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const debouncedSearch = useDebounce(search, 300)
 
    const { user, loading: authLoading } = useAuth()
    const { activeHospitalId, isSuperAdmin } = useMultiHospital()
    const [sortField, setSortField] = useState<string>('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
    const [appointmentViewFilter, setAppointmentViewFilter] = useState<'all' | 'upcoming' | null>(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [deleteModal, setDeleteModal] = useState(false)
    const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showOtpModal, setShowOtpModal] = useState(false)
    const [pendingPatientValues, setPendingPatientValues] = useState<PatientProfileFormValues | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [showReportModal, setShowReportModal] = useState(false)
    const [reportFilter, setReportFilter] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'all'>('all')
    const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf')
    const [customStartDate, setCustomStartDate] = useState('')
    const [customEndDate, setCustomEndDate] = useState('')
    const [generatingReport, setGeneratingReport] = useState(false)
    const [branchBackfillModalOpen, setBranchBackfillModalOpen] = useState(false)
    const [branchBackfillLoading, setBranchBackfillLoading] = useState(false)
    const [branchBackfillError, setBranchBackfillError] = useState<string | null>(null)
    const [branchBackfillPreview, setBranchBackfillPreview] = useState<{
        wouldAssign: number
        targetBranch: { id: string; name: string }
        scanned: number
        samples: string[]
        reachedEnd: boolean
        capped: boolean
    } | null>(null)
    const [branchEditModalOpen, setBranchEditModalOpen] = useState(false)
    const [branchEditPatient, setBranchEditPatient] = useState<Patient | null>(null)
    const [branchOptions, setBranchOptions] = useState<BranchOption[]>([])
    const [branchOptionsLoading, setBranchOptionsLoading] = useState(false)
    const [selectedBranchIdForEdit, setSelectedBranchIdForEdit] = useState("")
    const [branchEditLoading, setBranchEditLoading] = useState(false)
    const [branchEditError, setBranchEditError] = useState<string | null>(null)

    // Root `patients` with hospitalId (legacy + flows that write root first). Realtime so new rows stay visible.
    useEffect(() => {
        if (!activeHospitalId) {
            setLegacyPatients([])
            return () => {}
        }

        const legacyRef = collection(db, 'patients')
        const legacyQuery = query(
            legacyRef,
            where('hospitalId', '==', activeHospitalId),
            where('status', 'in', ['active', 'inactive'])
        )

        try {
            const unsubscribe = onSnapshot(
                legacyQuery,
                (legacySnapshot) => {
                    const mapped = legacySnapshot.docs.map((legacyDoc) => ({
                        id: legacyDoc.id,
                        ...legacyDoc.data(),
                    })) as Patient[]
                    setLegacyPatients(mapped)
                },
                () => {
                    setLegacyPatients([])
                }
            )
            return () => unsubscribe()
        } catch {
            setLegacyPatients([])
            return () => {}
        }
    }, [activeHospitalId])
    const fetchPatientAppointmentDetails = useCallback(async (patient: Patient) => {
        if (!activeHospitalId) {
            return null
        }

        const appointmentMap = new Map<string, any>()
        const appointmentsRef = getHospitalCollection(activeHospitalId, 'appointments')

        // Query by UID and patient ID because old + new records are not always consistent.
        const tasks: Promise<QuerySnapshot<DocumentData>>[] = [getDocs(query(appointmentsRef, where('patientUid', '==', patient.id)))]
        if (patient.patientId) {
            tasks.push(getDocs(query(appointmentsRef, where('patientId', '==', patient.patientId))))
        }

        const snapshots = await Promise.all(tasks)
        snapshots.forEach((snap) => {
            snap.docs.forEach((aptDoc: QueryDocumentSnapshot<DocumentData>) => {
                appointmentMap.set(aptDoc.id, { id: aptDoc.id, ...(aptDoc.data() || {}) })
            })
        })

        const appointments = Array.from(appointmentMap.values())
        const today = new Date().toISOString().split('T')[0]
        const upcoming = appointments.filter((apt: any) => {
            const isUpcoming = String(apt.appointmentDate || '') >= today
            const isActiveStatus = ['confirmed', 'pending', 'whatsapp_pending'].includes(String(apt.status || ''))
            return isUpcoming && isActiveStatus
        })

        const nextAppointment = upcoming.length > 0
            ? upcoming.sort((a: any, b: any) => {
                const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}`).getTime()
                const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime || '00:00'}`).getTime()
                return dateA - dateB
            })[0]
            : null

        const sortedAppointments = appointments.sort((a: any, b: any) => {
            const aTime = new Date(`${a.appointmentDate || ''}T${a.appointmentTime || '00:00'}`).getTime()
            const bTime = new Date(`${b.appointmentDate || ''}T${b.appointmentTime || '00:00'}`).getTime()
            return bTime - aTime
        })

        return {
            total: appointments.length,
            upcoming: upcoming.length,
            appointments: sortedAppointments.map((apt: any) => ({
                id: String(apt.id || ''),
                appointmentDate: apt.appointmentDate,
                appointmentTime: apt.appointmentTime,
                doctorName: apt.doctorName,
                status: apt.status,
                chiefComplaint: apt.chiefComplaint,
                medicalHistory: apt.medicalHistory,
            })),
            nextAppointment: nextAppointment ? {
                date: nextAppointment.appointmentDate,
                time: nextAppointment.appointmentTime || '',
                doctorName: nextAppointment.doctorName || 'To be assigned',
                status: nextAppointment.status,
                chiefComplaint: nextAppointment.chiefComplaint || '',
                medicalHistory: nextAppointment.medicalHistory || '',
            } : undefined,
        }
    }, [activeHospitalId])

    const handleView = async (patient: Patient) => {
        setAppointmentViewFilter(null)
        setSelectedPatient({ ...patient, appointmentDetails: undefined })
        setShowViewModal(true)
        try {
            const details = await fetchPatientAppointmentDetails(patient)
            setSelectedPatient((prev) => {
                if (!prev || prev.id !== patient.id) return prev
                return {
                    ...prev,
                    appointmentDetails: details || {
                        total: 0,
                        upcoming: 0,
                    },
                }
            })
        } catch {
            setSelectedPatient((prev) => {
                if (!prev || prev.id !== patient.id) return prev
                return {
                    ...prev,
                    appointmentDetails: {
                        total: 0,
                        upcoming: 0,
                    },
                }
            })
        }
    }
    const handleDelete = (patient: Patient) => {
        if (!canDelete) return
        setDeletePatient(patient)
        setDeleteModal(true)
    }
    const handleDeleteConfirm = async () => {
        if (!canDelete || !deletePatient) return
        
        // Optimistic update: Remove from UI immediately
        const previousPatients = [...patients]
        const deletedPatient = deletePatient
        
        setPatients(prev => prev.filter(p => p.id !== deletePatient.id))
        setDeleteModal(false)
        setDeletePatient(null)
        
        try {
            setLoading(true)
            setError(null) // Clear any previous errors
            
            // First, delete from Firebase Auth
            try {
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
                    body: JSON.stringify({ uid: deletedPatient.id, userType: 'Patient' })
                })
                
                if (!authDeleteResponse.ok) {
                    await authDeleteResponse.json().catch(() => ({}))
                    // Continue with Firestore deletion even if auth deletion fails
                }
            } catch {
                // Continue with Firestore deletion even if auth deletion fails
            }
            
            // Then delete from Firestore: hospital-scoped patients + legacy root collection
            if (activeHospitalId) {
                try {
                    const scopedRef = doc(getHospitalCollection(activeHospitalId, 'patients'), deletedPatient.id)
                    await deleteDoc(scopedRef)
                } catch {
                }
            }
            try {
                const legacyRef = doc(db, 'patients', deletedPatient.id)
                await deleteDoc(legacyRef)
            } catch {
            }
            
            // Show success message
            setSuccessMessage('Patient deleted successfully from database and authentication!')
            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)
            
        } catch (error) {
            // Rollback on error
            setPatients(previousPatients)
            setDeletePatient(deletedPatient)
            setError((error as Error).message || 'Failed to delete patient')
        } finally {
            setLoading(false)
        }
    }
    const setupPatientsListener = useCallback(() => {
        if (!activeHospitalId) return () => {}
        
        try{
            setLoading(true)
            const patientsRef = getHospitalCollection(activeHospitalId, 'patients')
            const q = query(patientsRef, where('status','in',['active','inactive']))
            
            const unsubscribe = onSnapshot(q, async (snapshot) => {
                let patientsList = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                })) as Patient[]

                // Merge in legacy patients (loaded once per hospital) and de-duplicate by id.
                if (legacyPatients.length > 0) {
                    const byId = new Map<string, Patient>()
                    patientsList.forEach((p) => byId.set(p.id, p))
                    legacyPatients.forEach((p) => {
                        if (!byId.has(p.id)) {
                            byId.set(p.id, p)
                        }
                    })
                    patientsList = Array.from(byId.values())
                }

                // If used from receptionist dashboard, restrict to their branch.
                // Include patients with no branch (legacy / IPD auto-register before branch was set) so they stay visible.
                if (receptionistBranchId) {
                    patientsList = patientsList.filter(
                        (p) =>
                            p.defaultBranchId === receptionistBranchId ||
                            p.defaultBranchId == null ||
                            p.defaultBranchId === ""
                    )
                }
                
                // Admin branch filter: match branch or patients with no branch (same as receptionist list)
                if (!receptionistBranchId && selectedBranchId !== "all") {
                    patientsList = patientsList.filter(
                        (p) =>
                            p.defaultBranchId === selectedBranchId ||
                            p.defaultBranchId == null ||
                            p.defaultBranchId === ""
                    )
                }
                
                // Appointment stats are loaded on-demand when View modal opens.
                setPatients(patientsList)
                setLoading(false)
            }, (error) => {
                setError(error.message)
                setLoading(false)
            })
            
            return unsubscribe
        } catch (error) {
            setError((error as Error).message)
        } finally {
            setLoading(false)
        }
    }, [activeHospitalId, receptionistBranchId, selectedBranchId, legacyPatients])

    useEffect(() => {   
        if (!user || authLoading || !activeHospitalId) return
        
        const unsubscribe = setupPatientsListener()
        
        // Cleanup function
        return () => {
            if (unsubscribe) {
                unsubscribe()
            }
        }
    }, [setupPatientsListener, user, authLoading, activeHospitalId, selectedBranchId])

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
        const searchTrimmed = (debouncedSearch || "").trim().toLowerCase()
        if (searchTrimmed) {
            filtered = filtered.filter(patient => {
                const fullName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim().toLowerCase()
                const email = (patient.email || "").toLowerCase()
                const phone = (patient.phone || "").replace(/\D/g, "")
                const searchDigits = searchTrimmed.replace(/\D/g, "")
                return (
                    fullName.includes(searchTrimmed) ||
                    email.includes(searchTrimmed) ||
                    (patient.patientId && patient.patientId.toLowerCase().includes(searchTrimmed)) ||
                    (searchDigits.length >= 2 && phone.includes(searchDigits))
                )
            })
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
    }, [patients, debouncedSearch, sortField, sortOrder, statusFilter])

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

    const allowAdd = canAdd && !isSuperAdmin && user?.role === "receptionist"

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

            // Real-time listener will automatically update patients
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
        // Receptionist portal: create patient directly without OTP
        if (receptionistBranchId != null) {
            await finalizePatientCreation(values)
            return
        }
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
            iconClass: 'bg-cyan-100 text-cyan-700',
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
            deltaClass: 'text-cyan-700',
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
            deltaClass: 'text-cyan-700',
            iconClass: 'bg-cyan-100 text-cyan-700',
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

    const handleGenerateReport = async () => {
        try {
            setGeneratingReport(true)
            setError(null)

            // Validate custom date range if custom filter is selected
            if (reportFilter === 'custom') {
                if (!customStartDate || !customEndDate) {
                    setError('Please select both start and end dates for custom range')
                    setGeneratingReport(false)
                    return
                }
                if (new Date(customStartDate) > new Date(customEndDate)) {
                    setError('Start date must be before end date')
                    setGeneratingReport(false)
                    return
                }
            }

            // Build query parameters
            const params = new URLSearchParams({
                filter: reportFilter,
                format: reportFormat
            })

            if (reportFilter === 'custom') {
                params.append('startDate', customStartDate)
                params.append('endDate', customEndDate)
            }

            // Get auth token
            const currentUser = auth.currentUser
            if (!currentUser) {
                setError('You must be logged in to generate reports')
                setGeneratingReport(false)
                return
            }

            const token = await currentUser.getIdToken()

            // Fetch report
            const response = await fetch(`/api/admin/patient-reports?${params.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to generate report')
            }

            // Download the file
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            
            const contentDisposition = response.headers.get('Content-Disposition')
            let filename = `patient_report_${reportFilter}_${new Date().toISOString().split('T')[0]}.${reportFormat === 'pdf' ? 'pdf' : 'xlsx'}`
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/)
                if (filenameMatch) {
                    filename = filenameMatch[1]
                }
            }
            
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            // Close modal and show success
            setShowReportModal(false)
            setSuccessMessage('Report generated and downloaded successfully!')
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (error) {
            setError((error as Error).message || 'Failed to generate report')
        } finally {
            setGeneratingReport(false)
        }
    }
    
    useEffect(() => {
        if (!allowAdd && showAddModal) {
            closeAddPatientModal()
        }
    }, [allowAdd, showAddModal])

    useEffect(() => {
        if (!branchBackfillModalOpen || !activeHospitalId) return
        let cancelled = false
        setBranchBackfillError(null)
        setBranchBackfillPreview(null)
        setBranchBackfillLoading(true)
        ;(async () => {
            try {
                const currentUser = auth.currentUser
                if (!currentUser) {
                    throw new Error("You must be signed in.")
                }
                const token = await currentUser.getIdToken()
                const res = await fetch("/api/admin/patients/branch-backfill", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        dryRun: true,
                        maxUpdates: 3000,
                        hospitalId: activeHospitalId,
                    }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) {
                    throw new Error(data?.error || "Failed to scan patients")
                }
                if (cancelled) return
                setBranchBackfillPreview({
                    wouldAssign: data.wouldAssign ?? 0,
                    targetBranch: data.targetBranch,
                    scanned: data.scanned ?? 0,
                    samples: Array.isArray(data.samplePatientDocIds) ? data.samplePatientDocIds : [],
                    reachedEnd: Boolean(data.reachedEnd),
                    capped: Boolean(data.cappedByMaxUpdates),
                })
            } catch (e: unknown) {
                if (!cancelled) {
                    setBranchBackfillError((e as Error)?.message || "Preview failed")
                }
            } finally {
                if (!cancelled) {
                    setBranchBackfillLoading(false)
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [branchBackfillModalOpen, activeHospitalId])

    const handleBranchBackfillApply = async () => {
        if (!activeHospitalId) return
        setBranchBackfillLoading(true)
        setBranchBackfillError(null)
        try {
            const currentUser = auth.currentUser
            if (!currentUser) {
                throw new Error("You must be signed in.")
            }
            const token = await currentUser.getIdToken()
            const res = await fetch("/api/admin/patients/branch-backfill", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    dryRun: false,
                    maxUpdates: 400,
                    hospitalId: activeHospitalId,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data?.error || "Failed to assign branches")
            }
            const n = typeof data.updated === "number" ? data.updated : 0
            const branchLabel = data.targetBranch?.name || "branch"
            setSuccessMessage(
                n > 0
                    ? `Assigned "${branchLabel}" to ${n} patient record(s). Open this tool again if more patients still show "Not assigned".`
                    : "No patients in this batch needed a branch assignment."
            )
            setTimeout(() => setSuccessMessage(null), 6000)
            setBranchBackfillModalOpen(false)
            setBranchBackfillPreview(null)
        } catch (e: unknown) {
            setBranchBackfillError((e as Error)?.message || "Apply failed")
        } finally {
            setBranchBackfillLoading(false)
        }
    }

    const openBranchEditModal = (patient: Patient) => {
        setBranchEditPatient(patient)
        setSelectedBranchIdForEdit(patient.defaultBranchId || "")
        setBranchEditError(null)
        setBranchEditModalOpen(true)
    }

    useEffect(() => {
        if (!branchEditModalOpen || !activeHospitalId) return
        let cancelled = false
        setBranchOptionsLoading(true)
        ;(async () => {
            try {
                const currentUser = auth.currentUser
                if (!currentUser) throw new Error("You must be logged in")
                const token = await currentUser.getIdToken()
                const res = await fetch(`/api/branches?hospitalId=${encodeURIComponent(activeHospitalId)}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok || !data?.success) {
                    throw new Error(data?.error || "Failed to load branches")
                }
                const rows = Array.isArray(data?.branches) ? data.branches : []
                if (cancelled) return
                setBranchOptions(
                    rows
                        .map((b: any) => ({
                            id: String(b?.id || "").trim(),
                            name: String(b?.name || "Branch").trim(),
                        }))
                        .filter((b: BranchOption) => b.id)
                )
            } catch (e: unknown) {
                if (!cancelled) {
                    setBranchEditError((e as Error)?.message || "Failed to load branches")
                    setBranchOptions([])
                }
            } finally {
                if (!cancelled) setBranchOptionsLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [branchEditModalOpen, activeHospitalId])

    const handleSavePatientBranch = async () => {
        if (!branchEditPatient) return
        if (!selectedBranchIdForEdit) {
            setBranchEditError("Select a branch")
            return
        }
        setBranchEditLoading(true)
        setBranchEditError(null)
        try {
            const currentUser = auth.currentUser
            if (!currentUser) throw new Error("You must be logged in")
            const token = await currentUser.getIdToken()
            const res = await fetch(`/api/receptionist/patients/${encodeURIComponent(branchEditPatient.id)}/branch`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ branchId: selectedBranchIdForEdit }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data?.error || "Failed to update branch")
            }
            const branchName =
                branchOptions.find((b) => b.id === selectedBranchIdForEdit)?.name || data?.branch?.name || "Branch"
            setSuccessMessage(`Updated branch for ${branchEditPatient.firstName} ${branchEditPatient.lastName} to ${branchName}.`)
            setTimeout(() => setSuccessMessage(null), 4000)
            if (selectedPatient?.id === branchEditPatient.id) {
                setSelectedPatient({
                    ...selectedPatient,
                    defaultBranchId: selectedBranchIdForEdit,
                    defaultBranchName: branchName,
                })
            }
            setBranchEditModalOpen(false)
        } catch (e: unknown) {
            setBranchEditError((e as Error)?.message || "Failed to update branch")
        } finally {
            setBranchEditLoading(false)
        }
    }

    const patientColumns: EnterpriseColumn<Patient>[] = useMemo(
        () => [
            {
                key: 'name',
                header: `Patient (${filteredPatients.length})`,
                sortable: true,
                render: (patient) => {
                    const age = calculateAge(patient.dateOfBirth)
                    const initials = `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`
                    return (
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 transition-colors group-hover:bg-cyan-100 group-hover:text-cyan-700">
                                {initials}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                    {patient.firstName} {patient.lastName}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                    {age !== null && (
                                        <span className="text-xs text-slate-500">{age}y</span>
                                    )}
                                    {patient.bloodGroup && (
                                        <>
                                            {age !== null && <span className="text-xs text-slate-300">·</span>}
                                            <span className="text-xs font-semibold text-rose-600">{patient.bloodGroup}</span>
                                        </>
                                    )}
                                    {patient.gender && (
                                        <>
                                            <span className="text-xs text-slate-300">·</span>
                                            <span className="text-xs capitalize text-slate-400">{patient.gender}</span>
                                        </>
                                    )}
                                </div>
                                {patient.patientId && (
                                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">#{patient.patientId}</p>
                                )}
                            </div>
                        </div>
                    )
                },
            },
            {
                key: 'email',
                header: 'Contact',
                sortable: true,
                hideBelow: 'sm',
                render: (patient) => (
                    <>
                        <p className="max-w-[180px] truncate text-sm text-slate-700">{patient.email}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{patient.phone || '—'}</p>
                    </>
                ),
            },
            {
                key: 'branch',
                header: 'Branch',
                hideBelow: 'lg',
                render: (patient) => (
                    <p className="text-sm text-slate-700">{patient.defaultBranchName || 'Not assigned'}</p>
                ),
            },
            {
                key: 'createdAt',
                header: 'Created',
                sortable: true,
                hideBelow: 'lg',
                render: (patient) => (
                    <>
                        <p className="text-sm text-slate-700">{formatDate(patient.createdAt)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">Updated {formatDate(patient.updatedAt)}</p>
                    </>
                ),
            },
            {
                key: 'status',
                header: 'Status',
                sortable: true,
                render: (patient) => (
                    <StatusPill
                        label={patient.status === 'active' ? 'Active' : 'Inactive'}
                        variant={patient.status === 'active' ? 'success' : 'neutral'}
                    />
                ),
            },
        ],
        [filteredPatients.length]
    )

    const patientRowActions: EnterpriseRowAction<Patient>[] = useMemo(() => {
        const actions: EnterpriseRowAction<Patient>[] = [
            {
                label: 'Branch',
                onClick: (patient) => openBranchEditModal(patient),
            },
        ]
        if (canDelete) {
            actions.push({
                label: 'Delete',
                variant: 'danger',
                icon: (
                    <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                ),
                onClick: (patient) => handleDelete(patient),
            })
        }
        return actions
    }, [canDelete])

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

          <div className="rx-section-card">
            {/* ── Module header ── */}
            <div className="rx-section-header flex-wrap gap-y-3">
              <div className="min-w-0">
                <p className="rx-section-title">Patient Records</p>
                <p className="rx-section-subtitle">
                  {metrics.total} registered · {metrics.active} active
                  {metrics.newThisMonth > 0 && ` · +${metrics.newThisMonth} this month`}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 px-2.5 py-1 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Live
                </div>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  type="button"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Report
                </button>
                {(user.role === "admin" || user.role === "receptionist") && activeHospitalId && (
                  <button
                    type="button"
                    onClick={() => setBranchBackfillModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    Fix branches
                  </button>
                )}
                {allowAdd && (
                  <button
                    onClick={openAddPatientModal}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-cyan-700 transition-colors"
                    type="button"
                    data-add-patient
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Patient
                  </button>
                )}
              </div>
            </div>

              <div className="space-y-4 p-4">
              {/* ── Summary metrics ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {summaryCards.map((card) => (
                  <div key={card.title} className="rx-metric-card">
                    <div className="flex items-start justify-between mb-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${card.iconClass}`}>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{card.icon}</svg>
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none">{card.value}</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">{card.title}</p>
                    {card.delta && (
                      <p className={`rx-metric-subtext mt-1 ${card.deltaClass}`}>{card.delta}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Search & filter bar ── */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 flex-col sm:flex-row">
                  <div className="flex-1 relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, phone, email, or patient ID…"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {[10, 15, 20].map((size) => (
                      <option key={size} value={size}>{size} rows</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="rx-subtab-bar">
                    {statusTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStatusFilter(tab.key)}
                        className={`rx-subtab${statusFilter === tab.key ? ' rx-subtab--active' : ''}`}
                      >
                        {tab.label}
                        {tab.key === 'all' && (
                          <span className="ml-1.5 text-[10px] font-semibold tabular-nums text-slate-400">
                            {metrics.total}
                          </span>
                        )}
                        {tab.key === 'active' && (
                          <span className="ml-1.5 text-[10px] font-semibold tabular-nums text-slate-400">
                            {metrics.active}
                          </span>
                        )}
                        {tab.key === 'inactive' && (
                          <span className="ml-1.5 text-[10px] font-semibold tabular-nums text-slate-400">
                            {metrics.inactive}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    {filteredPatients.length.toLocaleString()} {filteredPatients.length === 1 ? 'patient' : 'patients'}
                    {search && ' found'}
                  </p>
                </div>
              </div>

              <EnterpriseDataTable
                data={paginatedPatients}
                columns={patientColumns}
                loading={loading}
                loadingMessage="Loading patients…"
                error={error}
                emptyTitle={search ? 'No patients found' : 'No patients yet'}
                emptyDescription={
                  search
                    ? "We couldn't find any patients matching your search. Try adjusting your filters or search keywords."
                    : 'There are no patients in the system yet. Patients will appear here once they register or are added.'
                }
                emptyAction={
                  canAdd && !search
                    ? { label: 'Add Patient', onClick: openAddPatientModal }
                    : search
                      ? { label: 'Clear Search', onClick: () => setSearch('') }
                      : undefined
                }
                toolbar={
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span className="font-semibold text-slate-700">Patient directory</span>
                    <span className="text-xs text-slate-500">
                      {filteredPatients.length.toLocaleString()} total
                    </span>
                  </div>
                }
                enableSearch={false}
                enableFilters={false}
                enableBulkSelection={false}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={handleSort}
                onRowClick={handleView}
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
                rowActions={patientRowActions}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredPatients.length}
                onPageChange={goToPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 15, 20]}
                showPageSize={false}
                itemLabel="patients"
                minWidth="min-w-[900px]"
              />
            </div>
          </div>
          {/* Patient Details Modal */}
          <ViewModal
            isOpen={showViewModal}
            onClose={() => {
              setShowViewModal(false)
              setAppointmentViewFilter(null)
            }}
            title="Patient Profile"
            subtitle="Clinical overview"
            headerColor="blue"
          >
            <div className="space-y-5">

              {/* ── WHO IS THIS PATIENT? ── Identity header ── */}
              <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-cyan-100 flex items-center justify-center text-xl font-bold text-cyan-700">
                  {selectedPatient?.firstName?.charAt(0)}{selectedPatient?.lastName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {selectedPatient?.firstName} {selectedPatient?.lastName}
                      </h3>
                      {selectedPatient?.patientId && (
                        <p className="text-xs font-mono text-slate-400 mt-0.5">#{selectedPatient.patientId}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                      selectedPatient?.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {selectedPatient?.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {/* Quick clinical facts */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedPatient?.dateOfBirth && (() => {
                      const age = calculateAge(selectedPatient.dateOfBirth)
                      return age !== null ? (
                        <span className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700">
                          {age} yrs
                        </span>
                      ) : null
                    })()}
                    {selectedPatient?.bloodGroup && (
                      <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-md px-2 py-1 text-xs font-bold text-rose-700">
                        {selectedPatient.bloodGroup}
                      </span>
                    )}
                    {selectedPatient?.gender && (
                      <span className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700 capitalize">
                        {selectedPatient.gender}
                      </span>
                    )}
                    {selectedPatient?.phone && (
                      <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700">
                        <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {selectedPatient.phone}
                      </span>
                    )}
                    {selectedPatient?.defaultBranchName && (
                      <span className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-medium text-slate-700">
                        <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                        {selectedPatient.defaultBranchName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── WHY ARE THEY HERE TODAY? ── Next appointment ── */}
              {selectedPatient?.appointmentDetails === undefined ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-slate-500">Loading appointment information…</p>
                </div>
              ) : selectedPatient?.appointmentDetails?.nextAppointment ? (
                <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-600 mb-3">Next Appointment</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">When</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {formatDate(selectedPatient.appointmentDetails.nextAppointment.date)}
                        {selectedPatient.appointmentDetails.nextAppointment.time && (
                          <span className="text-slate-500 font-normal"> at {selectedPatient.appointmentDetails.nextAppointment.time}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">With</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {selectedPatient.appointmentDetails.nextAppointment.doctorName || 'Doctor TBD'}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold mt-1 ${
                        selectedPatient.appointmentDetails.nextAppointment.status === 'confirmed'
                          ? 'bg-cyan-100 text-cyan-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedPatient.appointmentDetails.nextAppointment.status === 'whatsapp_pending'
                          ? 'Pending'
                          : selectedPatient.appointmentDetails.nextAppointment.status}
                      </span>
                    </div>
                    {selectedPatient.appointmentDetails.nextAppointment.chiefComplaint && (
                      <div className="sm:col-span-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Chief Complaint</p>
                        <p className="text-sm text-slate-800 bg-white rounded-lg px-3 py-2 border border-cyan-200">
                          {selectedPatient.appointmentDetails.nextAppointment.chiefComplaint}
                        </p>
                      </div>
                    )}
                    {selectedPatient.appointmentDetails.nextAppointment.medicalHistory && (
                      <div className="sm:col-span-2">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Medical History</p>
                        <p className="text-sm text-slate-700 bg-white rounded-lg px-3 py-2 border border-cyan-200">
                          {selectedPatient.appointmentDetails.nextAppointment.medicalHistory}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : selectedPatient?.appointmentDetails ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                  <p className="text-sm text-slate-500">
                    {selectedPatient.appointmentDetails.total > 0
                      ? 'No upcoming appointments scheduled'
                      : 'No appointments booked yet'}
                  </p>
                </div>
              ) : null}

              {/* ── VISIT HISTORY + DOCUMENTS ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Visit history */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Visit History</p>
                    <div className="flex gap-2 text-xs">
                      <span className="text-slate-400">{selectedPatient?.appointmentDetails?.total ?? '—'} total</span>
                      <span className="text-emerald-600 font-semibold">{selectedPatient?.appointmentDetails?.upcoming ?? '—'} upcoming</span>
                    </div>
                  </div>
                  {!selectedPatient?.appointmentDetails ? (
                    <p className="text-xs text-slate-400 text-center py-4">Loading…</p>
                  ) : (selectedPatient.appointmentDetails.appointments?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No visits recorded</p>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      <div className="flex gap-1.5 mb-2">
                        {(['all', 'upcoming'] as const).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setAppointmentViewFilter(f === appointmentViewFilter ? null : f)}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                              appointmentViewFilter === f
                                ? 'bg-cyan-600 text-white border-cyan-600'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {f === 'all' ? 'All visits' : 'Upcoming only'}
                          </button>
                        ))}
                      </div>
                      {(selectedPatient.appointmentDetails.appointments || [])
                        .filter((apt) => {
                          if (appointmentViewFilter !== 'upcoming') return true
                          const today = new Date().toISOString().split('T')[0]
                          return String(apt.appointmentDate || '') >= today && ['confirmed', 'pending', 'whatsapp_pending'].includes(String(apt.status || ''))
                        })
                        .map((apt) => (
                          <div key={apt.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-800">
                                {apt.appointmentDate ? formatDate(apt.appointmentDate) : 'Date TBD'}
                                {apt.appointmentTime ? ` · ${apt.appointmentTime}` : ''}
                              </p>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                apt.status === 'confirmed' ? 'bg-cyan-100 text-cyan-700'
                                : apt.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                                : apt.status === 'cancelled' ? 'bg-red-100 text-red-600'
                                : 'bg-amber-100 text-amber-700'
                              }`}>
                                {apt.status === 'whatsapp_pending' ? 'pending' : (apt.status || '—')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{apt.doctorName || 'Doctor TBD'}</p>
                            {apt.chiefComplaint && (
                              <p className="text-xs text-slate-600 mt-0.5 truncate">{apt.chiefComplaint}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Documents */}
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <DocumentListCompact
                    patientId={selectedPatient?.id || selectedPatient?.patientId}
                    patientUid={selectedPatient?.id}
                    title="Documents"
                    maxItems={10}
                  />
                </div>
              </div>

              {/* ── CONTACT & ADDRESS ── */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Contact & Address</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">Email</p>
                    <p className="text-slate-800">{selectedPatient?.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">Phone</p>
                    <p className="text-slate-800">{selectedPatient?.phone || '—'}</p>
                  </div>
                  {selectedPatient?.address && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">Address</p>
                      <p className="text-slate-800">{selectedPatient.address}</p>
                    </div>
                  )}
                  {selectedPatient?.dateOfBirth && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">Date of Birth</p>
                      <p className="text-slate-800">
                        {formatDate(selectedPatient.dateOfBirth)}
                        {(() => {
                          const age = calculateAge(selectedPatient.dateOfBirth)
                          return age !== null ? <span className="ml-2 text-xs text-slate-500">({age} yrs)</span> : null
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── SYSTEM INFO (collapsible, secondary) ── */}
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors list-none select-none">
                  <svg className="h-3.5 w-3.5 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  System Information
                </summary>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { label: 'Patient ID', value: selectedPatient?.patientId || 'Not assigned', mono: true },
                    { label: 'Status', value: selectedPatient?.status || '—', mono: false },
                    { label: 'Created by', value: selectedPatient?.createdBy || '—', mono: false },
                    { label: 'Registered', value: formatDateTime(selectedPatient?.createdAt || ''), mono: false },
                    { label: 'Last updated', value: formatDateTime(selectedPatient?.updatedAt || ''), mono: false },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">{label}</p>
                      <p className={`text-slate-700 truncate ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
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
          {/* Generate Report Modal */}
          {showReportModal && (
            <RevealModal
              isOpen={true}
              onClose={() => setShowReportModal(false)}
              contentClassName="p-0"
            >
              <GenerateReportModalContent
                reportFilter={reportFilter}
                setReportFilter={setReportFilter}
                customStartDate={customStartDate}
                setCustomStartDate={setCustomStartDate}
                customEndDate={customEndDate}
                setCustomEndDate={setCustomEndDate}
                reportFormat={reportFormat}
                setReportFormat={setReportFormat}
                generatingReport={generatingReport}
                error={error}
                onGenerate={handleGenerateReport}
              />
            </RevealModal>
          )}
        </div>
        {branchBackfillModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900">Assign default branch</h3>
              <p className="mt-2 text-sm text-slate-600">
                Patients without <span className="font-medium">defaultBranchId</span> are hard to filter by branch. This
                assigns the correct branch: receptionists use <span className="font-medium">their branch</span> when
                set, otherwise the hospital&apos;s first active branch (alphabetically).
              </p>
              {branchBackfillLoading && !branchBackfillPreview && (
                <p className="mt-4 text-sm text-slate-500">Scanning patients…</p>
              )}
              {branchBackfillError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {branchBackfillError}
                </div>
              )}
              {branchBackfillPreview && (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p>
                    <span className="font-semibold text-slate-800">Target branch:</span>{" "}
                    {branchBackfillPreview.targetBranch.name}{" "}
                    <span className="text-slate-500">({branchBackfillPreview.targetBranch.id})</span>
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Patients missing branch (in scan window):</span>{" "}
                    {branchBackfillPreview.wouldAssign}
                  </p>
                  <p className="text-xs text-slate-500">
                    Scanned {branchBackfillPreview.scanned} document(s).
                    {branchBackfillPreview.capped ? " Scan hit the preview limit; more may exist." : ""}
                    {branchBackfillPreview.reachedEnd ? " Reached end of hospital patient list for this pass." : ""}
                  </p>
                  {branchBackfillPreview.samples.length > 0 && (
                    <p className="text-xs text-slate-500 break-all">
                      Sample IDs: {branchBackfillPreview.samples.join(", ")}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setBranchBackfillModalOpen(false)
                    setBranchBackfillPreview(null)
                    setBranchBackfillError(null)
                  }}
                  disabled={branchBackfillLoading}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  onClick={handleBranchBackfillApply}
                  disabled={
                    branchBackfillLoading ||
                    !branchBackfillPreview ||
                    branchBackfillPreview.wouldAssign === 0
                  }
                >
                  {branchBackfillLoading ? "Working…" : "Assign branch (up to 400)"}
                </button>
              </div>
            </div>
          </div>
        )}
        {branchEditModalOpen && (
          <div className="fixed inset-0 z-[61] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900">Change patient branch</h3>
              <p className="mt-1 text-sm text-slate-600">
                {branchEditPatient?.firstName} {branchEditPatient?.lastName}
              </p>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Branch</label>
                <select
                  value={selectedBranchIdForEdit}
                  onChange={(e) => setSelectedBranchIdForEdit(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  disabled={branchOptionsLoading || branchEditLoading}
                >
                  <option value="">{branchOptionsLoading ? "Loading branches..." : "Select branch"}</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              {branchEditError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {branchEditError}
                </div>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setBranchEditModalOpen(false)}
                  disabled={branchEditLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  onClick={handleSavePatientBranch}
                  disabled={branchEditLoading || !selectedBranchIdForEdit}
                >
                  {branchEditLoading ? "Saving..." : "Save branch"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Add Patient Modal */}
        {allowAdd && showAddModal && (
          <RevealModal
            isOpen={true}
            onClose={closeAddPatientModal}
            contentClassName="p-0"
          >
            <AddPatientModalContent
              loading={loading}
              error={error}
              onErrorClear={() => setError(null)}
              onSubmit={handleCreatePatient}
              receptionistBranchId={receptionistBranchId}
              submitLabel={loading ? "Adding Patient..." : (receptionistBranchId != null ? "Create Patient" : "Send OTP")}
            />
          </RevealModal>
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