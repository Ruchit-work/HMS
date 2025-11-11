"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/firebase/config"
import { ROOM_TYPES } from "@/constants/roomTypes"
import { Admission, AdmissionRequest, Room } from "@/types/patient"

const roomTypeLabelMap: Record<Room["roomType"], string> = ROOM_TYPES.reduce((acc, type) => {
  acc[type.id] = type.name
  return acc
}, {} as Record<Room["roomType"], string>)

const roomTypeRateMap = ROOM_TYPES.reduce((acc, type) => {
  acc[type.id] = type.dailyRate
  return acc
}, {} as Record<Room["roomType"], number>)

const fallbackRoomNumbersByType: Record<Room["roomType"], string[]> = {
  general: ["101", "102"],
  semi_private: ["201", "202"],
  private: ["301"],
  deluxe: ["401"],
  vip: ["501"],
}

interface AdmitRequestsPanelProps {
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
}

export default function AdmitRequestsPanel({ onNotification }: AdmitRequestsPanelProps) {
  const [admitRequests, setAdmitRequests] = useState<AdmissionRequest[]>([])
  const [admitRequestsLoading, setAdmitRequestsLoading] = useState(false)
  const [admitRequestsError, setAdmitRequestsError] = useState<string | null>(null)
  const [selectedAdmitRequest, setSelectedAdmitRequest] = useState<AdmissionRequest | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignRoomType, setAssignRoomType] = useState<Room["roomType"] | "">("")
  const [assignRoomId, setAssignRoomId] = useState("")
  const [assignNotes, setAssignNotes] = useState("")
  const [assignLoading, setAssignLoading] = useState(false)
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)

  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [admissionsLoading, setAdmissionsLoading] = useState(false)
  const [admissionsError, setAdmissionsError] = useState<string | null>(null)
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)
  const [dischargeModalOpen, setDischargeModalOpen] = useState(false)
  const [dischargeDoctorFee, setDischargeDoctorFee] = useState("")
  const [dischargeOtherCharges, setDischargeOtherCharges] = useState("")
  const [dischargeOtherDescription, setDischargeOtherDescription] = useState("")
  const [dischargeNotes, setDischargeNotes] = useState("")
  const [dischargeLoading, setDischargeLoading] = useState(false)

  const availableRoomTypes = useMemo(() => {
    const types = new Set<Room["roomType"]>()
    rooms.forEach((room) => {
      if (room?.roomType) {
        types.add(room.roomType)
      }
    })
    return Array.from(types)
  }, [rooms])

  const availableRoomsForType = useMemo(() => {
    return rooms.filter((room) => {
      if (room.status !== "available") return false
      if (!assignRoomType) return true
      return room.roomType === assignRoomType
    })
  }, [rooms, assignRoomType])

  const notify = useCallback(
    (payload: { type: "success" | "error"; message: string } | null) => {
      onNotification?.(payload)
    },
    [onNotification]
  )

  const fetchRooms = useCallback(async () => {
    try {
      setRoomsLoading(true)
      let roomsSnap = await getDocs(collection(db, "rooms"))
      if (roomsSnap.empty) {
        await fetch("/api/admin/rooms/seed", { method: "POST" })
        roomsSnap = await getDocs(collection(db, "rooms"))
      }
      let roomsList = roomsSnap.docs.map((r) => {
        const data = r.data() as Omit<Room, "id"> & Partial<Room>
        return { ...data, id: r.id } as Room
      })
      if (roomsList.length === 0) {
        roomsList = Object.entries(fallbackRoomNumbersByType).flatMap(([type, numbers]) => {
          const roomTypeId = type as Room["roomType"]
          const rate = roomTypeRateMap[roomTypeId] ?? 0
          return numbers.map((roomNumber) => ({
            id: `demo-${roomNumber}`,
            roomNumber,
            roomType: roomTypeId,
            ratePerDay: rate,
            status: "available" as Room["status"],
          }))
        })
      }
      setRooms(roomsList)
    } catch (error) {
      console.error("Failed to load rooms", error)
    } finally {
      setRoomsLoading(false)
    }
  }, [])

  const fetchAdmitRequests = useCallback(async () => {
    try {
      setAdmitRequestsLoading(true)
      setAdmitRequestsError(null)
      const res = await fetch("/api/receptionist/admission-requests")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load admit requests")
      }
      const data = await res.json().catch(() => ({}))
      const requests = Array.isArray(data?.requests) ? data.requests : []
      const formatted: AdmissionRequest[] = requests.map((req: any) => ({
        id: String(req.id || ""),
        appointmentId: String(req.appointmentId || ""),
        patientUid: String(req.patientUid || ""),
        patientId: req.patientId || undefined,
        patientName: req.patientName || null,
        doctorId: String(req.doctorId || ""),
        doctorName: req.doctorName || undefined,
        notes: req.notes ?? null,
        status: req.status || "pending",
        createdAt: req.createdAt || new Date().toISOString(),
        updatedAt: req.updatedAt,
        cancelledAt: req.cancelledAt,
        cancelledBy: req.cancelledBy,
        appointmentDetails: req.appointmentDetails || null,
      }))
      setAdmitRequests(formatted.filter((req) => req.status === "pending"))
    } catch (error: any) {
      console.error("Failed to load admission requests", error)
      setAdmitRequestsError(error?.message || "Failed to load admission requests")
    } finally {
      setAdmitRequestsLoading(false)
    }
  }, [])

  const fetchAdmissions = useCallback(async () => {
    try {
      setAdmissionsLoading(true)
      setAdmissionsError(null)
      const res = await fetch("/api/receptionist/admissions?status=admitted")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load admissions")
      }
      const data = await res.json().catch(() => ({}))
      const items = Array.isArray(data?.admissions) ? data.admissions : []
      const formatted: Admission[] = items.map((item: any) => ({
        id: String(item.id || ""),
        appointmentId: String(item.appointmentId || ""),
        patientUid: String(item.patientUid || ""),
        patientId: item.patientId || undefined,
        patientName: item.patientName || null,
        doctorId: String(item.doctorId || ""),
        doctorName: item.doctorName || null,
        roomId: String(item.roomId || ""),
        roomNumber: item.roomNumber || "",
        roomType: item.roomType || "general",
        roomRatePerDay: Number(item.roomRatePerDay || 0),
        status: item.status || "admitted",
        checkInAt: item.checkInAt || new Date().toISOString(),
        checkOutAt: item.checkOutAt || null,
        notes: item.notes || null,
        createdBy: item.createdBy || "receptionist",
        createdAt: item.createdAt || item.checkInAt || new Date().toISOString(),
        updatedAt: item.updatedAt,
        billingId: item.billingId || null,
        appointmentDetails: item.appointmentDetails || null,
      }))
      setAdmissions(formatted.filter((admission) => admission.status === "admitted"))
    } catch (error: any) {
      console.error("Failed to load admissions", error)
      setAdmissionsError(error?.message || "Failed to load admissions")
    } finally {
      setAdmissionsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
    fetchAdmitRequests()
    fetchAdmissions()
  }, [fetchRooms, fetchAdmitRequests, fetchAdmissions])

  const handleOpenAssignModal = (request: AdmissionRequest) => {
    setSelectedAdmitRequest(request)
    const defaultType = rooms.find((room) => room.status === "available")?.roomType || ""
    setAssignRoomType(defaultType)
    setAssignRoomId("")
    setAssignNotes("")
    setAssignModalOpen(true)
  }

  const handleCloseAssignModal = () => {
    setAssignModalOpen(false)
    setSelectedAdmitRequest(null)
    setAssignRoomId("")
    setAssignNotes("")
  }

  const handleAssignRoom = async () => {
    if (!selectedAdmitRequest) return
    if (!assignRoomId) {
      notify({ type: "error", message: "Select a room to assign." })
      return
    }
    setAssignLoading(true)
    try {
      const res = await fetch(`/api/receptionist/admission-request/${selectedAdmitRequest.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: assignRoomId,
          notes: assignNotes.trim() ? assignNotes.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to assign room")
      }
      notify({ type: "success", message: "Patient admitted successfully." })
      setAdmitRequests((prev) => prev.filter((req) => req.id !== selectedAdmitRequest.id))
      setRooms((prev) => prev.map((room) => (room.id === assignRoomId ? { ...room, status: "occupied" } : room)))
      fetchAdmissions()
      setAssignModalOpen(false)
      setSelectedAdmitRequest(null)
    } catch (error: any) {
      console.error("Assign room error", error)
      notify({ type: "error", message: error?.message || "Failed to assign room" })
    } finally {
      setAssignLoading(false)
    }
  }

  const handleCancelAdmitRequest = async (request: AdmissionRequest) => {
    const confirmation = window.confirm("Cancel this admission request? The appointment will be marked as completed.")
    if (!confirmation) return
    const cancelReason = window.prompt("Optional: add a cancellation note for history.") || undefined
    setCancelLoadingId(request.id)
    try {
      const res = await fetch(`/api/receptionist/admission-request/${request.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason && cancelReason.trim() ? cancelReason.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to cancel admission request")
      }
      setAdmitRequests((prev) => prev.filter((req) => req.id !== request.id))
      notify({ type: "success", message: "Admission request cancelled." })
    } catch (error: any) {
      console.error("Cancel admission request error", error)
      notify({ type: "error", message: error?.message || "Failed to cancel admission request" })
    } finally {
      setCancelLoadingId(null)
    }
  }

  const handleOpenDischargeModal = (admission: Admission) => {
    setSelectedAdmission(admission)
    setDischargeDoctorFee("")
    setDischargeOtherCharges("")
    setDischargeOtherDescription("")
    setDischargeNotes("")
    setDischargeModalOpen(true)
  }

  const handleCloseDischargeModal = () => {
    setDischargeModalOpen(false)
    setSelectedAdmission(null)
  }

  const handleDischarge = async () => {
    if (!selectedAdmission) return
    setDischargeLoading(true)
    try {
      const res = await fetch(`/api/receptionist/admissions/${selectedAdmission.id}/discharge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorFee: dischargeDoctorFee ? Number(dischargeDoctorFee) : undefined,
          otherCharges: dischargeOtherCharges ? Number(dischargeOtherCharges) : undefined,
          otherDescription: dischargeOtherDescription?.trim() || undefined,
          notes: dischargeNotes?.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to discharge patient")
      }
      notify({ type: "success", message: "Patient discharged successfully." })
      setAdmissions((prev) => prev.filter((admission) => admission.id !== selectedAdmission.id))
      setRooms((prev) => prev.map((room) => (room.id === selectedAdmission.roomId ? { ...room, status: "available" } : room)))
      setDischargeModalOpen(false)
      setSelectedAdmission(null)
    } catch (error: any) {
      console.error("Discharge error", error)
      notify({ type: "error", message: error?.message || "Failed to discharge patient" })
    } finally {
      setDischargeLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pending Admit Requests</h2>
          <p className="text-sm text-gray-500">Review hospitalization requests sent by doctors</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAdmitRequests}
            disabled={admitRequestsLoading}
            className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50 text-sm"
          >
            {admitRequestsLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {admitRequestsError && (
        <div className="p-3 border border-red-200 rounded-lg bg-red-50 text-sm text-red-700">
          {admitRequestsError}
        </div>
      )}

      {admitRequestsLoading && admitRequests.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <svg className="w-8 h-8 mx-auto mb-3 animate-spin text-purple-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading admit requests...
        </div>
      ) : admitRequests.length === 0 ? (
        <div className="py-12 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <span className="text-4xl mb-2 block">🏥</span>
          No pending admit requests right now.
        </div>
      ) : (
        <div className="space-y-4">
          {admitRequests.map((request) => (
            <div key={request.id} className="border border-gray-200 rounded-xl p-4 sm:p-5 bg-white hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs uppercase text-gray-500">Patient</p>
                    <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      {request.patientName || "Unknown"}
                      {request.patientId && (
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                          {request.patientId}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                    <div>
                      <span className="text-xs uppercase text-gray-500 block">Doctor</span>
                      <span className="font-medium">{request.doctorName || "Unknown Doctor"}</span>
                    </div>
                    <div>
                      <span className="text-xs uppercase text-gray-500 block">Created</span>
                      <span>{request.createdAt ? new Date(request.createdAt).toLocaleString() : "—"}</span>
                    </div>
                    {request.notes && (
                      <div className="sm:col-span-2">
                        <span className="text-xs uppercase text-gray-500 block">Doctor Notes</span>
                        <span>{request.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:w-40">
                  <button
                    onClick={() => handleOpenAssignModal(request)}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                  >
                    Assign Room
                  </button>
                  <button
                    onClick={() => handleCancelAdmitRequest(request)}
                    disabled={cancelLoadingId === request.id}
                    className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors disabled:opacity-50"
                  >
                    {cancelLoadingId === request.id ? "Cancelling..." : "Cancel Request"}
                  </button>
                </div>
              </div>
              {request.appointmentDetails && (
                <div className="mt-4 border-t border-dashed border-gray-200 pt-3 text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <span className="block font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Appointment</span>
                    <span>{request.appointmentDetails.appointmentDate || "—"} {request.appointmentDetails.appointmentTime || ""}</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Patient Phone</span>
                    <span>{request.appointmentDetails.patientPhone || "—"}</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-gray-500 uppercase text-[10px] tracking-wide">Doctor Specialization</span>
                    <span>{request.appointmentDetails.doctorSpecialization || "—"}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Currently Admitted Patients</h3>
            <p className="text-sm text-gray-500">Manage inpatients and discharge when ready</p>
          </div>
          <button
            onClick={fetchAdmissions}
            disabled={admissionsLoading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 text-sm"
          >
            {admissionsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {admissionsError && (
          <div className="p-3 border border-red-200 rounded-lg bg-red-50 text-sm text-red-700 mb-4">
            {admissionsError}
          </div>
        )}

        {admissionsLoading && admissions.length === 0 ? (
          <div className="py-10 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Loading admitted patients...
          </div>
        ) : admissions.length === 0 ? (
          <div className="py-10 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <span className="text-4xl mb-2 block">🛏️</span>
            No patients are currently admitted.
          </div>
        ) : (
          <div className="space-y-4">
            {admissions.map((admission) => {
              return (
                <div key={admission.id} className="border border-gray-200 rounded-xl p-4 sm:p-5 bg-white hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs uppercase text-gray-500">Patient</p>
                        <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {admission.patientName || "Unknown"}
                          {admission.patientId && (
                            <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                              {admission.patientId}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                        <div>
                          <span className="text-xs uppercase text-gray-500 block">Doctor</span>
                          <span className="font-medium">{admission.doctorName || "Unknown"}</span>
                        </div>
                        <div>
                          <span className="text-xs uppercase text-gray-500 block">Room</span>
                          <span className="font-medium">
                            {admission.roomNumber} — {roomTypeLabelMap[admission.roomType] || admission.roomType}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs uppercase text-gray-500 block">Rate / Day</span>
                          <span>₹{admission.roomRatePerDay}</span>
                        </div>
                        <div>
                          <span className="text-xs uppercase text-gray-500 block">Check-in</span>
                          <span>{admission.checkInAt ? new Date(admission.checkInAt).toLocaleString() : "—"}</span>
                        </div>
                        <div>
                          <span className="text-xs uppercase text-gray-500 block">Stay Duration</span>
                          <span>{admission.checkInAt ? Math.max(1, Math.ceil((Date.now() - new Date(admission.checkInAt).getTime()) / (1000 * 60 * 60 * 24))) : 1} day(s)</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:w-40">
                      <button
                        onClick={() => handleOpenDischargeModal(admission)}
                        className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        Discharge
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {assignModalOpen && selectedAdmitRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold">Assign Room</h3>
                <p className="text-sm text-blue-100">Confirm room allocation for the selected admission request</p>
              </div>
              <button onClick={handleCloseAssignModal} className="w-9 h-9 rounded-lg hover:bg-white/20 flex items-center justify-center">
                <span className="text-xl">×</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5 bg-gray-50 rounded-b-2xl">
              <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedAdmitRequest.patientName || "Unknown patient"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Doctor: {selectedAdmitRequest.doctorName || "—"}
                    </p>
                  </div>
                  {selectedAdmitRequest.patientId && (
                    <span className="text-xs font-mono px-2 py-1 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                      ID: {selectedAdmitRequest.patientId}
                    </span>
                  )}
                </div>
                {selectedAdmitRequest.notes && (
                  <p className="mt-3 text-sm text-gray-600">{selectedAdmitRequest.notes}</p>
                )}
              </div>

              {roomsLoading && (
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600">
                  Loading available rooms...
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Room Type</label>
                <select
                  value={assignRoomType}
                  onChange={(e) => {
                    setAssignRoomType(e.target.value as Room["roomType"])
                    setAssignRoomId("")
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Show all available types</option>
                  {availableRoomTypes.map((type) => (
                    <option key={type} value={type}>
                      {roomTypeLabelMap[type] || type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2"
              >
                <label className="block text-sm font-medium text-gray-700">Room</label>
                {availableRoomsForType.length === 0 ? (
                  <div className="p-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500">
                    No available rooms{assignRoomType ? ` for ${roomTypeLabelMap[assignRoomType] || assignRoomType}` : ""}. Please adjust the selection or free up rooms.
                  </div>
                ) : (
                  <select
                    value={assignRoomId}
                    onChange={(e) => setAssignRoomId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select room</option>
                    {availableRoomsForType.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.roomNumber} — {roomTypeLabelMap[room.roomType] || room.roomType} (₹{room.ratePerDay}/day)
                      </option>
                    ))}
                  </select>
                )}
                {assignRoomId && (
                  <p className="text-xs text-gray-500">
                    Rate per day: ₹{rooms.find((room) => room.id === assignRoomId)?.ratePerDay || 0}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Reception Notes <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add room or admission notes for the medical team..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleCloseAssignModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={assignLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignRoom}
                  disabled={assignLoading || !assignRoomId}
                  className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {assignLoading ? "Assigning..." : "Confirm Admission"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dischargeModalOpen && selectedAdmission && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold">Discharge Patient</h3>
                <p className="text-sm text-indigo-100">Finalize the patient's discharge summary and billing adjustments</p>
              </div>
              <button onClick={handleCloseDischargeModal} className="w-9 h-9 rounded-lg hover:bg-white/20 flex items-center justify-center">
                <span className="text-xl">×</span>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5 bg-gray-50 rounded-b-2xl">
              <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedAdmission.patientName || "Unknown patient"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Doctor: {selectedAdmission.doctorName || "—"}
                    </p>
                  </div>
                  {selectedAdmission.patientId && (
                    <span className="text-xs font-mono px-2 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                      ID: {selectedAdmission.patientId}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 mt-3">
                  <div>
                    <span className="text-xs uppercase text-gray-500 block">Room</span>
                    <span>{selectedAdmission.roomNumber} — {roomTypeLabelMap[selectedAdmission.roomType] || selectedAdmission.roomType}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-gray-500 block">Rate / Day</span>
                    <span>₹{selectedAdmission.roomRatePerDay}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-gray-500 block">Check-in</span>
                    <span>{selectedAdmission.checkInAt ? new Date(selectedAdmission.checkInAt).toLocaleString() : "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-gray-500 block">Stay Duration</span>
                    <span>{selectedAdmission.checkInAt ? Math.max(1, Math.ceil((Date.now() - new Date(selectedAdmission.checkInAt).getTime()) / (1000 * 60 * 60 * 24))) : 1} day(s)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Doctor Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={dischargeDoctorFee}
                    onChange={(e) => setDischargeDoctorFee(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Other Charges (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={dischargeOtherCharges}
                    onChange={(e) => setDischargeOtherCharges(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g. 300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Other Charges Description</label>
                <input
                  type="text"
                  value={dischargeOtherDescription}
                  onChange={(e) => setDischargeOtherDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Lab tests, medicines, etc."
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Discharge Notes <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={dischargeNotes}
                  onChange={(e) => setDischargeNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Add any discharge notes for medical records."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseDischargeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={dischargeLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDischarge}
                  disabled={dischargeLoading}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {dischargeLoading ? "Processing..." : "Confirm Discharge"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
