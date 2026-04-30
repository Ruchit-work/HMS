"use client"

import type { Dispatch, SetStateAction } from "react"
import type { Admission, Room } from "@/types/patient"

type AdmissionPackageOption = {
  id: string
  packageName: string
  fixedRate: number
}

interface AdmissionDetailsModalProps {
  selectedAdmission: Admission | null
  dischargeModalOpen: boolean
  onClose: () => void
  getRoomTypeDisplayName: (room: Pick<Room, "roomType" | "customRoomTypeName">) => string
  updateAdmissionDraft: (admissionId: string, updater: (current: Admission) => Admission) => void
  admissionPackages: AdmissionPackageOption[]
  depositTopupAmount: string
  setDepositTopupAmount: (value: string) => void
  depositTopupNote: string
  setDepositTopupNote: (value: string) => void
  depositTopupPaymentMode: string
  setDepositTopupPaymentMode: (value: string) => void
  depositPaymentModes: Array<{ value: string; label: string }>
  handleAddDepositTopup: (admission: Admission) => void
  depositTopupLoading: boolean
  handleSaveAdmissionDetails: (admission: Admission) => void
  handleProcessBilling: (admission: Admission) => void
}

export default function AdmissionDetailsModal({
  selectedAdmission,
  dischargeModalOpen,
  onClose,
  getRoomTypeDisplayName,
  updateAdmissionDraft,
  admissionPackages,
  depositTopupAmount,
  setDepositTopupAmount,
  depositTopupNote,
  setDepositTopupNote,
  depositTopupPaymentMode,
  setDepositTopupPaymentMode,
  depositPaymentModes,
  handleAddDepositTopup,
  depositTopupLoading,
  handleSaveAdmissionDetails,
  handleProcessBilling,
}: AdmissionDetailsModalProps) {
  if (!selectedAdmission || dischargeModalOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Admitted Patient Details</h3>
            <p className="text-sm text-slate-500">{selectedAdmission.patientName || "Unknown patient"}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100">
            ×
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-slate-500">Address:</span> {selectedAdmission.patientAddress || "—"}</div>
            <div>
              <span className="text-slate-500">Room:</span> {selectedAdmission.roomNumber} (
              {getRoomTypeDisplayName({
                roomType: selectedAdmission.roomType,
                customRoomTypeName: selectedAdmission.customRoomTypeName || null,
              })}
              )
            </div>
            <div><span className="text-slate-500">Admit date:</span> {new Date(selectedAdmission.checkInAt).toLocaleString()}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Expected discharge date</label>
              <input
                type="datetime-local"
                value={selectedAdmission.expectedDischargeAt ? new Date(selectedAdmission.expectedDischargeAt).toISOString().slice(0, 16) : ""}
                onChange={(e) =>
                  updateAdmissionDraft(selectedAdmission.id, (current) => ({
                    ...current,
                    expectedDischargeAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Doctor round charges (default/editable)</label>
              <input
                type="number"
                min="0"
                value={selectedAdmission.charges?.doctorRoundFee || 0}
                onChange={(e) =>
                  updateAdmissionDraft(selectedAdmission.id, (current) => ({
                    ...current,
                    charges: { ...(current.charges || {}), doctorRoundFee: Number(e.target.value || 0) },
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Nurse round charges</label>
              <input
                type="number"
                min="0"
                value={selectedAdmission.charges?.nurseRoundFee || 0}
                onChange={(e) =>
                  updateAdmissionDraft(selectedAdmission.id, (current) => ({
                    ...current,
                    charges: { ...(current.charges || {}), nurseRoundFee: Number(e.target.value || 0) },
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Payment terms</label>
              <select
                value={selectedAdmission.paymentTerms || "standard"}
                onChange={(e) =>
                  updateAdmissionDraft(selectedAdmission.id, (current) => ({
                    ...current,
                    paymentTerms: e.target.value === "pay_later_after_discharge" ? "pay_later_after_discharge" : "standard",
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="standard">Standard payment</option>
                <option value="pay_later_after_discharge">Allow pay later after discharge</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Deposit Summary</label>
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:grid-cols-3">
                <p><span className="font-semibold">Deposited:</span> ₹{Number(selectedAdmission.depositSummary?.totalDeposited || 0).toLocaleString()}</p>
                <p><span className="font-semibold">Adjusted:</span> ₹{Number(selectedAdmission.depositSummary?.totalAdjusted || 0).toLocaleString()}</p>
                <p><span className="font-semibold">Balance:</span> ₹{Number(selectedAdmission.depositSummary?.balance || 0).toLocaleString()}</p>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  min="0"
                  value={depositTopupAmount}
                  onChange={(e) => setDepositTopupAmount(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Top-up amount (₹)"
                />
                <input
                  value={depositTopupNote}
                  onChange={(e) => setDepositTopupNote(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
                  placeholder="Top-up note (optional)"
                />
              </div>
              <div className="mt-2">
                <select
                  value={depositTopupPaymentMode}
                  onChange={(e) => setDepositTopupPaymentMode(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {depositPaymentModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      Top-up Payment Mode: {mode.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2">
                <button
                  onClick={() => handleAddDepositTopup(selectedAdmission)}
                  disabled={depositTopupLoading}
                  className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-60"
                >
                  {depositTopupLoading ? "Adding..." : "Add Top-up Deposit"}
                </button>
              </div>
              {Array.isArray(selectedAdmission.depositTransactions) && selectedAdmission.depositTransactions.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-100/40 p-2 text-xs text-amber-900">
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Operation package</label>
              <select
                value={selectedAdmission.operationPackage?.packageId || ""}
                onChange={(e) => {
                  const selected = admissionPackages.find((pkg) => pkg.id === e.target.value)
                  updateAdmissionDraft(selectedAdmission.id, (current) => ({
                    ...current,
                    operationPackage: selected
                      ? {
                          packageId: selected.id,
                          packageName: selected.packageName,
                          fixedRate: selected.fixedRate,
                          paymentTiming: "after_operation",
                          advancePaidAmount: 0,
                          notes: null,
                        }
                      : null,
                  }))
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">No package selected</option>
                {admissionPackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.packageName} (Rs {pkg.fixedRate})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Package payment timing</label>
              <select
                value={selectedAdmission.operationPackage?.paymentTiming || "after_operation"}
                onChange={(e) =>
                  updateAdmissionDraft(selectedAdmission.id, (current) => ({
                    ...current,
                    operationPackage: current.operationPackage
                      ? {
                          ...current.operationPackage,
                          paymentTiming: e.target.value === "advance" ? "advance" : "after_operation",
                        }
                      : null,
                  }))
                }
                disabled={!selectedAdmission.operationPackage}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="after_operation">After operation</option>
                <option value="advance">Advance payment</option>
              </select>
            </div>
          </div>
          {selectedAdmission.operationPackage && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Advance paid amount</label>
                <input
                  type="number"
                  min="0"
                  value={Number(selectedAdmission.operationPackage.advancePaidAmount || 0)}
                  onChange={(e) =>
                    updateAdmissionDraft(selectedAdmission.id, (current) => ({
                      ...current,
                      operationPackage: current.operationPackage
                        ? {
                            ...current.operationPackage,
                            advancePaidAmount: Number(e.target.value || 0),
                          }
                        : null,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p>
                  Package due: Rs{" "}
                  {Math.max(
                    0,
                    Number(selectedAdmission.operationPackage.fixedRate || 0) -
                      (selectedAdmission.operationPackage.paymentTiming === "advance"
                        ? Number(selectedAdmission.operationPackage.advancePaidAmount || 0)
                        : 0)
                  )}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(
              [
                ["Medicine", "medicineCharges"],
                ["Injection", "injectionCharges"],
                ["Bottles", "bottleCharges"],
                ["Facility", "facilityCharges"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium text-slate-700">{label} charges</label>
                <input
                  type="number"
                  min="0"
                  value={Number(selectedAdmission.charges?.[key] || 0)}
                  onChange={(e) =>
                    updateAdmissionDraft(selectedAdmission.id, (current) => ({
                      ...current,
                      charges: { ...(current.charges || {}), [key]: Number(e.target.value || 0) },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => handleSaveAdmissionDetails(selectedAdmission)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Save Details
            </button>
            <button
              onClick={() => handleProcessBilling(selectedAdmission)}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Process Billing
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
