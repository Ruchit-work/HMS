'use client'

import { useState, useEffect, useCallback } from "react"
import { DocumentMetadata } from "@/types/document"
import { auth } from "@/firebase/config"

interface DocumentViewerProps {
  document: DocumentMetadata
  onClose?: () => void
  onDelete?: (documentId: string) => void
  canEdit?: boolean
  canDelete?: boolean
}

export default function DocumentViewer({
  document,
  onClose,
  onDelete,
  canEdit = false,
  canDelete = false,
}: DocumentViewerProps) {
  const isImage = document.mimeType?.startsWith("image/") || false
  const isPDF = document.mimeType === "application/pdf"

  const [downloadUrl, setDownloadUrl] = useState<string | null>(document.downloadUrl || null)
  const [loading, setLoading] = useState(!document.downloadUrl) // Only load if we don't have a URL
  const [error, setError] = useState<string | null>(null)

  const fetchDownloadUrl = useCallback(async () => {
    try {
      setLoading(true)

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to view documents")
      }

      const token = await currentUser.getIdToken()

      const response = await fetch(`/api/documents/${document.id}/download`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get download URL")
      }

      setDownloadUrl(data.downloadUrl)
    } catch (err: any) {
      setError(err.message || "Failed to load document")
    } finally {
      setLoading(false)
    }
  }, [document.id])

  useEffect(() => {
    // If document already has downloadUrl, use it directly (especially for images)
    if (document.downloadUrl && isImage) {
      setDownloadUrl(document.downloadUrl)
      setLoading(false)
      return
    }
    
    // Otherwise, fetch a signed URL
    if (!document.downloadUrl) {
      fetchDownloadUrl()
    }
  }, [document.id, document.downloadUrl, isImage, fetchDownloadUrl])

  const handleDownload = () => {
    if (downloadUrl) {
      // Use window.document to avoid shadowing the 'document' prop
      const link = window.document.createElement("a")
      link.href = downloadUrl
      link.download = document.originalFileName
      link.target = "_blank" // Open in new tab as fallback
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-2xl">
      {/* Header */}
      <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{document.originalFileName}</h3>
          <p className="text-sm text-blue-100 mt-1">
            {document.fileType} {document.specialty && `• ${document.specialty}`}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {downloadUrl && (
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 rounded-md text-sm font-medium transition-colors"
            >
              Download
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-blue-700 rounded-md transition-colors"
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
          )}
        </div>
      </div>

      {/* Document Info */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-500">File Size:</span>
            <span className="ml-2 font-medium">{formatFileSize(document.fileSize)}</span>
          </div>
          <div>
            <span className="text-gray-500">Uploaded:</span>
            <span className="ml-2 font-medium">{formatDate(document.uploadedAt)}</span>
          </div>
          <div>
            <span className="text-gray-500">Uploaded By:</span>
            <span className="ml-2 font-medium">{document.uploadedBy.name}</span>
          </div>
          {document.patientName && (
            <div>
              <span className="text-gray-500">Patient:</span>
              <span className="ml-2 font-medium">{document.patientName}</span>
            </div>
          )}
          {document.doctorName && (
            <div>
              <span className="text-gray-500">Doctor:</span>
              <span className="ml-2 font-medium">{document.doctorName}</span>
            </div>
          )}
          {document.appointmentDate && (
            <div>
              <span className="text-gray-500">Appointment Date:</span>
              <span className="ml-2 font-medium">
                {new Date(document.appointmentDate).toLocaleDateString()}
              </span>
            </div>
          )}
          {document.specialty && (
            <div>
              <span className="text-gray-500">Specialty:</span>
              <span className="ml-2 font-medium">{document.specialty}</span>
            </div>
          )}
        </div>
        {document.description && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <span className="text-gray-500 text-sm">Description:</span>
            <p className="mt-1 text-sm text-gray-900">{document.description}</p>
          </div>
        )}
      </div>

      {/* Document Preview */}
      <div className="flex-1 px-6 py-4 bg-gray-50 flex items-center justify-center">
        {loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading document...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-4 text-red-600">{error}</p>
            <button
              onClick={fetchDownloadUrl}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : downloadUrl ? (
          <div className="w-full h-full flex items-center justify-center">
            {isImage ? (
              <div className="w-full flex items-center justify-center">
                <img
                  src={downloadUrl}
                  alt={document.originalFileName}
                  className="max-w-full max-h-[82vh] object-contain mx-auto rounded-lg shadow-lg"
                  onError={() => {
                    setError("Failed to load image. The file may be corrupted or inaccessible.")
                  }}
                  onLoad={() => {
                  }}
                />
              </div>
            ) : isPDF ? (
              <iframe
                src={downloadUrl}
                className="w-full h-full max-h-[82vh] border border-gray-300 rounded-lg bg-white shadow-inner"
                title={document.originalFileName}
              />
            ) : (
              <div className="text-center">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400"
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
                <p className="mt-4 text-gray-600">Preview not available for this file type</p>
                <button
                  onClick={handleDownload}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Download to View
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-600">No preview available</p>
            <button
              onClick={fetchDownloadUrl}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Load Document
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      {(canEdit || canDelete || onClose) && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 text-sm font-medium"
            >
              Close
            </button>
          )}
          {canDelete && onDelete && (
            <button
              onClick={() => onDelete(document.id)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

