"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { auth } from "@/firebase/config"
import { useMultiHospital } from "@/contexts/MultiHospitalContext"
import { Button } from "@/components/ui/Button"
import { Admission, BillingRecord } from "@/types/patient"

interface AdmissionHistoryPanelProps {
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
}

export default function AdmissionHistoryPanel({ onNotification }: AdmissionHistoryPanelProps) {
  const { activeHospital } = useMultiHospital()
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
        ipdNo: item.ipdNo ? String(item.ipdNo) : undefined,
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
      const hospitalName = activeHospital?.name || "Hospital Management System"
      const hospitalAddress = activeHospital?.address || ""
      const hospitalPhone = activeHospital?.phone || ""
      const ipdLabel = admission.ipdNo?.trim() || admission.id
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
          const fromAt = stay.fromAt ? new Date(stay.fromAt).toLocaleString() : "N/A"
          const toAt = stay.toAt ? new Date(stay.toAt).toLocaleString() : "Discharge"
          return `
            <tr>
              <td>${idx + 1}</td>
              <td>${stay.roomNumber || "N/A"}</td>
              <td>${roomTypeLabel}</td>
              <td>${fromAt}</td>
              <td>${toAt}</td>
              <td class="right">${formatCurrency(Number(stay.ratePerDay || 0))}</td>
            </tr>
          `
        })
        .join("")

      const otherServicesRows =
        billing && Array.isArray(billing.otherServices) && billing.otherServices.length > 0
          ? billing.otherServices
              .map(
                (service) => `
                <tr>
                  <td>${service.description || "Service"}</td>
                  <td class="right">${formatCurrency(Number(service.amount || 0))}</td>
                </tr>
              `
              )
              .join("")
          : ""

      const billingLinesHtml = billing
        ? `
          <tr><td>Bill ID</td><td class="right">${billing.id}</td></tr>
          <tr><td>Room Charges</td><td class="right">${formatCurrency(Number(billing.roomCharges || 0))}</td></tr>
          <tr><td>Doctor Fee</td><td class="right">${formatCurrency(Number(billing.doctorFee || 0))}</td></tr>
          ${otherServicesRows}
          <tr class="total"><td>Total Amount</td><td class="right">${formatCurrency(Number(billing.totalAmount || 0))}</td></tr>
          <tr><td>Payment Status</td><td class="right" style="text-transform:capitalize">${billing.status}</td></tr>
          <tr><td>Payment Method</td><td class="right">${billing.paymentMethod || "N/A"}</td></tr>
          <tr><td>Paid At</td><td class="right">${billing.paidAt ? new Date(billing.paidAt).toLocaleString() : "N/A"}</td></tr>
          <tr><td>Reference</td><td class="right">${billing.paymentReference || "N/A"}</td></tr>
        `
        : `<tr><td colspan="2">Billing details not found for this admission.</td></tr>`

      const html = `
  <div class="page">
    <div class="header">
      <div>
        <p class="hospital">${hospitalName}</p>
        ${hospitalAddress ? `<p class="subtitle">${hospitalAddress}</p>` : ""}
        ${hospitalPhone ? `<p class="subtitle">Tel: ${hospitalPhone}</p>` : ""}
        <p class="title">Discharge & Billing Summary</p>
        <p class="subtitle">Official inpatient discharge statement</p>
      </div>
      <div class="meta">
        <p><span>IPD No:</span> ${ipdLabel}</p>
        <p><span>Admission ID:</span> ${admission.id}</p>
        <p><span>Generated:</span> ${new Date().toLocaleString()}</p>
      </div>
    </div>

    <div class="card">
      <h3>Admission Details</h3>
      <table class="info-table">
        <tr><td><strong>Patient</strong></td><td>${admission.patientName || "Unknown"}</td><td><strong>Patient ID</strong></td><td>${admission.patientId || "N/A"}</td></tr>
        <tr><td><strong>Doctor</strong></td><td>${admission.doctorName || "N/A"}</td><td><strong>Status</strong></td><td style="text-transform:capitalize">${admission.status}</td></tr>
        <tr><td><strong>Check-in</strong></td><td>${admission.checkInAt ? new Date(admission.checkInAt).toLocaleString() : "N/A"}</td><td><strong>Check-out</strong></td><td>${admission.checkOutAt ? new Date(admission.checkOutAt).toLocaleString() : "N/A"}</td></tr>
        <tr><td><strong>Address</strong></td><td colspan="3">${admission.patientAddress || "N/A"}</td></tr>
      </table>
    </div>

    <div class="card">
      <h3>Room Journey</h3>
      <table class="grid">
        <thead>
          <tr>
            <th>#</th>
            <th>Room</th>
            <th>Type</th>
            <th>From</th>
            <th>To</th>
            <th class="right">Rate / Day</th>
          </tr>
        </thead>
        <tbody>${roomJourneyHtml}</tbody>
      </table>
    </div>

    <div class="card">
      <h3>Billing Breakdown</h3>
      <table class="grid">${billingLinesHtml}</table>
    </div>

    <div class="signatures">
      <div>
        <p class="sig-label">Reception / Billing</p>
        <div class="sig-line"></div>
        <p class="sig-hint">Name & signature</p>
      </div>
      <div>
        <p class="sig-label">Patient / Attendant</p>
        <div class="sig-line"></div>
        <p class="sig-hint">Name & signature</p>
      </div>
    </div>
    <div class="footer-note">
      <p>Computer-generated discharge summary. Please verify all amounts before payment.</p>
    </div>
  </div>`

      const printWindow = window.open("", "_blank", "width=900,height=700")
      if (!printWindow) {
        notify({ type: "error", message: "Unable to open print window. Please allow popups." })
        return
      }
      printWindow.document.open()
      printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Admission Summary - ${admission.id}</title>
    <style>
      @page { size: A4; margin: 12mm; }
      body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; }
      .page { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
      .header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
      .hospital { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: #334155; text-transform: uppercase; }
      .title { margin: 6px 0 0; font-size: 22px; font-weight: 800; color: var(--color-primary-dark); }
      .header { border-bottom-color: var(--color-primary); }
      .subtitle { margin: 2px 0 0; font-size: 12px; color: #64748b; }
      .meta p { margin: 0 0 4px; font-size: 12px; text-align: right; }
      .meta span { font-weight: 700; color: #334155; }
      .card { margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
      .card h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #475569; }
      .info-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .info-table td { border-bottom: 1px dashed #e2e8f0; padding: 6px 4px; vertical-align: top; }
      .grid { width: 100%; border-collapse: collapse; font-size: 12px; }
      .grid th { background: #f1f5f9; color: #334155; text-align: left; padding: 7px 6px; border: 1px solid #e2e8f0; }
      .grid td { padding: 7px 6px; border: 1px solid #e2e8f0; }
      .right { text-align: right; }
      .total td { font-weight: 800; background: #ecfeff; }
      .signatures { display: flex; gap: 24px; margin-top: 16px; }
      .signatures > div { flex: 1; }
      .sig-label { margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; }
      .sig-line { border-bottom: 1px solid #94a3b8; height: 36px; margin: 8px 0 4px; }
      .sig-hint { margin: 0; font-size: 10px; color: #64748b; }
      .footer-note { margin-top: 10px; font-size: 11px; color: #64748b; text-align: center; }
      @media print {
        body { background: #fff; }
        .page { border: none; border-radius: 0; padding: 0; }
      }
    </style>
  </head>
  <body>${html}</body>
</html>`)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 250)
    },
    [activeHospital, billingByAdmissionId, notify]
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
          <Button type="button" variant="outline" size="sm" onClick={fetchHistory} loading={loading} loadingText="Refreshing...">
            Refresh
          </Button>
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
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAdmission(item)}>
                        View
                      </Button>
                      <Button type="button" variant="primary" size="sm" onClick={() => handlePrintSummary(item)}>
                        Print
                      </Button>
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
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => selectedAdmission && handlePrintSummary(selectedAdmission)}
              >
                Print Summary
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAdmission(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

