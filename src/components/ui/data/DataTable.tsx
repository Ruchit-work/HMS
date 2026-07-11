'use client'

import { ReactNode, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — exported so callers can build column cells consistently
// ─────────────────────────────────────────────────────────────────────────────

export type StatusVariant =
  | 'success'   // green  — completed / paid / active
  | 'warning'   // amber  — pending / waiting
  | 'danger'    // red    — cancelled / void / critical
  | 'blue'      // blue   — confirmed / scheduled
  | 'purple'    // purple — in consultation
  | 'neutral'   // gray   — not attended / inactive
  | 'cyan'      // cyan   — info / online

const STATUS_CLS: Record<StatusVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100  text-amber-700  border-amber-200',
  danger:  'bg-red-100    text-red-700    border-red-200',
  blue:    'bg-blue-100   text-blue-700   border-blue-200',
  purple:  'bg-purple-100 text-purple-700 border-purple-200',
  neutral: 'bg-slate-100  text-slate-600  border-slate-200',
  cyan:    'bg-cyan-100   text-cyan-700   border-cyan-200',
}

/** Dot + label status chip — use this everywhere instead of ad-hoc span classes */
export function StatusPill({
  label,
  variant,
  className = '',
}: {
  label: string
  variant: StatusVariant
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLS[variant]} ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  )
}

export type AvatarColor = 'cyan' | 'slate' | 'emerald' | 'violet' | 'amber' | 'rose'

const AVATAR_CLS: Record<AvatarColor, string> = {
  cyan:    'bg-cyan-100    text-cyan-700',
  slate:   'bg-slate-100   text-slate-600',
  emerald: 'bg-emerald-100 text-emerald-700',
  violet:  'bg-violet-100  text-violet-700',
  amber:   'bg-amber-100   text-amber-700',
  rose:    'bg-rose-100    text-rose-700',
}

