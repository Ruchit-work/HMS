"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db, auth } from "@/firebase/config"
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

  const pendingCount = admitRequests.length

  const { totalRooms, availableRoomsCount, occupiedRoomsCount } = useMemo(() => {
    const total = rooms.length
    let available = 0
    let occupied = 0
    rooms.forEach((room) => {
      if (room.status === "available") available += 1
      if (room.status === "occupied") occupied += 1
    })
    return {
      totalRooms: total,
      availableRoomsCount: available,
      occupiedRoomsCount: occupied,
    }
  }, [rooms])

  const admissionsCount = admissions.length
  const roomOccupancyRate = totalRooms ? Math.round((occupiedRoomsCount / totalRooms) * 100) : 0

  const roomAvailabilityByType = useMemo(() => {
    return ROOM_TYPES.map((type) => {
      const typeRooms = rooms.filter((room) => room.roomType === type.id)
      const available = typeRooms.filter((room) => room.status === "available").length
      const occupied = typeRooms.filter((room) => room.status === "occupied").length
      return {
        id: type.id,
        name: type.name,
        available,
        occupied,
        total: typeRooms.length || available + occupied,
      }
    })
  }, [rooms])

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Pending Requests",
        value: pendingCount,
        caption: "Awaiting admission review",
        tone: "from-purple-500 to-purple-600",
        icon: "📥",
      },
      {
        label: "Occupied Beds",
        value: occupiedRoomsCount,
        caption: `${roomOccupancyRate}% of total capacity`,
        tone: "from-rose-500 to-rose-600",
        icon: "🛏️",
      },
      {
        label: "Available Rooms",
        value: availableRoomsCount,
        caption: totalRooms ? `${availableRoomsCount}/${totalRooms} ready for assignment` : "No rooms synced yet",
        tone: "from-emerald-500 to-emerald-600",
        icon: "✅",
      },
      {
        label: "Admitted Patients",
        value: admissionsCount,
        caption: "Under inpatient supervision",
        tone: "from-sky-500 to-sky-600",
        icon: "🩺",
      },
    ]
  }, [pendingCount, occupiedRoomsCount, roomOccupancyRate, availableRoomsCount, totalRooms, admissionsCount])

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
        // Get Firebase Auth token
        const currentUser = auth.currentUser
        if (currentUser) {
          const token = await currentUser.getIdToken()
          await fetch("/api/admin/rooms/seed", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
        }
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

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to access admission requests")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch("/api/receptionist/admission-requests", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
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

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to access admissions")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch("/api/receptionist/admissions?status=admitted", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
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
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAdmitRequests()
      fetchAdmissions()
    }, 30000)
    
    return () => clearInterval(interval)
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
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to accept admission requests")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch(`/api/receptionist/admission-request/${selectedAdmitRequest.id}/accept`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to cancel admission requests")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch(`/api/receptionist/admission-request/${request.id}/cancel`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to discharge patients")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch(`/api/receptionist/admissions/${selectedAdmission.id}/discharge`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-800 text-white shadow-lg">
        <div className="relative px-6 py-10 sm:px-10">
          <div className="absolute inset-y-0 right-0 hidden w-48 translate-x-16 rotate-12 rounded-full bg-white/10 blur-3xl sm:block" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200/80">Admissions Desk</p>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                Keep inpatient operations flowing smoothly.
              </h2>
              <p className="text-sm text-indigo-100/90 sm:text-base">
                Track new admission requests, monitor bed utilization, and coordinate discharges from a single
                streamlined workspace.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-indigo-100/90">
                <span className="rounded-full border border-indigo-300/40 px-3 py-1 font-semibold uppercase tracking-wide">
                  Real-time room status
                </span>
                <span className="rounded-full border border-indigo-300/40 px-3 py-1 font-semibold uppercase tracking-wide">
                  Admission pipeline
                </span>
              </div>
            </div>
            <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/15 p-4 shadow-md backdrop-blur"
                >
                  <div className="absolute right-3 top-3 text-lg">{card.icon}</div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-100/90">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                  <p className="mt-2 text-[12px] text-indigo-100/80">{card.caption}</p>
                  <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${card.tone} opacity-20`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Pending Admission Requests</h3>
              <p className="text-sm text-slate-500">
                Review doctor-submitted requests and allocate rooms with a single action.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs font-semibold text-purple-700">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span>Auto-Refresh</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {admitRequestsError && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {admitRequestsError}
              </div>
            )}

            {admitRequestsLoading && admitRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-sm text-slate-500">
                <svg className="mb-3 h-7 w-7 animate-spin text-purple-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading admission requests…
              </div>
            ) : admitRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
                <span className="mb-2 text-4xl">🏥</span>
                <p className="text-sm font-medium">No new admission requests right now.</p>
                <p className="text-xs text-slate-400">You'll be notified as new requests arrive from doctors.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {admitRequests.map((request) => {
                  const createdAt = request.createdAt ? new Date(request.createdAt) : null
                  return (
                    <article
                      key={request.id}
                      className="group rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Patient
                            </span>
                            <p className="text-lg font-semibold text-slate-900">
                              {request.patientName || "Unknown"}
                              {request.patientId && (
                                <span className="ml-2 inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-mono text-purple-700">
                                  {request.patientId}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Doctor</p>
                              <p className="font-semibold text-slate-800">{request.doctorName || "Unknown Doctor"}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Created</p>
                              <p>{createdAt ? createdAt.toLocaleString() : "—"}</p>
                            </div>
                            {request.notes && (
                              <div className="sm:col-span-2">
                                <p className="text-xs uppercase tracking-wide text-slate-400">Doctor notes</p>
                                <p className="text-slate-700">{request.notes}</p>
                              </div>
                            )}
                          </div>

                          {request.appointmentDetails && (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                              <div className="grid gap-3 sm:grid-cols-3">
                                <div>
                                  <p className="font-semibold uppercase tracking-wide text-slate-500">Appointment</p>
                                  <p>
                                    {request.appointmentDetails.appointmentDate || "—"}{" "}
                                    {request.appointmentDetails.appointmentTime || ""}
                                  </p>
                                </div>
                                <div>
                                  <p className="font-semibold uppercase tracking-wide text-slate-500">Contact</p>
                                  <p>{request.appointmentDetails.patientPhone || "—"}</p>
                                </div>
                                <div>
                                  <p className="font-semibold uppercase tracking-wide text-slate-500">Specialization</p>
                                  <p>{request.appointmentDetails.doctorSpecialization || "—"}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:max-w-[180px]">
                          <button
                            onClick={() => handleOpenAssignModal(request)}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            Assign Room
                          </button>
                          <button
                            onClick={() => handleCancelAdmitRequest(request)}
                            disabled={cancelLoadingId === request.id}
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancelLoadingId === request.id ? "Cancelling…" : "Cancel Request"}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Capacity Snapshot</h4>
            <p className="mt-1 text-2xl font-bold text-slate-900">{occupiedRoomsCount} occupied beds</p>
            <p className="text-xs text-slate-500">{availableRoomsCount} rooms available across all types</p>
            <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-500"
                style={{ width: `${roomOccupancyRate}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">Occupancy {roomOccupancyRate}% of total capacity</p>
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Room availability by type</h5>
            <div className="space-y-2">
              {roomAvailabilityByType.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{type.name}</p>
                    <p className="text-xs text-slate-500">
                      {type.available} available · {type.occupied} occupied
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {type.available + type.occupied > 0
                      ? `${type.available}/${type.total || type.available + type.occupied}`
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
            <p className="font-semibold">Tip</p>
            <p className="mt-1">
              Seed rooms from the admin console if you haven’t synchronized floor data yet. The panel will automatically
              populate with fallback room numbers otherwise.
            </p>
          </div>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Currently Admitted Patients</h3>
            <p className="text-sm text-slate-500">Monitor active inpatients and wrap up their discharge paperwork.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-200 rounded-lg text-xs font-semibold text-sky-700">
            <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
            <span>Auto-Refresh</span>
          </div>
        </div>

        <div className="px-6 py-5">
          {admissionsError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {admissionsError}
            </div>
          )}

          {admissionsLoading && admissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-sm text-slate-500">
              Loading admitted patients…
            </div>
          ) : admissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-slate-500">
              <span className="mb-2 text-4xl">🛏️</span>
              <p className="text-sm font-medium">No patients are currently admitted.</p>
              <p className="text-xs text-slate-400">All inpatients have been discharged for now.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {admissions.map((admission) => {
                const stayDays = admission.checkInAt
                  ? Math.max(
                      1,
                      Math.ceil((Date.now() - new Date(admission.checkInAt).getTime()) / (1000 * 60 * 60 * 24))
                    )
                  : 1
                return (
                  <article
                    key={admission.id}
                    className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Inpatient
                          </span>
                          <p className="text-lg font-semibold text-slate-900">
                            {admission.patientName || "Unknown"}
                            {admission.patientId && (
                              <span className="ml-2 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-mono text-indigo-700">
                                {admission.patientId}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Doctor</p>
                            <p className="font-semibold text-slate-800">{admission.doctorName || "Unknown"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Room</p>
                            <p className="font-semibold text-slate-800">
                              {admission.roomNumber} — {roomTypeLabelMap[admission.roomType] || admission.roomType}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Rate / Day</p>
                            <p className="font-semibold text-slate-800">₹{admission.roomRatePerDay}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Check-in</p>
                            <p>{admission.checkInAt ? new Date(admission.checkInAt).toLocaleString() : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Stay duration</p>
                            <p>{stayDays} day(s)</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:max-w-[180px]">
                        <button
                          onClick={() => handleOpenDischargeModal(admission)}
                          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                        >
                          Discharge
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

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
