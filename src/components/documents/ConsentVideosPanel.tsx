"use client"

import { useState, useEffect, useCallback } from "react"
import { auth } from "@/firebase/config"
import { PatientConsentMetadata } from "@/types/consent"
import PatientSelector from "./PatientSelector"
import { ConfirmDialog } from "@/components/ui/overlays/Modals"
import Notification from "@/components/ui/feedback/Notification"

interface ConsentVideosPanelProps {
  patientId?: string
  patientUid?: string
  showPatientSelector?: boolean
  selectedPatient: { id: string; uid: string; patientId: string; firstName: string; lastName: string; email: string; phone?: string } | null
  onPatientSelect: (p: ConsentVideosPanelProps["selectedPatient"]) => void
  canDelete?: boolean
  className?: string
}

export default function ConsentVideosPanel({
  patientId: initialPatientId,
  patientUid: initialPatientUid,
  showPatientSelector = false,
  selectedPatient,
  onPatientSelect,
  canDelete = true,
  className = "",
}: ConsentVideosPanelProps) {
  const [consents, setConsents] = useState<PatientConsentMetadata[]>([])
  const [allConsents, setAllConsents] = useState<PatientConsentMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [patientId, setPatientId] = useState(initialPatientId || "")
  const [patientUid, setPatientUid] = useState(initialPatientUid || "")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    if (selectedPatient) {
      setPatientId(selectedPatient.patientId)
      setPatientUid(selectedPatient.uid)
    } else if (!showPatientSelector) {
      setPatientId(initialPatientId || "")
      setPatientUid(initialPatientUid || "")
    }
  }, [selectedPatient, initialPatientId, initialPatientUid, showPatientSelector])

  const fetchConsents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const user = auth.currentUser
      if (!user) {
        setError("You must be logged in to view consent videos.")
        return
      }
      const token = await user.getIdToken()
      const params = new URLSearchParams()
      const finalUid = patientUid || initialPatientUid
      const finalId = patientId || initialPatientId
      if (finalUid) params.set("patientId", finalUid)
      else if (finalId) params.set("patientId", finalId)

      const res = await fetch(`/api/patient-consent?${params}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load consent videos")
      const list = (data.consents || []) as PatientConsentMetadata[]
      setAllConsents(list)
      applyFilters(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setAllConsents([])
      setConsents([])
    } finally {
      setLoading(false)
    }
  }, [patientId, patientUid, initialPatientId, initialPatientUid])

  const applyFilters = useCallback(
    (list: PatientConsentMetadata[]) => {
      let filtered = [...list]
      const q = searchQuery.toLowerCase().trim()
      if (q) {
        filtered = filtered.filter(
          (c) =>
            (c.patientName || "").toLowerCase().includes(q) ||
            (c.fileName || "").toLowerCase().includes(q) ||
            (c.uploadedBy?.name || "").toLowerCase().includes(q) ||
            (c.patientId || "").toLowerCase().includes(q)
        )
      }
      if (dateFrom) {
        filtered = filtered.filter((c) => {
          const d = new Date(c.uploadedAt).toISOString().split("T")[0]
          return d >= dateFrom
        })
      }
      if (dateTo) {
        filtered = filtered.filter((c) => {
          const d = new Date(c.uploadedAt).toISOString().split("T")[0]
          return d <= dateTo
        })
      }
      setConsents(filtered)
    },
    [searchQuery, dateFrom, dateTo]
  )

  // Only fetch consent videos when a patient is selected (never show "last uploaded" by default)
  useEffect(() => {
    const hasPatient = !!(patientUid || initialPatientUid || patientId || initialPatientId)
    if (!hasPatient) {
      setConsents([])
      setAllConsents([])
      setLoading(false)
      return
    }
    fetchConsents()
  }, [showPatientSelector, patientUid, initialPatientUid, patientId, initialPatientId, fetchConsents])

  useEffect(() => {
    if (allConsents.length > 0) applyFilters(allConsents)
  }, [searchQuery, dateFrom, dateTo, allConsents, applyFilters])

  const handleDelete = async (consentId: string) => {
    setDeleting(true)
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
      setAllConsents((prev) => prev.filter((c) => c.id !== consentId))
      setConsents((prev) => prev.filter((c) => c.id !== consentId))
      setConfirmDeleteId(null)
      setNotification({ type: "success", message: "Consent video deleted." })
      setTimeout(() => setNotification(null), 3000)
    } catch (e) {
      setNotification({ type: "error", message: e instanceof Error ? e.message : "Failed to delete" })
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })

  return (
    <div className={className}>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
          durationMs={notification.type === "error" ? 5000 : 3000}
        />
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Consent Videos</h2>
        <p className="text-sm text-gray-600 mt-1">
          {consents.length} consent video{consents.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {showPatientSelector && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <PatientSelector
            onPatientSelect={(p) => {
              onPatientSelect(p ?? null)
              if (p) {
                setPatientId(p.patientId)
                setPatientUid(p.uid)
              } else {
                setPatientId("")
                setPatientUid("")
              }
            }}
            selectedPatient={selectedPatient}
          />
        </div>
      )}

      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Patient name, file name, uploaded by..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
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

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading consent videos...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
          <button onClick={() => fetchConsents()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Retry
          </button>
        </div>
      ) : consents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600">
            {!(patientUid || initialPatientUid || patientId || initialPatientId)
              ? "Select or search for a patient above to view their consent videos."
              : "No consent videos found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {consents.map((c) => (
            <div key={c.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">🎥</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 truncate">{c.fileName || "Consent video"}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {c.source} • {c.uploadedBy?.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(c.uploadedAt)}</p>
                  {(c.patientName || !patientUid) && (
                    <p className="text-xs text-blue-600 mt-1">{c.patientName || `Patient: ${c.patientId}`}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={c.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Play
                </a>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(c.id)}
                    className="inline-flex items-center px-3 py-1.5 rounded-md border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        title="Delete consent video?"
        message="Are you sure you want to delete this consent video? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmLoading={deleting}
        loadingText="Deleting..."
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
