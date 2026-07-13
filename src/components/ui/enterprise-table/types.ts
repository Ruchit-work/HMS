import type { ReactNode } from "react"

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "blue"
  | "purple"
  | "neutral"
  | "cyan"

export type AvatarColor = "cyan" | "slate" | "emerald" | "violet" | "amber" | "rose"

export interface EnterpriseColumn<T> {
  key: string
  header: string
  /** Tailwind width class, e.g. "w-[18%]" */
  width?: string
  minWidth?: string
  hideBelow?: "sm" | "md" | "lg"
  align?: "left" | "right" | "center"
  sortable?: boolean
  render: (row: T, index: number) => ReactNode
}

export interface EnterpriseRowAction<T> {
  label: string
  icon?: ReactNode
  variant?: "default" | "danger" | "success" | "warning"
  hidden?: (row: T) => boolean
  onClick: (row: T) => void
}

export interface EnterpriseBulkAction<T> {
  label: string
  variant?: "default" | "danger" | "success"
  disabled?: boolean
  onClick: (selectedRows: T[]) => void
}

export interface EnterpriseToolbarAction {
  id: string
  label: string
  icon?: ReactNode
  variant?: "primary" | "secondary" | "ghost"
  onClick: () => void
  disabled?: boolean
}

export interface EnterpriseFilterOption {
  id: string
  label: string
  count?: number
}

export type EnterpriseTableVariant = "card" | "flat"
