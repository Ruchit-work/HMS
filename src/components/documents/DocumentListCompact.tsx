'use client'

import { useState, useEffect } from "react"
import { DocumentMetadata } from "@/types/document"
import DocumentViewer from "./DocumentViewer"
import { auth } from "@/firebase/config"

interface DocumentListCompactProps {
  patientId?: string
  patientUid?: string
  appointmentId?: string
  className?: string
  title?: string
  maxItems?: number
}

export default function DocumentListCompact({
  patientId,
  patientUid,
  appointmentId,
  className = "",
  title = "Documents",
  maxItems = 5,
}: DocumentListCompactProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<DocumentMetadata | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (patientUid || patientId) {
      fetchDocuments()
    }
  }, [patientId, patientUid, appointmentId])

  const fetchDocuments = async () => {
    if (!patientUid && !patientId) {
      setDocuments([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (patientUid) {
        params.append("patientUid", patientUid)
      }
      if (patientId) {
        params.append("patientId", patientId)
      }
      if (appointmentId) {
        params.append("appointmentId", appointmentId)
      }
      params.append("status", "active")

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

      setDocuments(data.documents || [])
    } catch (err: any) {
      setError(err.message || "Failed to load documents")
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getFileTypeIcon = (fileType: string): string => {
    const icons: Record<string, string> = {
      report: "📄",
      prescription: "💊",
      "x-ray": "🩻",
      "lab-report": "🧪",
      scan: "🔬",
      ultrasound: "📡",
      mri: "🧲",
      "ct-scan": "⚡",
      ecg: "📈",
      other: "📎",
    }
    return icons[fileType] || "📎"
  }

  const displayDocuments = showAll ? documents : documents.slice(0, maxItems)
  const hasMore = documents.length > maxItems

  if (loading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Loading documents...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className={className}>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
        <p className="text-xs text-gray-500">No documents available</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        <span className="text-xs text-gray-500">{documents.length} document{documents.length !== 1 ? "s" : ""}</span>
      </div>
      
      <div className="space-y-1.5">
        {displayDocuments.map((doc) => {
          const isLinked = appointmentId && doc.appointmentId === appointmentId
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedDocument(doc)}
              className={`w-full text-left px-3 py-2 rounded-md border transition-all hover:shadow-sm ${
                isLinked
                  ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                  : "bg-white border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{getFileTypeIcon(doc.fileType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{doc.originalFileName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">{doc.fileType}</span>
                    {isLinked && (
                      <span className="text-xs text-blue-600 font-medium">• Linked</span>
                    )}
                    <span className="text-xs text-gray-400">• {formatDate(doc.uploadedAt)}</span>
                  </div>
                </div>
                <svg
                  className="w-4 h-4 text-gray-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          )
        })}
      </div>

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          View all {documents.length} documents →
        </button>
      )}

      {showAll && hasMore && (
        <button
          onClick={() => setShowAll(false)}
          className="mt-2 text-xs text-gray-600 hover:text-gray-700 font-medium"
        >
          Show less
        </button>
      )}

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-semibold text-gray-900">Document Viewer</h3>
              <button
                onClick={() => setSelectedDocument(null)}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <DocumentViewer
                document={selectedDocument}
                onClose={() => setSelectedDocument(null)}
                canEdit={false}
                canDelete={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

