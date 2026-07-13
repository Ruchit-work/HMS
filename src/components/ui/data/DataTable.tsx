/**
 * Backward-compatible re-export of the Enterprise Data Table.
 * Prefer importing from `@/components/ui/enterprise-table`.
 */
"use client"

export {
  EnterpriseDataTable as DataTable,
  StatusPill,
  AvatarCell,
} from "@/components/ui/enterprise-table"

export type {
  EnterpriseColumn as DTColumn,
  EnterpriseRowAction as DTRowAction,
  EnterpriseBulkAction as DTBulkAction,
  EnterpriseDataTableProps,
} from "@/components/ui/enterprise-table"
