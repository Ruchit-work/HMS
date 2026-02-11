"use client"

import React from "react"

interface HistorySearchProps {
  text: string
  date: string
  onTextChange: (text: string) => void
  onDateChange: (date: string) => void
  onReset: () => void
  resultCount: number
  totalCount: number
}

export default function HistorySearch({
  text,
  date,
  onTextChange,
  onDateChange,
  onReset,
  resultCount,
  totalCount,
}: HistorySearchProps) {
  const hasFilters = !!text || !!date

  return (
    <div className="border-b border-slate-200 bg-blue-50/40 px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Search by patient name, ID, symptoms..."
            className="block w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            aria-label="Search appointments"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            aria-label="Filter by date"
          />
          {hasFilters && (
            <button
              onClick={onReset}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      {hasFilters && (
        <p className="mt-3 text-sm text-slate-600">
          Showing <span className="font-semibold">{resultCount}</span> of{" "}
          <span className="font-semibold">{totalCount}</span> appointments
        </p>
      )}
    </div>
  )
}
