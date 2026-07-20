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
 * Clears previous hospital branches immediately on hospital change and ignores stale responses.
 */
export function useBranches(
  hospitalId: string | null | undefined,
  options: UseBranchesOptions = {}
) {
  const { enabled = true, transform } = options
  const transformRef = useRef(transform)
  transformRef.current = transform
  const hospitalIdRef = useRef(hospitalId)
  hospitalIdRef.current = hospitalId

  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const requestHospitalId = hospitalId
    if (!requestHospitalId || !enabled) {
      setBranches([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await fetchBranches(requestHospitalId)
      // Ignore responses that belong to a hospital the user has already left.
      if (hospitalIdRef.current !== requestHospitalId) return
      if (!result.success) {
        setError(result.error || "Failed to load branches")
        setBranches([])
        return
      }
      const map = transformRef.current
      const next = map ? map(result.branches) : result.branches
      setBranches(next)
    } catch (err) {
      if (hospitalIdRef.current !== requestHospitalId) return
      setError(err instanceof Error ? err.message : "Failed to load branches")
      setBranches([])
    } finally {
      if (hospitalIdRef.current === requestHospitalId) {
        setLoading(false)
      }
    }
  }, [hospitalId, enabled])

  useEffect(() => {
    // Clear immediately so Super Admin never sees the previous hospital's branches.
    setBranches([])
    setError(null)
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
