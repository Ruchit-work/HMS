"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from '@/shared/components'
import { auth } from "@/firebase/config"
import { Admission } from "@/types/patient"
import { onAuthStateChanged, type User } from "firebase/auth"
import {
  ClinicalAlertCard,
  ClinicalFormSection,
  ClinicalPageFrame,
  ClinicalPageHeader,
  ClinicalStatusBadge,
} from "@/features/doctor/clinical"
import { Users } from "lucide-react"

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

type PatientHistoryState = {
  loading: boolean
  error: string | null
  patientProfile: Record<string, unknown> | null
  previousAdmissions: Array<any>
  normalVisits: Array<any>
}

const getAuthenticatedUser = async (): Promise<User> => {
  if (auth.currentUser) return auth.currentUser
  return await new Promise<User>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error("You must be logged in"))
    }, 5000)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return
      clearTimeout(timeout)
      unsubscribe()
      resolve(user)
    })
  })
}

export default function DoctorInpatientsPage() {
  const [activeTab, setActiveTab] = useState<"admitted" | "prebooked">("admitted")
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
  const [viewingPatient, setViewingPatient] = useState<InpatientRow | null>(null)
  const [patientHistory, setPatientHistory] = useState<PatientHistoryState>({
    loading: false,
    error: null,
    patientProfile: null,
    previousAdmissions: [],
    normalVisits: [],
  })

  const fetchInpatients = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const currentUser = await getAuthenticatedUser()
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

  const admittedPatients = useMemo(
    () => filteredInpatients.filter((patient) => String(patient.status || "") === "admitted"),
    [filteredInpatients]
  )

  const preBookedPatients = useMemo(
    () => filteredInpatients.filter((patient) => String(patient.status || "") === "scheduled"),
    [filteredInpatients]
  )

  const markRoundDone = useCallback(async () => {
    if (!expandedAdmissionId) return
    const selectedAdmission = inpatients.find((item) => item.id === expandedAdmissionId)
    if (!selectedAdmission) return
    setMarkingRound(true)
    try {
      const currentUser = await getAuthenticatedUser()
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
        const currentUser = await getAuthenticatedUser()
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

  const handleViewPatientDetails = useCallback(async (patient: InpatientRow) => {
    setViewingPatient(patient)
    setPatientHistory({
      loading: true,
      error: null,
      patientProfile: null,
      previousAdmissions: [],
      normalVisits: [],
    })
    try {
      const currentUser = await getAuthenticatedUser()
      const token = await currentUser.getIdToken()
      const patientUid = String(patient.patientUid || "")
      if (!patientUid) throw new Error("Patient UID not found for this admission")

      const query = new URLSearchParams()
      if (patient.patientId) query.set("patientId", String(patient.patientId))
      query.set("currentAdmissionId", String(patient.id))

      const res = await fetch(`/api/doctor/patients/${patientUid}/history?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load patient history")
      }
      const data = await res.json().catch(() => ({}))
      setPatientHistory({
        loading: false,
        error: null,
        patientProfile:
          data?.patientProfile && typeof data.patientProfile === "object" ? data.patientProfile : null,
        previousAdmissions: Array.isArray(data?.previousAdmissions) ? data.previousAdmissions : [],
        normalVisits: Array.isArray(data?.normalVisits) ? data.normalVisits : [],
      })
    } catch (err: any) {
      setPatientHistory({
        loading: false,
        error: err?.message || "Failed to load patient history",
        patientProfile: null,
        previousAdmissions: [],
        normalVisits: [],
      })
    }
  }, [])

  const patientProfileEntries = useMemo(() => {
    if (!patientHistory.patientProfile) return []
    const hiddenKeys = new Set([
      "id",
      "createdAt",
      "createdBy",
      "defaultBranchId",
      "email",
      "patientId",
      "phoneCountryCode",
      "phone",
      "phoneNumber",
      "hospitalId",
      "updatedAt",
      "status",
    ])
    return Object.entries(patientHistory.patientProfile)
      .filter(([key, value]) => !hiddenKeys.has(key) && value !== undefined && value !== null && String(value).trim() !== "")
      .sort(([a], [b]) => a.localeCompare(b))
  }, [patientHistory.patientProfile])

  return (
    <ClinicalPageFrame>
        <ClinicalPageHeader
          title="Inpatients"
          subtitle="Patients admitted under your care. Document rounds and request discharge."
          icon={<Users className="w-5 h-5" />}
          badge={
            <span className="text-xs font-medium text-slate-500">
              {inpatients.length} active · {totalRounds} rounds
            </span>
          }
        />

        <ClinicalFormSection
          title="Search patients"
          description="Find by name, patient ID, room, or admission ID."
        >
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search patient by name, patient ID, room, or admission ID"
              suppressHydrationWarning
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm hms-input"
            />
        </ClinicalFormSection>

        {error ? (
          <ClinicalAlertCard variant="error" title="Unable to load inpatients">
            {error}
          </ClinicalAlertCard>
        ) : null}

        <section className="clinical-surface p-3">
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("admitted")}
              suppressHydrationWarning
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeTab === "admitted"
                  ? "bg-cyan-100 text-cyan-800"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Admitted Patients ({admittedPatients.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("prebooked")}
              suppressHydrationWarning
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeTab === "prebooked"
                  ? "bg-amber-100 text-amber-800"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Pre-Booked Admissions ({preBookedPatients.length})
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Patient</th>
                <th className="px-3 py-2 text-left">Room</th>
                <th className="px-3 py-2 text-left">Admitted</th>
                {activeTab === "admitted" ? (
                  <>
                    <th className="px-3 py-2 text-left">Round Count</th>
                    <th className="px-3 py-2 text-left">Last Round</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </>
                ) : (
                  <th className="px-3 py-2 text-left">Status</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeTab === "admitted" ? 6 : 4} className="px-3 py-6 text-center text-slate-500">
                    Loading inpatients...
                  </td>
                </tr>
              ) : activeTab === "admitted" && admittedPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No matching admitted patients found.
                  </td>
                </tr>
              ) : activeTab === "prebooked" && preBookedPatients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    No matching pre-booked admissions found.
                  </td>
                </tr>
              ) : (
                (activeTab === "admitted" ? admittedPatients : preBookedPatients).map((patient) => {
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
                      {activeTab === "admitted" ? (
                        <>
                          <td className="px-3 py-3 text-slate-700 font-semibold">{rounds.length}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {lastRound?.roundAt ? new Date(lastRound.roundAt).toLocaleString() : "No rounds yet"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleViewPatientDetails(patient)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                View Details
                              </button>
                              <Button
                                type="button"
                                size="sm"
                                variant={expandedAdmissionId === patient.id ? "outline" : "primary"}
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
                              >
                                {expandedAdmissionId === patient.id ? "Close Round Form" : "Mark Round Done"}
                              </Button>
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
                        </>
                      ) : (
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              Pre-Booked (Read only)
                            </span>
                            <button
                              onClick={() => handleViewPatientDetails(patient)}
                              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>,
                    activeTab === "admitted" && expandedAdmissionId === patient.id ? (
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
                              <Button type="button" variant="outline" size="sm" onClick={() => setExpandedAdmissionId(null)} disabled={markingRound}>
                                Cancel
                              </Button>
                              <Button type="button" variant="primary" size="sm" onClick={markRoundDone} loading={markingRound} loadingText="Saving...">
                                Mark Round Done
                              </Button>
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
          </div>
        </section>

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

      {viewingPatient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 mb-0 flex items-start justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Patient Details - {viewingPatient.patientName || "Unknown patient"}
                </h3>
                <p className="text-xs text-slate-500">
                  {viewingPatient.patientId || "PID: N/A"} | Room {viewingPatient.roomNumber || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPatient(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              {patientHistory.loading ? (
                <p className="py-6 text-center text-sm text-slate-500">Loading patient history...</p>
              ) : patientHistory.error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {patientHistory.error}
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient Master Details</p>
                    {patientProfileEntries.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">No additional patient profile details found.</p>
                    ) : (
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {patientProfileEntries.map(([key, value]) => (
                          <div key={key} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs">
                            <p className="font-semibold uppercase tracking-wide text-slate-500">{key}</p>
                            <p className="break-words text-slate-700">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Previous Admissions</p>
                    <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                      {patientHistory.previousAdmissions.length === 0 ? (
                        <p className="text-sm text-slate-500">No previous admissions found.</p>
                      ) : (
                        patientHistory.previousAdmissions.map((entry) => (
                          <div key={String(entry.id)} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs">
                            <p className="font-semibold text-slate-700">Admission ID: {String(entry.id)}</p>
                            <p className="text-slate-600">
                              {String(entry.status || "—")} | {entry.checkInAt ? new Date(entry.checkInAt).toLocaleString() : "—"}
                            </p>
                            <p className="text-slate-500">Room: {String(entry.roomNumber || "—")}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Normal Visits (OPD)</p>
                    <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                      {patientHistory.normalVisits.length === 0 ? (
                        <p className="text-sm text-slate-500">No previous normal visits found.</p>
                      ) : (
                        patientHistory.normalVisits.map((entry) => (
                        <div key={String(entry.id)} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs space-y-1">
                            <p className="font-semibold text-slate-700">
                              Appointment ID: {String(entry.id || "—")}
                            </p>
                            <p className="text-slate-600">
                              Date/Time: {String(entry.appointmentDate || "—")}{" "}
                              {entry.appointmentTime ? `at ${String(entry.appointmentTime)}` : ""}
                            </p>
                            <p className="text-slate-600">Doctor: {String(entry.doctorName || "—")}</p>
                            <p className="text-slate-600">Status: {String(entry.status || "—")}</p>
                          <p className="text-slate-600">Chief complaint: {String(entry.chiefComplaint || "—")}</p>
                          {Array.isArray(entry.finalDiagnosis) && entry.finalDiagnosis.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {entry.finalDiagnosis.map((diag: string, idx: number) => (
                                <span
                                  key={`${entry.id}-diag-${idx}`}
                                  className="inline-flex items-center rounded-full border border-blue-100 bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-800"
                                >
                                  {diag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500">Final diagnosis: —</p>
                          )}
                          <p className="text-slate-600 whitespace-pre-line">
                            Prescription: {String(entry.medicine || "—")}
                          </p>
                          <p className="text-slate-600 whitespace-pre-line">
                            Doctor notes: {String(entry.doctorNotes || entry.notes || "—")}
                          </p>
                            <p className="text-slate-500">
                              Payment: {String(entry.paymentStatus || "—")} | {String(entry.paymentMethod || "—")} | ₹
                              {Number(entry.paymentAmount || entry.totalConsultationFee || 0).toLocaleString()}
                            </p>
                            <p className="text-slate-500">
                              Branch: {String(entry.branchName || "—")} | Type: {String(entry.paymentType || "—")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

    </ClinicalPageFrame>
  )
}

