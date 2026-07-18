"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Branch } from "@/types/branch"
import { fetchBranches } from "@/services/BranchService"

export type UseBranchesOptions = {
  enabled?: boolean
  /** Optional map/transform after fetch (e.g. doctor branchIds filter). Stored in a ref to avoid refetch loops. */
  transform?: (branches: Branch[]) => Branch[]
}

/**
 * Load branches for a hospital via BranchService (replaces repeated fetch effects).
 */
export function useBranches(
  hospitalId: string | null | undefined,
  options: UseBranchesOptions = {}
) {
  const { enabled = true, transform } = options
  const transformRef = useRef(transform)
  transformRef.current = transform

  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!hospitalId || !enabled) {
      setBranches([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await fetchBranches(hospitalId)
      if (!result.success) {
        setError(result.error || "Failed to load branches")
        setBranches([])
        return
      }
      const map = transformRef.current
      const next = map ? map(result.branches) : result.branches
      setBranches(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load branches")
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [hospitalId, enabled])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    branches,
    setBranches,
    loading,
    loadingBranches: loading,
    error,
    refresh,
  }
}

export default useBranches
