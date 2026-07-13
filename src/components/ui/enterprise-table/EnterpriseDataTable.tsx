"use client"

import { memo, useMemo, type ReactNode } from "react"
import TableToolbar from "./TableToolbar"
import TablePagination from "./TablePagination"
import TableEmptyState from "./TableEmptyState"
import TableLoading from "./TableLoading"
import TableActions, { useTableActionMenu } from "./TableActions"
import type {
  EnterpriseBulkAction,
  EnterpriseColumn,
  EnterpriseRowAction,
  EnterpriseTableVariant,
  EnterpriseToolbarAction,
} from "./types"

function hideClass(hideBelow?: "sm" | "md" | "lg") {
  if (hideBelow === "sm") return "hidden sm:table-cell"
  if (hideBelow === "md") return "hidden md:table-cell"
  if (hideBelow === "lg") return "hidden lg:table-cell"
  return ""
}

function alignClass(align?: "left" | "right" | "center") {
  if (align === "right") return "text-right"
  if (align === "center") return "text-center"
  return "text-left"
}

export interface EnterpriseDataTableProps<T extends { id: string }> {
  data: T[]
  columns: EnterpriseColumn<T>[]
  keyExtractor?: (row: T) => string

  loading?: boolean
  loadingMessage?: string
  loadingVariant?: "spinner" | "skeleton"
  error?: string | null
  onRetry?: () => void

  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: { label: string; onClick: () => void }
  emptyIcon?: ReactNode

  /** Fully custom toolbar node (overrides search/actions helpers) */
  toolbar?: ReactNode
  /** Built-in search — only used when `toolbar` is not provided */
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  /** Built-in filter slot — rendered next to search when `toolbar` is not provided */
  filters?: ReactNode
  /** Built-in toolbar action buttons */
  toolbarActions?: EnterpriseToolbarAction[]
  toolbarTrailing?: ReactNode

  enableSearch?: boolean
  enableFilters?: boolean
  enablePagination?: boolean
  enableSorting?: boolean
  enableBulkSelection?: boolean
  enableRowActions?: boolean

  selectable?: boolean
  selectedIds?: Set<string>
  onToggleRow?: (id: string) => void
  onToggleAll?: () => void
  bulkActions?: EnterpriseBulkAction<T>[]
  processingBulk?: boolean

  primaryAction?: { label: string; icon?: ReactNode; onClick: (row: T) => void }
  rowActions?: EnterpriseRowAction<T>[]
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string | undefined

  sortField?: string
  sortOrder?: "asc" | "desc"
  onSort?: (field: string) => void

  currentPage?: number
  totalPages?: number
  pageSize?: number
  totalItems?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  showPageSize?: boolean

  minWidth?: string
  variant?: EnterpriseTableVariant
  className?: string
  /** Clears bulk selection — used by the selection toolbar Clear control */
  onClearSelection?: () => void
}

