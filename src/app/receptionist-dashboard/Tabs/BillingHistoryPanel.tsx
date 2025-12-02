"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { auth, db } from "@/firebase/config"
import { collection, onSnapshot, query, orderBy } from "firebase/firestore"
import PaymentMethodSection, {
  PaymentData as BillingPaymentData,
  PaymentMethodOption as BillingPaymentMethod,
} from "@/components/payments/PaymentMethodSection"
import { BillingRecord } from "@/types/patient"

// Show more billing records per page now that cards are more compact
const BILLING_PAGE_SIZE = 10

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
  const [billingDateFilter, setBillingDateFilter] = useState("")
  const [billingPaymentModalOpen, setBillingPaymentModalOpen] = useState(false)
  const [selectedBillingRecord, setSelectedBillingRecord] = useState<BillingRecord | null>(null)
  const [billingPaymentMethod, setBillingPaymentMethod] = useState<BillingPaymentMethod>("cash")
  const [billingPaymentData, setBillingPaymentData] = useState<BillingPaymentData>(emptyPaymentData)
  const [processingBillingPayment, setProcessingBillingPayment] = useState(false)
  const [billingStatusFilter, setBillingStatusFilter] = useState<"all" | "pending" | "paid" | "void">("all")
  const [currentPage, setCurrentPage] = useState(1)

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

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to access billing records")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch("/api/receptionist/billing-records", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load billing records")
      }
      const data = await res.json().catch(() => ({}))
      const records = Array.isArray(data?.records) ? data.records : []
      const formatted: BillingRecord[] = records.map((record: any) => ({
        id: String(record.id || ""),
        type: record.type || "admission", // Default to admission for backward compatibility
        admissionId: record.admissionId ? String(record.admissionId) : undefined,
        appointmentId: record.appointmentId ? String(record.appointmentId) : undefined,
        patientId: String(record.patientId || ""),
        patientUid: record.patientUid || null,
        patientName: record.patientName || null,
        doctorId: String(record.doctorId || ""),
        doctorName: record.doctorName || null,
        roomCharges: record.roomCharges !== undefined ? Number(record.roomCharges) : undefined,
        doctorFee: record.doctorFee !== undefined ? Number(record.doctorFee) : undefined,
        consultationFee: record.consultationFee !== undefined ? Number(record.consultationFee) : undefined,
        otherServices: Array.isArray(record.otherServices) ? record.otherServices : [],
        totalAmount: Number(record.totalAmount || 0),
        generatedAt: record.generatedAt || new Date().toISOString(),
        status: record.status || "pending",
        paymentMethod: record.paymentMethod,
        paidAt: record.paidAt,
        paymentReference: record.paymentReference,
        transactionId: record.transactionId || null,
        paidAtFrontDesk: record.paidAtFrontDesk,
        handledBy: record.handledBy || null,
        settlementMode: record.settlementMode || null,
        paymentType: record.paymentType || "full",
        remainingAmount: record.remainingAmount !== undefined ? Number(record.remainingAmount) : undefined,
        hospitalId: record.hospitalId || null,
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
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchBillingRecords()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [fetchBillingRecords])

  const billingSearchValue = billingSearchTerm.trim().toLowerCase()
  const statusFilteredRecords = useMemo(() => {
    if (billingStatusFilter === "all") return billingRecords
    return billingRecords.filter((record) => {
      if (billingStatusFilter === "pending") {
        return record.status !== "paid" && record.status !== "void"
      }
      return record.status === billingStatusFilter
    })
  }, [billingRecords, billingStatusFilter])

  const filteredBillingRecords = useMemo(() => {
    let filtered = statusFilteredRecords

    if (billingDateFilter) {
      filtered = filtered.filter((record) => {
        if (!record.generatedAt) return false
        const formattedDate = new Date(record.generatedAt).toISOString().slice(0, 10)
        return formattedDate === billingDateFilter
      })
    }

    if (!billingSearchValue) return filtered

    return filtered.filter((record) => {
      const idMatch = record.patientId?.toLowerCase().includes(billingSearchValue)
      const nameMatch = record.patientName ? record.patientName.toLowerCase().includes(billingSearchValue) : false
      const billingIdMatch = record.id.toLowerCase().includes(billingSearchValue)
      return idMatch || nameMatch || billingIdMatch
    })
  }, [statusFilteredRecords, billingSearchValue, billingDateFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [billingStatusFilter, billingSearchValue, billingDateFilter])

  const totalPages = Math.max(1, Math.ceil(filteredBillingRecords.length / BILLING_PAGE_SIZE))

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const paginatedBillingRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * BILLING_PAGE_SIZE
    return filteredBillingRecords.slice(startIndex, startIndex + BILLING_PAGE_SIZE)
  }, [filteredBillingRecords, currentPage])

  const pageStart = filteredBillingRecords.length === 0 ? 0 : (currentPage - 1) * BILLING_PAGE_SIZE + 1
  const pageEnd = filteredBillingRecords.length === 0 ? 0 : Math.min(filteredBillingRecords.length, currentPage * BILLING_PAGE_SIZE)

  const billingMetrics = useMemo(() => {
    let totalBilled = 0
    let totalCollected = 0
    let pendingAmount = 0
    let paidCount = 0
    let pendingCount = 0
    let voidCount = 0
    let lastPaymentAt: string | null = null

    billingRecords.forEach((record) => {
      const amount = record.totalAmount || 0
      totalBilled += amount

      if (record.status === "paid") {
        totalCollected += amount
        paidCount += 1
        if (record.paidAt) {
          if (!lastPaymentAt || new Date(record.paidAt) > new Date(lastPaymentAt)) {
            lastPaymentAt = record.paidAt
          }
        }
      } else if (record.status === "void") {
        voidCount += 1
      } else {
        pendingAmount += amount
        pendingCount += 1
      }
    })

    return {
      totalBilled,
      totalCollected,
      pendingAmount,
      paidCount,
      pendingCount,
      voidCount,
      totalCount: billingRecords.length,
      lastPaymentAt,
    }
  }, [billingRecords])

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString()}`

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Total Billed",
        value: formatCurrency(billingMetrics.totalBilled),
        caption: `${billingMetrics.totalCount} invoices issued`,
        icon: "🧾",
        tone: "from-slate-500 to-slate-700",
      },
      {
        label: "Revenue Collected",
        value: formatCurrency(billingMetrics.totalCollected),
        caption: `${billingMetrics.paidCount} invoices settled`,
        icon: "💰",
        tone: "from-emerald-500 to-teal-500",
      },
      {
        label: "Outstanding Dues",
        value: formatCurrency(billingMetrics.pendingAmount),
        caption: billingMetrics.pendingCount ? `${billingMetrics.pendingCount} unsettled bills` : "All clear",
        icon: "⏳",
        tone: "from-amber-500 to-orange-500",
      },
      {
        label: "Average Bill Size",
        value:
          billingMetrics.totalCount > 0
            ? formatCurrency(Math.round(billingMetrics.totalBilled / billingMetrics.totalCount))
            : "₹0",
        caption: billingMetrics.lastPaymentAt
          ? `Last payment ${new Date(billingMetrics.lastPaymentAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "2-digit",
            })}`
          : "No payments yet",
        icon: "📊",
        tone: "from-sky-500 to-cyan-500",
      },
    ]
  }, [billingMetrics])

  const statusTabs = useMemo(
    () => [
      { value: "all" as const, label: "All", count: billingMetrics.totalCount },
      { value: "pending" as const, label: "Pending", count: billingMetrics.pendingCount },
      { value: "paid" as const, label: "Paid", count: billingMetrics.paidCount },
      { value: "void" as const, label: "Voided", count: billingMetrics.voidCount },
    ],
    [billingMetrics]
  )

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
      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to process payments")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch("/api/patient/billing/pay", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billingId: selectedBillingRecord.id,
          paymentMethod: billingPaymentMethod,
          actor: "receptionist",
          type: selectedBillingRecord.type, // Pass type to help API identify collection
          // Pass hospitalId so API can find hospital-scoped appointment billing
          hospitalId: selectedBillingRecord.hospitalId,
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
                transactionId: data?.transactionId || record.transactionId || null,
                paidAtFrontDesk: record.type === "admission" ? true : false, // Only for admission billing
                handledBy: record.type === "admission" ? "receptionist" : record.handledBy || null,
                settlementMode: record.type === "admission" ? billingPaymentMethod : record.settlementMode || null,
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
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-800 text-white shadow-lg">
        <div className="relative px-6 py-10 sm:px-10">
          <div className="absolute inset-y-0 right-0 hidden w-48 translate-x-16 rotate-12 rounded-full bg-white/10 blur-3xl sm:block" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                Billing Desk
              </p>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                Track revenue and outstanding dues instantly.
              </h2>
              <p className="text-sm text-emerald-100/90 sm:text-base">
                Keep tabs on discharge billing, record front-desk payments, and spot outstanding balances before patients
                leave the hospital.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-emerald-100/90">
                <span className="rounded-full border border-emerald-300/50 px-3 py-1 font-semibold uppercase tracking-wide">
                  Front-desk settlement
                </span>
                <span className="rounded-full border border-emerald-300/50 px-3 py-1 font-semibold uppercase tracking-wide">
                  Outstanding insights
                </span>
              </div>
            </div>
            <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/15 p-4 shadow-md backdrop-blur"
                >
                  <div className="absolute right-3 top-3 text-lg">{card.icon}</div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100/90">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                  <p className="mt-2 text-[12px] text-emerald-100/80">{card.caption}</p>
                  <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${card.tone} opacity-20`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Recent Billing History</h3>
            <p className="text-sm text-slate-500">Latest invoices generated during patient discharge.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="relative sm:w-48">
              <input
                type="date"
                value={billingDateFilter}
                onChange={(e) => setBillingDateFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 pr-10 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              {billingDateFilter && (
                <button
                  type="button"
                  onClick={() => setBillingDateFilter("")}
                  className="absolute inset-y-0 right-2 flex items-center rounded-full bg-white px-2 text-slate-400 shadow-sm hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="relative sm:w-72">
              <input
                type="text"
                value={billingSearchTerm}
                onChange={(e) => setBillingSearchTerm(e.target.value)}
                placeholder="Search bills by patient name or ID"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span>Auto-Refresh</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => {
            const isActive = billingStatusFilter === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setBillingStatusFilter(tab.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {billingError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {billingError}
          </div>
        )}

        {billingLoading && billingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-sm text-slate-500">
            Loading billing history…
          </div>
        ) : billingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
            <span className="mb-2 text-4xl">📄</span>
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="text-xs text-slate-400">Bills appear once patients are discharged.</p>
          </div>
        ) : filteredBillingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
            <span className="mb-2 text-4xl">🔍</span>
            <p className="text-sm font-medium">No records match your filters.</p>
            <p className="text-xs text-slate-400">Try adjusting the search or status filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {paginatedBillingRecords.map((record) => {
                const generatedAt = record.generatedAt ? new Date(record.generatedAt) : null
                const paidAt = record.paidAt ? new Date(record.paidAt) : null
                const statusStyle =
                  record.status === "paid"
                    ? "bg-emerald-100 text-emerald-700"
                    : record.status === "void"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-700"
                const statusLabel =
                  record.status === "paid" ? "Paid" : record.status === "void" ? "Voided" : "Pending Settlement"
                return (
                  <article
                    key={record.id}
                    className="group rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            Bill #{record.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            record.type === "appointment" 
                              ? "bg-blue-100 text-blue-700 border border-blue-200" 
                              : "bg-purple-100 text-purple-700 border border-purple-200"
                          }`}>
                            {record.type === "appointment" ? "Appointment" : "Admission"}
                          </span>
                          {record.admissionId && (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-500">
                              Admission {record.admissionId}
                            </span>
                          )}
                          {record.appointmentId && (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-500">
                              Appointment {record.appointmentId.slice(0, 8)}
                            </span>
                          )}
                        </div>

                        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Generated</p>
                            <p className="font-semibold text-slate-800">{generatedAt ? generatedAt.toLocaleString() : "—"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Patient</p>
                            <p className="font-semibold text-slate-800">
                              {record.patientName || "Unknown"}{" "}
                              <span className="ml-1 text-xs font-mono text-slate-500">
                                (ID {record.patientId || "N/A"})
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Doctor</p>
                            <p className="font-semibold text-slate-800">{record.doctorName || "—"}</p>
                          </div>
                          {record.type === "appointment" ? (
                            <>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-slate-400">Consultation Fee</p>
                                <p className="font-semibold text-slate-800">{formatCurrency(record.consultationFee || 0)}</p>
                              </div>
                              {record.paymentType === "partial" && record.remainingAmount !== undefined && (
                                <div>
                                <p className="text-[11px] uppercase tracking-wide text-slate-400">Remaining Amount</p>
                                  <p className="font-semibold text-amber-600">{formatCurrency(record.remainingAmount)}</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-slate-400">Room Charges</p>
                                <p className="font-semibold text-slate-800">{formatCurrency(record.roomCharges || 0)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-slate-400">Doctor Fee</p>
                                <p className="font-semibold text-slate-800">{formatCurrency(record.doctorFee || 0)}</p>
                              </div>
                            </>
                          )}
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Total Amount</p>
                            <p className="text-base font-bold text-slate-900">{formatCurrency(record.totalAmount)}</p>
                          </div>
                        </div>

                        {record.otherServices && record.otherServices.length > 0 && (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Additional services
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {record.otherServices.map((service, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                                >
                                  {service.description || "Service"} · {formatCurrency(Number(service.amount) || 0)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:max-w-[190px] text-xs">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px] font-semibold ${statusStyle}`}>
                            <span>{statusLabel}</span>
                            {record.paymentMethod && record.status === "paid" && (
                              <span className="capitalize text-[11px] opacity-80">via {record.paymentMethod}</span>
                            )}
                          </span>
                          {paidAt && (
                            <span className="text-[11px] text-emerald-600">
                              Settled on {paidAt.toLocaleDateString()} at {paidAt.toLocaleTimeString()}
                            </span>
                          )}
                          {record.paidAtFrontDesk && record.status === "paid" && (
                            <span className="text-[11px] text-emerald-600">Collected at front desk</span>
                          )}
                        </div>

                        {record.status !== "paid" && record.status !== "void" && (
                          <button
                            onClick={() => handleOpenBillingPayment(record)}
                            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {pageStart.toLocaleString("en-IN")}–{pageEnd.toLocaleString("en-IN")} of {filteredBillingRecords.length.toLocaleString("en-IN")} bills
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`inline-flex items-center rounded-lg border px-3 py-1.5 font-semibold transition ${
                      currentPage === 1
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    Previous
                  </button>
                  <span className="text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`inline-flex items-center rounded-lg border px-3 py-1.5 font-semibold transition ${
                      currentPage === totalPages
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

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
                  <span className="text-2xl font-bold text-slate-900">{formatCurrency(selectedBillingRecord.totalAmount)}</span>
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
                  methods={["cash", "card", "upi"]}
                />
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
                {processingBillingPayment ? "Recording..." : `Record ${formatCurrency(selectedBillingRecord.totalAmount)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
