"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import type { EnterpriseRowAction } from "./types"

interface TableActionsProps<T> {
  row: T
  rowId: string
  primaryAction?: { label: string; icon?: ReactNode; onClick: (row: T) => void }
  rowActions?: EnterpriseRowAction<T>[]
  openActionId: string | null
  actionAnchor: DOMRect | null
  onOpenChange: (id: string | null, anchor: DOMRect | null) => void
}

function TableActions<T>({
  row,
  rowId,
  primaryAction,
  rowActions = [],
  openActionId,
  actionAnchor,
  onOpenChange,
}: TableActionsProps<T>) {
  const visible = rowActions.filter((a) => !a.hidden?.(row))
  const isOpen = openActionId === rowId

  return (
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
      {visible.length > 0 && (
        <button
          type="button"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation()
            if (isOpen) {
              onOpenChange(null, null)
            } else {
              onOpenChange(rowId, e.currentTarget.getBoundingClientRect())
            }
          }}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      )}

      {isOpen &&
        actionAnchor &&
        createPortal(
          <div
            className="fixed z-[100] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{
              top: actionAnchor.bottom + 4,
              left: Math.max(8, Math.min(actionAnchor.right - 208, window.innerWidth - 216)),
            }}
            onClick={(e) => e.stopPropagation()}
            role="menu"
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Actions</p>
            </div>
            {visible.map((action, i) => {
              const variantCls =
                action.variant === "danger"
                  ? "text-red-600 hover:bg-red-50"
                  : action.variant === "success"
                    ? "text-emerald-700 hover:bg-emerald-50"
                    : action.variant === "warning"
                      ? "text-amber-700 hover:bg-amber-50"
                      : "text-slate-700 hover:bg-slate-50"
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onOpenChange(null, null)
                    action.onClick(row)
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${variantCls}`}
                >
                  {action.icon && <span className="shrink-0">{action.icon}</span>}
                  {action.label}
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}

export function useTableActionMenu() {
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [actionAnchor, setActionAnchor] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!openActionId) return
    const close = () => {
      setOpenActionId(null)
      setActionAnchor(null)
    }
    document.addEventListener("click", close)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [openActionId])

  return {
    openActionId,
    actionAnchor,
    onOpenChange: (id: string | null, anchor: DOMRect | null) => {
      setOpenActionId(id)
      setActionAnchor(anchor)
    },
  }
}

export default TableActions
