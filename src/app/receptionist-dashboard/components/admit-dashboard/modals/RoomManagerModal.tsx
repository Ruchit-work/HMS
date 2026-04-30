"use client"

import { ROOM_TYPES } from "@/constants/roomTypes"
import type { Room } from "@/types/patient"

interface RoomManagerModalProps {
  isOpen: boolean
  roomEditId: string | null
  onClose: () => void
  manageRoomNumber: string
  setManageRoomNumber: (value: string) => void
  manageRoomType: Room["roomType"] | ""
  setManageRoomType: (value: Room["roomType"] | "") => void
  manageCustomRoomTypeName: string
  setManageCustomRoomTypeName: (value: string) => void
  manageRoomRate: string
  setManageRoomRate: (value: string) => void
  manageRoomStatus: Room["status"]
  setManageRoomStatus: (value: Room["status"]) => void
  roomManageLoading: boolean
  onSubmit: () => void
}

export default function RoomManagerModal({
  isOpen,
  roomEditId,
  onClose,
  manageRoomNumber,
  setManageRoomNumber,
  manageRoomType,
  setManageRoomType,
  manageCustomRoomTypeName,
  setManageCustomRoomTypeName,
  manageRoomRate,
  setManageRoomRate,
  manageRoomStatus,
  setManageRoomStatus,
  roomManageLoading,
  onSubmit,
}: RoomManagerModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{roomEditId ? "Edit Room" : "Add New Room"}</h3>
            <p className="text-sm text-slate-500">Manage room availability and rates for admissions</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {!roomEditId && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Room number</label>
              <input
                value={manageRoomNumber}
                onChange={(e) => setManageRoomNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 305"
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Room type</label>
              <select
                value={manageRoomType}
                onChange={(e) => {
                  const nextType = e.target.value as Room["roomType"] | ""
                  setManageRoomType(nextType)
                  if (nextType !== "custom") {
                    setManageCustomRoomTypeName("")
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select type</option>
                {ROOM_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Daily rate</label>
              <input
                type="number"
                min="0"
                value={manageRoomRate}
                onChange={(e) => setManageRoomRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. 3000"
              />
            </div>
          </div>
          {manageRoomType === "custom" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Custom room type name</label>
              <input
                value={manageCustomRoomTypeName}
                onChange={(e) => setManageCustomRoomTypeName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. ICU, NICU, Isolation"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              value={manageRoomStatus}
              onChange={(e) => setManageRoomStatus(e.target.value as Room["status"])}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
              {roomEditId && <option value="occupied">Occupied</option>}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={roomManageLoading}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            disabled={roomManageLoading}
          >
            {roomManageLoading ? "Saving..." : roomEditId ? "Update Room" : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  )
}
