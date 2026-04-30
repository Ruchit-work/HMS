"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { auth } from "@/firebase/config"
import { Admission } from "@/types/patient"

const ROUND_CHARGE_OPTIONS = [
  { key: "medicine", label: "Medicine" },
  { key: "injection", label: "Injection" },
  { key: "drug", label: "Drug" },
  { key: "bottle", label: "Bottle" },
  { key: "other", label: "Other" },
] as const

type RoundChargeKey = (typeof ROUND_CHARGE_OPTIONS)[number]["key"]

type InpatientRow = Admission & {
  doctorRounds?: Array<{
    roundAt: string
    notes?: string | null
    fee?: number
  }>
}

export default function DoctorInpatientsPage() {
  const [inpatients, setInpatients] = useState<InpatientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedAdmissionId, setExpandedAdmissionId] = useState<string | null>(null)
  const [roundFee, setRoundFee] = useState("500")
  const [roundNotes, setRoundNotes] = useState("")
  const [roundChargeSelection, setRoundChargeSelection] = useState<Record<RoundChargeKey, boolean>>({
    medicine: false,
    injection: false,
    drug: false,
    bottle: false,
    other: false,
  })
  const [roundChargeAmount, setRoundChargeAmount] = useState<Record<RoundChargeKey, string>>({
    medicine: "",
    injection: "",
    drug: "",
    bottle: "",
    other: "",
  })
  const [markingRound, setMarkingRound] = useState(false)
  const [requestingDischargeId, setRequestingDischargeId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [confirmDischargeAdmission, setConfirmDischargeAdmission] = useState<InpatientRow | null>(null)
  const [dischargeRequestNote, setDischargeRequestNote] = useState("")

  const fetchInpatients = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in")
      const token = await currentUser.getIdToken()
      const res = await fetch("/api/doctor/inpatients", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load admitted patients")
      }
      const data = await res.json().catch(() => ({}))
      const rows = Array.isArray(data?.admissions) ? data.admissions : []
      setInpatients(rows as InpatientRow[])
    } catch (err: any) {
      setError(err?.message || "Failed to load admitted patients")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInpatients()
  }, [fetchInpatients])

  const totalRounds = useMemo(
    () =>
      inpatients.reduce((sum, patient) => {
        const count = Array.isArray(patient.doctorRounds) ? patient.doctorRounds.length : 0
        return sum + count
      }, 0),
    [inpatients]
  )

  const filteredInpatients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return inpatients
    return inpatients.filter((patient) => {
      const name = String(patient.patientName || "").toLowerCase()
      const patientId = String(patient.patientId || "").toLowerCase()
      const room = String(patient.roomNumber || "").toLowerCase()
      const admissionId = String(patient.id || "").toLowerCase()
      return (
        name.includes(query) ||
        patientId.includes(query) ||
        room.includes(query) ||
        admissionId.includes(query)
      )
    })
  }, [inpatients, searchTerm])

  const markRoundDone = useCallback(async () => {
    if (!expandedAdmissionId) return
    const selectedAdmission = inpatients.find((item) => item.id === expandedAdmissionId)
    if (!selectedAdmission) return
    setMarkingRound(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in")
      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/doctor/admissions/${selectedAdmission.id}/rounds`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fee: Number(roundFee || 0),
          notes: roundNotes || undefined,
          medicineCharge: roundChargeSelection.medicine ? Number(roundChargeAmount.medicine || 0) : 0,
          injectionCharge: roundChargeSelection.injection ? Number(roundChargeAmount.injection || 0) : 0,
          bottleCharge: roundChargeSelection.bottle ? Number(roundChargeAmount.bottle || 0) : 0,
          drugCharge: roundChargeSelection.drug ? Number(roundChargeAmount.drug || 0) : 0,
          otherCharge: roundChargeSelection.other ? Number(roundChargeAmount.other || 0) : 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to mark round")
      }
      setRoundNotes("")
      setRoundChargeSelection({
        medicine: false,
        injection: false,
        drug: false,
        bottle: false,
        other: false,
      })
      setRoundChargeAmount({
        medicine: "",
        injection: "",
        drug: "",
        bottle: "",
        other: "",
      })
      await fetchInpatients()
    } catch (err: any) {
      setError(err?.message || "Failed to mark round")
    } finally {
      setMarkingRound(false)
    }
  }, [
    expandedAdmissionId,
    inpatients,
    roundFee,
    roundNotes,
    roundChargeSelection,
    roundChargeAmount,
    fetchInpatients,
  ])

  const requestDischarge = useCallback(
    async (admission: InpatientRow, note?: string) => {
      setRequestingDischargeId(admission.id)
      try {
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error("You must be logged in")
        const token = await currentUser.getIdToken()
        const res = await fetch(`/api/doctor/admissions/${admission.id}/request-discharge`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes: note?.trim() || undefined }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || "Failed to request discharge")
        }
        await fetchInpatients()
      } catch (err: any) {
        setError(err?.message || "Failed to request discharge")
      } finally {
        setRequestingDischargeId(null)
      }
    },
    [fetchInpatients]
  )

  return (
    <div className="min-h-screen bg-slate-50 pt-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Admitted Patients Under My Care</h2>
              <p className="text-sm text-slate-500">
                Mark doctor rounds, track visit count, and keep billing fee in sync.
              </p>
            </div>
            <div className="text-sm text-slate-600">
              Active patients: <span className="font-semibold text-slate-900">{inpatients.length}</span> | Total rounds
              marked: <span className="font-semibold text-slate-900">{totalRounds}</span>
            </div>
          </div>
          <div className="mt-4">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patient by name, patient ID, room, or admission ID"
              suppressHydrationWarning
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Patient</th>
                <th className="px-3 py-2 text-left">Room</th>
                <th className="px-3 py-2 text-left">Admitted</th>
                <th className="px-3 py-2 text-left">Round Count</th>
                <th className="px-3 py-2 text-left">Last Round</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Loading inpatients...
                  </td>
                </tr>
              ) : filteredInpatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No matching admitted patients found.
                  </td>
                </tr>
              ) : (
                filteredInpatients.map((patient) => {
                  const rounds = Array.isArray(patient.doctorRounds) ? patient.doctorRounds : []
                  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null
                  return [
                    <tr key={`${patient.id}-row`} className="border-t border-slate-100">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-slate-900">{patient.patientName || "Unknown patient"}</p>
                        <p className="text-xs text-slate-500">{patient.patientId || "PID: N/A"}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {patient.roomNumber} ({patient.roomType === "custom" ? patient.customRoomTypeName || "Custom" : patient.roomType})
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {patient.checkInAt ? new Date(patient.checkInAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-700 font-semibold">{rounds.length}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {lastRound?.roundAt ? new Date(lastRound.roundAt).toLocaleString() : "No rounds yet"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setExpandedAdmissionId((prev) => (prev === patient.id ? null : patient.id))
                              setRoundFee("500")
                              setRoundNotes("")
                              setRoundChargeSelection({
                                medicine: false,
                                injection: false,
                                drug: false,
                                bottle: false,
                                other: false,
                              })
                              setRoundChargeAmount({
                                medicine: "",
                                injection: "",
                                drug: "",
                                bottle: "",
                                other: "",
                              })
                            }}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            {expandedAdmissionId === patient.id ? "Close Round Form" : "Mark Round Done"}
                          </button>
                          <button
                            onClick={() => {
                              setConfirmDischargeAdmission(patient)
                              setDischargeRequestNote("")
                            }}
                            disabled={
                              requestingDischargeId === patient.id ||
                              patient.dischargeRequest?.status === "pending"
                            }
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            {patient.dischargeRequest?.status === "pending"
                              ? "Requested"
                              : requestingDischargeId === patient.id
                                ? "Requesting..."
                                : "Request Discharge"}
                          </button>
                        </div>
                      </td>
                    </tr>,
                    expandedAdmissionId === patient.id ? (
                      <tr key={`${patient.id}-accordion`} className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={6} className="px-3 py-4">
                          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-900">
                                Round Update - {patient.patientName || "Unknown"} ({patient.patientId || "PID: N/A"})
                              </h4>
                              <p className="text-xs text-slate-500">Add notes, prescriptions, injections, and billable items.</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Round Fee (₹)</label>
                                <input type="number" min="0" value={roundFee} onChange={(e) => setRoundFee(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700">Current Round Count</label>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{(patient.doctorRounds || []).length}</div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-sm font-medium text-slate-700">Round Notes (optional)</label>
                              <textarea rows={3} value={roundNotes} onChange={(e) => setRoundNotes(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Condition update, treatment response, next plan..." />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="space-y-2 sm:col-span-2">
                                <label className="text-sm font-medium text-slate-700">
                                  Treatment charges (select and customize)
                                </label>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {ROUND_CHARGE_OPTIONS.map((option) => (
                                    <div key={option.key} className="rounded-lg border border-slate-200 p-2">
                                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={roundChargeSelection[option.key]}
                                          onChange={(e) =>
                                            setRoundChargeSelection((prev) => ({
                                              ...prev,
                                              [option.key]: e.target.checked,
                                            }))
                                          }
                                        />
                                        {option.label}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        disabled={!roundChargeSelection[option.key]}
                                        value={roundChargeAmount[option.key]}
                                        onChange={(e) =>
                                          setRoundChargeAmount((prev) => ({
                                            ...prev,
                                            [option.key]: e.target.value,
                                          }))
                                        }
                                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm [appearance:textfield] disabled:bg-slate-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        placeholder={`${option.label} charge (₹)`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase text-slate-600">Round History</p>
                              <div className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-slate-700">
                                {(patient.doctorRounds || []).length === 0 ? (
                                  <p>No rounds marked yet.</p>
                                ) : (
                                  (patient.doctorRounds || []).slice().reverse().map((round, index) => (
                                    <p key={`${round.roundAt}-${index}`}>
                                      {new Date(round.roundAt).toLocaleString()} - Fee ₹{Number(round.fee || 0)}
                                      {round.notes ? ` - ${round.notes}` : ""}
                                    </p>
                                  ))
                                )}
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setExpandedAdmissionId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={markingRound}>Cancel</button>
                              <button onClick={markRoundDone} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60" disabled={markingRound}>{markingRound ? "Saving..." : "Mark Round Done"}</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ]
                })
              )}
            </tbody>
          </table>
        </section>
      </main>

      {confirmDischargeAdmission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Are you sure?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Send discharge request for{" "}
              <span className="font-semibold text-slate-800">
                {confirmDischargeAdmission.patientName || "this patient"}
              </span>
              ?
            </p>
            <div className="mt-3 space-y-1">
              <label className="text-sm font-medium text-slate-700">Note for receptionist (optional)</label>
              <textarea
                rows={3}
                value={dischargeRequestNote}
                onChange={(e) => setDischargeRequestNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Any discharge instructions..."
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmDischargeAdmission(null)
                  setDischargeRequestNote("")
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={requestingDischargeId === confirmDischargeAdmission.id}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await requestDischarge(confirmDischargeAdmission, dischargeRequestNote)
                  setConfirmDischargeAdmission(null)
                  setDischargeRequestNote("")
                }}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={requestingDischargeId === confirmDischargeAdmission.id}
              >
                {requestingDischargeId === confirmDischargeAdmission.id ? "Sending..." : "Yes, Send Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}

