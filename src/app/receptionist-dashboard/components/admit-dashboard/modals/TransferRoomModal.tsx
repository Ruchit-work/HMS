"use client"

import type { Admission, Room } from "@/types/patient"

interface TransferRoomModalProps {
  isOpen: boolean
  transferAdmission: Admission | null
  transferRoomId: string
  setTransferRoomId: (value: string) => void
  transferNotes: string
  setTransferNotes: (value: string) => void
  rooms: Room[]
  getRoomTypeDisplayName: (room: Pick<Room, "roomType" | "customRoomTypeName">) => string
  transferLoading: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function TransferRoomModal({
  isOpen,
  transferAdmission,
  transferRoomId,
  setTransferRoomId,
  transferNotes,
  setTransferNotes,
  rooms,
  getRoomTypeDisplayName,
  transferLoading,
  onClose,
  onConfirm,
}: TransferRoomModalProps) {
  if (!isOpen || !transferAdmission) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Transfer / Change Room</h3>
            <p className="text-sm text-slate-500">
              {transferAdmission.patientName || "Patient"} currently in room {transferAdmission.roomNumber}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500">
            ×
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Target room</label>
            <select
              value={transferRoomId}
              onChange={(e) => setTransferRoomId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select available room</option>
              {rooms
                .filter((room) => room.status === "available" && room.id !== transferAdmission.roomId)
                .map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber} - {getRoomTypeDisplayName(room)} (Rs {room.ratePerDay}/day)
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Transfer reason (optional)</label>
            <textarea
              rows={3}
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="ICU step-down, room upgrade request, etc."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={transferLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            disabled={transferLoading || !transferRoomId}
          >
            {transferLoading ? "Transferring..." : "Confirm Transfer"}
          </button>
        </div>
      </div>
    </div>
  )
}
