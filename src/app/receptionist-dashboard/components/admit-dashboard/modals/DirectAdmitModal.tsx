"use client"

import type { Room } from "@/types/patient"

type ExistingPatientOption = {
  uid: string
  patientId: string
  fullName: string
  phone: string
  gender: string
  dateOfBirth: string
  address: string
}

type DoctorOption = {
  uid: string
  fullName: string
  specialization: string
}

type AdmissionPackageOption = {
  id: string
  packageName: string
  fixedRate: number
  preferredRoomType?: string | null
}

type RoomTypeOption = {
  key: string
  label: string
}

type RoomOption = {
  id: string
  roomNumber: string
  roomType: Room["roomType"]
  customRoomTypeName?: string | null
  status: string
}

type PaymentModeOption = {
  value: string
  label: string
}

interface DirectAdmitModalProps {
  isOpen: boolean
  onClose: () => void
  directPatientName: string
  setDirectPatientName: (value: string) => void
  setDirectPatientUid: (value: string) => void
  setDirectPatientId: (value: string) => void
  directPatientLookupLoading: boolean
  directPatientResults: ExistingPatientOption[]
  handleSelectExistingPatient: (patient: ExistingPatientOption) => void
  directPatientUid: string
  directPatientId: string
  directDoctorId: string
  setDirectDoctorId: (value: string) => void
  setDirectDoctorName: (value: string) => void
  doctorsLoading: boolean
  doctors: DoctorOption[]
  directDoctorName: string
  directPatientAddress: string
  setDirectPatientAddress: (value: string) => void
  directPackageId: string
  setDirectPackageId: (value: string) => void
  admissionPackages: AdmissionPackageOption[]
  rooms: RoomOption[]
  getRoomTypeFilterKey: (room: Pick<Room, "roomType" | "customRoomTypeName">) => string
  setAssignRoomType: (value: string) => void
  setAssignRoomId: (value: string) => void
  directAdmitType: "emergency" | "planned"
  setDirectAdmitType: (value: "emergency" | "planned") => void
  directPlannedAdmitAt: string
  setDirectPlannedAdmitAt: (value: string) => void
  directExpectedDischargeAt: string
  setDirectExpectedDischargeAt: (value: string) => void
  assignRoomType: string
  assignRoomId: string
  availableRoomTypes: RoomTypeOption[]
  availableRoomsForType: Array<RoomOption & { roomNumber: string }>
  getRoomTypeDisplayName: (room: Pick<Room, "roomType" | "customRoomTypeName">) => string
  directDoctorRoundFee: string
  setDirectDoctorRoundFee: (value: string) => void
  directInitialDeposit: string
  setDirectInitialDeposit: (value: string) => void
  directInitialDepositMode: string
  setDirectInitialDepositMode: (value: string) => void
  depositPaymentModes: PaymentModeOption[]
  assignNotes: string
  setAssignNotes: (value: string) => void
  directAdmitLoading: boolean
  onCreateAdmission: () => void
}

