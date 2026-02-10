"use client"

import { useState, useRef, useEffect } from "react"
import { auth } from "@/firebase/config"
import { PatientConsentMetadata } from "@/types/consent"
import { ConfirmDialog } from "@/components/ui/overlays/Modals"

interface PatientConsentVideoProps {
  patientId: string
  patientUid: string
  patientName?: string
  appointmentId?: string
  onUploadSuccess?: () => void
  optional?: boolean
  compact?: boolean
}

export default function PatientConsentVideo({
  patientId,
  patientUid,
  patientName = "",
  appointmentId,
  onUploadSuccess,
  optional = true,
  compact = false,
}: PatientConsentVideoProps) {
  const [consents, setConsents] = useState<PatientConsentMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  // Revoke blob URL when preview is cleared
  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url)
    }
  }, [preview?.url])

  // Force video to load blob URL after DOM is ready (fixes black preview in modals)
  useEffect(() => {
    if (!preview?.url) return
    const url = preview.url
    const id = setTimeout(() => {
      const video = previewVideoRef.current
      if (video) {
        video.src = url
        video.load()
      }
    }, 120)
    return () => clearTimeout(id)
  }, [preview?.url])

  const fetchConsents = async () => {
    setLoading(true)
    setError(null)
    try {
      const user = auth.currentUser
      if (!user) {
        setError("Please sign in to view consent videos.")
        return
      }
      const token = await user.getIdToken()
      const params = new URLSearchParams({ patientId: patientUid })
      if (appointmentId) params.set("appointmentId", appointmentId)
      const res = await fetch(`/api/patient-consent?${params}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load consents")
      }
      const data = await res.json()
      setConsents(data.consents || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (patientUid) fetchConsents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUid, appointmentId])

  const uploadVideo = async (file: File | Blob, source: "recorded" | "uploaded", fileName?: string) => {
    setUploading(true)
    setError(null)
    try {
      const user = auth.currentUser
      if (!user) {
        setError("Please sign in to upload consent video.")
        return
      }
      const token = await user.getIdToken()
      const formData = new FormData()
      const f = file instanceof File ? file : new File([file], fileName || "consent.webm", { type: file.type || "video/webm" })
      formData.append("video", f)
      formData.append("patientId", patientId)
      formData.append("patientUid", patientUid)
      formData.append("patientName", patientName)
      formData.append("source", source)
      if (appointmentId) formData.append("appointmentId", appointmentId)

      const res = await fetch("/api/patient-consent/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      setConsents((prev) => [data.consent, ...prev])
      onUploadSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const startRecording = async () => {
    setError(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Recording is not supported in this browser.")
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm"
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const chunks = [...chunksRef.current]
        if (chunks.length === 0) return
        const blob = new Blob(chunks, { type: "video/webm" })
        const url = URL.createObjectURL(blob)
        setPreview({ blob, url })
      }
      recorder.start(1000)
      setRecording(true)
    } catch (e: unknown) {
      const err = e as Error & { name?: string }
      if (err.name === "NotAllowedError" || err.message?.toLowerCase().includes("permission")) {
        setError("Camera and microphone access was denied. Please allow access in your browser (address bar or site settings) and try again.")
      } else if (err.name === "NotFoundError") {
        setError("No camera or microphone found. Please connect a device and try again.")
      } else {
        setError(err.message || "Could not start recording. Please check camera and microphone permissions.")
      }
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      // Flush any buffered data so the final blob has all chunks
      if (recorder.state === "recording") recorder.requestData()
      recorder.stop()
    }
    setRecording(false)
  }

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      uploadVideo(file, "uploaded")
    } else {
      setError("Please select a video file (webm, mp4, mov)")
    }
    e.target.value = ""
  }

  const confirmAddRecording = () => {
    if (!preview?.blob) return
    uploadVideo(preview.blob, "recorded", "consent.webm")
    if (preview.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const retakeRecording = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
    setError(null)
  }

  const deleteConsent = async (consentId: string) => {
    setDeletingId(consentId)
    setError(null)
    try {
      const user = auth.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch(`/api/patient-consent/${consentId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      setConsents((prev) => prev.filter((c) => c.id !== consentId))
      setConfirmDeleteId(null)
      onUploadSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setDeletingId(null)
    }
  }

  const labelClass = compact ? "text-xs font-medium text-slate-700" : "text-sm font-semibold text-slate-800"
  const sectionClass = compact ? "space-y-2" : "space-y-3"

  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between gap-2">
        <h4 className={labelClass}>
          Patient consent video {optional && <span className="text-slate-400 font-normal">(optional)</span>}
        </h4>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>
      )}

      {recording && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
          </span>
          <span className="text-sm font-medium text-red-800">Recording in progress…</span>
          <span className="text-xs text-red-600">Click &quot;Stop recording&quot; when done.</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {preview ? null : !recording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <span className="w-2 h-2 rounded-full bg-white" />
            Start recording
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Stop recording
          </button>
        )}
        {!preview && (
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <input type="file" accept="video/webm,video/mp4,video/quicktime" className="hidden" onChange={onFileSelect} disabled={uploading || recording} />
            Upload video
          </label>
        )}
      </div>

      {preview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
          <p className="text-xs font-medium text-slate-600">Preview — verify then add</p>
          {preview.url ? (
            <video
              ref={previewVideoRef}
              key={preview.url}
              src={preview.url}
              controls
              className="w-full max-h-48 rounded border border-slate-200 bg-black"
              playsInline
              preload="auto"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retakeRecording}
              disabled={uploading}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={confirmAddRecording}
              disabled={uploading}
              className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {uploading ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {uploading && !preview && <p className="text-xs text-slate-500">Uploading…</p>}
      {loading ? (
        <p className="text-xs text-slate-500">Loading list…</p>
      ) : consents.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Recorded / uploaded consents</p>
          <ul className="space-y-1">
            {consents.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 truncate">
                  {new Date(c.uploadedAt).toLocaleString()} · {c.source} · {c.uploadedBy.name}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <a
                    href={c.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Play
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(c.id)}
                    disabled={deletingId !== null}
                    className="text-red-600 hover:underline disabled:opacity-50"
                    aria-label="Delete consent"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        title="Delete consent video?"
        message="Are you sure you want to delete this consent video? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmLoading={deletingId === confirmDeleteId}
        loadingText="Deleting..."
        onConfirm={() => confirmDeleteId && deleteConsent(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
