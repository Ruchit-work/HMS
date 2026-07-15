"use client"

import { Button } from '@/shared/components'
import type { Admission, Room } from "@/types/patient"
import type { Dispatch, SetStateAction } from "react"

type DischargeOtherChargeOption = {
  id: string
  label: string
  amount: number
}

type ChargePreview = {
  roomTotal: number
  roomCount: number
  calendarStayDays: number
  doctorRoundFee: number
  prescriptionTotal: number
  prescriptionItems: Array<{ label: string; amount: number }>
  customPrescriptionCharges: number
  customPrescriptionNames: string
  selectedOtherChargeItems: Array<{ label: string; amount: number }>
  extraDischargeCharges: number
  estimatedTotal: number
  totalDeposited: number
  adjustedFromDeposit: number
  finalPayable: number
  refundDue: number
}

interface DischargeModalProps {
  isOpen: boolean
  selectedAdmission: Admission | null
  onClose: () => void
  getRoomTypeDisplayName: (room: Pick<Room, "roomType" | "customRoomTypeName">) => string
  depositTopupAmount: string
  setDepositTopupAmount: (value: string) => void
  depositTopupNote: string
  setDepositTopupNote: (value: string) => void
  depositTopupPaymentMode: string
  setDepositTopupPaymentMode: (value: string) => void
  depositPaymentModes: Array<{ value: string; label: string }>
  handleAddDepositTopup: (admission: Admission) => void
  depositTopupLoading: boolean
  dischargeDoctorFee: string
  setDischargeDoctorFee: (value: string) => void
  dischargePrescriptionCharges: string
  setDischargePrescriptionCharges: (value: string) => void
  dischargePrescriptionNames: string
  setDischargePrescriptionNames: (value: string) => void
  dischargeOtherChargeSelections: string[]
  setDischargeOtherChargeSelections: Dispatch<SetStateAction<string[]>>
  dischargeOtherChargeAmounts: Record<string, number>
  setDischargeOtherChargeAmounts: Dispatch<SetStateAction<Record<string, number>>>
  dischargeOtherChargeOptions: DischargeOtherChargeOption[]
  dischargeChargePreview: ChargePreview
  dischargeNotes: string
  setDischargeNotes: (value: string) => void
  dischargeLoading: boolean
  onConfirm: () => void
}

