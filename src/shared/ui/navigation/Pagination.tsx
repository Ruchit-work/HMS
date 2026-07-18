/**
 * Pagination Component
 * 
 * Reusable pagination component for tables with page navigation and page size selector.
 * 
 * @example
 * <Pagination
 *   currentPage={currentPage}
 *   totalPages={totalPages}
 *   pageSize={pageSize}
 *   totalItems={filteredItems.length}
 *   onPageChange={goToPage}
 *   onPageSizeChange={setPageSize}
 *   pageSizeOptions={[10, 15, 20]}
 * />
 */

"use client"

import React from 'react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  showPageSizeSelector?: boolean
  showPageInfo?: boolean
  itemLabel?: string // Custom label for items (e.g., "patients", "appointments")
  className?: string
}

export default function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 20],
  showPageSizeSelector = true,
  showPageInfo = true,
  itemLabel = 'items',
  className = '',
}: PaginationProps) {
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalItems)

  const handleFirst = () => onPageChange(1)
  const handlePrev = () => onPageChange(currentPage - 1)
  const handleNext = () => onPageChange(currentPage + 1)
  const handleLast = () => onPageChange(totalPages)

  return (
    <div className={`flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      {showPageInfo && (
        <div>
          Showing{' '}
          <span className="font-semibold text-slate-800">
            {startIndex}–{endIndex}
          </span>{' '}
          of <span className="font-semibold text-slate-800">{totalItems.toLocaleString()}</span> {itemLabel}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {showPageSizeSelector && (
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFirst}
            disabled={currentPage === 1}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            First
          </button>
          <button
            onClick={handlePrev}
            disabled={currentPage === 1}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            Prev
          </button>
          <span>
            Page <span className="font-semibold text-slate-800">{currentPage}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalPages}</span>
          </span>
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            Next
          </button>
          <button
            onClick={handleLast}
            disabled={currentPage === totalPages}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  )
}

