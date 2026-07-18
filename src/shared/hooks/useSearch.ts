"use client"

import { useCallback, useState } from "react"
import { useDebounce } from "@/shared/hooks/useDebounce"

export type UseSearchOptions = {
  /** Debounce delay in ms. Default 300. */
  delay?: number
  initialValue?: string
}

/**
 * Search input state with debounced value — replaces repeated useState + useDebounce pairs.
 */
export function useSearch(options: UseSearchOptions = {}) {
  const { delay = 300, initialValue = "" } = options
  const [search, setSearch] = useState(initialValue)
  const debouncedSearch = useDebounce(search, delay)

  const clearSearch = useCallback(() => {
    setSearch("")
  }, [])

  return {
    search,
    setSearch,
    debouncedSearch,
    clearSearch,
    /** Alias used by some management tabs */
    searchTerm: search,
    setSearchTerm: setSearch,
    debouncedSearchTerm: debouncedSearch,
  }
}

export default useSearch
