"use client"

import React from "react"
import ClinicalEmptyState from "./ClinicalEmptyState"

interface ClinicalDataTableColumn<T> {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
}

interface ClinicalDataTableProps<T> {
  columns: ClinicalDataTableColumn<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  loading?: boolean
  loadingMessage?: string
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
  selectedKey?: string | null
  toolbar?: React.ReactNode
  className?: string
}

export default function ClinicalDataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  loadingMessage: _loadingMessage = "Loading records…",
  emptyTitle = "No records found",
  emptyDescription,
  onRowClick,
  selectedKey,
  toolbar,
  className = "",
}: ClinicalDataTableProps<T>) {
  return (
    <div className={`clinical-data-table ${className}`}>
      {toolbar && <div className="clinical-data-table__toolbar">{toolbar}</div>}
      <div className="clinical-data-table__scroll">
        <table className="clinical-data-table__table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.headerClassName}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  <td colSpan={columns.length} className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 rounded bg-slate-100" />
                        <div className="h-2.5 w-1/4 rounded bg-slate-50" />
                      </div>
                      <div className="h-6 w-16 rounded-full bg-slate-100" />
                    </div>
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <ClinicalEmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    illustration="patients"
                  />
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const key = keyExtractor(row)
                const isSelected = selectedKey === key
                return (
                  <tr
                    key={key}
                    className={`${onRowClick ? "clinical-data-table__row--clickable" : ""} ${
                      isSelected ? "clinical-data-table__row--selected" : ""
                    }`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