function EnterpriseDataTableInner<T extends { id: string }>({
  data,
  columns,
  keyExtractor,
  loading = false,
  loadingMessage = "Loading…",
  loadingVariant = "spinner",
  error = null,
  onRetry,
  emptyTitle = "No records found",
  emptyDescription = "There are no records to display.",
  emptyAction,
  emptyIcon,
  toolbar,
  search,
  filters,
  toolbarActions = [],
  toolbarTrailing,
  enableSearch = true,
  enableFilters = true,
  enablePagination = true,
  enableSorting = true,
  enableBulkSelection = true,
  enableRowActions = true,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  bulkActions = [],
  processingBulk = false,
  primaryAction,
  rowActions = [],
  onRowClick,
  getRowClassName,
  sortField,
  sortOrder,
  onSort,
  currentPage = 1,
  totalPages = 1,
  pageSize = 10,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 20],
  itemLabel = "records",
  showPageSize = true,
  minWidth = "min-w-[640px]",
  variant = "card",
  className = "",
  onClearSelection,
}: EnterpriseDataTableProps<T>) {
  const { openActionId, actionAnchor, onOpenChange } = useTableActionMenu()

  const selectionEnabled = enableBulkSelection && selectable
  const actionsEnabled = enableRowActions && (rowActions.length > 0 || !!primaryAction)
  const paginationEnabled = enablePagination && !!onPageChange

  const selectedCount = selectedIds?.size ?? 0
  const allSelected = data.length > 0 && selectedCount === data.length
  const countDisplay = totalItems ?? data.length
  const colSpan = columns.length + (selectionEnabled ? 1 : 0) + (actionsEnabled ? 1 : 0)

  const resolvedToolbar = useMemo(() => {
    if (toolbar) return toolbar
    const showSearch = enableSearch && search
    const showFilters = enableFilters && filters
    const showActions = toolbarActions.length > 0 || toolbarTrailing
    if (!showSearch && !showFilters && !showActions) return null
    return (
      <TableToolbar
        search={showSearch ? search : undefined}
        filters={showFilters ? filters : undefined}
        actions={toolbarActions}
        trailing={toolbarTrailing}
      />
    )
  }, [toolbar, enableSearch, search, enableFilters, filters, toolbarActions, toolbarTrailing])

  const wrapperCls =
    variant === "flat"
      ? `overflow-hidden ${className}`
      : `overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`

  return (
    <div className={wrapperCls}>
      {resolvedToolbar}

      {selectionEnabled && selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-100 bg-amber-50/80 px-4 py-2.5">
          <span className="text-sm font-semibold text-amber-800">{selectedCount} selected</span>
          {bulkActions.map((action, i) => (
            <button
              key={i}
              type="button"
              disabled={processingBulk || action.disabled}
              onClick={() => {
                const rows = data.filter((r) => selectedIds?.has(r.id))
                action.onClick(rows)
              }}
              className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                action.variant === "danger"
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : action.variant === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onClearSelection?.()}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table className={`w-full ${minWidth} table-fixed`}>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {selectionEnabled && (
                <th className="w-10 px-3 py-3.5 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleAll?.()}
                    className="rounded border-slate-300"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={
                    enableSorting && col.sortable && onSort ? () => onSort(col.key) : undefined
                  }
                  className={[
                    col.width ?? "",
                    col.minWidth ?? "",
                    hideClass(col.hideBelow),
                    alignClass(col.align),
                    enableSorting && col.sortable ? "cursor-pointer select-none hover:text-slate-600" : "",
                    "px-3 py-3.5",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {col.header}
                  {enableSorting && col.sortable && sortField === col.key && (
                    <span className="ml-1 text-cyan-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
              {actionsEnabled && <th className="px-3 py-3.5 text-left">Actions</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {loading && (
              <TableLoading colSpan={colSpan} message={loadingMessage} variant={loadingVariant} />
            )}

            {!loading && error && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-10 w-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <p className="text-sm font-semibold text-red-600">Failed to load {itemLabel}</p>
                    <p className="text-xs text-slate-400">{error}</p>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="mt-1 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && data.length === 0 && (
              <TableEmptyState
                colSpan={colSpan}
                title={emptyTitle}
                description={emptyDescription}
                action={emptyAction}
                icon={emptyIcon}
              />
            )}

            {!loading &&
              !error &&
              data.map((row, index) => {
                const id = keyExtractor ? keyExtractor(row) : row.id
                const rowExtra = getRowClassName?.(row) ?? ""
                return (
                  <tr
                    key={id}
                    className={`group transition-colors hover:bg-slate-50/70 ${onRowClick ? "cursor-pointer" : ""} ${rowExtra}`.trim()}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectionEnabled && (
                      <td className="w-10 px-3 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds?.has(row.id) ?? false}
                          onChange={() => onToggleRow?.(row.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={[hideClass(col.hideBelow), alignClass(col.align), "px-3 py-4"]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {col.render(row, index)}
                      </td>
                    ))}
                    {actionsEnabled && (
                      <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                        <TableActions
                          row={row}
                          rowId={id}
                          primaryAction={primaryAction}
                          rowActions={rowActions}
                          openActionId={openActionId}
                          actionAnchor={actionAnchor}
                          onOpenChange={onOpenChange}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {paginationEnabled && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={countDisplay}
          onPageChange={onPageChange!}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
          itemLabel={itemLabel}
          showPageSize={showPageSize}
        />
      )}
    </div>
  )
}

const EnterpriseDataTable = memo(EnterpriseDataTableInner) as typeof EnterpriseDataTableInner
export default EnterpriseDataTable
