/**
 * Canonical shared UI primitives for HMS.
 * Prefer importing from `@/shared/components` in pages and feature modules.
 * Implementations live under `@/components/ui/*` (and a few local shared files);
 * this barrel is the stable public surface.
 */

// Buttons
export { Button } from "@/components/ui/Button"
export type { ButtonProps } from "@/components/ui/Button"

// Cards / KPI
export { KpiCard } from "./KpiCard"
export type { KpiCardProps } from "./KpiCard"

// Tables
export {
  DataTable,
  StatusPill,
  AvatarCell,
} from "@/components/ui/data/DataTable"
export type {
  DTColumn,
  DTRowAction,
  DTBulkAction,
  EnterpriseDataTableProps,
} from "@/components/ui/data/DataTable"
export {
  EnterpriseDataTable,
  TablePagination,
  TableEmptyState,
  TableLoading,
  TableToolbar,
  TableFilters,
} from "@/components/ui/enterprise-table"
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
} from "@/components/ui/enterprise-table"

// Dialogs / Modals
export { RevealModal, useRevealModalClose } from "@/components/ui/overlays/RevealModal"
export { ConfirmDialog, DeleteModal, ViewModal } from "@/components/ui/overlays/Modals"

// Empty states
export { EmptyState } from "./EmptyState"
export type { EmptyStateProps } from "./EmptyState"

// Search / filters
export { SearchInput } from "./SearchInput"
export type { SearchInputProps } from "./SearchInput"
export { FilterBar } from "./FilterBar"
export type { FilterBarProps } from "./FilterBar"
export { FilterChip } from "@/components/ui/FilterChip"

// Pagination
export { default as Pagination } from "@/components/ui/navigation/Pagination"

// Loading / skeletons
export { LoadingSpinner, InlineSpinner } from "@/components/ui/feedback/StatusComponents"
export { default as TabSkeleton, tabSkeletonForTab } from "@/components/ui/feedback/TabSkeleton"
export { DashboardShellSkeleton } from "./DashboardShellSkeleton"

// Badges / status / toasts
export { SuccessToast } from "./SuccessToast"
export { default as Notification } from "@/components/ui/feedback/Notification"
export { default as NotificationBadge } from "@/components/ui/feedback/NotificationBadge"

// Headers / layout
export { default as PageHeader } from "@/components/ui/layout/PageHeader"
export { default as GlobalHeader } from "@/components/ui/layout/GlobalHeader"
export { TableShell } from "@/components/ui/layout/TableShell"
export { default as DoctorCard } from "@/components/ui/layout/DoctorCard"
export { default as Footer } from "@/components/ui/layout/Footer"

// Forms
export {
  FormField,
  FormSection,
  TextField,
  FormErrorBanner,
  FormActions,
  FormInput,
  FormSelect,
  FormTextarea,
} from "@/components/ui/forms"
export type { TextFieldProps, FormSectionProps, FormFieldProps, FormErrorBannerProps } from "@/components/ui/forms"

// Navigation
export { NavTab } from "@/components/ui/navigation/NavTab"
export { default as GroupedNav } from "@/components/ui/navigation/GroupedNav"
export type { NavTabProps } from "@/components/ui/navigation/NavTab"
export type { GroupedNavItem, GroupedNavSection } from "@/components/ui/navigation/GroupedNav"
