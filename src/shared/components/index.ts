/**
 * Canonical shared UI primitives for HMS.
 * Prefer importing from `@/shared/components` in pages and feature modules.
 * Implementations live under `@/shared/ui/*` (and a few local shared files);
 * this barrel is the stable public surface.
 */

// Buttons
export { Button } from "@/shared/ui/Button"
export type { ButtonProps } from "@/shared/ui/Button"

// Cards / KPI
export { KpiCard } from "./KpiCard"
export type { KpiCardProps } from "./KpiCard"

// Tables
export {
  EnterpriseDataTable as DataTable,
  StatusPill,
  AvatarCell,
} from "@/shared/ui/enterprise-table"
export type {
  EnterpriseColumn as DTColumn,
  EnterpriseRowAction as DTRowAction,
  EnterpriseBulkAction as DTBulkAction,
  EnterpriseDataTableProps,
} from "@/shared/ui/enterprise-table"
export {
  EnterpriseDataTable,
  TablePagination,
  TableEmptyState,
  TableLoading,
  TableToolbar,
  TableFilters,
} from "@/shared/ui/enterprise-table"
export type {
  EnterpriseColumn,
  EnterpriseRowAction,
  EnterpriseBulkAction,
  EnterpriseDataTableProps as EnterpriseTableProps,
  StatusVariant,
  AvatarColor,
  EnterpriseToolbarAction,
  EnterpriseFilterOption,
  EnterpriseTableVariant,
} from "@/shared/ui/enterprise-table"

// Dialogs / Modals
export { RevealModal, useRevealModalClose } from "@/shared/ui/overlays/RevealModal"
export { ConfirmDialog, DeleteModal, ViewModal } from "@/shared/ui/overlays/Modals"

// Empty states
export { EmptyState } from "./EmptyState"
export type { EmptyStateProps } from "./EmptyState"

// Search / filters
export { SearchInput } from "./SearchInput"
export type { SearchInputProps } from "./SearchInput"
export { FilterBar } from "./FilterBar"
export type { FilterBarProps } from "./FilterBar"
export { FilterChip } from "@/shared/ui/FilterChip"

// Pagination
export { default as Pagination } from "@/shared/ui/navigation/Pagination"

// Loading / skeletons
export { LoadingSpinner, InlineSpinner } from "@/shared/ui/feedback/StatusComponents"
export { default as TabSkeleton, tabSkeletonForTab } from "@/shared/ui/feedback/TabSkeleton"
export { DashboardShellSkeleton } from "./DashboardShellSkeleton"

// Badges / status / toasts
export { SuccessToast } from "./SuccessToast"
export { default as Notification } from "@/shared/ui/feedback/Notification"
export { default as NotificationBadge } from "@/shared/ui/feedback/NotificationBadge"

// Headers / layout
export { default as PageHeader } from "@/shared/ui/layout/PageHeader"
export { default as GlobalHeader } from "@/shared/ui/layout/GlobalHeader"
export { TableShell } from "@/shared/ui/layout/TableShell"
export { default as DoctorCard } from "@/shared/ui/layout/DoctorCard"
export { default as Footer } from "@/shared/ui/layout/Footer"

// Forms
export { default as FormSection } from "@/shared/ui/forms/FormSection"
export {
  FormField,
  FormErrorBanner,
  FormActions,
  FormInput,
  FormSelect,
  FormTextarea,
} from "@/shared/ui/forms/FormField"
export { TextField } from "@/shared/ui/forms/TextField"
export type { TextFieldProps } from "@/shared/ui/forms/TextField"
export type { FormSectionProps } from "@/shared/ui/forms/FormSection"
export type { FormFieldProps, FormErrorBannerProps } from "@/shared/ui/forms/FormField"

// Navigation
export { NavTab } from "@/shared/ui/navigation/NavTab"
export { default as GroupedNav } from "@/shared/ui/navigation/GroupedNav"
export type { NavTabProps } from "@/shared/ui/navigation/NavTab"
export type { GroupedNavItem, GroupedNavSection } from "@/shared/ui/navigation/GroupedNav"
