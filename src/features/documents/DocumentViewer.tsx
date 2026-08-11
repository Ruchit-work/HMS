'use client'

import { useState, useEffect, useCallback, useRef } from "react"
import { DocumentMetadata } from "@/types/document"
import { auth } from "@/firebase/config"
import { detectCriticalFindings, formatReportDate, getReportDoctor } from "@/shared/utils/clinicalReportUtils"

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
  const [loading, setLoading] = useState(!document.downloadUrl)
  const [error, setError] = useState<string | null>(null)

  // Zoom & Rotation controls for image canvas
  const [zoom, setZoom] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchDownloadUrl = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

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
    if (document.downloadUrl && document.downloadUrl.trim().length > 0) {
      setDownloadUrl(document.downloadUrl)
      setLoading(false)
      return
    }
    fetchDownloadUrl()
  }, [document.id, document.downloadUrl, fetchDownloadUrl])

  const handleDownload = () => {
    if (downloadUrl) {
      const link = window.document.createElement("a")
      link.href = downloadUrl
      link.download = document.originalFileName
      link.target = "_blank"
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    }
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3.5))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))
  const handleResetZoom = () => {
    setZoom(1.0)
    setRotation(0)
  }
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360)

  const toggleFullscreen = () => {
    if (!window.document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      window.document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return "—"
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  const formatDate = (dateString: string): string => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getCategoryIcon = () => {
    if (isImage) return "🖼️"
    if (isPDF) return "📄"
    if (document.fileType === "laboratory-report") return "🧪"
    if (document.fileType === "radiology-report") return "🩻"
    if (document.fileType === "cardiology-report") return "❤️"
    if (document.fileType === "prescription") return "💊"
    return "📎"
  }

  const criticalInfo = detectCriticalFindings(document)

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[92vh] sm:h-[94vh] max-w-[96vw] bg-white text-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* ══════════════════════════════════════
          Header Bar — Clean Light Medical Workspace
          ══════════════════════════════════════ */}
      <div className={`px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
        criticalInfo.isCritical
          ? "bg-rose-50 border-rose-200 text-rose-900"
          : "bg-white border-slate-200 text-slate-900"
      }`}>
        {/* Left: Document Icon & Primary Metadata */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl shrink-0">
            {getCategoryIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold truncate text-slate-900 max-w-[280px] sm:max-w-[450px]">
                {document.originalFileName}
              </h3>
              {criticalInfo.isCritical && (
                <span className="shrink-0 rounded-md bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  Critical Finding
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              Uploaded by <span className="text-slate-800 font-medium">{document.uploadedBy?.name || "System"}</span> • {formatDate(document.uploadedAt)}
              {getReportDoctor(document) !== "—" && ` • Dr. ${getReportDoctor(document)}`}
            </p>
          </div>
        </div>

        {/* Center/Right: Badges & Tags */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-xs font-semibold text-cyan-800 uppercase tracking-wide">
            {document.fileType || "Document"}
          </span>
          {document.specialty && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              {document.specialty}
            </span>
          )}
          {document.patientName && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              Patient: {document.patientName}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600">
            {formatFileSize(document.fileSize)}
          </span>
        </div>

        {/* Right: Actions (Download & Close) */}
        <div className="flex items-center gap-2 shrink-0">
          {downloadUrl && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(document.id)}
              className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-xs font-semibold transition-colors"
            >
              Delete
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Close viewer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          Main Viewing Workspace Canvas (Light)
          ══════════════════════════════════════ */}
      <div className="relative flex-1 bg-slate-50 overflow-hidden flex items-center justify-center p-2 sm:p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-600 animate-spin" />
            <p className="mt-4 text-sm font-semibold text-slate-800">Loading document workspace…</p>
            <p className="mt-1 text-xs text-slate-500">Fetching medical record</p>
          </div>
        ) : error ? (
          <div className="max-w-md w-full text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-slate-900">Document Preview Error</h4>
            <p className="mt-2 text-xs text-slate-600">{error}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={fetchDownloadUrl}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Try Again
              </button>
              {downloadUrl && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
                >
                  Download File
                </button>
              )}
            </div>
          </div>
        ) : downloadUrl ? (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {isImage ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4 select-none">
                <img
                  src={downloadUrl}
                  alt={document.originalFileName}
                  className="max-w-full max-h-full object-contain mx-auto rounded-xl shadow-lg border border-slate-200/80 bg-white transition-transform duration-200 ease-out"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  }}
                  onError={() => {
                    setError("Failed to load image preview. The file link may have expired.")
                  }}
                />
              </div>
            ) : isPDF ? (
              <iframe
                src={downloadUrl}
                className="w-full h-full border border-slate-200 rounded-xl bg-white shadow-lg"
                title={document.originalFileName}
              />
            ) : (
              <div className="max-w-md text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl mx-auto mb-4">
                  {getCategoryIcon()}
                </div>
                <h4 className="text-base font-bold text-slate-900">{document.originalFileName}</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {document.mimeType || "Binary document file"} • {formatFileSize(document.fileSize)}
                </p>
                <p className="mt-3 text-xs text-slate-600">
                  Direct inline preview is not supported for this file format. Click below to download and view in your application.
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download File to View
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-6">
            <p className="text-sm text-slate-500">No document preview available</p>
            <button
              type="button"
              onClick={fetchDownloadUrl}
              className="mt-3 px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-semibold"
            >
              Load Document
            </button>
          </div>
        )}

        {/* Floating Image Viewing Toolbar Controls (Light Theme) */}
        {isImage && downloadUrl && !loading && !error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full px-3.5 py-1.5 flex items-center gap-2 shadow-xl text-slate-700 z-10">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              className="p-1.5 hover:bg-slate-100 rounded-full hover:text-slate-900 disabled:opacity-40 transition-colors"
              title="Zoom Out (-)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-xs font-mono font-bold text-slate-800 min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3.5}
              className="p-1.5 hover:bg-slate-100 rounded-full hover:text-slate-900 disabled:opacity-40 transition-colors"
              title="Zoom In (+)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2 py-1 text-[10px] font-semibold tracking-wide uppercase hover:bg-slate-100 rounded-lg hover:text-slate-900 transition-colors"
              title="Fit to screen"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={handleRotate}
              className="p-1.5 hover:bg-slate-100 rounded-full hover:text-slate-900 transition-colors"
              title="Rotate 90 degrees"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-slate-100 rounded-full hover:text-slate-900 transition-colors"
              title="Toggle Fullscreen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
