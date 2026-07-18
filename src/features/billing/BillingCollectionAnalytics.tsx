"use client"

import { useMemo, useState } from "react"
import {
  type BillingCollectionRecord,
  type CollectionPeriod,
  computeCollectionTrend,
  formatBillingCurrency,
  getCollectionPeriodRanges,
  sumPeriodMetrics,
} from "@/shared/utils/collectionAnalytics"

function TrendBadge({
  trend,
  compareLabel,
  size = "sm",
}: {
  trend: ReturnType<typeof computeCollectionTrend>
  compareLabel: string
  size?: "sm" | "md"
}) {
  const cls =
    trend.direction === "up"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : trend.direction === "down"
        ? "border-red-200 bg-red-50 text-red-600"
        : "border-slate-200 bg-slate-50 text-slate-600"
  const pad = size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${cls} ${pad}`}>
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

/**
 * Collection Analytics + Recent Payments — same metrics as Reception Billing.
 */
export default function BillingCollectionAnalytics({
  records,
}: {
  records: BillingCollectionRecord[]
}) {
  const [collectionPeriod, setCollectionPeriod] = useState<CollectionPeriod>("today")

  const collectionPeriodTabs: { value: CollectionPeriod; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ]

  const collectionPeriodMetrics = useMemo(() => {
    const ranges = getCollectionPeriodRanges(collectionPeriod)
    const current = sumPeriodMetrics(records, ranges.current.start, ranges.current.end)
    const previous = sumPeriodMetrics(records, ranges.previous.start, ranges.previous.end)
    const trend = computeCollectionTrend(current.collectionAmount, previous.collectionAmount)
    return {
      ...current,
      previousCollectionAmount: previous.collectionAmount,
      trend,
      previousLabel: ranges.previousLabel,
      periodLabel: ranges.periodLabel,
    }
  }, [records, collectionPeriod])

  const recentPayments = useMemo(() => {
    return records
      .filter((r) => r.status === "paid" && r.paidAt)
      .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime())
      .slice(0, 5)
  }, [records])

  const periodPrefix =
    collectionPeriod === "today"
      ? "Today's"
      : collectionPeriod === "weekly"
        ? "Weekly"
        : collectionPeriod === "monthly"
          ? "Monthly"
          : "Yearly"

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                {periodPrefix} Collection
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                {formatBillingCurrency(collectionPeriodMetrics.collectionAmount)}
              </p>
              <p className="mt-1 text-[11px] text-emerald-600">
                {collectionPeriodMetrics.paidCount} payment
                {collectionPeriodMetrics.paidCount !== 1 ? "s" : ""} received
                {collectionPeriodMetrics.previousCollectionAmount > 0 && (
                  <span className="text-emerald-500">
                    {" "}
                    · previous {collectionPeriodMetrics.previousLabel}:{" "}
                    {formatBillingCurrency(collectionPeriodMetrics.previousCollectionAmount)}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <TrendBadge
                trend={collectionPeriodMetrics.trend}
                compareLabel={collectionPeriodMetrics.previousLabel}
                size="md"
              />
              <p className="text-[10px] text-slate-500">
                {collectionPeriodMetrics.trend.increased
                  ? "Collection increased"
                  : collectionPeriodMetrics.trend.direction === "down"
                    ? "Collection decreased"
                    : "No change in collection"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
          {(
            [
              {
                label: `${periodPrefix} Collection`,
                value: formatBillingCurrency(collectionPeriodMetrics.collectionAmount),
                valueColor: "text-emerald-700",
                iconColor: "text-emerald-500",
                showTrend: true,
                iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
              },
              {
                label: "Cash Collection",
                value: formatBillingCurrency(collectionPeriodMetrics.cashAmount),
                valueColor: "text-emerald-600",
                iconColor: "text-emerald-400",
                showTrend: false,
                iconPath:
                  "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
              },
              {
                label: "Card Collection",
                value: formatBillingCurrency(collectionPeriodMetrics.cardAmount),
                valueColor: "text-purple-700",
                iconColor: "text-purple-500",
                showTrend: false,
                iconPath:
                  "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
              },
              {
                label: "UPI Collection",
                value: formatBillingCurrency(collectionPeriodMetrics.upiAmount),
                valueColor: "text-blue-700",
                iconColor: "text-blue-500",
                showTrend: false,
                iconPath: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z",
              },
              {
                label: "Pending Payments",
                value: formatBillingCurrency(collectionPeriodMetrics.pendingAmount),
                valueColor: "text-amber-700",
                iconColor: "text-amber-500",
                showTrend: false,
                iconPath: "M12 8v4l2.5 2.5M12 22a10 10 0 100-20 10 10 0 000 20z",
              },
              {
                label: "Average Bill Size",
                value:
                  collectionPeriodMetrics.avgBillSize > 0
                    ? formatBillingCurrency(collectionPeriodMetrics.avgBillSize)
                    : "₹0",
                valueColor: "text-sky-700",
                iconColor: "text-sky-500",
                showTrend: false,
                iconPath:
                  "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
              },
              {
                label: "Invoices in Period",
                value: String(collectionPeriodMetrics.invoicesCount),
                valueColor: "text-slate-800",
                iconColor: "text-slate-400",
                showTrend: false,
                iconPath:
                  "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 2.5 2 2.5-2 3.5 2z",
              },
            ] as const
          ).map((ins) => (
            <div
              key={ins.label}
              className="flex items-center gap-3 bg-white px-4 py-3.5 transition-colors hover:bg-slate-50/70"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <svg className={`h-3.5 w-3.5 ${ins.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ins.iconPath} />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className={`text-base font-bold tabular-nums leading-none ${ins.valueColor}`}>{ins.value}</p>
                  {ins.showTrend && (
                    <TrendBadge
                      trend={collectionPeriodMetrics.trend}
                      compareLabel={collectionPeriodMetrics.previousLabel}
                    />
                  )}
                </div>
                <p className="mt-1 text-[10px] font-medium text-slate-500">{ins.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

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
              <p className="text-xs font-semibold text-slate-600">No payments yet</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Received payments appear here</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentPayments.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100/70"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-2.5 w-2.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800">
                      {formatBillingCurrency(record.totalAmount || 0)}
                      <span className="ml-1 font-normal text-slate-500">
                        · {record.patientName || "Patient"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10px] capitalize text-slate-400">
                      {record.type === "appointment" ? "Appointment" : "Admission"}
                      {" · "}
                      {record.paymentMethod || record.settlementMode || "cash"}
                      {record.paidAt
                        ? " · " +
                          new Date(record.paidAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
