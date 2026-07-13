"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { auth } from "@/firebase/config"
import BillingCollectionAnalytics from "@/components/billing/BillingCollectionAnalytics"
import {
  computeCollectionTrend,
  formatBillingCurrency,
  getCollectionPeriodRanges,
  sumPeriodMetrics,
} from "@/utils/billing/collectionAnalytics"

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
  paymentMethod?: "card" | "upi" | "cash"
  paidAt?: string | null
  paymentReference?: string | null
  transactionId?: string | null
  paidAtFrontDesk?: boolean
  handledBy?: string | null
  settlementMode?: string | null
  paymentType?: "full" | "partial"
  remainingAmount?: number
  branchId?: string | null
}

export default function BillingManagement({ selectedBranchId = "all" }: { selectedBranchId?: string } = {}) {
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

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error("You must be logged in to access billing records")
      }

      const token = await currentUser.getIdToken()

      const res = await fetch("/api/admin/billing-records", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to load billing records")
      }
      const data = await res.json().catch(() => ({}))
      let records = Array.isArray(data?.records) ? data.records : []

      if (selectedBranchId !== "all") {
        records = records.filter((record: UnifiedBillingRecord) => {
          if (!record.branchId) return true
          return record.branchId === selectedBranchId
        })
      }

      setBillingRecords(records as UnifiedBillingRecord[])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load billing records"
      setBillingError(message)
    } finally {
      setBillingLoading(false)
    }
  }, [selectedBranchId])

  useEffect(() => {
    fetchBillingRecords()
    const interval = setInterval(() => {
      fetchBillingRecords()
    }, 30000)
    return () => clearInterval(interval)
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
  const pageEnd =
    filteredBillingRecords.length === 0 ? 0 : Math.min(filteredBillingRecords.length, currentPage * BILLING_PAGE_SIZE)

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
    let lastPaymentAt: string | null = null

    billingRecords.forEach((record) => {
      const amount = record.totalAmount || 0
      totalBilled += amount

      if (record.type === "admission") admissionCount += 1
      else if (record.type === "appointment") appointmentCount += 1

      if (record.status === "paid") {
        totalCollected += amount
        paidCount += 1
        if (record.paidAt && (!lastPaymentAt || record.paidAt > lastPaymentAt)) {
          lastPaymentAt = record.paidAt
        }
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
      lastPaymentAt,
    }
  }, [billingRecords])

  const todayPeriodMetrics = useMemo(() => {
    const ranges = getCollectionPeriodRanges("today")
    return sumPeriodMetrics(billingRecords, ranges.current.start, ranges.current.end)
  }, [billingRecords])

  const todayCollectionTrend = useMemo(() => {
    const ranges = getCollectionPeriodRanges("today")
    const current = sumPeriodMetrics(billingRecords, ranges.current.start, ranges.current.end)
    const previous = sumPeriodMetrics(billingRecords, ranges.previous.start, ranges.previous.end)
    return computeCollectionTrend(current.collectionAmount, previous.collectionAmount)
  }, [billingRecords])

  const formatCurrency = formatBillingCurrency

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
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <p className="text-sm font-bold text-slate-900">Revenue & Analytics</p>
            <p className="text-[11px] text-slate-400">
              Unified collections from admissions and appointments · same source as Reception Billing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-700">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
              Live Sync
            </div>
            <button
              type="button"
              onClick={() => void fetchBillingRecords()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 xl:grid-cols-4 xl:divide-y-0">
          {(
            [
              {
                label: "Total Billed",
                value: formatCurrency(billingMetrics.totalBilled),
                sub: `${billingMetrics.totalCount} invoices issued`,
                trend: todayPeriodMetrics.invoicesCount > 0 ? `${todayPeriodMetrics.invoicesCount} today` : null,
                valueColor: "text-slate-800",
                top: "border-t-[3px] border-t-slate-400",
                iconBg: "bg-slate-100",
                iconColor: "text-slate-500",
                iconPath:
                  "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 2.5 2 2.5-2 3.5 2z",
              },
              {
                label: "Revenue Collected",
                value: formatCurrency(billingMetrics.totalCollected),
                sub: `${billingMetrics.paidCount} invoices settled`,
                trend:
                  todayPeriodMetrics.collectionAmount > 0
                    ? `${formatCurrency(todayPeriodMetrics.collectionAmount)} today · ${todayCollectionTrend.text} vs yesterday`
                    : `${todayCollectionTrend.text} vs yesterday`,
                trendUp: todayCollectionTrend.increased,
                valueColor: "text-emerald-700",
                top: "border-t-[3px] border-t-emerald-500",
                iconBg: "bg-emerald-50",
                iconColor: "text-emerald-600",
                iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                label: "Outstanding Dues",
                value: formatCurrency(billingMetrics.pendingAmount),
                sub: billingMetrics.pendingCount ? `${billingMetrics.pendingCount} unsettled` : "All cleared",
                trend: todayPeriodMetrics.pendingCount > 0 ? `${todayPeriodMetrics.pendingCount} due today` : null,
                valueColor: "text-amber-700",
                top: "border-t-[3px] border-t-amber-400",
                iconBg: "bg-amber-50",
                iconColor: "text-amber-600",
                iconPath: "M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z",
              },
              {
                label: "Average Bill Size",
                value:
                  billingMetrics.totalCount > 0
                    ? formatCurrency(Math.round(billingMetrics.totalBilled / billingMetrics.totalCount))
                    : "₹0",
                sub: billingMetrics.lastPaymentAt
                  ? `Last: ${new Date(billingMetrics.lastPaymentAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "2-digit",
                    })}`
                  : "No payments yet",
                trend:
                  billingMetrics.totalBilled > 0
                    ? `${Math.round((billingMetrics.totalCollected / billingMetrics.totalBilled) * 100)}% collected`
                    : null,
                valueColor: "text-sky-700",
                top: "border-t-[3px] border-t-sky-500",
                iconBg: "bg-sky-50",
                iconColor: "text-sky-600",
                iconPath:
                  "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
              },
            ] as const
          ).map((kpi) => (
            <div
              key={kpi.label}
              className={`group flex flex-col gap-3 bg-white px-5 py-5 transition-all duration-150 hover:bg-slate-50/70 ${kpi.top}`}
            >
              <div className="flex items-start justify-between">
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                  <svg className={`h-4 w-4 ${kpi.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={kpi.iconPath} />
                  </svg>
                </div>
                {kpi.trend && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      "trendUp" in kpi && kpi.trendUp
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "trendUp" in kpi && kpi.trendUp === false && String(kpi.trend).includes("%")
                          ? "border-red-200 bg-red-50 text-red-600"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {kpi.trend}
                  </span>
                )}
              </div>
              <div>
                <p className={`text-[1.6rem] font-bold leading-none tabular-nums ${kpi.valueColor}`}>{kpi.value}</p>
                <p className="mt-1.5 text-xs font-semibold text-slate-700">{kpi.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BillingCollectionAnalytics records={billingRecords} />

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Invoice History</h3>
            <p className="text-[11px] text-slate-400">
              {filteredBillingRecords.length} record{filteredBillingRecords.length !== 1 ? "s" : ""} · admissions &
              appointments
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="relative sm:w-48">
              <input
                type="date"
                value={billingDateFilter}
                onChange={(e) => setBillingDateFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-cyan-100"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
              {billingSearchTerm && (
                <button
                  type="button"
                  onClick={() => setBillingSearchTerm("")}
                  className="absolute inset-y-0 right-2 flex items-center text-sm text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Filter by Type</p>
            <div className="flex flex-wrap gap-2">
              {typeTabs.map((tab) => {
                const isActive = billingTypeFilter === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setBillingTypeFilter(tab.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "border-[var(--color-primary)] bg-cyan-50 text-cyan-800 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        isActive ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-500"
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Filter by Status</p>
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => {
                const isActive = billingStatusFilter === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setBillingStatusFilter(tab.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "border-[var(--color-primary)] bg-cyan-50 text-cyan-800 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        isActive ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-500"
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
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{billingError}</div>
        )}

        {billingLoading && billingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12">
            <p className="text-sm text-slate-500">Loading billing history…</p>
          </div>
        ) : billingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
            <p className="text-sm font-medium">No billing records yet</p>
            <p className="text-xs text-slate-400">
              Billing records appear when appointments are paid or patients are discharged.
            </p>
          </div>
        ) : filteredBillingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
            <p className="text-sm font-medium">No records match your filters.</p>
            <p className="text-xs text-slate-400">Try adjusting the search or status filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
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
                  record.status === "paid"
                    ? "Paid"
                    : record.status === "void"
                      ? "Voided"
                      : record.status === "cancelled"
                        ? "Cancelled"
                        : "Pending Settlement"
                return (
                  <article
                    key={record.id}
                    className="group rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                              record.type === "admission"
                                ? "bg-cyan-100 text-cyan-800"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {record.type === "admission" ? "Admission" : "Appointment"}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyle}`}
                          >
                            {statusLabel}
                          </span>
                          {(record.paymentMethod || record.settlementMode) && (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
                              {record.paymentMethod || record.settlementMode}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {record.patientName || record.patientId || "Patient"}
                          </p>
                          <p className="text-xs text-slate-500">
                            Dr. {record.doctorName || "—"} · ₹{(record.totalAmount || 0).toLocaleString("en-IN")}
                            {generatedAt ? ` · ${generatedAt.toLocaleString("en-IN")}` : ""}
                            {paidAt ? ` · Paid ${paidAt.toLocaleString("en-IN")}` : ""}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400">{record.id}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>
                  Showing {pageStart}–{pageEnd} of {filteredBillingRecords.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