export default function DischargeModal({
  isOpen,
  selectedAdmission,
  onClose,
  getRoomTypeDisplayName,
  depositTopupAmount,
  setDepositTopupAmount,
  depositTopupNote,
  setDepositTopupNote,
  depositTopupPaymentMode,
  setDepositTopupPaymentMode,
  depositPaymentModes,
  handleAddDepositTopup,
  depositTopupLoading,
  dischargeDoctorFee,
  setDischargeDoctorFee,
  dischargePrescriptionCharges,
  setDischargePrescriptionCharges,
  dischargePrescriptionNames,
  setDischargePrescriptionNames,
  dischargeOtherChargeSelections,
  setDischargeOtherChargeSelections,
  dischargeOtherChargeAmounts,
  setDischargeOtherChargeAmounts,
  dischargeOtherChargeOptions,
  dischargeChargePreview,
  dischargeNotes,
  setDischargeNotes,
  dischargeLoading,
  onConfirm,
}: DischargeModalProps) {
  if (!isOpen || !selectedAdmission) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* ── Modal header ── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Discharge Patient</h3>
            <p className="mt-0.5 text-xs text-slate-500">Finalize discharge summary and billing adjustments</p>
          </div>
          <button onClick={onClose} type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedAdmission.patientName || "Unknown patient"}</p>
                <p className="text-xs text-slate-500 mt-0.5">Doctor: {selectedAdmission.doctorName || "—"}</p>
              </div>
              {selectedAdmission.patientId && (
                <span className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2 py-1 text-xs font-mono text-[var(--color-primary-dark)]">
                  ID: {selectedAdmission.patientId}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700 mt-3">
              <div>
                <span className="text-xs uppercase text-slate-500 block">Room</span>
                <span>
                  {selectedAdmission.roomNumber} —{" "}
                  {getRoomTypeDisplayName({
                    roomType: selectedAdmission.roomType,
                    customRoomTypeName: selectedAdmission.customRoomTypeName || null,
                  })}
                </span>
              </div>
              <div>
                <span className="text-xs uppercase text-slate-500 block">Rate / Day</span>
                <span>₹{selectedAdmission.roomRatePerDay}</span>
              </div>
              <div>
                <span className="text-xs uppercase text-slate-500 block">Check-in</span>
                <span>{selectedAdmission.checkInAt ? new Date(selectedAdmission.checkInAt).toLocaleString() : "—"}</span>
              </div>
              <div>
                <span className="text-xs uppercase text-slate-500 block">Stay Duration</span>
                <span>
                  {selectedAdmission.checkInAt
                    ? Math.max(1, Math.ceil((Date.now() - new Date(selectedAdmission.checkInAt).getTime()) / (1000 * 60 * 60 * 24)))
                    : 1}{" "}
                  day(s)
                </span>
              </div>
            </div>
            {selectedAdmission.dischargeRequest?.status === "pending" && (
              <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900">
                <p className="font-semibold">Doctor discharge request received.</p>
                {selectedAdmission.dischargeRequest?.notes ? <p className="mt-1">Note: {selectedAdmission.dischargeRequest.notes}</p> : null}
              </div>
            )}
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase text-amber-800">Deposit wallet</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-amber-900 sm:grid-cols-3">
                <p>Deposited: ₹{Number(selectedAdmission.depositSummary?.totalDeposited || 0).toLocaleString()}</p>
                <p>Adjusted: ₹{Number(selectedAdmission.depositSummary?.totalAdjusted || 0).toLocaleString()}</p>
                <p>Balance: ₹{Number(selectedAdmission.depositSummary?.balance || 0).toLocaleString()}</p>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  min="0"
                  value={depositTopupAmount}
                  onChange={(e) => setDepositTopupAmount(e.target.value)}
                  className="rounded border border-amber-300 px-2 py-1 text-xs"
                  placeholder="Top-up amount (₹)"
                />
                <input
                  value={depositTopupNote}
                  onChange={(e) => setDepositTopupNote(e.target.value)}
                  className="rounded border border-amber-300 px-2 py-1 text-xs sm:col-span-2"
                  placeholder="Top-up note (optional)"
                />
              </div>
              <div className="mt-2">
                <select
                  value={depositTopupPaymentMode}
                  onChange={(e) => setDepositTopupPaymentMode(e.target.value)}
                  className="rounded border border-amber-300 px-2 py-1 text-xs"
                >
                  {depositPaymentModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      Top-up Payment Mode: {mode.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddDepositTopup(selectedAdmission)}
                  loading={depositTopupLoading}
                  loadingText="Adding..."
                >
                  Add Top-up Deposit
                </Button>
              </div>
              {Array.isArray(selectedAdmission.depositTransactions) && selectedAdmission.depositTransactions.length > 0 && (
                <div className="mt-2 rounded border border-amber-300 bg-amber-100/40 p-2 text-xs text-amber-900">
                  <p className="font-semibold">Recent transactions</p>
                  <div className="mt-1 space-y-1">
                    {selectedAdmission.depositTransactions.slice(-3).reverse().map((entry) => (
                      <p key={entry.id}>
                        {entry.type.toUpperCase()} ₹{Number(entry.amount || 0).toLocaleString()} · {entry.paymentMode || "N/A"}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {Array.isArray(selectedAdmission.roomStays) && selectedAdmission.roomStays.length > 1 && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-600">Room Journey</p>
                <div className="mt-2 space-y-1 text-xs text-slate-700">
                  {selectedAdmission.roomStays.map((stay, index) => (
                    <p key={`${stay.roomId}-${stay.fromAt}-${index}`}>
                      {index + 1}. {stay.roomNumber} —{" "}
                      {getRoomTypeDisplayName({
                        roomType: stay.roomType,
                        customRoomTypeName: stay.customRoomTypeName || null,
                      })}{" "}
                      (Rs {stay.ratePerDay}/day)
                    </p>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(selectedAdmission.clinicalUpdates) && selectedAdmission.clinicalUpdates.length > 0 && (
              <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-xs font-semibold uppercase text-cyan-700">Doctor Clinical Updates</p>
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-cyan-900">
                  {selectedAdmission.clinicalUpdates
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <p key={`${entry.updatedAt}-${index}`}>
                        {new Date(entry.updatedAt).toLocaleString()} - {entry.roundNote || "Round update"}
                        {entry.prescriptionNote ? ` | Rx: ${entry.prescriptionNote}` : ""}
                        {entry.medicineName ? ` | Med: ${entry.medicineName}` : ""}
                        {entry.injectionName ? ` | Inj: ${entry.injectionName}` : ""}
                        {entry.additionalNote ? ` | Note: ${entry.additionalNote}` : ""}
                      </p>
                    ))}
                </div>
              </div>
            )}
          </div>

          {!selectedAdmission.operationPackage ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="rx-form-field">
                  <label className="rx-form-label">Doctor Fee (₹)</label>
                  <input type="number" min="0" value={dischargeDoctorFee}
                    onChange={(e) => setDischargeDoctorFee(e.target.value)}
                    className="rx-form-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="e.g. 500" />
                </div>
                <div className="rx-form-field">
                  <label className="rx-form-label">Prescription Charges (₹)</label>
                  <input type="number" min="0" value={dischargePrescriptionCharges}
                    onChange={(e) => setDischargePrescriptionCharges(e.target.value)}
                    className="rx-form-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    placeholder="e.g. 1200" />
                  <input type="text" value={dischargePrescriptionNames}
                    onChange={(e) => setDischargePrescriptionNames(e.target.value)}
                    className="rx-form-input mt-2"
                    placeholder="e.g. Cefixime, Dolo, IV NS" />
                </div>
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Other Charges</label>
                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="space-y-1">
                    {dischargeOtherChargeOptions.map((option) => {
                      const checked = dischargeOtherChargeSelections.includes(option.id)
                      return (
                        <div key={option.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-slate-50">
                          <span className="inline-flex items-center gap-2 text-sm text-slate-700 flex-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setDischargeOtherChargeSelections((prev) =>
                                  e.target.checked ? [...prev, option.id] : prev.filter((id) => id !== option.id)
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            {option.label}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={Number(dischargeOtherChargeAmounts[option.id] ?? option.amount)}
                            onChange={(e) =>
                              setDischargeOtherChargeAmounts((prev) => ({
                                ...prev,
                                [option.id]: Number(e.target.value || 0),
                              }))
                            }
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                          />
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-cyan-700">
                    Selected total: ₹{dischargeChargePreview.extraDischargeCharges.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
              Package is selected for this patient. Additional doctor/prescription/other fee inputs are disabled because package covers total cost.
            </div>
          )}

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Auto Billing Summary</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-emerald-800 font-medium">Room charges</p>
                <p className="text-emerald-700">
                  ₹{dischargeChargePreview.roomTotal.toLocaleString()} ({dischargeChargePreview.roomCount} room charge entr
                  {dischargeChargePreview.roomCount > 1 ? "ies" : "y"}, patient stay {dischargeChargePreview.calendarStayDays} calendar day
                  {dischargeChargePreview.calendarStayDays > 1 ? "s" : ""})
                </p>
              </div>
              <div>
                <p className="text-emerald-800 font-medium">Doctor round fee</p>
                <p className="text-emerald-700">₹{dischargeChargePreview.doctorRoundFee.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-emerald-800 font-medium">Prescription fee</p>
                <p className="text-emerald-700">₹{dischargeChargePreview.prescriptionTotal.toLocaleString()}</p>
              </div>
            </div>
            {dischargeChargePreview.prescriptionItems.length > 0 && (
              <div className="mt-2 text-xs text-emerald-900">
                Includes: {dischargeChargePreview.prescriptionItems.map((item) => `${item.label} ₹${item.amount.toLocaleString()}`).join(" · ")}
              </div>
            )}
            {dischargeChargePreview.customPrescriptionCharges > 0 && (
              <div className="mt-1 text-xs text-emerald-900">Custom prescription charges: ₹{dischargeChargePreview.customPrescriptionCharges.toLocaleString()}</div>
            )}
            {dischargeChargePreview.customPrescriptionNames && (
              <div className="mt-1 text-xs text-emerald-900">Prescription names: {dischargeChargePreview.customPrescriptionNames}</div>
            )}
            {dischargeChargePreview.selectedOtherChargeItems.length > 0 && (
              <div className="mt-1 text-xs text-emerald-900">
                Other charges:{" "}
                {dischargeChargePreview.selectedOtherChargeItems.map((item) => `${item.label} ₹${item.amount.toLocaleString()}`).join(" · ")}
              </div>
            )}
            <div className="mt-3 border-t border-emerald-200 pt-2 text-sm font-semibold text-emerald-900">
              Gross total: ₹{dischargeChargePreview.estimatedTotal.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-emerald-900">
              Deposit available: ₹{dischargeChargePreview.totalDeposited.toLocaleString()} | Adjusted: ₹
              {dischargeChargePreview.adjustedFromDeposit.toLocaleString()}
            </div>
            <div className="mt-1 text-sm font-semibold text-emerald-900">Final payable at discharge: ₹{dischargeChargePreview.finalPayable.toLocaleString()}</div>
            {dischargeChargePreview.refundDue > 0 && (
              <div className="mt-1 text-xs font-semibold text-emerald-900">Refund due to patient: ₹{dischargeChargePreview.refundDue.toLocaleString()}</div>
            )}
          </div>

          <div className="rx-form-field">
            <label className="rx-form-label">
              Discharge Notes <span className="text-[11px] font-normal text-slate-400">(optional)</span>
            </label>
            <textarea rows={3} value={dischargeNotes}
              onChange={(e) => setDischargeNotes(e.target.value)}
              className="rx-form-textarea"
              placeholder="Add discharge notes for medical records…" />
          </div>
        </div>

        {/* ── Modal footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={dischargeLoading}>Cancel</Button>
          <Button type="button" variant="primary" onClick={onConfirm}
            loading={dischargeLoading} loadingText="Processing…">
            Confirm Discharge
          </Button>
        </div>
      </div>
    </div>
  )
}
