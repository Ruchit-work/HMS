/**
 * Pagination hook alias — same API as useTablePagination.
 * Prefer this name for new call sites; existing useTablePagination imports remain valid.
 */

export {
  useTablePagination as usePagination,
  useTablePagination,
} from "@/hooks/useTablePagination"

export { useTablePagination as default } from "@/hooks/useTablePagination"
