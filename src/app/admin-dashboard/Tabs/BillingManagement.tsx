"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { auth } from "@/firebase/config"
import RefreshButton from "@/components/ui/RefreshButton"

const BILLING_PAGE_SIZE = 10

interface UnifiedBillingRecord {
  id: string
  type: "admission" | "appointment"
  admissionId?: string
  appointmentId?: string
  patientId: string
  patientUid?: string | null
  patientName?: string | null
  doctorId: string
  doctorName?: string | null
  roomCharges?: number
  doctorFee?: number
  consultationFee?: number
  otherServices?: Array<{ description: string; amount: number }>
  totalAmount: number
  generatedAt: string
  status: "pending" | "paid" | "void" | "cancelled"
  paymentMethod?: "card" | "upi" | "cash" | "wallet" | "demo"
  paidAt?: string | null
  paymentReference?: string | null
  transactionId?: string | null
  paidAtFrontDesk?: boolean
  handledBy?: string | null
  settlementMode?: string | null
  paymentType?: "full" | "partial"
  remainingAmount?: number
}

export default function BillingManagement() {
  const [billingRecords, setBillingRecords] = useState<UnifiedBillingRecord[]>([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [billingSearchTerm, setBillingSearchTerm] = useState("")
  const [billingDateFilter, setBillingDateFilter] = useState("")
  const [billingStatusFilter, setBillingStatusFilter] = useState<"all" | "pending" | "paid" | "void" | "cancelled">("all")
  const [billingTypeFilter, setBillingTypeFilter] = useState<"all" | "admission" | "appointment">("all")
  const [currentPage, setCurrentPage] = useState(1)

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

      const res = await fetch("/api/admin/billing-records", {
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
      setBillingRecords(records as UnifiedBillingRecord[])
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
  const typeFilteredRecords = useMemo(() => {
    if (billingTypeFilter === "all") return billingRecords
    return billingRecords.filter((record) => record.type === billingTypeFilter)
  }, [billingRecords, billingTypeFilter])

  const statusFilteredRecords = useMemo(() => {
    if (billingStatusFilter === "all") return typeFilteredRecords
    return typeFilteredRecords.filter((record) => {
      if (billingStatusFilter === "pending") {
        return record.status !== "paid" && record.status !== "void" && record.status !== "cancelled"
      }
      return record.status === billingStatusFilter
    })
  }, [typeFilteredRecords, billingStatusFilter])

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
      const doctorNameMatch = record.doctorName ? record.doctorName.toLowerCase().includes(billingSearchValue) : false
      return idMatch || nameMatch || billingIdMatch || doctorNameMatch
    })
  }, [statusFilteredRecords, billingSearchValue, billingDateFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [billingStatusFilter, billingTypeFilter, billingSearchValue, billingDateFilter])

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
    let cancelledCount = 0
    let admissionCount = 0
    let appointmentCount = 0

    billingRecords.forEach((record) => {
      const amount = record.totalAmount || 0
      totalBilled += amount

      if (record.type === "admission") {
        admissionCount += 1
      } else if (record.type === "appointment") {
        appointmentCount += 1
      }

      if (record.status === "paid") {
        totalCollected += amount
        paidCount += 1
      } else if (record.status === "void") {
        voidCount += 1
      } else if (record.status === "cancelled") {
        cancelledCount += 1
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
      cancelledCount,
      admissionCount,
      appointmentCount,
      totalCount: billingRecords.length,
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
        caption: `${billingMetrics.voidCount} voided bills`,
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
      { value: "cancelled" as const, label: "Cancelled", count: billingMetrics.cancelledCount },
    ],
    [billingMetrics]
  )

  const typeTabs = useMemo(
    () => [
      { value: "all" as const, label: "All Types", count: billingMetrics.totalCount },
      { value: "admission" as const, label: "Admissions", count: billingMetrics.admissionCount },
      { value: "appointment" as const, label: "Appointments", count: billingMetrics.appointmentCount },
    ],
    [billingMetrics]
  )

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-purple-800 text-white shadow-lg">
        <div className="relative px-6 py-10 sm:px-10">
          <div className="absolute inset-y-0 right-0 hidden w-48 translate-x-16 rotate-12 rounded-full bg-white/10 blur-3xl sm:block" />
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-200/80">
                Billing & Payments
              </p>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                Monitor all billing records and payments.
              </h2>
              <p className="text-sm text-purple-100/90 sm:text-base">
                View comprehensive billing history, track revenue, and monitor outstanding dues across all appointments and admissions.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-purple-100/90">
                <span className="rounded-full border border-purple-300/50 px-3 py-1 font-semibold uppercase tracking-wide">
                  Complete overview
                </span>
                <span className="rounded-full border border-purple-300/50 px-3 py-1 font-semibold uppercase tracking-wide">
                  Revenue tracking
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-100/90">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
                  <p className="mt-2 text-[12px] text-purple-100/80">{card.caption}</p>
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
            <h3 className="text-xl font-semibold text-slate-900">Billing History</h3>
            <p className="text-sm text-slate-500">All billing records from appointments and patient admissions.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="relative sm:w-48">
              <input
                type="date"
                value={billingDateFilter}
                onChange={(e) => setBillingDateFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 pr-10 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
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
                placeholder="Search by patient name, ID, doctor name, or bill ID"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
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
            <RefreshButton
              onClick={fetchBillingRecords}
              loading={billingLoading}
              variant="gray"
              label="Refresh"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Filter by Type</p>
            <div className="flex flex-wrap gap-2">
              {typeTabs.map((tab) => {
                const isActive = billingTypeFilter === tab.value
                return (
                  <button
                    key={tab.value}
                    onClick={() => setBillingTypeFilter(tab.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        isActive ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Filter by Status</p>
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => {
                const isActive = billingStatusFilter === tab.value
                return (
                  <button
                    key={tab.value}
                    onClick={() => setBillingStatusFilter(tab.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        isActive ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
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
            <p className="text-sm font-medium">No billing records yet</p>
            <p className="text-xs text-slate-400">Billing records appear when appointments are paid or patients are discharged.</p>
          </div>
        ) : filteredBillingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
            <span className="mb-2 text-4xl">🔍</span>
            <p className="text-sm font-medium">No records match your filters.</p>
            <p className="text-xs text-slate-400">Try adjusting the search or status filter.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
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
                  record.status === "paid" ? "Paid" : 
                  record.status === "void" ? "Voided" : 
                  record.status === "cancelled" ? "Cancelled" : 
                  "Pending Settlement"
                return (
                  <article
                    key={record.id}
                    className="group rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                            record.type === "admission" 
                              ? "bg-blue-100 text-blue-700" 
                              : "bg-green-100 text-green-700"
                          }`}>
                            {record.type === "admission" ? "🏥 Admission" : "📅 Appointment"}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {record.type === "admission" ? "Bill" : "Payment"} #{record.id.slice(0, 8).toUpperCase()}
                          </span>
                          {record.admissionId && (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-500">
                              Admission {record.admissionId.slice(0, 8)}
                            </span>
                          )}
                          {record.appointmentId && (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-500">
                              Appointment {record.appointmentId.slice(0, 8)}
                            </span>
                          )}
                        </div>

                        <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">
                              {record.type === "admission" ? "Generated" : "Paid"}
                            </p>
                            <p className="font-semibold text-slate-800">{generatedAt ? generatedAt.toLocaleString() : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Patient</p>
                            <p className="font-semibold text-slate-800">
                              {record.patientName || "Unknown"}{" "}
                              <span className="ml-1 text-xs font-mono text-slate-500">
                                (ID {record.patientId || "N/A"})
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Doctor</p>
                            <p className="font-semibold text-slate-800">{record.doctorName || "—"}</p>
                          </div>
                          {record.type === "admission" ? (
                            <>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">Room Charges</p>
                                <p className="font-semibold text-slate-800">{formatCurrency(record.roomCharges || 0)}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-slate-400">Doctor Fee</p>
                                <p className="font-semibold text-slate-800">{formatCurrency(record.doctorFee || 0)}</p>
                              </div>
                            </>
                          ) : (
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Consultation Fee</p>
                              <p className="font-semibold text-slate-800">{formatCurrency(record.consultationFee || 0)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Total Amount</p>
                            <p className="text-lg font-bold text-slate-900">{formatCurrency(record.totalAmount)}</p>
                          </div>
                          {record.type === "appointment" && record.remainingAmount !== undefined && record.remainingAmount > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Remaining Amount</p>
                              <p className="font-semibold text-amber-600">{formatCurrency(record.remainingAmount)}</p>
                            </div>
                          )}
                          {record.type === "appointment" && record.paymentType && (
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-400">Payment Type</p>
                              <p className="font-semibold text-slate-800 capitalize">{record.paymentType}</p>
                            </div>
                          )}
                        </div>

                        {record.otherServices && record.otherServices.length > 0 && (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Additional services
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {record.otherServices.map((service, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600"
                                >
                                  {service.description || "Service"} · {formatCurrency(Number(service.amount) || 0)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex w-full flex-col gap-3 sm:max-w-[200px]">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${statusStyle}`}>
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
                          {record.paymentReference && (
                            <span className="text-[11px] text-slate-500 font-mono">Ref: {record.paymentReference}</span>
                          )}
                        </div>
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
                        : "border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
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
                        : "border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
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
    </div>
  )
}

