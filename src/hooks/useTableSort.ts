/**
 * Table Sorting Hook
 * 
 * Provides sorting logic for tables with field and order management.
 * 
 * @example
 * const { sortField, sortOrder, handleSort, sortedItems } = useTableSort(items, {
 *   sortFields: ['name', 'email', 'createdAt']
 * })
 */

import { useState, useMemo } from 'react'

export type SortOrder = 'asc' | 'desc'

interface UseTableSortOptions<T> {
  initialSortField?: string
  initialSortOrder?: SortOrder
  sortFunction?: (items: T[], field: string, order: SortOrder) => T[]
  defaultSortField?: string
}

interface UseTableSortReturn<T> {
  sortField: string
  sortOrder: SortOrder
  handleSort: (field: string) => void
  sortedItems: T[]
  setSortField: (field: string) => void
  setSortOrder: (order: SortOrder) => void
  resetSort: () => void
}

/**
 * Hook for table sorting
 * @param items - Array of items to sort
 * @param options - Sorting options
 * @returns Sorting state and functions
 */
export function useTableSort<T>(
  items: T[],
  options: UseTableSortOptions<T> = {}
): UseTableSortReturn<T> {
  const {
    initialSortField = '',
    initialSortOrder = 'asc',
    sortFunction,
    defaultSortField = '',
  } = options

  const [sortField, setSortField] = useState(initialSortField)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder)

  // Handle sort click - toggle order if same field, otherwise set new field
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle order
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      // Set new field with ascending order
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Sort items
  const sortedItems = useMemo(() => {
    if (!sortField || !sortFunction) {
      return items
    }
    return sortFunction(items, sortField, sortOrder)
  }, [items, sortField, sortOrder, sortFunction])

  // Reset sort
  const resetSort = () => {
    setSortField(defaultSortField)
    setSortOrder('asc')
  }

  return {
    sortField,
    sortOrder,
    handleSort,
    sortedItems,
    setSortField,
    setSortOrder,
    resetSort,
  }
}

