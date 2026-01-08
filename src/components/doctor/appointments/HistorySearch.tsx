"use client"

import React from 'react'

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
  const hasFilters = text || date

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Search by patient name, ID, symptoms..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Search appointments"
            />
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Filter by date"
            />
            {hasFilters && (
              <button
                onClick={onReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Reset
              </button>
            )}
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 text-sm text-gray-600">
            Showing <span className="font-medium">{resultCount}</span> of{' '}
            <span className="font-medium">{totalCount}</span> appointments
          </div>
        )}
    </div>
  )
}

