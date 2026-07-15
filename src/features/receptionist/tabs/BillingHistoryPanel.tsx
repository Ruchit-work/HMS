"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from '@/shared/components'
import PaymentMethodSection, {
  PaymentData as BillingPaymentData,
  PaymentMethodOption as BillingPaymentMethod,
} from "@/features/payments/PaymentMethodSection"
import { BillingRecord } from "@/types/patient"
import { authedFetchJson } from "@/utils/client/authedFetch"

// Show more billing records per page now that cards are more compact
const BILLING_PAGE_SIZE = 10

type CollectionPeriod = "today" | "weekly" | "monthly" | "yearly"

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

function isInDateRange(dateStr: string | null | undefined, start: Date, end: Date) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= start && d <= end
}

function getCollectionPeriodRanges(period: CollectionPeriod, now = new Date()) {
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  switch (period) {
    case "today": {
      const yesterday = new Date(todayStart)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        current: { start: todayStart, end: todayEnd },
        previous: { start: startOfDay(yesterday), end: endOfDay(yesterday) },
        previousLabel: "yesterday",
        periodLabel: "Today",
      }
    }
    case "weekly": {
      const day = now.getDay()
      const mondayOffset = day === 0 ? -6 : 1 - day
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() + mondayOffset)

      const prevWeekEnd = new Date(weekStart)
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 1)
      const prevWeekStart = new Date(prevWeekEnd)
      const prevDay = prevWeekEnd.getDay()
      const prevMondayOffset = prevDay === 0 ? -6 : 1 - prevDay
      prevWeekStart.setDate(prevWeekStart.getDate() + prevMondayOffset)

      return {
        current: { start: weekStart, end: todayEnd },
        previous: { start: prevWeekStart, end: endOfDay(prevWeekEnd) },
        previousLabel: "last week",
        periodLabel: "This Week",
      }
    }
    case "monthly": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      return {
        current: { start: monthStart, end: todayEnd },
        previous: { start: prevMonthStart, end: prevMonthEnd },
        previousLabel: "last month",
        periodLabel: "This Month",
      }
    }
    case "yearly": {
      const yearStart = new Date(now.getFullYear(), 0, 1)
      const prevYearStart = new Date(now.getFullYear() - 1, 0, 1)
      const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
      return {
        current: { start: yearStart, end: todayEnd },
        previous: { start: prevYearStart, end: prevYearEnd },
        previousLabel: "last year",
        periodLabel: "This Year",
      }
    }
  }
}

function sumPeriodMetrics(records: BillingRecord[], start: Date, end: Date) {
  const paid = records.filter((r) => r.status === "paid" && isInDateRange(r.paidAt, start, end))
  const cash = paid.filter((r) => r.paymentMethod === "cash" || r.settlementMode === "cash")
  const upi = paid.filter((r) => r.paymentMethod === "upi" || r.settlementMode === "upi")
  const card = paid.filter((r) => r.paymentMethod === "card" || r.settlementMode === "card")
  const generatedInPeriod = records.filter((r) => isInDateRange(r.generatedAt, start, end))
  const pending = generatedInPeriod.filter((r) => r.status !== "paid" && r.status !== "void")

  const collectionAmount = paid.reduce((sum, r) => sum + (r.totalAmount || 0), 0)

  return {
    collectionAmount,
    cashAmount: cash.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    upiAmount: upi.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    cardAmount: card.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    paidCount: paid.length,
    invoicesCount: generatedInPeriod.length,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
    avgBillSize: paid.length > 0 ? Math.round(collectionAmount / paid.length) : 0,
  }
}

function computeCollectionTrend(current: number, previous: number) {
  if (current === 0 && previous === 0) {
    return { direction: "flat" as const, percent: 0, text: "No change", increased: false }
  }
  if (previous === 0) {
    return { direction: "up" as const, percent: 100, text: "+100%", increased: true }
  }

  const percent = Math.round(((current - previous) / previous) * 100)
  if (percent > 0) {
    return { direction: "up" as const, percent, text: `+${percent}%`, increased: true }
  }
  if (percent < 0) {
    return { direction: "down" as const, percent, text: `${percent}%`, increased: false }
  }
  return { direction: "flat" as const, percent: 0, text: "No change", increased: false }
}

