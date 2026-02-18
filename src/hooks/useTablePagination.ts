/**
 * Table Pagination Hook
 * 
 * Provides pagination logic for tables with filtering, sorting, and pagination.
 * 
 * @example
 * const { currentPage, pageSize, totalPages, paginatedItems, goToPage, setPageSize, resetPage } = useTablePagination(filteredItems, { initialPageSize: 10 })
 */

import { useState, useMemo, useEffect } from 'react'

interface UseTablePaginationOptions {
  initialPageSize?: number
  resetOnFilterChange?: boolean
}

interface UseTablePaginationReturn<T> {
  currentPage: number
  pageSize: number
  totalPages: number
  paginatedItems: T[]
  goToPage: (page: number) => void
  setPageSize: (size: number) => void
  resetPage: () => void
  startIndex: number
  endIndex: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * Hook for table pagination
 * @param items - Array of items to paginate
 * @param options - Pagination options
 * @returns Pagination state and functions
 */
export function useTablePagination<T>(
  items: T[],
  options: UseTablePaginationOptions = {}
): UseTablePaginationReturn<T> {
  const { initialPageSize = 10, resetOnFilterChange = true } = options

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  // Calculate total pages
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize]
  )

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  // Reset to page 1 when items change (filtering/sorting)
  useEffect(() => {
    if (resetOnFilterChange) {
      setCurrentPage(1)
    }
  }, [items.length, resetOnFilterChange])

  // Paginate items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, currentPage, pageSize])

  // Calculate indices for display
  const startIndex = items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, items.length)

  // Navigation helpers
  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages)
    setCurrentPage(nextPage)
  }

  const resetPage = () => {
    setCurrentPage(1)
  }

  const setPageSize = (size: number) => {
    setPageSizeState(size)
    setCurrentPage(1) // Reset to first page when page size changes
  }

  const hasNextPage = currentPage < totalPages
  const hasPreviousPage = currentPage > 1

  return {
    currentPage,
    pageSize,
    totalPages,
    paginatedItems,
    goToPage,
    setPageSize,
    resetPage,
    startIndex,
    endIndex,
    hasNextPage,
    hasPreviousPage,
  }
}