/** Initials avatar + name + optional sub-text — use for Patient and Doctor cells */
export function AvatarCell({
  name,
  sub,
  color = 'cyan',
  size = 'md',
}: {
  name: string
  sub?: string
  color?: AvatarColor
  size?: 'sm' | 'md'
}) {
  const parts = (name || '?').trim().split(' ')
  const initials =
    parts.length >= 2
      ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
      : (name || '?').charAt(0).toUpperCase()

  const avatarSize =
    size === 'sm'
      ? 'h-7 w-7 rounded-lg text-[10px]'
      : 'h-8 w-8 rounded-lg text-xs'

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className={`shrink-0 flex items-center justify-center font-bold ${avatarSize} ${AVATAR_CLS[color]}`}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{name || '—'}</p>
        {sub && <p className="truncate text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Column + Action types
// ─────────────────────────────────────────────────────────────────────────────

export interface DTColumn<T> {
  key: string
  header: string
  /** Tailwind width class, e.g. "w-[18%]" */
  width?: string
  /** Minimum width class, e.g. "min-w-[120px]" */
  minWidth?: string
  /** Hide this column below this breakpoint */
  hideBelow?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  render: (row: T, index: number) => ReactNode
}

export interface DTRowAction<T> {
  label: string
  icon?: ReactNode
  /** Controls button color */
  variant?: 'default' | 'danger' | 'success' | 'warning'
  /** Return true to hide this action for a specific row */
  hidden?: (row: T) => boolean
  onClick: (row: T) => void
}

export interface DTBulkAction<T> {
  label: string
  variant?: 'default' | 'danger' | 'success'
  disabled?: boolean
  onClick: (selectedRows: T[]) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// DataTable props
// ─────────────────────────────────────────────────────────────────────────────

interface DataTableProps<T extends { id: string }> {
  data: T[]
  columns: DTColumn<T>[]
  keyExtractor?: (row: T) => string

  // States
  loading?: boolean
  loadingMessage?: string
  error?: string | null

  // Empty state
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: { label: string; onClick: () => void }
  emptyIcon?: ReactNode

  /** Slot rendered above the table (search, filters, toolbar) */
  toolbar?: ReactNode

  // Bulk selection
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleRow?: (id: string) => void
  onToggleAll?: () => void
  bulkActions?: DTBulkAction<T>[]
  processingBulk?: boolean

  // Row actions
  /** Shown as a visible button in the actions cell */
  primaryAction?: { label: string; icon?: ReactNode; onClick: (row: T) => void }
  /** Shown in a ⋮ dropdown */
  rowActions?: DTRowAction<T>[]

  /** Make entire row clickable */
  onRowClick?: (row: T) => void

  // Sort
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void

  // Pagination
  currentPage?: number
  totalPages?: number
  pageSize?: number
  totalItems?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  showPageSize?: boolean

  /** min-w class for the <table>; defaults to "min-w-[640px]" */
  minWidth?: string
  /**
   * "card"  — (default) wraps in a rounded-2xl border shadow-sm card
   * "flat"  — no outer wrapper; use when DataTable is placed inside an existing card
   */
  variant?: 'card' | 'flat'
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hideClass(hideBelow?: 'sm' | 'md' | 'lg') {
  if (hideBelow === 'sm') return 'hidden sm:table-cell'
  if (hideBelow === 'md') return 'hidden md:table-cell'
  if (hideBelow === 'lg') return 'hidden lg:table-cell'
  return ''
}

function alignClass(align?: 'left' | 'right' | 'center') {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

// ─────────────────────────────────────────────────────────────────────────────
// DataTable
// ─────────────────────────────────────────────────────────────────────────────

export function DataTable<T extends { id: string }>({
  data,
  columns,
  keyExtractor,
  loading = false,
  loadingMessage = 'Loading…',
  error = null,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no records to display.',
  emptyAction,
  emptyIcon,
  toolbar,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  bulkActions = [],
  processingBulk = false,
  primaryAction,
  rowActions = [],
  onRowClick,
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
  itemLabel = 'records',
  showPageSize = true,
  minWidth = 'min-w-[640px]',
  variant = 'card',
  className = '',
}: DataTableProps<T>) {
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [actionAnchor, setActionAnchor] = useState<DOMRect | null>(null)

  const selectedCount = selectedIds?.size ?? 0
  const allSelected = data.length > 0 && selectedCount === data.length
  const countDisplay = totalItems ?? data.length
  const pageStart = countDisplay === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(countDisplay, currentPage * pageSize)
  const hasActions = rowActions.length > 0 || !!primaryAction
  const colSpan =
    columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0)

  // Close action dropdown on outside events
  useEffect(() => {
    if (!openActionId) return
    const close = () => {
      setOpenActionId(null)
      setActionAnchor(null)
    }
    document.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [openActionId])

  const wrapperCls =
    variant === 'flat'
      ? `overflow-hidden ${className}`
      : `overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`

  return (
    <div className={wrapperCls}>
      {/* ── Toolbar slot ── */}
      {toolbar && <div className="border-b border-slate-100">{toolbar}</div>}

      {/* ── Bulk action bar ── */}
      {selectable && selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-100 bg-amber-50/80 px-4 py-2.5">
          <span className="text-sm font-semibold text-amber-800">
            {selectedCount} selected
          </span>
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
                action.variant === 'danger'
                  ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                  : action.variant === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onToggleAll?.()}
            className="text-xs text-slate-500 underline hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Table scroll container ── */}
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table className={`w-full ${minWidth} table-fixed`}>

          {/* ── Sticky thead ── */}
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {selectable && (
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
                    col.sortable && onSort ? () => onSort(col.key) : undefined
                  }
                  className={[
                    col.width ?? '',
                    col.minWidth ?? '',
                    hideClass(col.hideBelow),
                    alignClass(col.align),
                    col.sortable
                      ? 'cursor-pointer select-none hover:text-slate-600'
                      : '',
                    'px-3 py-3.5',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {col.header}
                  {col.sortable && sortField === col.key && (
                    <span className="ml-1 text-cyan-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
              {hasActions && (
                <th className="px-3 py-3.5 text-left">Actions</th>
              )}
            </tr>
          </thead>

          {/* ── Tbody ── */}
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {/* Loading */}
            {loading && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg
                      className="h-8 w-8 animate-spin text-slate-300"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    <p className="text-sm text-slate-500">{loadingMessage}</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Error */}
            {!loading && error && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-14 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="h-10 w-10 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <p className="text-sm font-semibold text-red-600">
                      Failed to load {itemLabel}
                    </p>
                    <p className="text-xs text-slate-400">{error}</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty */}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                      {emptyIcon ?? (
                        <svg
                          className="h-7 w-7 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {emptyTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {emptyDescription}
                      </p>
                    </div>
                    {emptyAction && (
                      <button
                        type="button"
                        onClick={emptyAction.onClick}
                        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {emptyAction.label}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!loading &&
              !error &&
              data.map((row, index) => (
                <tr
                  key={keyExtractor ? keyExtractor(row) : row.id}
                  className={`transition-colors hover:bg-slate-50/70 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {/* Checkbox */}
                  {selectable && (
                    <td
                      className="w-10 px-3 py-4 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(row.id) ?? false}
                        onChange={() => onToggleRow?.(row.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                  )}

                  {/* Column cells */}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        hideClass(col.hideBelow),
                        alignClass(col.align),
                        'px-3 py-4',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}

                  {/* Actions cell */}
                  {hasActions && (
                    <td
                      className="px-3 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        {primaryAction && (
                          <button
                            type="button"
                            onClick={() => primaryAction.onClick(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            {primaryAction.icon}
                            {primaryAction.label}
                          </button>
                        )}
                        {rowActions.length > 0 && (
                          <button
                            type="button"
                            aria-label="More actions"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (openActionId === row.id) {
                                setOpenActionId(null)
                                setActionAnchor(null)
                              } else {
                                setActionAnchor(
                                  e.currentTarget.getBoundingClientRect()
                                )
                                setOpenActionId(row.id)
                              }
                            }}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {onPageChange && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {countDisplay === 0 ? (
              `No ${itemLabel}`
            ) : (
              <>
                Showing{' '}
                <span className="font-semibold text-slate-700">
                  {pageStart}–{pageEnd}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-700">
                  {countDisplay}
                </span>{' '}
                {itemLabel}
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
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(totalPages)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Row action dropdown portal ── */}
      {openActionId &&
        actionAnchor &&
        (() => {
          const row = data.find((r) => r.id === openActionId)
          if (!row) return null
          const visible = rowActions.filter((a) => !a.hidden?.(row))
          if (visible.length === 0) return null
          const W = 208
          const top = actionAnchor.bottom + 4
          const left = Math.max(
            8,
            Math.min(
              actionAnchor.right - W,
              window.innerWidth - W - 8
            )
          )
          return createPortal(
            <div
              className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
              style={{ top, left }}
              onClick={(e) => e.stopPropagation()}
              role="menu"
            >
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Actions
                </p>
              </div>
              {visible.map((action, i) => {
                const variantCls =
                  action.variant === 'danger'
                    ? 'text-red-600 hover:bg-red-50'
                    : action.variant === 'success'
                    ? 'text-emerald-700 hover:bg-emerald-50'
                    : action.variant === 'warning'
                    ? 'text-amber-700 hover:bg-amber-50'
                    : 'text-slate-700 hover:bg-slate-50'
                return (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenActionId(null)
                      setActionAnchor(null)
                      action.onClick(row)
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${variantCls}`}
                  >
                    {action.icon && (
                      <span className="shrink-0">{action.icon}</span>
                    )}
                    {action.label}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        })()}
    </div>
  )
}
