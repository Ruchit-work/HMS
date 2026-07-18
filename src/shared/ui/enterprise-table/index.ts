export { default as EnterpriseDataTable } from "./EnterpriseDataTable"
export type { EnterpriseDataTableProps } from "./EnterpriseDataTable"

export { default as TableToolbar } from "./TableToolbar"
export { default as TablePagination } from "./TablePagination"
export { default as TableFilters } from "./TableFilters"
export { default as TableEmptyState } from "./TableEmptyState"
export { default as TableLoading } from "./TableLoading"
export { default as TableActions, useTableActionMenu } from "./TableActions"
export { StatusPill, AvatarCell } from "./TableCells"

export type {
  StatusVariant,
  AvatarColor,
  EnterpriseColumn,
  EnterpriseRowAction,
  EnterpriseBulkAction,
  EnterpriseToolbarAction,
  EnterpriseFilterOption,
  EnterpriseTableVariant,
} from "./types"

/** @deprecated Prefer EnterpriseColumn — alias retained for DataTable compatibility */
export type { EnterpriseColumn as DTColumn } from "./types"
/** @deprecated Prefer EnterpriseRowAction */
export type { EnterpriseRowAction as DTRowAction } from "./types"
/** @deprecated Prefer EnterpriseBulkAction */
export type { EnterpriseBulkAction as DTBulkAction } from "./types"
