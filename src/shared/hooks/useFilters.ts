"use client"

import { useCallback, useMemo, useState } from "react"

export type UseFiltersOptions<T extends Record<string, unknown>> = {
  initial: T
}

/**
 * Generic filter-state helper for management / analytics screens.
 */
export function useFilters<T extends Record<string, unknown>>(options: UseFiltersOptions<T>) {
  const { initial } = options
  const [filters, setFilters] = useState<T>(initial)

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(initial)
  }, [initial])

  const hasActiveFilters = useMemo(() => {
    return (Object.keys(filters) as Array<keyof T>).some((key) => {
      const value = filters[key]
      const baseline = initial[key]
      if (value === "all" || value === "" || value === null || value === undefined) {
        return false
      }
      return value !== baseline
    })
  }, [filters, initial])

  return {
    filters,
    setFilters,
    setFilter,
    resetFilters,
    hasActiveFilters,
  }
}

export default useFilters
