 "use client"

import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/firebase/config"
import { authedFetchJson } from "@/shared/utils/authedFetch"
import { Button, ConfirmDialog } from "@/shared/components"
import { ROOM_TYPES } from "@/constants/roomTypes"
import type { Room } from "@/types/patient"

export default function RoomManagement() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    roomNumber: "",
    ward: "",
    floor: "",
    roomType: "",
    customRoomTypeName: "",
    bedCount: 1,
    occupiedBeds: 0,
    ratePerDay: 0,
    status: "available",
  })
  const [saving, setSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Room | null>(null)

  const fetchRooms = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, "rooms"), where("hospitalId", "==", window.sessionStorage.getItem("activeHospitalId") || ""))
      const snap = await getDocs(q)
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) } as Room))
      setRooms(list.filter((r) => !(r as any).isArchived))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRooms()
  }, [])

  const openCreate = () => {
    setEditId(null)
    setForm({
      roomNumber: "",
      ward: "",
      floor: "",
      roomType: "",
      customRoomTypeName: "",
      bedCount: 1,
      occupiedBeds: 0,
      ratePerDay: 0,
      status: "available",
    })
    setModalOpen(true)
  }

  const openEdit = (room: Room) => {
    setEditId(room.id)
    setForm({
      roomNumber: room.roomNumber || "",
      ward: (room as any).ward || "",
      floor: (room as any).floor || "",
      roomType: room.roomType || "",
      customRoomTypeName: room.customRoomTypeName || "",
      bedCount: Number((room as any).bedCount || 1),
      occupiedBeds: Number((room as any).occupiedBeds || 0),
      ratePerDay: Number(room.ratePerDay || 0),
      status: room.status || "available",
    })
    setModalOpen(true)
  }

  const submit = async () => {
    try {
      setSaving(true)
      const payload: any = {
        roomType: form.roomType,
        customRoomTypeName: form.roomType === "custom" ? form.customRoomTypeName.trim() : null,
        ratePerDay: Number(form.ratePerDay || 0),
        status: form.status,
        ward: form.ward || null,
        floor: form.floor || null,
        bedCount: Number(form.bedCount || 1),
        occupiedBeds: Number(form.occupiedBeds || 0),
      }
      let url = "/api/receptionist/rooms"
      let method = "POST"
      if (editId) {
        url = `/api/receptionist/rooms/${editId}`
        method = "PATCH"
      } else {
        payload.roomNumber = form.roomNumber.trim()
      }
      await authedFetchJson(url, { method, body: JSON.stringify(payload) }, "Failed to save room")
      setModalOpen(false)
      await fetchRooms()
    } catch (e: any) {
      alert(e?.message || "Failed to save room")
    } finally {
      setSaving(false)
    }
  }

  const confirmArchive = async () => {
    if (!archiveTarget) return
    try {
      await authedFetchJson(`/api/receptionist/rooms/${archiveTarget.id}`, { method: "DELETE" }, "Failed to archive room")
      setArchiveTarget(null)
      await fetchRooms()
    } catch (e: any) {
      alert(e?.message || "Failed to archive")
    }
  }

  return (
    <div className="hms-content-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Room Management</h3>
        <Button type="button" variant="primary" onClick={openCreate}>Create Room</Button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading rooms…</div>
      ) : rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
          No rooms configured for this hospital.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Room</th>
                <th className="px-3 py-2 text-left">Ward / Floor</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Beds</th>
                <th className="px-3 py-2 text-left">Occupied</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-800">{r.roomNumber}</td>
                  <td className="px-3 py-3 text-slate-700">{(r as any).ward || "—"} / {(r as any).floor || "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{r.roomType}{r.roomType === "custom" ? ` · ${r.customRoomTypeName || ""}` : ""}</td>
                  <td className="px-3 py-3 text-slate-700">{(r as any).bedCount || 1}</td>
                  <td className="px-3 py-3 text-slate-700">{(r as any).occupiedBeds || 0}</td>
                  <td className="px-3 py-3 text-xs text-slate-600 capitalize">{r.status}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(r)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">Edit</button>
                      <button onClick={() => setArchiveTarget(r)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-600">Archive</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6">
            <h4 className="text-base font-semibold mb-4">{editId ? "Edit Room" : "Create Room"}</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {!editId && (
                <div>
                  <label className="text-sm">Room number</label>
                  <input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} className="w-full rounded-lg border px-3 py-2" />
                </div>
              )}
              <div>
                <label className="text-sm">Ward</label>
                <input value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm">Floor</label>
                <input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm">Room type</label>
                <select value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })} className="w-full rounded-lg border px-3 py-2">
                  <option value="">Select</option>
                  {ROOM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {form.roomType === "custom" && (
                <div>
                  <label className="text-sm">Custom type name</label>
                  <input value={form.customRoomTypeName} onChange={(e) => setForm({ ...form, customRoomTypeName: e.target.value })} className="w-full rounded-lg border px-3 py-2" />
                </div>
              )}
              <div>
                <label className="text-sm">Bed count</label>
                <input type="number" min={1} value={String(form.bedCount)} onChange={(e) => setForm({ ...form, bedCount: Number(e.target.value || 1) })} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm">Occupied beds</label>
                <input type="number" min={0} value={String(form.occupiedBeds)} onChange={(e) => setForm({ ...form, occupiedBeds: Number(e.target.value || 0) })} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm">Rate per day</label>
                <input type="number" min={0} value={String(form.ratePerDay)} onChange={(e) => setForm({ ...form, ratePerDay: Number(e.target.value || 0) })} className="w-full rounded-lg border px-3 py-2" />
              </div>
              <div>
                <label className="text-sm">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border px-3 py-2">
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                  <option value="occupied">Occupied</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="button" variant="primary" onClick={submit} loading={saving} loadingText="Saving..." disabled={saving}>
                {editId ? "Update Room" : "Create Room"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!archiveTarget}
        title="Archive room"
        message={archiveTarget ? `Archive room ${archiveTarget.roomNumber}?` : ""}
        confirmText="Archive"
        cancelText="Cancel"
        confirmLoading={false}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={confirmArchive}
      />
    </div>
  )
}

