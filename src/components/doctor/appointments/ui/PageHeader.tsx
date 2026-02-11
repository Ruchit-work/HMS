"use client"

import React from "react"
import Link from "next/link"

interface PageHeaderProps {
  variant?: "light" | "dark"
  onGenerateReport: () => void
  onRefresh: () => void
  refreshing: boolean
}

export default function PageHeader({
  variant = "light",
  onGenerateReport,
  onRefresh,
  refreshing,
}: PageHeaderProps) {
  const isDark = variant === "dark"
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
          Appointments
        </h1>
        <p className={`mt-0.5 text-sm ${isDark ? "text-blue-100" : "text-slate-500"}`}>
          Manage your schedule and patient consultations.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/doctor-dashboard/book-appointment"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition-colors ${
            isDark
              ? "bg-white text-blue-700 hover:bg-blue-50"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          aria-label="Book appointment"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Book Appointment
        </Link>
        <button
          onClick={onGenerateReport}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            isDark
              ? "bg-white/15 text-white border border-white/30 hover:bg-white/25"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          aria-label="Generate report"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Report
        </button>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDark
              ? "bg-white/15 text-white border border-white/30 hover:bg-white/25"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          aria-label="Refresh appointments"
        >
          {refreshing ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  )
}
