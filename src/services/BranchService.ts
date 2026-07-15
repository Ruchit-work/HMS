/**
 * BranchService — shared branch list/fetch helpers.
 * Preserves existing /api/branches behavior (auth header + hospitalId query).
 */

import { auth } from "@/firebase/config"
import type { Branch } from "@/types/branch"

export type BranchListResult = {
  success: boolean
  branches: Branch[]
  error?: string
}

/**
 * Fetch branches for a hospital via the existing API route.
 * Callers that previously used fetch(`/api/branches?hospitalId=…`) should use this.
 */
export async function fetchBranches(
  hospitalId: string,
  options?: { token?: string | null }
): Promise<BranchListResult> {
  if (!hospitalId) {
    return { success: false, branches: [], error: "Hospital ID is required" }
  }

  try {
    let token = options?.token ?? null
    if (!token) {
      const currentUser = auth.currentUser
      if (!currentUser) {
        return { success: false, branches: [], error: "Not authenticated" }
      }
      token = await currentUser.getIdToken()
    }

    const response = await fetch(
      `/api/branches?hospitalId=${encodeURIComponent(hospitalId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await response.json()

    if (data.success && Array.isArray(data.branches)) {
      return { success: true, branches: data.branches as Branch[] }
    }

    return {
      success: false,
      branches: [],
      error: typeof data.error === "string" ? data.error : "Failed to load branches",
    }
  } catch (err) {
    return {
      success: false,
      branches: [],
      error: err instanceof Error ? err.message : "Failed to load branches",
    }
  }
}

export const BranchService = {
  fetchBranches,
}

export default BranchService