export default function DirectAdmitModal(props: DirectAdmitModalProps) {
  const {
    isOpen,
    onClose,
    directPatientName,
    setDirectPatientName,
    setDirectPatientUid,
    setDirectPatientId,
    directPatientLookupLoading,
    directPatientResults,
    handleSelectExistingPatient,
    directPatientUid,
    directPatientId,
    directDoctorId,
    setDirectDoctorId,
    setDirectDoctorName,
    doctorsLoading,
    doctors,
    directDoctorName,
    directPatientAddress,
    setDirectPatientAddress,
    directPackageId,
    setDirectPackageId,
    admissionPackages,
    rooms,
    getRoomTypeFilterKey,
    setAssignRoomType,
    setAssignRoomId,
    directAdmitType,
    setDirectAdmitType,
    directPlannedAdmitAt,
    setDirectPlannedAdmitAt,
    directExpectedDischargeAt,
    setDirectExpectedDischargeAt,
    assignRoomType,
    assignRoomId,
    availableRoomTypes,
    availableRoomsForType,
    getRoomTypeDisplayName,
    directDoctorRoundFee,
    setDirectDoctorRoundFee,
    directInitialDeposit,
    setDirectInitialDeposit,
    directInitialDepositMode,
    setDirectInitialDepositMode,
    depositPaymentModes,
    assignNotes,
    setAssignNotes,
    directAdmitLoading,
    onCreateAdmission,
  } = props

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-t-2xl">
          <div>
            <h3 className="text-lg font-semibold">Direct Patient Admit</h3>
            <p className="text-sm text-rose-100">Emergency admit now or pre-plan admission date and time</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-white/20">
            ×
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 bg-gray-50 rounded-b-2xl overflow-y-auto">
          <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
            <label className="block text-sm font-medium text-gray-700">Patient Name (auto-suggest existing patients)</label>
            <input
              value={directPatientName}
              onChange={(e) => {
                setDirectPatientName(e.target.value)
                setDirectPatientUid("")
                setDirectPatientId("")
              }}
              placeholder="Type patient name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {directPatientLookupLoading && <p className="text-xs text-slate-500">Searching existing patients...</p>}
            {directPatientResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {directPatientResults.map((patient) => (
                  <button
                    key={patient.uid}
                    type="button"
                    onClick={() => handleSelectExistingPatient(patient)}
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <p className="text-sm font-semibold text-slate-800">{patient.fullName || "Unknown patient"}</p>
                    <p className="text-xs text-slate-500">
                      {patient.patientId || "PID: N/A"} · {patient.phone || "No phone"}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {directPatientUid && <p className="text-xs font-medium text-emerald-700">Existing patient selected. UID auto-fetched.</p>}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Patient & Doctor Details</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Patient ID</p>
                <input
                  value={directPatientId}
                  readOnly
                  placeholder="Auto-generated for new patient"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-500">
                  {directPatientUid ? "Fetched from existing patient record." : "Will be auto-generated after admission is created."}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Assign Doctor</p>
                <select
                  value={directDoctorId}
                  onChange={(e) => {
                    const value = e.target.value
                    setDirectDoctorId(value)
                    if (!value) {
                      setDirectDoctorName("")
                      return
                    }
                    const selectedDoctor = doctors.find((doctor) => doctor.uid === value)
                    setDirectDoctorName(selectedDoctor?.fullName || "")
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">{doctorsLoading ? "Loading doctors..." : "Assign doctor later"}</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.uid} value={doctor.uid}>
                      {doctor.fullName} ({doctor.specialization})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Doctor Name</p>
                <input
                  value={directDoctorName}
                  readOnly
                  placeholder="Auto-fetched from selection"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-slate-100 text-slate-700"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Patient Address</p>
                <input
                  value={directPatientAddress}
                  onChange={(e) => setDirectPatientAddress(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Package Selection</p>
            <select
              value={directPackageId}
              onChange={(e) => {
                const nextPackageId = e.target.value
                setDirectPackageId(nextPackageId)
                const selected = admissionPackages.find((pkg) => pkg.id === nextPackageId)
                if (selected?.preferredRoomType) {
                  setAssignRoomType(selected.preferredRoomType)
                  const firstMatching = rooms.find(
                    (room) => room.status === "available" && getRoomTypeFilterKey(room) === selected.preferredRoomType
                  )
                  setAssignRoomId(firstMatching?.id || "")
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select package (optional)</option>
              {admissionPackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.packageName} (Rs {pkg.fixedRate})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Admission Schedule</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Admit Type</p>
                <select
                  value={directAdmitType}
                  onChange={(e) => setDirectAdmitType(e.target.value as "emergency" | "planned")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="emergency">Emergency Direct Admit</option>
                  <option value="planned">Pre-Registered Planned Admit</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Planned Admit Date & Time</p>
                <input
                  type="datetime-local"
                  value={directPlannedAdmitAt}
                  onChange={(e) => setDirectPlannedAdmitAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                  disabled={directAdmitType !== "planned"}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Expected Discharge Date</p>
                <input
                  type="datetime-local"
                  value={directExpectedDischargeAt}
                  onChange={(e) => setDirectExpectedDischargeAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Room & Charges</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Room Type</p>
                <select
                  value={assignRoomType}
                  onChange={(e) => {
                    setAssignRoomType(e.target.value)
                    setAssignRoomId("")
                  }}
                  disabled={Boolean(directPackageId)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Select room type</option>
                  {availableRoomTypes.map((type) => (
                    <option key={type.key} value={type.key}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Room Number</p>
                <select value={assignRoomId} onChange={(e) => setAssignRoomId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Select room</option>
                  {availableRoomsForType.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.roomNumber} — {getRoomTypeDisplayName(room)}
                    </option>
                  ))}
                </select>
              </div>
              {!directPackageId && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">Doctor Round Fee (Optional)</p>
                  <input
                    type="number"
                    min="0"
                    value={directDoctorRoundFee}
                    onChange={(e) => setDirectDoctorRoundFee(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white p-3 sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-gray-700">Initial Deposit</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Amount (₹)</p>
                  <input
                    type="number"
                    min="0"
                    value={directInitialDeposit}
                    onChange={(e) => setDirectInitialDeposit(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Payment Mode</p>
                  <select
                    value={directInitialDepositMode}
                    onChange={(e) => setDirectInitialDepositMode(e.target.value)}
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

          {directPackageId && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Package selected: extra fees are covered by package. Only package amount will be billed.
            </div>
          )}
          <textarea
            value={assignNotes}
            onChange={(e) => setAssignNotes(e.target.value)}
            rows={2}
            placeholder="Admission notes (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200" disabled={directAdmitLoading}>
              Cancel
            </button>
            <button
              onClick={onCreateAdmission}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-60"
              disabled={directAdmitLoading || !assignRoomId}
            >
              {directAdmitLoading ? "Creating..." : "Create Admission"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
