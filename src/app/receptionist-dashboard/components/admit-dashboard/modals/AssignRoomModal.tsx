"use client"

import type { Room } from "@/types/patient"

type RoomTypeOption = {
  key: string
  label: string
}

type RoomOption = {
  id: string
  roomNumber: string
  ratePerDay: number
  roomType: Room["roomType"]
  customRoomTypeName?: string | null
}

type AdmitRequestLike = {
  patientName?: string | null
  doctorName?: string | null
  patientId?: string
  notes?: string | null
}

type PaymentModeOption = {
  value: string
  label: string
}

interface AssignRoomModalProps {
  isOpen: boolean
  selectedAdmitRequest: AdmitRequestLike | null
  onClose: () => void
  roomsLoading: boolean
  assignRoomType: string
  setAssignRoomType: (value: string) => void
  assignRoomId: string
  setAssignRoomId: (value: string) => void
  availableRoomTypes: RoomTypeOption[]
  availableRoomsForType: RoomOption[]
  getRoomTypeDisplayName: (room: Pick<Room, "roomType" | "customRoomTypeName">) => string
  rooms: RoomOption[]
  assignInitialDeposit: string
  setAssignInitialDeposit: (value: string) => void
  assignInitialDepositMode: string
  setAssignInitialDepositMode: (value: string) => void
  depositPaymentModes: PaymentModeOption[]
  assignNotes: string
  setAssignNotes: (value: string) => void
  assignLoading: boolean
  onConfirm: () => void
}

export default function AssignRoomModal({
  isOpen,
  selectedAdmitRequest,
  onClose,
  roomsLoading,
  assignRoomType,
  setAssignRoomType,
  assignRoomId,
  setAssignRoomId,
  availableRoomTypes,
  availableRoomsForType,
  getRoomTypeDisplayName,
  rooms,
  assignInitialDeposit,
  setAssignInitialDeposit,
  assignInitialDepositMode,
  setAssignInitialDepositMode,
  depositPaymentModes,
  assignNotes,
  setAssignNotes,
  assignLoading,
  onConfirm,
}: AssignRoomModalProps) {
  if (!isOpen || !selectedAdmitRequest) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-semibold">Assign Room</h3>
            <p className="text-sm text-blue-100">Confirm room allocation for the selected admission request</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-white/20 flex items-center justify-center">
            <span className="text-xl">×</span>
          </button>
        </div>
        <div className="px-6 py-5 space-y-5 bg-gray-50 rounded-b-2xl">
          <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{selectedAdmitRequest.patientName || "Unknown patient"}</p>
                <p className="text-xs text-gray-500 mt-0.5">Doctor: {selectedAdmitRequest.doctorName || "—"}</p>
              </div>
              {selectedAdmitRequest.patientId && (
                <span className="text-xs font-mono px-2 py-1 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                  ID: {selectedAdmitRequest.patientId}
                </span>
              )}
            </div>
            {selectedAdmitRequest.notes && <p className="mt-3 text-sm text-gray-600">{selectedAdmitRequest.notes}</p>}
          </div>

          {roomsLoading && (
            <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600">Loading available rooms...</div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Room Type</label>
            <select
              value={assignRoomType}
              onChange={(e) => {
                setAssignRoomType(e.target.value)
                setAssignRoomId("")
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Show all available types</option>
              {availableRoomTypes.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Room</label>
            {availableRoomsForType.length === 0 ? (
              <div className="p-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500">
                No available rooms
                {assignRoomType ? ` for ${availableRoomTypes.find((type) => type.key === assignRoomType)?.label || assignRoomType}` : ""}. Please
                adjust the selection or free up rooms.
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
                    {room.roomNumber} — {getRoomTypeDisplayName(room)} (₹{room.ratePerDay}/day)
                  </option>
                ))}
              </select>
            )}
            {assignRoomId && <p className="text-xs text-gray-500">Rate per day: ₹{rooms.find((room) => room.id === assignRoomId)?.ratePerDay || 0}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Initial Deposit</label>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Amount (₹)</p>
                  <input
                    type="number"
                    min="0"
                    value={assignInitialDeposit}
                    onChange={(e) => setAssignInitialDeposit(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm [appearance:textfield] focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="e.g. 5000"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Payment Mode</p>
                  <select
                    value={assignInitialDepositMode}
                    onChange={(e) => setAssignInitialDepositMode(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {depositPaymentModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
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
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={assignLoading}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={assignLoading || !assignRoomId}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {assignLoading ? "Assigning..." : "Confirm Admission"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
