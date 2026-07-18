/**
 * Branch selection context for the Hospital Admin Portal.
 * Single source of truth for selectedBranchId; reuses useBranches + MultiHospital.
 */

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Branch } from "@/types/branch"
import { useBranches } from "@/shared/hooks/useBranches"
import { useMultiHospital } from "@/providers/MultiHospitalProvider"

export type BranchContextValue = {
  selectedBranchId: string
  setSelectedBranchId: (branchId: string) => void
  branches: Branch[]
  selectedBranch: Branch | null
  loadingBranches: boolean
  refreshBranches: () => Promise<void>
  /** True when rendered under BranchProvider (admin portal). */
  isProvided: boolean
}

const BranchContext = createContext<BranchContextValue | null>(null)

const EMPTY_BRANCH_CONTEXT: BranchContextValue = {
  selectedBranchId: "all",
  setSelectedBranchId: () => {},
  branches: [],
  selectedBranch: null,
  loadingBranches: false,
  refreshBranches: async () => {},
  isProvided: false,
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { activeHospitalId } = useMultiHospital()
  const [selectedBranchId, setSelectedBranchIdState] = useState("all")

  const { branches, loadingBranches, refresh } = useBranches(activeHospitalId, {
    enabled: Boolean(activeHospitalId),
  })

  const setSelectedBranchId = useCallback((branchId: string) => {
    setSelectedBranchIdState(branchId)
  }, [])

  const selectedBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  )

  const value = useMemo<BranchContextValue>(
    () => ({
      selectedBranchId,
      setSelectedBranchId,
      branches,
      selectedBranch,
      loadingBranches,
      refreshBranches: refresh,
      isProvided: true,
    }),
    [
      selectedBranchId,
      setSelectedBranchId,
      branches,
      selectedBranch,
      loadingBranches,
      refresh,
    ]
  )

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  )
}

/** Strict — requires BranchProvider (admin portal shell). */
export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext)
  if (!ctx) {
    throw new Error("useBranch must be used within a BranchProvider")
  }
  return ctx
}

/**
 * Safe for admin tabs that are also mounted outside BranchProvider
 * (e.g. receptionist dashboard). Defaults match prior prop defaults (`"all"`).
 */
export function useBranchSelection(): BranchContextValue {
  return useContext(BranchContext) ?? EMPTY_BRANCH_CONTEXT
}
