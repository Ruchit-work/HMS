"use client"

import { Button } from '@/shared/components'
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl">
        {/* ── Modal header ── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Assign Room</h3>
            <p className="mt-0.5 text-xs text-slate-500">Confirm room allocation for the selected admission request</p>
          </div>
          <button onClick={onClose} type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* ── Patient summary ── */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{selectedAdmitRequest.patientName || "Unknown patient"}</p>
              <p className="text-xs text-slate-500 mt-0.5">Doctor: {selectedAdmitRequest.doctorName || "—"}</p>
              {selectedAdmitRequest.notes && <p className="mt-1 text-xs text-slate-600">{selectedAdmitRequest.notes}</p>}
            </div>
            {selectedAdmitRequest.patientId && (
              <span className="shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-mono text-cyan-800">
                {selectedAdmitRequest.patientId}
              </span>
            )}
          </div>

          {roomsLoading && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Loading available rooms…
            </div>
          )}

          <div className="rx-form-field">
            <label className="rx-form-label">Room Type</label>
            <select value={assignRoomType}
              onChange={(e) => { setAssignRoomType(e.target.value); setAssignRoomId("") }}
              className="rx-form-select">
              <option value="">Show all available types</option>
              {availableRoomTypes.map((type) => (
                <option key={type.key} value={type.key}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="rx-form-field">
            <label className="rx-form-label">Room Number</label>
            {availableRoomsForType.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No available rooms{assignRoomType ? ` for ${availableRoomTypes.find((t) => t.key === assignRoomType)?.label || assignRoomType}` : ""} — adjust selection or free up rooms.
              </div>
            ) : (
              <select value={assignRoomId} onChange={(e) => setAssignRoomId(e.target.value)} className="rx-form-select">
                <option value="">Select room</option>
                {availableRoomsForType.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber} — {getRoomTypeDisplayName(room)} (₹{room.ratePerDay}/day)
                  </option>
                ))}
              </select>
            )}
            {assignRoomId && (
              <p className="rx-form-helper">Rate per day: ₹{rooms.find((r) => r.id === assignRoomId)?.ratePerDay || 0}</p>
            )}
          </div>

          {/* ── Initial Deposit ── */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Initial Deposit</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rx-form-field">
                <label className="rx-form-label">Amount (₹)</label>
                <input type="number" min="0" value={assignInitialDeposit}
                  onChange={(e) => setAssignInitialDeposit(e.target.value)}
                  className="rx-form-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="e.g. 5000" />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Payment Mode</label>
                <select value={assignInitialDepositMode} onChange={(e) => setAssignInitialDepositMode(e.target.value)} className="rx-form-select">
                  {depositPaymentModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rx-form-field">
            <label className="rx-form-label">
              Reception Notes <span className="text-[11px] font-normal text-slate-400">(optional)</span>
            </label>
            <textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)}
              rows={3} className="rx-form-textarea"
              placeholder="Notes for the nursing team or ward staff…" />
          </div>
        </div>

        {/* ── Modal footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={assignLoading}>Cancel</Button>
          <Button type="button" variant="primary" onClick={onConfirm}
            loading={assignLoading} loadingText="Assigning…" disabled={!assignRoomId}>
            Confirm Admission
          </Button>
        </div>
      </div>
    </div>
  )
}
