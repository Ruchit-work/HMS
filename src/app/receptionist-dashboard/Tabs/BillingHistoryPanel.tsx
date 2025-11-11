"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import PaymentMethodSection, {
  PaymentData as BillingPaymentData,
  PaymentMethodOption as BillingPaymentMethod,
} from "@/components/payments/PaymentMethodSection"
import { BillingRecord } from "@/types/patient"

interface BillingHistoryPanelProps {
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
}

const emptyPaymentData: BillingPaymentData = {
  cardNumber: "",
  cardName: "",
  expiryDate: "",
  cvv: "",
  upiId: "",
}

export default function BillingHistoryPanel({ onNotification }: BillingHistoryPanelProps) {
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [billingSearchTerm, setBillingSearchTerm] = useState("")
  const [billingPaymentModalOpen, setBillingPaymentModalOpen] = useState(false)
  const [selectedBillingRecord, setSelectedBillingRecord] = useState<BillingRecord | null>(null)
  const [billingPaymentMethod, setBillingPaymentMethod] = useState<BillingPaymentMethod>("cash")
  const [billingPaymentData, setBillingPaymentData] = useState<BillingPaymentData>(emptyPaymentData)
  const [processingBillingPayment, setProcessingBillingPayment] = useState(false)

  const notify = useCallback(
    (payload: { type: "success" | "error"; message: string } | null) => {
      onNotification?.(payload)
    },
    [onNotification]
  )

  const fetchBillingRecords = useCallback(async () => {
    try {
      setBillingLoading(true)
      setBillingError(null)
      const res = await fetch("/api/receptionist/billing-records")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load billing records")
      }
      const data = await res.json().catch(() => ({}))
      const records = Array.isArray(data?.records) ? data.records : []
      const formatted: BillingRecord[] = records.map((record: any) => ({
        id: String(record.id || ""),
        admissionId: String(record.admissionId || ""),
        appointmentId: record.appointmentId ? String(record.appointmentId) : undefined,
        patientId: String(record.patientId || ""),
        patientUid: record.patientUid || null,
        patientName: record.patientName || null,
        doctorId: String(record.doctorId || ""),
        doctorName: record.doctorName || null,
        roomCharges: Number(record.roomCharges || 0),
        doctorFee: record.doctorFee !== undefined ? Number(record.doctorFee) : undefined,
        otherServices: Array.isArray(record.otherServices) ? record.otherServices : [],
        totalAmount: Number(record.totalAmount || 0),
        generatedAt: record.generatedAt || new Date().toISOString(),
        status: record.status || "pending",
        paymentMethod: record.paymentMethod,
        paidAt: record.paidAt,
        paidAtFrontDesk: record.paidAtFrontDesk,
        paymentReference: record.paymentReference,
      }))
      setBillingRecords(formatted)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load billing records"
      setBillingError(message)
    } finally {
      setBillingLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBillingRecords()
  }, [fetchBillingRecords])

  const billingSearchValue = billingSearchTerm.trim().toLowerCase()
  const filteredBillingRecords = useMemo(() => {
    if (!billingSearchValue) return billingRecords
    return billingRecords.filter((record) => {
      const idMatch = record.patientId?.toLowerCase().includes(billingSearchValue)
      const nameMatch = record.patientName ? record.patientName.toLowerCase().includes(billingSearchValue) : false
      const billingIdMatch = record.id.toLowerCase().includes(billingSearchValue)
      return idMatch || nameMatch || billingIdMatch
    })
  }, [billingRecords, billingSearchValue])

  const handleOpenBillingPayment = useCallback(
    (record: BillingRecord) => {
      if (record.status === "paid") return
      setSelectedBillingRecord(record)
      setBillingPaymentMethod(
        record.paymentMethod && record.paymentMethod !== "demo"
          ? (record.paymentMethod as BillingPaymentMethod)
          : "cash"
      )
      setBillingPaymentData(emptyPaymentData)
      setBillingPaymentModalOpen(true)
    },
    []
  )

  const resetPaymentState = useCallback(() => {
    setBillingPaymentModalOpen(false)
    setSelectedBillingRecord(null)
    setBillingPaymentMethod("cash")
    setBillingPaymentData(emptyPaymentData)
    setProcessingBillingPayment(false)
  }, [])

  const handleConfirmBillingPayment = useCallback(async () => {
    if (!selectedBillingRecord) return
    setProcessingBillingPayment(true)
    try {
      const res = await fetch("/api/patient/billing/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingId: selectedBillingRecord.id,
          paymentMethod: billingPaymentMethod,
          actor: "receptionist",
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to record payment")
      }
      const data = await res.json().catch(() => ({}))
      setBillingRecords((prev) =>
        prev.map((record) =>
          record.id === selectedBillingRecord.id
            ? {
                ...record,
                status: "paid",
                paymentMethod: data?.paymentMethod || billingPaymentMethod,
                paidAt: data?.paidAt || new Date().toISOString(),
                paymentReference: data?.paymentReference || record.paymentReference || null,
                paidAtFrontDesk: true,
                handledBy: "receptionist",
                settlementMode: billingPaymentMethod,
              }
            : record
        )
      )
      notify({ type: "success", message: "Payment recorded successfully." })
      resetPaymentState()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to record payment."
      notify({ type: "error", message })
      setProcessingBillingPayment(false)
    }
  }, [billingPaymentMethod, notify, resetPaymentState, selectedBillingRecord])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Recent Billing History</h2>
          <p className="text-sm text-gray-500">Latest hospitalization bills generated during discharge</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative sm:w-72">
            <input
              type="text"
              value={billingSearchTerm}
              onChange={(e) => setBillingSearchTerm(e.target.value)}
              placeholder="Search bills by patient name or ID"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
            {billingSearchTerm && (
              <button
                type="button"
                onClick={() => setBillingSearchTerm("")}
                className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={fetchBillingRecords}
            disabled={billingLoading}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm"
          >
            {billingLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {billingError && (
        <div className="p-3 border border-red-200 rounded-lg bg-red-50 text-sm text-red-700 mb-4">
          {billingError}
        </div>
      )}

      {billingLoading && billingRecords.length === 0 ? (
        <div className="py-8 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          Loading billing history...
        </div>
      ) : billingRecords.length === 0 ? (
        <div className="py-8 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          Billing records will appear after discharges are completed.
        </div>
      ) : filteredBillingRecords.length === 0 ? (
        <div className="py-8 text-center text-gray-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
          No billing records match your search.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Generated</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Admission</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Patient</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Room Charges</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Doctor Fee</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Other Services</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredBillingRecords.map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {record.generatedAt ? new Date(record.generatedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 font-mono">{record.admissionId}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{record.patientName || "Unknown"}</span>
                      <span className="text-xs font-mono text-slate-500">ID: {record.patientId || "—"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700">₹{record.roomCharges}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">₹{record.doctorFee || 0}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">
                    {record.otherServices && record.otherServices.length > 0
                      ? record.otherServices.map((service, idx) => (
                          <div key={idx}>₹{service.amount} — {service.description}</div>
                        ))
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900 font-semibold">₹{record.totalAmount}</td>
                  <td className="px-3 py-2 text-sm">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : record.status === "void"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {record.status === "paid" ? "Paid" : record.status === "void" ? "Voided" : "Pending"}
                          {record.paymentMethod && record.status === "paid" && (
                            <span className="capitalize text-[11px]">· {record.paymentMethod}</span>
                          )}
                        </span>
                        {record.status !== "paid" && (
                          <button
                            onClick={() => handleOpenBillingPayment(record)}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                      {record.paidAt && (
                        <span className="text-[11px] text-slate-400">{new Date(record.paidAt).toLocaleString()}</span>
                      )}
                      {record.paidAtFrontDesk && record.status === "paid" && (
                        <span className="text-[11px] text-emerald-600">Settled at front desk</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {billingPaymentModalOpen && selectedBillingRecord && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Record Patient Payment</h3>
                <p className="text-sm text-slate-500">
                  Patient ID {selectedBillingRecord.patientId || "Unknown"} • Bill #{selectedBillingRecord.id.slice(0, 6).toUpperCase()}
                </p>
              </div>
              <button
                onClick={resetPaymentState}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 text-xl"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide mb-2">Bill Summary</p>
                <div className="flex items-center justify-between text-slate-800">
                  <span className="text-sm">Total amount due</span>
                  <span className="text-2xl font-bold text-slate-900">₹{selectedBillingRecord.totalAmount}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Generated on {selectedBillingRecord.generatedAt ? new Date(selectedBillingRecord.generatedAt).toLocaleString() : "N/A"}
                </p>
              </div>
              <div>
                <PaymentMethodSection
                  title="Payment method"
                  paymentMethod={billingPaymentMethod}
                  setPaymentMethod={(method) => setBillingPaymentMethod(method)}
                  paymentData={billingPaymentData}
                  setPaymentData={setBillingPaymentData}
                  amountToPay={selectedBillingRecord.totalAmount}
                  walletBalance={undefined}
                  methods={["cash", "card", "upi", "wallet"]}
                />
                {billingPaymentMethod === "wallet" && (
                  <p className="text-xs text-amber-600 mt-2">
                    Ensure the patient has sufficient wallet balance before confirming.
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={resetPaymentState}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all"
                disabled={processingBillingPayment}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBillingPayment}
                disabled={processingBillingPayment}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-60"
              >
                {processingBillingPayment ? "Recording..." : `Record ₹${selectedBillingRecord.totalAmount}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
