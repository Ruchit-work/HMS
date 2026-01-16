'use client'

import { useState, useEffect, useCallback } from "react"
import { DocumentMetadata, DocumentType } from "@/types/document"
import DocumentUpload from "./DocumentUpload"
import DocumentViewer from "./DocumentViewer"
import { ConfirmDialog } from "@/components/ui/overlays/Modals"
import { auth } from "@/firebase/config"
import { doc, getDoc, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/firebase/hospital-queries"
import PatientSelector from "./PatientSelector"
import Notification from "@/components/ui/feedback/Notification"

interface DocumentsTabProps {
  patientId?: string
  patientUid?: string
  appointmentId?: string
  appointmentSpecialty?: string
  canUpload?: boolean
  canEdit?: boolean
  canDelete?: boolean
  showPatientSelector?: boolean
  className?: string
}

export default function DocumentsTab({
  patientId: initialPatientId,
  patientUid: initialPatientUid,
  appointmentId,
  appointmentSpecialty,
  canUpload = true,
  canEdit = true,
  canDelete = true,
  showPatientSelector = false,
  className = "",
}: DocumentsTabProps) {
  const { activeHospitalId } = useMultiHospital()
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [allDocuments, setAllDocuments] = useState<DocumentMetadata[]>([]) // Store all fetched documents for client-side filtering
  const [loading, setLoading] = useState(false) // Start as false, will be set to true when fetching
  const [loadingMore, setLoadingMore] = useState(false) // For "Load More" button
  const [hasMore, setHasMore] = useState(false) // Whether there are more documents to load
  const [lastDocId, setLastDocId] = useState<string | null>(null) // Last document ID for pagination
  const [error, setError] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<DocumentMetadata | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [patientNames, setPatientNames] = useState<Record<string, string>>({}) // Map patientUid/patientId to patient name
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null)

  // Patient selection
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; uid: string; patientId: string; firstName: string; lastName: string; email: string; phone?: string } | null>(null)
  
  // Filters
  const [patientId, setPatientId] = useState(initialPatientId || "")
  const [patientUid, setPatientUid] = useState(initialPatientUid || "")
  const [fileTypeFilter, setFileTypeFilter] = useState<DocumentType | "">("")
  const [specialtyFilter, setSpecialtyFilter] = useState<string>(appointmentSpecialty || "")
  const [showAllSpecialties, setShowAllSpecialties] = useState(!appointmentSpecialty)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Update patientId and patientUid when patient is selected
  useEffect(() => {
    if (selectedPatient) {
      setPatientId(selectedPatient.patientId)
      setPatientUid(selectedPatient.uid)
    } else if (!showPatientSelector) {
      // If patient selector is not shown, use initial values
      setPatientId(initialPatientId || "")
      setPatientUid(initialPatientUid || "")
    }
  }, [selectedPatient, initialPatientId, initialPatientUid, showPatientSelector])

  const fetchDocuments = useCallback(async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setAllDocuments([]) // Clear existing documents when starting fresh
      setDocuments([])
      setLastDocId(null) // Reset pagination
      setHasMore(false)
    }
    setError(null)

    try {
      const params = new URLSearchParams()
      
      // Always send patientUid if available (more reliable)
      const finalPatientUid = patientUid || initialPatientUid
      const finalPatientId = patientId || initialPatientId
      
      // If patient is selected, filter by patient with pagination.
      // If patient selector is visible and no patient selected, we should have returned earlier.
      if (finalPatientUid) {
        params.append("patientUid", finalPatientUid)
        // Default limit of 50 for patient documents (pagination)
        params.append("limit", "50")
      } else if (finalPatientId) {
        params.append("patientId", finalPatientId)
        // Default limit of 50 for patient documents (pagination)
        params.append("limit", "50")
      }
      
      // Add pagination cursor if loading more
      if (loadMore && lastDocId) {
        params.append("lastDocId", lastDocId)
      }
      
      if (appointmentId) {
        params.append("appointmentId", appointmentId)
      }
      if (fileTypeFilter) {
        params.append("fileType", fileTypeFilter)
      }
      if (specialtyFilter && !showAllSpecialties) {
        params.append("specialty", specialtyFilter)
      }
      // Note: dateFrom, dateTo, and searchQuery are filtered client-side
      params.append("showAllSpecialties", showAllSpecialties.toString())

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to view documents")
      }

      const token = await currentUser.getIdToken()

      const response = await fetch(`/api/documents?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch documents")
      }

      const fetchedDocuments = data.documents || []
      // Update pagination state
      setHasMore(data.hasMore || false)
      setLastDocId(data.lastDocId || null)
      
      // Append or replace documents based on loadMore
      if (loadMore) {
        setAllDocuments((prev) => [...prev, ...fetchedDocuments])
      } else {
        setAllDocuments(fetchedDocuments)
      }
      
      // Apply client-side filters (search, date range)
      if (loadMore) {
        // When loading more, apply filters to all documents
        applyClientSideFilters([...allDocuments, ...fetchedDocuments])
      } else {
        applyClientSideFilters(fetchedDocuments)
      }

      // If showing recent documents (no patient filter), fetch patient names
      if (!finalPatientUid && !finalPatientId && fetchedDocuments.length > 0) {
        fetchPatientNames(fetchedDocuments)
      } else if (!loadMore) {
        setPatientNames({}) // Clear patient names when filtering by patient (only on initial load)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load documents")
      if (!loadMore) {
        setAllDocuments([])
        setDocuments([]) // Set empty array on error
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    patientUid,
    initialPatientUid,
    patientId,
    initialPatientId,
    appointmentId,
    fileTypeFilter,
    specialtyFilter,
    showAllSpecialties,
    lastDocId,
    allDocuments,
  ])

  useEffect(() => {
    // For doctor Documents & Reports page (with patient selector),
    // don't fetch any documents until a patient is selected.
    // For other contexts (no selector), keep existing behaviour.
    if (showPatientSelector && !patientUid && !initialPatientUid) {
      setDocuments([])
      setAllDocuments([])
      setHasMore(false)
      setLastDocId(null)
      return
    }

    // Note: searchQuery and date filters are applied client-side, so we don't include them in dependencies
    fetchDocuments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUid, initialPatientUid, appointmentId, fileTypeFilter, specialtyFilter, showAllSpecialties, showPatientSelector])
  
  const handleLoadMore = () => {
    fetchDocuments(true)
  }

  // Apply client-side filters (search, date range)
  const applyClientSideFilters = (docs: DocumentMetadata[]) => {
    let filtered = [...docs]

    // Apply search filter
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(doc =>
        doc.originalFileName.toLowerCase().includes(queryLower) ||
        doc.fileName.toLowerCase().includes(queryLower) ||
        doc.fileType.toLowerCase().includes(queryLower) ||
        doc.description?.toLowerCase().includes(queryLower) ||
        doc.specialty?.toLowerCase().includes(queryLower) ||
        doc.patientId.toLowerCase().includes(queryLower) ||
        (patientNames[doc.patientUid] || patientNames[doc.patientId] || "").toLowerCase().includes(queryLower)
      )
    }

    // Apply date range filters
    if (dateFrom) {
      filtered = filtered.filter(doc => {
        const docDate = new Date(doc.uploadedAt).toISOString().split('T')[0]
        return docDate >= dateFrom
      })
    }

    if (dateTo) {
      filtered = filtered.filter(doc => {
        const docDate = new Date(doc.uploadedAt).toISOString().split('T')[0]
        return docDate <= dateTo
      })
    }

    setDocuments(filtered)
  }

  // Re-apply filters when search query or date filters change
  useEffect(() => {
    if (allDocuments.length > 0) {
      applyClientSideFilters(allDocuments)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, dateFrom, dateTo, patientNames])

  const fetchPatientNames = async (docs: DocumentMetadata[]) => {
    if (!activeHospitalId) return

    const uniquePatientIds = new Set<string>()
    docs.forEach(doc => {
      if (doc.patientUid) uniquePatientIds.add(doc.patientUid)
      if (doc.patientId && doc.patientId !== doc.patientUid) uniquePatientIds.add(doc.patientId)
    })

    const namesMap: Record<string, string> = {}
    
    // Fetch patient names in parallel
    const fetchPromises = Array.from(uniquePatientIds).map(async (patientId) => {
      try {
        const patientsRef = getHospitalCollection(activeHospitalId, "patients")
        const patientDoc = await getDoc(doc(patientsRef, patientId))
        
        if (patientDoc.exists()) {
          const patientData = patientDoc.data()
          const fullName = `${patientData.firstName || ""} ${patientData.lastName || ""}`.trim()
          if (fullName) {
            namesMap[patientId] = fullName
            // Also map by patientUid if different
            if (patientData.patientId && patientData.patientId !== patientId) {
              namesMap[patientData.patientId] = fullName
            }
          }
        }
      } catch {
      }
    })

    await Promise.all(fetchPromises)
    setPatientNames(namesMap)
  }

  const handleUploadSuccess = async (document: DocumentMetadata) => {
    // If document was uploaded from Documents & Reports page (no appointmentId) and patient is selected,
    // automatically link it to the latest appointment
    if (!document.appointmentId && (patientUid || initialPatientUid || selectedPatient) && activeHospitalId) {
      try {
          const finalPatientUid = patientUid || initialPatientUid || selectedPatient?.uid
          const finalPatientId = patientId || initialPatientId || selectedPatient?.patientId
          
          if (finalPatientUid || finalPatientId) {
            try {
              // Fetch latest appointment for this patient
              const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
              let latestAppointmentQuery
              
              if (finalPatientUid) {
                latestAppointmentQuery = query(
                  appointmentsRef,
                  where("patientUid", "==", finalPatientUid),
                  orderBy("appointmentDate", "desc"),
                  limit(1)
                )
              } else if (finalPatientId) {
                latestAppointmentQuery = query(
                  appointmentsRef,
                  where("patientId", "==", finalPatientId),
                  orderBy("appointmentDate", "desc"),
                  limit(1)
                )
              }
              
              if (latestAppointmentQuery) {
                const snapshot = await getDocs(latestAppointmentQuery)
                if (!snapshot.empty) {
                  const latestAppointment = snapshot.docs[0]
                  const latestAppointmentId = latestAppointment.id
                  const latestAppointmentData = latestAppointment.data()
                  
                  // Update document to link to latest appointment
                  const currentUser = auth.currentUser
                  if (currentUser) {
                    const token = await currentUser.getIdToken()
                    await fetch(`/api/documents/${document.id}`, {
                      method: "PUT",
                      headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        appointmentId: latestAppointmentId,
                        doctorId: latestAppointmentData?.doctorId,
                        appointmentDate: latestAppointmentData?.appointmentDate,
                      }),
                    })
                    
                    // Update local document state
                    document.appointmentId = latestAppointmentId
                    document.doctorId = latestAppointmentData?.doctorId
                    document.appointmentDate = latestAppointmentData?.appointmentDate
                  }
                }
              }
            } catch {
              // If query fails (e.g., missing index), try without orderBy
              try {
                const appointmentsRef = getHospitalCollection(activeHospitalId, "appointments")
                let allAppointmentsQuery
                
                if (finalPatientUid) {
                  allAppointmentsQuery = query(
                    appointmentsRef,
                    where("patientUid", "==", finalPatientUid)
                  )
                } else if (finalPatientId) {
                  allAppointmentsQuery = query(
                    appointmentsRef,
                    where("patientId", "==", finalPatientId)
                  )
                }
                
                if (allAppointmentsQuery) {
                  const snapshot = await getDocs(allAppointmentsQuery)
                  if (!snapshot.empty) {
                    // Sort client-side and get the latest
                    const appointments: any[] = snapshot.docs
                      .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
                      .sort((a: any, b: any) => {
                        const dateA = new Date(a.appointmentDate || 0).getTime()
                        const dateB = new Date(b.appointmentDate || 0).getTime()
                        return dateB - dateA
                      })
                    
                    if (appointments.length > 0) {
                      const latestAppointment: any = appointments[0]
                      
                      const currentUser = auth.currentUser
                      if (currentUser) {
                        const token = await currentUser.getIdToken()
                        await fetch(`/api/documents/${document.id}`, {
                          method: "PUT",
                          headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            appointmentId: latestAppointment.id,
                            doctorId: latestAppointment.doctorId,
                            appointmentDate: latestAppointment.appointmentDate,
                          }),
                        })
                        
                        document.appointmentId = latestAppointment.id
                        document.doctorId = latestAppointment.doctorId
                        document.appointmentDate = latestAppointment.appointmentDate
                      }
                    }
                  }
                }
              } catch (fallbackError) {
                console.error("Error linking document to latest appointment:", fallbackError)
              }
            }
          }
      } catch (error) {
        console.error("Error linking document to latest appointment:", error)
        // Continue even if linking fails
      }
    }
    
    setDocuments((prev) => [document, ...prev])
    setShowUpload(false)
    setNotification({
      type: "success",
      message: `Document "${document.originalFileName}" uploaded successfully!${document.appointmentId ? " Linked to latest appointment." : ""}`
    })
    fetchDocuments() // Refresh list
    // Clear notification after 3 seconds
    setTimeout(() => setNotification(null), 3000)
  }

  const handleDelete = async (documentId: string) => {
    setDocumentToDelete(documentId)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!documentToDelete) return

    setDeleting(true)
    try {
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to delete documents")
      }

      const token = await currentUser.getIdToken()

      const response = await fetch(`/api/documents/${documentToDelete}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete document")
      }

      // Get document name before removing from state
      const deletedDoc = documents.find(doc => doc.id === documentToDelete)
      const documentName = deletedDoc?.originalFileName || "Document"

      // Remove from local state
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentToDelete))
      setAllDocuments((prev) => prev.filter((doc) => doc.id !== documentToDelete))
      setSelectedDocument(null)
      setDeleteConfirmOpen(false)
      setDocumentToDelete(null)
      
      // Show success notification
      setNotification({
        type: "success",
        message: `Document "${documentName}" deleted successfully!`
      })
      // Clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000)
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Failed to delete document"
      })
      // Clear error notification after 5 seconds
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const getFileTypeIcon = (fileType: DocumentType): string => {
    const icons: Record<DocumentType, string> = {
      "laboratory-report": "🧪",
      "radiology-report": "🩻",
      "cardiology-report": "❤️",
      prescription: "💊",
      other: "📎",
    }
    return icons[fileType] || "📎"
  }

  return (
    <div className={className}>
      {/* Toast Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
          durationMs={notification.type === "error" ? 5000 : 3000}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents & Reports</h2>
          <p className="text-sm text-gray-600 mt-1">
            {documents.length} document{documents.length !== 1 ? "s" : ""} found
          </p>
        </div>
        {canUpload && (patientUid || initialPatientUid || selectedPatient) && (
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            {showUpload ? "Cancel Upload" : "Upload Document"}
          </button>
        )}
      </div>

      {/* Patient Selector */}
      {showPatientSelector && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <PatientSelector
            onPatientSelect={(patient) => {
              setSelectedPatient(patient)
              if (patient) {
                setPatientId(patient.patientId)
                setPatientUid(patient.uid)
              } else {
                setPatientId("")
                setPatientUid("")
              }
            }}
            selectedPatient={selectedPatient}
          />
        </div>
      )}

      {/* Upload Section */}
      {showUpload && canUpload && (patientUid || initialPatientUid || selectedPatient) && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Upload Documents</h3>
          {(!patientUid && !initialPatientUid && !selectedPatient) && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">Please select a patient first to upload documents.</p>
            </div>
          )}
          {(patientUid || initialPatientUid || selectedPatient) && (
            <DocumentUpload
              patientId={patientId || initialPatientId || selectedPatient?.patientId || ""}
              patientUid={patientUid || initialPatientUid || selectedPatient?.uid || ""}
              appointmentId={appointmentId}
              specialty={appointmentSpecialty}
              onUploadSuccess={handleUploadSuccess}
              onUploadError={(err) => {
                setNotification({
                  type: "error",
                  message: err
                })
                setTimeout(() => setNotification(null), 5000)
              }}
              allowBulk={true}
            />
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {/* File Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <select
              value={fileTypeFilter}
              onChange={(e) => setFileTypeFilter(e.target.value as DocumentType | "")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              <option value="laboratory-report">Laboratory reports</option>
              <option value="radiology-report">Radiology Report</option>
              <option value="cardiology-report">Cardiology Report</option>
              <option value="prescription">Prescription</option>
              <option value="other">Other documents</option>
            </select>
          </div>

          {/* Specialty Filter */}
          {appointmentSpecialty && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
              <div className="flex items-center gap-2">
                <select
                  value={specialtyFilter}
                  onChange={(e) => setSpecialtyFilter(e.target.value)}
                  disabled={showAllSpecialties}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                >
                  <option value={appointmentSpecialty}>{appointmentSpecialty}</option>
                </select>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={showAllSpecialties}
                    onChange={(e) => setShowAllSpecialties(e.target.checked)}
                    className="rounded"
                  />
                  <span>All</span>
                </label>
              </div>
            </div>
          )}

          {/* Date Range */}
          <div className="col-span-full grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="loading mx-auto" style={{ width: "48px", height: "48px" }}>
            <svg width="64px" height="48px" viewBox="0 0 64 48" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
              <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="back"></polyline>
              <polyline points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24" id="front"></polyline>
            </svg>
          </div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => fetchDocuments()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-gray-600">
            {showPatientSelector && !patientUid && !initialPatientUid
              ? "Select a patient to view their documents."
              : "No documents found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDocument(doc)}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-4"
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{getFileTypeIcon(doc.fileType)}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">{doc.originalFileName}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {doc.fileType} {doc.specialty && `• ${doc.specialty}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatFileSize(doc.fileSize)} • {formatDate(doc.uploadedAt)}
                  </p>
                  {!patientUid && !initialPatientUid && (
                    <div className="mt-1">
                      {patientNames[doc.patientUid] || patientNames[doc.patientId] ? (
                        <p className="text-xs text-blue-600 font-medium">
                          Patient: {patientNames[doc.patientUid] || patientNames[doc.patientId]}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Patient ID: {doc.patientId}
                        </p>
                      )}
                    </div>
                  )}
                  {doc.description && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{doc.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {!loading && hasMore && documents.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Loading...
              </>
            ) : (
              "Load More Documents"
            )}
          </button>
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <DocumentViewer
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
              onDelete={canDelete ? handleDelete : undefined}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setDocumentToDelete(null)
        }}
        confirmLoading={deleting}
        loadingText="Deleting..."
      />
    </div>
  )
}

