'use client'

import { useState, useEffect } from "react"
import { DocumentMetadata } from "@/types/document"
import DocumentUpload from "./DocumentUpload"
import DocumentViewer from "./DocumentViewer"
import { ConfirmDialog } from "@/components/ui/Modals"
import { auth, db } from "@/firebase/config"
import { doc, getDoc } from "firebase/firestore"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { getHospitalCollection } from "@/utils/hospital-queries"
import Notification from "@/components/ui/Notification"

interface AppointmentDocumentsProps {
  appointmentId: string
  patientId: string
  patientUid: string
  appointmentSpecialty?: string
  appointmentStatus?: string
  canUpload?: boolean
  canEdit?: boolean
  canDelete?: boolean
  className?: string
  onlyCurrentAppointment?: boolean
}

export default function AppointmentDocuments({
  appointmentId,
  patientId,
  patientUid: initialPatientUid,
  appointmentSpecialty,
  appointmentStatus,
  canUpload = true,
  canEdit = true,
  canDelete = true,
  className = "",
  onlyCurrentAppointment = false,
}: AppointmentDocumentsProps) {
  const { activeHospitalId } = useMultiHospital()
  const [patientUid, setPatientUid] = useState<string>(initialPatientUid || "")
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<DocumentMetadata | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null)

  // Fetch patientUid from patient document if not provided
  useEffect(() => {
    const fetchPatientUid = async () => {
      // If we already have patientUid from props, use it
      if (initialPatientUid && initialPatientUid.trim() !== "") {
        setPatientUid(initialPatientUid)
        return
      }

      // If we have patientId but no patientUid, fetch it from the patient document
      if (patientId && activeHospitalId && (!initialPatientUid || initialPatientUid.trim() === "")) {
        try {
          const patientsRef = getHospitalCollection(activeHospitalId, "patients")
          const patientDoc = await getDoc(doc(patientsRef, patientId))
          
          if (patientDoc.exists()) {
            const patientData = patientDoc.data()
            const uid = patientData.uid || patientData.id || patientId
            setPatientUid(uid)
          } else {
            // Try using patientId as patientUid as fallback
            setPatientUid(patientId)
          }
        } catch (err: any) {
          // Fallback: use patientId as patientUid
          setPatientUid(patientId)
        }
      } else if (patientId && (!initialPatientUid || initialPatientUid.trim() === "")) {
        // Fallback: use patientId as patientUid if no hospital context or no initialPatientUid
        setPatientUid(patientId)
      }
    }

    fetchPatientUid()
  }, [patientId, initialPatientUid, activeHospitalId])

  // Fetch patientUid from patient document if not provided
  useEffect(() => {
    const fetchPatientUid = async () => {
      // If we already have patientUid, use it
      if (patientUid && patientUid.trim() !== "") {
        return
      }

      // If we have patientId but no patientUid, fetch it from the patient document
      if (patientId && activeHospitalId && (!patientUid || patientUid.trim() === "")) {
        try {
          const patientsRef = getHospitalCollection(activeHospitalId, "patients")
          const patientDoc = await getDoc(doc(patientsRef, patientId))
          
          if (patientDoc.exists()) {
            const patientData = patientDoc.data()
            const uid = patientData.uid || patientData.id || patientId
            setPatientUid(uid)
          } else {
            // Try using patientId as patientUid as fallback
            setPatientUid(patientId)
          }
        } catch (err: any) {
          // Fallback: use patientId as patientUid
          setPatientUid(patientId)
        }
      } else if (patientId && !activeHospitalId) {
        // Fallback: use patientId as patientUid if no hospital context
        setPatientUid(patientId)
      }
    }

    fetchPatientUid()
  }, [patientId, patientUid, activeHospitalId])

  useEffect(() => {
    // Reset state when patientUid changes (appointmentId is optional)
    if (!patientUid || patientUid.trim() === "") {
      setLoading(false)
      setDocuments([])
      if (patientId) {
        setError("Loading patient information...")
      } else {
        setError("Patient UID is required")
      }
      return
    }
    fetchDocuments()
  }, [appointmentId, patientUid, patientId])

  const fetchDocuments = async () => {
    if (!patientUid) {
      setLoading(false)
      setDocuments([])
      setError("Patient UID is required to fetch documents")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      // Always include patientUid to get all patient documents
      params.append("patientUid", patientUid)
      
      // Include patientId if available for better matching
      if (patientId) {
        params.append("patientId", patientId)
      }
      
      // Include appointmentId for context (but API will show all patient docs)
      if (appointmentId) {
        params.append("appointmentId", appointmentId)
      }
      
      params.append("status", "active") // Only fetch active documents
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
      setDocuments(fetchedDocuments)
    } catch (err: any) {
      setError(err.message || "Failed to load documents")
      setDocuments([]) // Clear documents on error
    } finally {
      setLoading(false)
    }
  }

  const handleUploadSuccess = (document: DocumentMetadata) => {
    setDocuments((prev) => [document, ...prev])
    setShowUpload(false)
    setNotification({
      type: "success",
      message: `Document "${document.originalFileName}" uploaded successfully!`
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

      // Permanently delete document (Firestore + Storage) using DELETE endpoint
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

      // Remove from local state so it disappears everywhere in this view
      setDocuments((prev) => prev.filter((doc) => doc.id !== documentToDelete))
      setSelectedDocument(null)
      setDeleteConfirmOpen(false)
      setDocumentToDelete(null)
      
      // Show success notification
      setNotification({
        type: "success",
        message: `Document "${documentName}" deleted permanently.`
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

  const getFileTypeIcon = (fileType: string): string => {
    const icons: Record<string, string> = {
      "laboratory-report": "🧪",
      "radiology-report": "🩻",
      "cardiology-report": "❤️",
      prescription: "💊",
      other: "📎",
    }
    return icons[fileType] || "📎"
  }

  // Allow adding documents even for completed appointments
  const canAddDocuments = canUpload && (appointmentStatus === "completed" || appointmentStatus === "confirmed" || appointmentStatus === "pending")

  const docsForThisAppointment = documents.filter((doc) => doc.appointmentId === appointmentId)
  const listDocuments = onlyCurrentAppointment ? docsForThisAppointment : documents

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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Documents & Reports</h3>
          <p className="text-sm text-gray-600 mt-1">
            {onlyCurrentAppointment
              ? docsForThisAppointment.length > 0
                ? `${docsForThisAppointment.length} document${docsForThisAppointment.length !== 1 ? "s" : ""} linked to this appointment`
                : "This appointment does not have any document attached."
              : `${documents.length} document${documents.length !== 1 ? "s" : ""} ${
                  documents.length > 0 && documents.some((d) => d.appointmentId === appointmentId)
                    ? "linked to this appointment"
                    : "available for this patient"
                }`}
          </p>
        </div>
        {/* Upload button removed - now handled in Complete Consultation Form */}
      </div>

      {/* Upload Section - Removed, now handled in Complete Consultation Form */}

      {/* Documents List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading documents...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={fetchDocuments}
            className="mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      ) : listDocuments.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
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
          {onlyCurrentAppointment ? (
            <>
              <p className="mt-2 text-sm text-gray-600">This appointment does not have any document attached.</p>
              <p className="mt-1 text-xs text-gray-500">
                When your doctor uploads reports for this visit, they will appear here.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-600">No documents found for this patient</p>
              <p className="mt-1 text-xs text-gray-500">Documents uploaded for this patient will appear here</p>
              <p className="mt-2 text-xs text-gray-500">
                Use the "Add Documents" button in the Complete Consultation Form to upload documents.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {listDocuments.map((doc) => {
            const isLinkedToThisAppointment = appointmentId && doc.appointmentId === appointmentId
            return (
            <div
              key={doc.id}
              onClick={() => setSelectedDocument(doc)}
              className={`flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-md transition-all cursor-pointer ${
                isLinkedToThisAppointment 
                  ? "border-blue-300 bg-blue-50/30" 
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              <div className="text-2xl">{getFileTypeIcon(doc.fileType)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900 truncate">{doc.originalFileName}</h4>
                  {isLinkedToThisAppointment && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      Linked
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{doc.fileType}</span>
                  {doc.specialty && <span>• {doc.specialty}</span>}
                  <span>• {formatFileSize(doc.fileSize)}</span>
                  <span>• {formatDate(doc.uploadedAt)}</span>
                </div>
              </div>
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(doc.id)
                  }}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Remove document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[92vh] h-full flex flex-col overflow-y-auto">
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
        message="Are you sure you want to permanently delete this document? This action cannot be undone and the file will be removed from all places."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setDocumentToDelete(null)
        }}
        confirmLoading={deleting}
        loadingText="Removing..."
      />
    </div>
  )
}

