'use client'

import { useState, useRef, DragEvent } from "react"
import { DocumentType, DocumentMetadata } from "@/types/document"
import { validateFileType, validateFileSize } from "@/utils/documents/documentDetection"
import { auth } from "@/firebase/config"

interface DocumentUploadProps {
  patientId: string
  patientUid: string
  appointmentId?: string
  specialty?: string
  onUploadSuccess?: (document: DocumentMetadata) => void
  onUploadError?: (error: string) => void
  allowBulk?: boolean
  className?: string
}

interface UploadFile {
  file: File
  progress: number
  status: "pending" | "uploading" | "success" | "error"
  error?: string
  document?: DocumentMetadata
}

export default function DocumentUpload({
  patientId,
  patientUid,
  appointmentId,
  specialty,
  onUploadSuccess,
  onUploadError,
  allowBulk = true,
  className = "",
}: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFileType, setSelectedFileType] = useState<DocumentType | "">("")
  const [description, setDescription] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy"
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
    }
  }

  const handleFiles = (fileList: File[]) => {
    const validFiles: UploadFile[] = []

    fileList.forEach((file) => {
      const typeValidation = validateFileType(file)
      const sizeValidation = validateFileSize(file)

      if (!typeValidation.valid) {
        onUploadError?.(`${file.name}: ${typeValidation.error}`)
        return
      }

      if (!sizeValidation.valid) {
        onUploadError?.(`${file.name}: ${sizeValidation.error}`)
        return
      }

      validFiles.push({
        file,
        progress: 0,
        status: "pending",
      })
    })

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setUploading(true)

    try {
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to upload documents")
      }

      const token = await currentUser.getIdToken()

      // Single file upload
      if (files.length === 1) {
        const uploadFile = files[0]
        setFiles((prev) =>
          prev.map((f, i) => (i === 0 ? { ...f, status: "uploading" as const, progress: 0 } : f))
        )

        const formData = new FormData()
        formData.append("file", uploadFile.file)
        formData.append("patientId", patientId)
        formData.append("patientUid", patientUid)
        if (appointmentId) formData.append("appointmentId", appointmentId)
        if (specialty) formData.append("specialty", specialty)
        if (selectedFileType) formData.append("fileType", selectedFileType)
        if (description) formData.append("description", description)

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Upload failed")
        }

        setFiles((prev) =>
          prev.map((f, i) =>
            i === 0
              ? { ...f, status: "success" as const, progress: 100, document: data.document }
              : f
          )
        )

        onUploadSuccess?.(data.document)
        setTimeout(() => {
          setFiles([])
          setDescription("")
          setSelectedFileType("")
        }, 2000)
      } else {
        // Bulk upload
        const formData = new FormData()
        formData.append("patientId", patientId)
        formData.append("patientUid", patientUid)
        if (appointmentId) formData.append("appointmentId", appointmentId)
        if (specialty) formData.append("specialty", specialty)

        files.forEach((uploadFile, index) => {
          formData.append(`file_${index}`, uploadFile.file)
        })

        // Update all to uploading
        setFiles((prev) => prev.map((f) => ({ ...f, status: "uploading" as const, progress: 0 })))

        const response = await fetch("/api/documents/bulk-upload", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Bulk upload failed")
        }

        // Update successful files
        const successMap = new Map<string, DocumentMetadata>(data.results.success.map((doc: DocumentMetadata) => [doc.originalFileName, doc]))
        const failedMap = new Map<string, string>(data.results.failed.map((item: { fileName: string; error: string }) => [item.fileName, item.error]))

        setFiles((prev) =>
          prev.map((f) => {
            const successDoc = successMap.get(f.file.name)
            if (successDoc) {
              return { ...f, status: "success" as const, progress: 100, document: successDoc }
            }
            const errorMsg = failedMap.get(f.file.name)
            if (errorMsg) {
              return { ...f, status: "error" as const, error: errorMsg }
            }
            return f
          })
        )

        // Call success callback for each successful upload
        data.results.success.forEach((doc: DocumentMetadata) => {
          onUploadSuccess?.(doc)
        })

        // Call error callback for each failed upload
        data.results.failed.forEach((item: { fileName: string; error: string }) => {
          onUploadError?.(`${item.fileName}: ${item.error}`)
        })

        setTimeout(() => {
          setFiles([])
          setDescription("")
          setSelectedFileType("")
        }, 3000)
      }
    } catch (error: any) {
      setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as const, error: error.message })))
      onUploadError?.(error.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
    return (bytes / (1024 * 1024)).toFixed(2) + " MB"
  }

  return (
    <div className={className}>
      {/* Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 ${
          isDragging 
            ? "border-blue-500 bg-blue-50/80 scale-[1.02] shadow-lg" 
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100/50"
        }`}
      >
        <div className="text-center">
          {isDragging ? (
            <div className="animate-bounce">
              <svg
                className="mx-auto h-16 w-16 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          ) : (
            <svg
              className="mx-auto h-12 w-12 text-gray-400 transition-colors"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <div className="mt-4">
            {isDragging ? (
              <p className="text-lg font-semibold text-blue-600 animate-pulse">
                Drop files here
              </p>
            ) : (
              <>
                <label
                  htmlFor="file-upload"
                  className="inline-block cursor-pointer rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 hover:shadow-lg transition-all duration-200"
                >
                  Select files
                </label>
                <input
                  id="file-upload"
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  multiple={allowBulk}
                  accept=".jpg,.jpeg,.png,.pdf,.dcm"
                  onChange={handleFileSelect}
                />
                <p className="mt-3 text-sm text-gray-600 font-medium">
                  or <span className="text-blue-600">drag and drop</span> files here
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Supported: JPG, PNG, PDF, DICOM (2MB - 10MB)
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* File Type and Description (for single file) */}
      {files.length === 1 && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document Type (optional - auto-detected)
            </label>
            <select
              value={selectedFileType}
              onChange={(e) => setSelectedFileType(e.target.value as DocumentType | "")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Auto-detect</option>
              <option value="laboratory-report">Laboratory reports</option>
              <option value="radiology-report">Radiology Report</option>
              <option value="cardiology-report">Cardiology Report</option>
              <option value="prescription">Prescription</option>
              <option value="other">Other documents</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Add a description for this document..."
            />
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((uploadFile, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{uploadFile.file.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(uploadFile.file.size)}</p>
                {uploadFile.status === "uploading" && (
                  <div className="mt-2">
                    <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                {uploadFile.status === "error" && uploadFile.error && (
                  <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                )}
                {uploadFile.status === "success" && (
                  <p className="text-xs text-green-600 mt-1">Uploaded successfully</p>
                )}
              </div>
              {uploadFile.status !== "uploading" && (
                <button
                  onClick={() => removeFile(index)}
                  className="ml-2 text-gray-400 hover:text-red-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          ))}

          {/* Upload Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={uploadFiles}
              disabled={uploading || files.length === 0}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading..." : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

