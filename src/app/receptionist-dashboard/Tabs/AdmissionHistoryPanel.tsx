"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { auth } from "@/firebase/config"
import { Admission, BillingRecord } from "@/types/patient"

interface AdmissionHistoryPanelProps {
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
}

export default function AdmissionHistoryPanel({ onNotification }: AdmissionHistoryPanelProps) {
  const [history, setHistory] = useState<Admission[]>([])
  const [billingByAdmissionId, setBillingByAdmissionId] = useState<Record<string, BillingRecord>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)

  const notify = useCallback(
    (payload: { type: "success" | "error"; message: string } | null) => {
      onNotification?.(payload)
    },
    [onNotification]
  )

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error("You must be logged in to view history")
      const token = await currentUser.getIdToken()
      const res = await fetch("/api/receptionist/admissions?includeAppointmentDetails=false", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load admission history")
      }
      const data = await res.json().catch(() => ({}))
      const items = Array.isArray(data?.admissions) ? data.admissions : []
      const formatted: Admission[] = items.map((item: any) => ({
        id: String(item.id || ""),
        appointmentId: String(item.appointmentId || ""),
        patientUid: String(item.patientUid || ""),
        patientId: item.patientId || undefined,
        patientName: item.patientName || null,
        patientAddress: item.patientAddress || null,
        doctorId: String(item.doctorId || ""),
        doctorName: item.doctorName || null,
        roomId: String(item.roomId || ""),
        roomNumber: item.roomNumber || "",
        roomType: item.roomType || "general",
        customRoomTypeName: item.customRoomTypeName || null,
        roomRatePerDay: Number(item.roomRatePerDay || 0),
        roomStays: Array.isArray(item.roomStays) ? item.roomStays : [],
        charges: item.charges || undefined,
        status: item.status || "completed",
        checkInAt: item.checkInAt || new Date().toISOString(),
        checkOutAt: item.checkOutAt || null,
        createdBy: item.createdBy || "receptionist",
        createdAt: item.createdAt || item.checkInAt || new Date().toISOString(),
        updatedAt: item.updatedAt,
        billingId: item.billingId || null,
      }))
      setHistory(formatted.filter((admission) => admission.status !== "admitted"))

      const billingRes = await fetch("/api/receptionist/billing-records?mode=admission_only&enrich=0", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
      if (billingRes.ok) {
        const billingData = await billingRes.json().catch(() => ({}))
        const records = Array.isArray(billingData?.records) ? billingData.records : []
        const admissionBilling = records
          .filter((record: any) => record?.type === "admission" && record?.admissionId)
          .reduce((acc: Record<string, BillingRecord>, record: any) => {
            acc[String(record.admissionId)] = {
              id: String(record.id || ""),
              type: "admission",
              admissionId: String(record.admissionId || ""),
              appointmentId: record.appointmentId ? String(record.appointmentId) : undefined,
              patientId: String(record.patientId || ""),
              patientUid: record.patientUid || null,
              patientName: record.patientName || null,
              doctorId: String(record.doctorId || ""),
              doctorName: record.doctorName || null,
              roomCharges: Number(record.roomCharges || 0),
              doctorFee: Number(record.doctorFee || 0),
              otherServices: Array.isArray(record.otherServices) ? record.otherServices : [],
              totalAmount: Number(record.totalAmount || 0),
              generatedAt: record.generatedAt || new Date().toISOString(),
              status: record.status || "pending",
              paymentMethod: record.paymentMethod,
              paidAt: record.paidAt || null,
              paymentReference: record.paymentReference || null,
            }
            return acc
          }, {})
        setBillingByAdmissionId(admissionBilling)
      }
    } catch (err: any) {
      const message = err?.message || "Failed to load admission history"
      setError(message)
      notify({ type: "error", message })
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const filteredHistory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return history
    return history.filter((item) => {
      const patientName = String(item.patientName || "").toLowerCase()
      const patientId = String(item.patientId || "").toLowerCase()
      const admissionId = String(item.id || "").toLowerCase()
      return patientName.includes(query) || patientId.includes(query) || admissionId.includes(query)
    })
  }, [history, searchTerm])

  const formatCurrency = (amount: number) => `₹${Number(amount || 0).toLocaleString("en-IN")}`

  const handlePrintSummary = useCallback(
    (admission: Admission) => {
      const billing = billingByAdmissionId[admission.id]
      const stays =
        Array.isArray(admission.roomStays) && admission.roomStays.length > 0
          ? admission.roomStays
          : [
              {
                roomNumber: admission.roomNumber,
                roomType: admission.roomType,
                customRoomTypeName: admission.customRoomTypeName || null,
                ratePerDay: admission.roomRatePerDay,
              },
            ]
      const roomJourneyHtml = stays
        .map((stay: any, idx: number) => {
          const roomTypeLabel =
            stay.roomType === "custom" ? stay.customRoomTypeName || "Custom Room Type" : stay.roomType
          return `<li>${idx + 1}. Room ${stay.roomNumber || "N/A"} (${roomTypeLabel}) - ${formatCurrency(Number(stay.ratePerDay || 0))}/day</li>`
        })
        .join("")

      const billingLinesHtml = billing
        ? `
          <tr><td>Bill ID</td><td>${billing.id}</td></tr>
          <tr><td>Room Charges</td><td>${formatCurrency(Number(billing.roomCharges || 0))}</td></tr>
          <tr><td>Doctor Fee</td><td>${formatCurrency(Number(billing.doctorFee || 0))}</td></tr>
          ${(billing.otherServices || [])
            .map((service) => `<tr><td>${service.description || "Service"}</td><td>${formatCurrency(Number(service.amount || 0))}</td></tr>`)
            .join("")}
          <tr class="total"><td>Total</td><td>${formatCurrency(Number(billing.totalAmount || 0))}</td></tr>
          <tr><td>Payment Status</td><td style="text-transform:capitalize">${billing.status}</td></tr>
        `
        : `<tr><td colspan="2">Billing details not found for this admission.</td></tr>`

      const html = `
  <div style="font-family: Arial, sans-serif; color: #1e293b; padding: 20px;">
    <div style="margin-bottom: 16px;">
      <p style="font-size: 22px; font-weight: 700; margin: 0;">Discharge & Billing Summary</p>
      <p style="color: #64748b; margin-top: 4px;">Admission ID: ${admission.id}</p>
    </div>

    <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
      <h3 style="margin: 0 0 8px; font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: .04em;">Admission Details</h3>
      <table style="width:100%; border-collapse:collapse; font-size: 14px;">
        <tr><td style="padding:4px 0;"><strong>Patient:</strong> ${admission.patientName || "Unknown"}</td><td style="padding:4px 0;"><strong>Patient ID:</strong> ${admission.patientId || "N/A"}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Doctor:</strong> ${admission.doctorName || "N/A"}</td><td style="padding:4px 0;"><strong>Status:</strong> <span style="text-transform:capitalize">${admission.status}</span></td></tr>
        <tr><td style="padding:4px 0;"><strong>Check-in:</strong> ${admission.checkInAt ? new Date(admission.checkInAt).toLocaleString() : "N/A"}</td><td style="padding:4px 0;"><strong>Check-out:</strong> ${admission.checkOutAt ? new Date(admission.checkOutAt).toLocaleString() : "N/A"}</td></tr>
      </table>
    </div>

    <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
      <h3 style="margin: 0 0 8px; font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: .04em;">Room Journey</h3>
      <ul style="margin:0; padding-left:18px;">${roomJourneyHtml}</ul>
    </div>

    <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
      <h3 style="margin: 0 0 8px; font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: .04em;">Billing</h3>
      <table style="width:100%; border-collapse:collapse; font-size: 14px;">${billingLinesHtml}</table>
    </div>
  </div>`

      const printWindow = window.open("", "_blank", "width=900,height=700")
      if (!printWindow) {
        notify({ type: "error", message: "Unable to open print window. Please allow popups." })
        return
      }
      printWindow.document.open()
      printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Admission Summary - ${admission.id}</title></head><body>${html}</body></html>`)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 250)
    },
    [billingByAdmissionId, notify]
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Admission History</h3>
          <p className="text-sm text-slate-500">View completed and discharged admissions.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient/admission ID"
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={fetchHistory}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Admission ID</th>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Doctor</th>
              <th className="px-3 py-2 text-left">Room</th>
              <th className="px-3 py-2 text-left">Check-in</th>
              <th className="px-3 py-2 text-left">Check-out</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                  Loading history...
                </td>
              </tr>
            ) : filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-slate-500">
                  No admission history found.
                </td>
              </tr>
            ) : (
              filteredHistory.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">{item.id}</td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-800">{item.patientName || "Unknown"}</p>
                    <p className="text-xs text-slate-500">{item.patientId || "PID: N/A"}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{item.doctorName || "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{item.roomNumber || "—"}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {item.checkInAt ? new Date(item.checkInAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">
                    {item.checkOutAt ? new Date(item.checkOutAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedAdmission(item)}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handlePrintSummary(item)}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedAdmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900">Admission Details</h4>
                <p className="text-sm text-slate-500">
                  {selectedAdmission.patientName || "Unknown"} ({selectedAdmission.patientId || "PID: N/A"})
                </p>
              </div>
              <button
                onClick={() => setSelectedAdmission(null)}
                className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <p><span className="font-medium text-slate-900">Admission ID:</span> {selectedAdmission.id}</p>
                <p><span className="font-medium text-slate-900">Doctor:</span> {selectedAdmission.doctorName || "—"}</p>
                <p><span className="font-medium text-slate-900">Check-in:</span> {selectedAdmission.checkInAt ? new Date(selectedAdmission.checkInAt).toLocaleString() : "—"}</p>
                <p><span className="font-medium text-slate-900">Check-out:</span> {selectedAdmission.checkOutAt ? new Date(selectedAdmission.checkOutAt).toLocaleString() : "—"}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-600">Room Journey</p>
                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {(selectedAdmission.roomStays || []).length > 0 ? (
                    (selectedAdmission.roomStays || []).map((stay, index) => (
                      <p key={`${stay.roomId}-${stay.fromAt}-${index}`}>
                        {index + 1}. Room {stay.roomNumber} -{" "}
                        {stay.roomType === "custom" ? stay.customRoomTypeName || "Custom Room Type" : stay.roomType} -{" "}
                        {formatCurrency(Number(stay.ratePerDay || 0))}/day
                      </p>
                    ))
                  ) : (
                    <p>
                      Room {selectedAdmission.roomNumber} -{" "}
                      {selectedAdmission.roomType === "custom"
                        ? selectedAdmission.customRoomTypeName || "Custom Room Type"
                        : selectedAdmission.roomType}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase text-emerald-700">Billing</p>
                {billingByAdmissionId[selectedAdmission.id] ? (
                  <div className="mt-2 space-y-1 text-sm text-emerald-900">
                    <p>Bill ID: {billingByAdmissionId[selectedAdmission.id].id}</p>
                    <p>Room Charges: {formatCurrency(Number(billingByAdmissionId[selectedAdmission.id].roomCharges || 0))}</p>
                    <p>Doctor Fee: {formatCurrency(Number(billingByAdmissionId[selectedAdmission.id].doctorFee || 0))}</p>
                    {(billingByAdmissionId[selectedAdmission.id].otherServices || []).map((service, idx) => (
                      <p key={`${service.description}-${idx}`}>
                        {service.description}: {formatCurrency(Number(service.amount || 0))}
                      </p>
                    ))}
                    <p className="pt-1 font-semibold">
                      Total: {formatCurrency(Number(billingByAdmissionId[selectedAdmission.id].totalAmount || 0))}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-emerald-900">Billing details not found.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={() => selectedAdmission && handlePrintSummary(selectedAdmission)}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Print Summary
              </button>
              <button
                onClick={() => setSelectedAdmission(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

