"use client"

import { memo } from "react"

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  showPageSize?: boolean
}

function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 20],
  itemLabel = "records",
  showPageSize = true,
}: TablePaginationProps) {
  const pageStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(totalItems, currentPage * pageSize)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-slate-500">
        {totalItems === 0 ? (
          `No ${itemLabel}`
        ) : (
          <>
            Showing <span className="font-semibold text-slate-700">{pageStart}–{pageEnd}</span> of{" "}
            <span className="font-semibold text-slate-700">{totalItems}</span> {itemLabel}
          </>
        )}
      </p>
      <div className="flex items-center gap-3">
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs focus:border-cyan-500 focus:outline-none"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            First
          </button>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 text-xs text-slate-500">
            {currentPage} / {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.max(totalPages, 1))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(TablePagination)