interface BillingHistoryPanelProps {
  onNotification?: (_payload: { type: "success" | "error"; message: string } | null) => void
  focusBillingQuery?: string | null
  onFocusHandled?: () => void
}

const emptyPaymentData: BillingPaymentData = {
  cardNumber: "",
  cardName: "",
  expiryDate: "",
  cvv: "",
  upiId: "",
}

export default function BillingHistoryPanel({
  onNotification,
  focusBillingQuery,
  onFocusHandled,
}: BillingHistoryPanelProps) {
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
  const [billingTypeFilter, setBillingTypeFilter] = useState<"all" | "admission" | "appointment">("all")
  const [collectionPeriod, setCollectionPeriod] = useState<CollectionPeriod>("today")
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
      const data = await authedFetchJson<{ records?: any[] }>(
        "/api/receptionist/billing-records",
        {},
        "Failed to load billing records"
      )
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
        paymentTerms: record.paymentTerms || "standard",
        packageSummary: record.packageSummary || null,
        chargeLineItems: Array.isArray(record.chargeLineItems) ? record.chargeLineItems : [],
        grossTotal: record.grossTotal !== undefined ? Number(record.grossTotal) : undefined,
        netPayable: record.netPayable !== undefined ? Number(record.netPayable) : undefined,
        refundAmount: record.refundAmount !== undefined ? Number(record.refundAmount) : undefined,
        depositSummary: record.depositSummary || null,
        depositTransactions: Array.isArray(record.depositTransactions) ? record.depositTransactions : [],
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

  useEffect(() => {
    if (!focusBillingQuery) return
    setBillingSearchTerm(focusBillingQuery)
    setBillingStatusFilter("all")
    setCurrentPage(1)
    onFocusHandled?.()
  }, [focusBillingQuery, onFocusHandled])

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

    if (billingTypeFilter !== "all") {
      filtered = filtered.filter((record) => record.type === billingTypeFilter)
    }

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
      const admissionIdMatch = record.admissionId ? record.admissionId.toLowerCase().includes(billingSearchValue) : false
      return idMatch || nameMatch || billingIdMatch || admissionIdMatch
    })
  }, [statusFilteredRecords, billingSearchValue, billingDateFilter, billingTypeFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [billingStatusFilter, billingSearchValue, billingDateFilter, billingTypeFilter])

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

  const collectionPeriodMetrics = useMemo(() => {
    const ranges = getCollectionPeriodRanges(collectionPeriod)
    const current = sumPeriodMetrics(billingRecords, ranges.current.start, ranges.current.end)
    const previous = sumPeriodMetrics(billingRecords, ranges.previous.start, ranges.previous.end)
    const trend = computeCollectionTrend(current.collectionAmount, previous.collectionAmount)

    return {
      ...current,
      previousCollectionAmount: previous.collectionAmount,
      previousPaidCount: previous.paidCount,
      trend,
      periodLabel: ranges.periodLabel,
      previousLabel: ranges.previousLabel,
    }
  }, [billingRecords, collectionPeriod])

  const todayCollectionTrend = useMemo(() => {
    const ranges = getCollectionPeriodRanges("today")
    const current = sumPeriodMetrics(billingRecords, ranges.current.start, ranges.current.end)
    const previous = sumPeriodMetrics(billingRecords, ranges.previous.start, ranges.previous.end)
    return computeCollectionTrend(current.collectionAmount, previous.collectionAmount)
  }, [billingRecords])

  const todayPeriodMetrics = useMemo(() => {
    const ranges = getCollectionPeriodRanges("today")
    return sumPeriodMetrics(billingRecords, ranges.current.start, ranges.current.end)
  }, [billingRecords])

  const collectionPeriodTabs: { value: CollectionPeriod; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ]

  const renderTrendBadge = (
    trend: ReturnType<typeof computeCollectionTrend>,
    compareLabel: string,
    size: "sm" | "md" = "sm"
  ) => {
    const sizeCls = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
    const colorCls =
      trend.direction === "up"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : trend.direction === "down"
        ? "border-red-200 bg-red-50 text-red-600"
        : "border-slate-200 bg-slate-50 text-slate-600"

    return (
      <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${sizeCls} ${colorCls}`}>
        {trend.direction === "up" && (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
        )}
        {trend.direction === "down" && (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        )}
        {trend.direction === "flat" && (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />
          </svg>
        )}
        {trend.text} vs {compareLabel}
      </span>
    )
  }

  // Last 5 paid records for the Recent Activity panel
  const recentPayments = useMemo(() => {
    return billingRecords
      .filter(r => r.status === "paid" && r.paidAt)
      .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())
      .slice(0, 5)
  }, [billingRecords])

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
        record.paymentMethod === "card" || record.paymentMethod === "upi" || record.paymentMethod === "cash"
          ? record.paymentMethod
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
      const data = await authedFetchJson<{
        paymentMethod?: BillingPaymentMethod
        paidAt?: string
        paymentReference?: string | null
        transactionId?: string | null
      }>(
        "/api/patient/billing/pay",
        {
          method: "POST",
          body: JSON.stringify({
          billingId: selectedBillingRecord.id,
          paymentMethod: billingPaymentMethod,
          actor: "receptionist",
          type: selectedBillingRecord.type, // Pass type to help API identify collection
          // Pass hospitalId so API can find hospital-scoped appointment billing
          hospitalId: selectedBillingRecord.hospitalId,
          }),
        },
        "Failed to record payment"
      )
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
    <div className="space-y-4">

      {/* ════════════════════════════════════════════
          1. HEADER + KPI CARDS
          ════════════════════════════════════════════ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="rx-section-title">Billing &amp; Payments</p>
            <p className="rx-section-subtitle">Track invoices, collect payments, and manage outstanding dues</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-700">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              Live Sync
            </div>
            <button type="button" onClick={fetchBillingRecords}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* KPI Cards — 4 columns, colored top border, trend chip, hover elevation */}
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 xl:grid-cols-4 xl:divide-y-0">
          {([
            {
              label: 'Total Billed',
              value: formatCurrency(billingMetrics.totalBilled),
              sub: `${billingMetrics.totalCount} invoices issued`,
              trend: todayPeriodMetrics.invoicesCount > 0 ? `${todayPeriodMetrics.invoicesCount} today` : null,
              iconPath: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 2.5 2 2.5-2 3.5 2z',
              iconColor: 'text-slate-500', iconBg: 'bg-slate-100',
              valueColor: 'text-slate-800', top: 'border-t-[3px] border-t-slate-400',
            },
            {
              label: 'Revenue Collected',
              value: formatCurrency(billingMetrics.totalCollected),
              sub: `${billingMetrics.paidCount} invoices settled`,
              trend: todayPeriodMetrics.collectionAmount > 0
                ? `${formatCurrency(todayPeriodMetrics.collectionAmount)} today · ${todayCollectionTrend.text} vs yesterday`
                : `${todayCollectionTrend.text} vs yesterday`,
              trendUp: todayCollectionTrend.increased,
              iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
              iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50',
              valueColor: 'text-emerald-700', top: 'border-t-[3px] border-t-emerald-500',
            },
            {
              label: 'Outstanding Dues',
              value: formatCurrency(billingMetrics.pendingAmount),
              sub: billingMetrics.pendingCount ? `${billingMetrics.pendingCount} unsettled` : 'All cleared',
              trend: todayPeriodMetrics.pendingCount > 0 ? `${todayPeriodMetrics.pendingCount} due today` : null,
              iconPath: 'M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z',
              iconColor: 'text-amber-600', iconBg: 'bg-amber-50',
              valueColor: 'text-amber-700', top: 'border-t-[3px] border-t-amber-400',
            },
            {
              label: 'Average Bill Size',
              value: billingMetrics.totalCount > 0 ? formatCurrency(Math.round(billingMetrics.totalBilled / billingMetrics.totalCount)) : '₹0',
              sub: billingMetrics.lastPaymentAt ? `Last: ${new Date(billingMetrics.lastPaymentAt).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })}` : 'No payments yet',
              trend: billingMetrics.totalBilled > 0 ? `${Math.round(billingMetrics.totalCollected / billingMetrics.totalBilled * 100)}% collected` : null,
              iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              iconColor: 'text-sky-600', iconBg: 'bg-sky-50',
              valueColor: 'text-sky-700', top: 'border-t-[3px] border-t-sky-500',
            },
          ] as const).map((kpi) => (
            <div key={kpi.label}
              className={`group flex flex-col gap-3 bg-white px-5 py-5 transition-all duration-150 hover:bg-slate-50/70 hover:shadow-inner cursor-default ${kpi.top}`}>
              <div className="flex items-start justify-between">
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                  <svg className={`h-4.5 w-4.5 ${kpi.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={kpi.iconPath} />
                  </svg>
                </div>
                {kpi.trend && (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    "trendUp" in kpi && kpi.trendUp
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "trendUp" in kpi && kpi.trendUp === false && kpi.trend.includes("%")
                      ? "border-red-200 bg-red-50 text-red-600"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}>
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

      {/* ════════════════════════════════════════════
          2. QUICK ACTIONS BAR
          ════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block">Quick Actions</span>
        <div className="hidden h-4 w-px bg-slate-200 sm:block" />
        {([
          {
            label: 'Pending Bills',
            iconPath: 'M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z',
            cls: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
            action: () => { setBillingStatusFilter("pending"); setBillingTypeFilter("all") },
          },
          {
            label: 'Paid Invoices',
            iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
            cls: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
            action: () => { setBillingStatusFilter("paid"); setBillingTypeFilter("all") },
          },
          {
            label: 'Admission Billing',
            iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
            cls: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
            action: () => { setBillingStatusFilter("all"); setBillingTypeFilter("admission") },
          },
          {
            label: 'Appointment Billing',
            iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
            cls: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100',
            action: () => { setBillingStatusFilter("all"); setBillingTypeFilter("appointment") },
          },
          {
            label: 'All Invoices',
            iconPath: 'M4 6h16M4 10h16M4 14h16M4 18h16',
            cls: 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100',
            action: () => { setBillingStatusFilter("all"); setBillingTypeFilter("all") },
          },
        ] as const).map((qa) => (
          <button key={qa.label} type="button" onClick={qa.action}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${qa.cls}`}>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={qa.iconPath} />
            </svg>
            {qa.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          3. LIVE INSIGHTS + RECENT ACTIVITY
          ════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Collection Analytics Strip (2 cols) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Collection Analytics</p>
                <p className="text-[11px] text-slate-400">
                  {collectionPeriodMetrics.periodLabel} · compared with {collectionPeriodMetrics.previousLabel}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {collectionPeriodTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setCollectionPeriod(tab.value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      collectionPeriod === tab.value
                        ? "bg-white text-cyan-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary collection summary with trend */}
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                  {collectionPeriod === "today" ? "Today's" : collectionPeriod === "weekly" ? "Weekly" : collectionPeriod === "monthly" ? "Monthly" : "Yearly"} Collection
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                  {formatCurrency(collectionPeriodMetrics.collectionAmount)}
                </p>
                <p className="mt-1 text-[11px] text-emerald-600">
                  {collectionPeriodMetrics.paidCount} payment{collectionPeriodMetrics.paidCount !== 1 ? "s" : ""} received
                  {collectionPeriodMetrics.previousCollectionAmount > 0 && (
                    <span className="text-emerald-500">
                      {" "}· previous {collectionPeriodMetrics.previousLabel}: {formatCurrency(collectionPeriodMetrics.previousCollectionAmount)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                {renderTrendBadge(collectionPeriodMetrics.trend, collectionPeriodMetrics.previousLabel, "md")}
                <p className="text-[10px] text-slate-500">
                  {collectionPeriodMetrics.trend.increased ? "Collection increased" : collectionPeriodMetrics.trend.direction === "down" ? "Collection decreased" : "No change in collection"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
            {([
              {
                label: `${collectionPeriod === "today" ? "Today's" : collectionPeriod === "weekly" ? "Weekly" : collectionPeriod === "monthly" ? "Monthly" : "Yearly"} Collection`,
                value: formatCurrency(collectionPeriodMetrics.collectionAmount),
                iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                valueColor: 'text-emerald-700',
                iconColor: 'text-emerald-500',
                showTrend: true,
              },
              { label: 'Cash Collection', value: formatCurrency(collectionPeriodMetrics.cashAmount), iconPath: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', valueColor: 'text-emerald-600', iconColor: 'text-emerald-400', showTrend: false },
              { label: 'UPI Collection', value: formatCurrency(collectionPeriodMetrics.upiAmount), iconPath: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', valueColor: 'text-blue-700', iconColor: 'text-blue-500', showTrend: false },
              { label: 'Card Collection', value: formatCurrency(collectionPeriodMetrics.cardAmount), iconPath: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', valueColor: 'text-purple-700', iconColor: 'text-purple-500', showTrend: false },
              { label: 'Pending Payments', value: formatCurrency(collectionPeriodMetrics.pendingAmount), iconPath: 'M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z', valueColor: 'text-amber-700', iconColor: 'text-amber-500', showTrend: false },
              { label: 'Average Bill Size', value: collectionPeriodMetrics.avgBillSize > 0 ? formatCurrency(collectionPeriodMetrics.avgBillSize) : '₹0', iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', valueColor: 'text-sky-700', iconColor: 'text-sky-500', showTrend: false },
              { label: 'Invoices in Period', value: String(collectionPeriodMetrics.invoicesCount), iconPath: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 2.5 2 2.5-2 3.5 2z', valueColor: 'text-slate-800', iconColor: 'text-slate-400', showTrend: false },
            ] as const).map((ins) => (
              <div key={ins.label} className="flex items-center gap-3 bg-white px-4 py-3.5 transition-colors hover:bg-slate-50/70">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <svg className={`h-3.5 w-3.5 ${ins.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ins.iconPath} />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className={`text-base font-bold tabular-nums leading-none ${ins.valueColor}`}>{ins.value}</p>
                    {ins.showTrend && renderTrendBadge(collectionPeriodMetrics.trend, collectionPeriodMetrics.previousLabel)}
                  </div>
                  <p className="mt-1 text-[10px] font-medium text-slate-500">{ins.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Payment Activity (1 col) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div>
              <p className="text-sm font-bold text-slate-900">Recent Payments</p>
              <p className="text-[11px] text-slate-400">Latest transactions</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="p-4">
            {recentPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-600">No payments yet</p>
                <p className="mt-0.5 text-[11px] text-slate-400">Received payments appear here</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentPayments.map((record) => (
                  <div key={record.id} className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100/70">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <svg className="h-2.5 w-2.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800">
                        {formatCurrency(record.totalAmount)}
                        <span className="ml-1 font-normal text-slate-500">· {record.patientName || 'Patient'}</span>
                      </p>
                      <p className="mt-0.5 text-[10px] capitalize text-slate-400">
                        {record.type === 'appointment' ? 'Appointment' : 'Admission'}
                        {' · '}{record.paymentMethod || record.settlementMode || 'cash'}
                        {record.paidAt ? ' · ' + new Date(record.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          4. BILLING HISTORY
          ════════════════════════════════════════════ */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* ── Filter Toolbar ── */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Invoice History</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {filteredBillingRecords.length} record{filteredBillingRecords.length !== 1 ? 's' : ''} · latest invoices from discharges &amp; appointments
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={billingSearchTerm}
                  onChange={(e) => setBillingSearchTerm(e.target.value)}
                  placeholder="Search patient or invoice ID…"
                  className="w-52 rounded-lg border border-slate-200 bg-white pl-9 pr-8 py-2 text-xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
                {billingSearchTerm && (
                  <button type="button" onClick={() => setBillingSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Date */}
              <div className="relative">
                <input
                  type="date"
                  value={billingDateFilter}
                  onChange={(e) => setBillingDateFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
                {billingDateFilter && (
                  <button type="button" onClick={() => setBillingDateFilter("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Reset (only when filters active) */}
              {(billingSearchTerm || billingDateFilter || billingStatusFilter !== "all" || billingTypeFilter !== "all") && (
                <button type="button"
                  onClick={() => { setBillingSearchTerm(""); setBillingDateFilter(""); setBillingStatusFilter("all"); setBillingTypeFilter("all") }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Status + Type filter pills */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Status tabs */}
            <div className="flex flex-wrap gap-1">
              {statusTabs.map((tab) => {
                const isActive = billingStatusFilter === tab.value
                return (
                  <button key={tab.value} onClick={() => setBillingStatusFilter(tab.value)}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                      isActive ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${isActive ? 'bg-cyan-500 text-white' : 'bg-slate-300 text-slate-700'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {/* Separator */}
            <div className="hidden h-4 w-px bg-slate-200 sm:block" />
            {/* Type pills */}
            <div className="flex gap-1">
              {([
                { value: "all" as const, label: "All Types" },
                { value: "admission" as const, label: "Admissions" },
                { value: "appointment" as const, label: "Appointments" },
              ]).map((t) => (
                <button key={t.value} onClick={() => setBillingTypeFilter(t.value)}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-150 ${
                    billingTypeFilter === t.value ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {billingError && (
          <div className="m-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-rose-700">{billingError}</p>
          </div>
        )}

        {/* Loading */}
        {billingLoading && billingRecords.length === 0 ? (
          <div className="space-y-3 px-4 py-6 animate-pulse" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-slate-100" />
                    <div className="h-3 w-56 rounded bg-slate-50" />
                    <div className="h-3 w-32 rounded bg-slate-50" />
                  </div>
                  <div className="h-16 w-36 rounded-xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>

        ) : billingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 2.5 2 2.5-2 3.5 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">No invoices yet</p>
            <p className="mt-1 text-xs text-slate-400">Bills appear once patients are discharged or appointments are paid.</p>
          </div>

        ) : filteredBillingRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">No records match your filters</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search, status, or invoice type.</p>
            <button type="button"
              onClick={() => { setBillingSearchTerm(""); setBillingDateFilter(""); setBillingStatusFilter("all"); setBillingTypeFilter("all") }}
              className="mt-3 text-xs font-semibold text-cyan-600 hover:underline">
              Clear all filters
            </button>
          </div>

        ) : (
          <div>
            {paginatedBillingRecords.map((record) => {
              const generatedAt = record.generatedAt ? new Date(record.generatedAt) : null
              const paidAt = record.paidAt ? new Date(record.paidAt) : null
              const isPaid = record.status === "paid"
              const isVoid = record.status === "void"
              const statusLabel = isPaid ? "Paid" : isVoid ? "Voided" : "Pending"

              const accentColor = isPaid ? "bg-emerald-500" : isVoid ? "bg-red-400" : "bg-amber-400"
              const amountColor = isPaid ? "text-emerald-700" : isVoid ? "text-slate-500" : "text-amber-700"
              const amountBg = isPaid ? "bg-emerald-50 border-emerald-100" : isVoid ? "bg-slate-50 border-slate-200" : "bg-amber-50 border-amber-100"

              const statusChipCls = isPaid
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : isVoid
                ? "bg-red-100 text-red-600 border-red-200"
                : "bg-amber-100 text-amber-700 border-amber-200"

              const typeCls = record.type === "appointment"
                ? "bg-sky-50 text-sky-700 border-sky-200"
                : "bg-indigo-50 text-indigo-700 border-indigo-200"

              const payMethodCls =
                record.paymentMethod === "cash" || record.settlementMode === "cash"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : record.paymentMethod === "upi" || record.settlementMode === "upi"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-purple-50 text-purple-700 border-purple-200"

              return (
                <article key={record.id}
                  className="group relative border-b border-slate-100 transition-all duration-150 hover:bg-slate-50/60 hover:shadow-[inset_0_0_0_1px_rgba(100,116,139,0.08)] last:border-0">
                  {/* Status accent bar */}
                  <div className={`absolute left-0 top-0 h-full w-[3px] rounded-full ${accentColor} transition-all group-hover:w-[4px]`} />

                  <div className="pl-6 pr-5 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                      {/* ── Left: Invoice Details ── */}
                      <div className="flex-1 min-w-0 space-y-3">

                        {/* Row 1: ID chips + badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-500 tracking-wider">
                            #{record.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${typeCls}`}>
                            {record.type === "appointment" ? "Appointment" : "Admission"}
                          </span>
                          {record.admissionId && (
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                              ADM {record.admissionId.slice(0, 8)}
                            </span>
                          )}
                          {record.appointmentId && (
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                              APT {record.appointmentId.slice(0, 8)}
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusChipCls}`}>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                            {statusLabel}
                          </span>
                          {isPaid && (record.paymentMethod || record.settlementMode) && (
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${payMethodCls}`}>
                              {record.paymentMethod || record.settlementMode}
                            </span>
                          )}
                        </div>

                        {/* Row 2: Patient name prominent, Doctor secondary, dates */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Patient</p>
                            <p className="mt-0.5 text-[15px] font-bold text-slate-900 truncate leading-tight">{record.patientName || "Unknown"}</p>
                            <p className="font-mono text-[10px] text-slate-400">ID {record.patientId || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Doctor</p>
                            <p className="mt-0.5 text-sm font-medium text-slate-600 truncate">{record.doctorName || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Generated</p>
                            <p className="mt-0.5 text-xs font-medium text-slate-700">{generatedAt ? generatedAt.toLocaleDateString("en-IN") : "—"}</p>
                            <p className="text-[10px] text-slate-400">{generatedAt ? generatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                          </div>
                          {paidAt ? (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Settled</p>
                              <p className="mt-0.5 text-xs font-semibold text-emerald-700">{paidAt.toLocaleDateString("en-IN")}</p>
                              <p className="text-[10px] text-emerald-500">{record.paidAtFrontDesk ? "Front desk" : "Online"}</p>
                            </div>
                          ) : null}
                        </div>

                        {/* Row 3: Charge breakdown tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {record.type === "appointment" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]">
                              <span className="text-slate-400">Consultation</span>
                              <span className="font-bold text-slate-700">{formatCurrency(record.consultationFee || 0)}</span>
                            </span>
                          ) : (
                            <>
                              {(record.roomCharges ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]">
                                  <span className="text-slate-400">Room</span>
                                  <span className="font-bold text-slate-700">{formatCurrency(record.roomCharges || 0)}</span>
                                </span>
                              )}
                              {(record.doctorFee ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]">
                                  <span className="text-slate-400">Doctor</span>
                                  <span className="font-bold text-slate-700">{formatCurrency(record.doctorFee || 0)}</span>
                                </span>
                              )}
                            </>
                          )}
                          {record.otherServices?.map((service, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px]">
                              <span className="text-slate-400">{service.description || "Service"}</span>
                              <span className="font-bold text-slate-700">{formatCurrency(Number(service.amount) || 0)}</span>
                            </span>
                          ))}
                          {record.paymentType === "partial" && record.remainingAmount !== undefined && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px]">
                              <span className="text-amber-600">Remaining</span>
                              <span className="font-bold text-amber-700">{formatCurrency(record.remainingAmount)}</span>
                            </span>
                          )}
                          {Number(record.refundAmount || 0) > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px]">
                              <span className="text-blue-600">Refund</span>
                              <span className="font-bold text-blue-700">{formatCurrency(Number(record.refundAmount))}</span>
                            </span>
                          )}
                        </div>

                        {/* Special notes */}
                        {(record.paymentTerms === "pay_later_after_discharge" || record.packageSummary) && (
                          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                            {record.paymentTerms === "pay_later_after_discharge" && (
                              <p className="font-semibold">Pay-later plan — payment allowed after discharge</p>
                            )}
                            {record.packageSummary && (
                              <p>Package: {record.packageSummary.packageName} · Due {formatCurrency(Number(record.packageSummary.dueAmount || 0))}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Right: Amount card + CTA ── */}
                      <div className="flex w-full shrink-0 flex-col gap-2 lg:w-44">
                        <div className={`rounded-xl border p-4 text-center ${amountBg}`}>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Amount</p>
                          <p className={`text-2xl font-bold tabular-nums leading-none ${amountColor}`}>
                            {formatCurrency(record.totalAmount)}
                          </p>
                          {record.netPayable !== undefined && record.netPayable !== record.totalAmount && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              Net: <span className="font-bold text-emerald-700">{formatCurrency(record.netPayable)}</span>
                            </p>
                          )}
                        </div>
                        {!isPaid && !isVoid && (
                          <Button type="button" size="sm" variant="primary" onClick={() => handleOpenBillingPayment(record)}>
                            <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Record Payment
                          </Button>
                        )}
                        {isPaid && (
                          <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5">
                            <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-xs font-semibold text-emerald-700">Settled</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}

            {/* ── Pagination ── */}
            <div className="flex flex-col gap-2 border-t border-slate-100 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing{" "}
                <span className="font-semibold text-slate-700">{pageStart.toLocaleString("en-IN")}–{pageEnd.toLocaleString("en-IN")}</span>
                {" "}of{" "}
                <span className="font-semibold text-slate-700">{filteredBillingRecords.length.toLocaleString("en-IN")}</span> invoices
              </p>
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    currentPage === 1
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  }`}>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
                  {currentPage} / {totalPages}
                </span>
                <button type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    currentPage === totalPages
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                  }`}>
                  Next
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════
          PAYMENT MODAL
          ════════════════════════════════════════════ */}
      {billingPaymentModalOpen && selectedBillingRecord && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-lg max-h-[min(92vh,720px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Modal header — fixed */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">Record Patient Payment</h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {selectedBillingRecord.patientName || "Patient"} · Bill #{selectedBillingRecord.id.slice(0, 6).toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={resetPaymentState}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body — prevents Card/UPI details from overflowing the viewport */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5 space-y-4">
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2">Amount Due</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold text-amber-700 tabular-nums leading-none">
                      {formatCurrency(selectedBillingRecord.totalAmount)}
                    </p>
                    <p className="mt-1.5 text-[11px] text-amber-600">
                      Invoice generated{" "}
                      {selectedBillingRecord.generatedAt
                        ? new Date(selectedBillingRecord.generatedAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                    <svg className="h-6 w-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <PaymentMethodSection
                title="Payment Method"
                paymentMethod={billingPaymentMethod}
                setPaymentMethod={(method) => setBillingPaymentMethod(method)}
                paymentData={billingPaymentData}
                setPaymentData={setBillingPaymentData}
                amountToPay={selectedBillingRecord.totalAmount}
                methods={["cash", "card", "upi"]}
              />
            </div>

            {/* Footer — always visible */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-5 py-3.5 sm:px-6 sm:py-4">
              <Button type="button" variant="outline" onClick={resetPaymentState} disabled={processingBillingPayment}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmBillingPayment}
                loading={processingBillingPayment}
                loadingText="Recording…"
              >
                Confirm · {formatCurrency(selectedBillingRecord.totalAmount)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
