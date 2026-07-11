"use client"

import { Button } from "@/components/ui/Button"
import type { Room } from "@/types/patient"

type ExistingPatientOption = {
  uid: string
  patientId: string
  fullName: string
  phone: string
  gender: string
  dateOfBirth: string
  address: string
  admissionStatus?: "admitted" | "scheduled" | null
  activeAdmissionId?: string | null
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
  /** When user types a new name, clear linked UID and extra demographic fields */
  onClearDirectPatientSelection?: () => void
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
  directPatientPhone: string
  setDirectPatientPhone: (value: string) => void
  directPatientGender: string
  setDirectPatientGender: (value: string) => void
  directPatientAge: string
  setDirectPatientAge: (value: string) => void
  directEmergencyRelativeName: string
  setDirectEmergencyRelativeName: (value: string) => void
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
    onClearDirectPatientSelection,
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
    directPatientPhone,
    setDirectPatientPhone,
    directPatientGender,
    setDirectPatientGender,
    directPatientAge,
    setDirectPatientAge,
    directEmergencyRelativeName,
    setDirectEmergencyRelativeName,
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* ── Modal header ── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">Direct Patient Admit</h3>
            <p className="mt-0.5 text-xs text-slate-500">Emergency admit now or pre-plan admission date and time</p>
          </div>
          <button onClick={onClose} type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* ── Patient Search ── */}
          <div className="space-y-2 rounded-xl border border-cyan-100 bg-cyan-50/50 p-4">
            <label className="rx-form-label">Patient Name <span className="rx-form-helper font-normal">(auto-suggests existing patients)</span></label>
            <input
              value={directPatientName}
              onChange={(e) => {
                setDirectPatientName(e.target.value)
                setDirectPatientUid("")
                setDirectPatientId("")
                onClearDirectPatientSelection?.()
              }}
              placeholder="Type patient name to search…"
              className="rx-form-input"
            />
            {directPatientLookupLoading && <p className="text-xs text-slate-500">Searching existing patients...</p>}
            {directPatientResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                {directPatientResults.map((patient) => (
                  <button
                    key={patient.uid}
                    type="button"
                    onClick={() => handleSelectExistingPatient(patient)}
                    disabled={patient.admissionStatus === "admitted" || patient.admissionStatus === "scheduled"}
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
                  >
                    <p className="text-sm font-semibold text-slate-800">{patient.fullName || "Unknown patient"}</p>
                    <p className="text-xs text-slate-500">
                      {patient.patientId || "PID: N/A"} · {patient.phone || "No phone"}
                    </p>
                    {patient.admissionStatus ? (
                      <p className="text-[11px] font-medium text-rose-600">
                        {patient.admissionStatus === "admitted"
                          ? "Already admitted (cannot direct admit again)"
                          : "Pre-registered for admission (cannot direct admit again)"}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            {directPatientUid && <p className="text-xs font-medium text-emerald-700">Existing patient selected. UID auto-fetched.</p>}
          </div>

          {/* ── Patient & Doctor Details ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Patient &amp; Doctor Details</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rx-form-field">
                <label className="rx-form-label">Patient ID</label>
                <input value={directPatientId} readOnly placeholder="Auto-generated for new patient"
                  className="rx-form-input rx-form-input--readonly" />
                <p className="rx-form-helper">
                  {directPatientUid ? "Fetched from existing patient record." : "Auto-generated after admission is created."}
                </p>
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Assign Doctor</label>
                <select value={directDoctorId}
                  onChange={(e) => {
                    const value = e.target.value
                    setDirectDoctorId(value)
                    if (!value) { setDirectDoctorName(""); return }
                    const selectedDoctor = doctors.find((doctor) => doctor.uid === value)
                    setDirectDoctorName(selectedDoctor?.fullName || "")
                  }}
                  className="rx-form-select">
                  <option value="">{doctorsLoading ? "Loading doctors…" : "Assign doctor later"}</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.uid} value={doctor.uid}>{doctor.fullName} ({doctor.specialization})</option>
                  ))}
                </select>
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Doctor Name</label>
                <input value={directDoctorName} readOnly placeholder="Auto-fetched from selection"
                  className="rx-form-input rx-form-input--readonly" />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Patient Address</label>
                <input value={directPatientAddress} onChange={(e) => setDirectPatientAddress(e.target.value)}
                  placeholder="Optional" className="rx-form-input" />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Mobile Number</label>
                <input value={directPatientPhone} onChange={(e) => setDirectPatientPhone(e.target.value)}
                  placeholder="Patient or attendant mobile" inputMode="tel" className="rx-form-input" />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Age (years)</label>
                <input type="number" min={0} max={120} value={directPatientAge}
                  onChange={(e) => setDirectPatientAge(e.target.value)}
                  placeholder="e.g. 45" className="rx-form-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                <p className="rx-form-helper">Used when creating a new patient record</p>
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Gender</label>
                <select value={directPatientGender} onChange={(e) => setDirectPatientGender(e.target.value)} className="rx-form-select">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Relative / Emergency Contact</label>
                <input value={directEmergencyRelativeName} onChange={(e) => setDirectEmergencyRelativeName(e.target.value)}
                  placeholder="Name (optional)" className="rx-form-input" />
              </div>
            </div>
          </div>

          {/* ── Package Selection ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Package Selection</p>
            <div className="rx-form-field">
              <label className="rx-form-label">Operation Package</label>
              <select value={directPackageId}
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
                className="rx-form-select">
                <option value="">No package — fee per item</option>
                {admissionPackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.packageName} (₹{pkg.fixedRate})</option>
                ))}
              </select>
              <p className="rx-form-helper">Package covers total billing; individual charges will be disabled</p>
            </div>
          </div>

          {/* ── Admission Schedule ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Admission Schedule</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rx-form-field">
                <label className="rx-form-label">Admit Type</label>
                <select value={directAdmitType} onChange={(e) => setDirectAdmitType(e.target.value as "emergency" | "planned")} className="rx-form-select">
                  <option value="emergency">Emergency Direct Admit</option>
                  <option value="planned">Pre-Registered Planned Admit</option>
                </select>
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Planned Admit Date &amp; Time</label>
                <input type="datetime-local" value={directPlannedAdmitAt}
                  onChange={(e) => setDirectPlannedAdmitAt(e.target.value)}
                  className={`rx-form-input ${directAdmitType !== "planned" ? "rx-form-input--readonly" : ""}`}
                  disabled={directAdmitType !== "planned"} />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Expected Discharge Date</label>
                <input type="datetime-local" value={directExpectedDischargeAt}
                  onChange={(e) => setDirectExpectedDischargeAt(e.target.value)}
                  className="rx-form-input" />
              </div>
            </div>
          </div>

          {/* ── Room & Charges ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Room &amp; Charges</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rx-form-field">
                <label className="rx-form-label">Room Type</label>
                <select value={assignRoomType}
                  onChange={(e) => { setAssignRoomType(e.target.value); setAssignRoomId("") }}
                  disabled={Boolean(directPackageId)}
                  className={`rx-form-select ${Boolean(directPackageId) ? "rx-form-input--readonly" : ""}`}>
                  <option value="">Select room type</option>
                  {availableRoomTypes.map((type) => (
                    <option key={type.key} value={type.key}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Room Number</label>
                <select value={assignRoomId} onChange={(e) => setAssignRoomId(e.target.value)} className="rx-form-select">
                  <option value="">Select room</option>
                  {availableRoomsForType.map((room) => (
                    <option key={room.id} value={room.id}>{room.roomNumber} — {getRoomTypeDisplayName(room)}</option>
                  ))}
                </select>
              </div>
              {!directPackageId && (
                <div className="rx-form-field">
                  <label className="rx-form-label">Doctor Round Fee</label>
                  <input type="number" min="0" value={directDoctorRoundFee}
                    onChange={(e) => setDirectDoctorRoundFee(e.target.value)}
                    placeholder="e.g. 500" className="rx-form-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <p className="rx-form-helper">Optional — charged per doctor visit during stay</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Initial Deposit ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Initial Deposit</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rx-form-field">
                <label className="rx-form-label">Amount (₹)</label>
                <input type="number" min="0" value={directInitialDeposit}
                  onChange={(e) => setDirectInitialDeposit(e.target.value)}
                  placeholder="e.g. 5000" className="rx-form-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </div>
              <div className="rx-form-field">
                <label className="rx-form-label">Payment Mode</label>
                <select value={directInitialDepositMode} onChange={(e) => setDirectInitialDepositMode(e.target.value)} className="rx-form-select">
                  {depositPaymentModes.map((mode) => (
                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {directPackageId && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-emerald-800">Package selected — extra fees are covered. Only the package amount will be billed.</p>
            </div>
          )}

          {/* ── Admission Notes ── */}
          <div className="rx-form-field">
            <label className="rx-form-label">Admission Notes <span className="text-[11px] font-normal text-slate-400">(optional)</span></label>
            <textarea value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)}
              rows={2} placeholder="Add notes for the nursing team or ward staff…"
              className="rx-form-textarea" />
          </div>
        </div>

        {/* ── Modal footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={directAdmitLoading}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={onCreateAdmission}
            loading={directAdmitLoading} loadingText="Creating…" disabled={!assignRoomId}>
            Create Admission
          </Button>
        </div>
      </div>
    </div>
  )
}
