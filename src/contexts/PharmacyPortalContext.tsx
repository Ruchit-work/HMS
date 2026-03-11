'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

export type PharmacyPortalTabId =
  | 'overview'
  | 'inventory'
  | 'queue'
  | 'sales'
  | 'cash_and_expenses'
  | 'returns'
  | 'orders'
  | 'transfers'
  | 'reports'
  | 'users'
  | 'suppliers'

export interface PharmacyPortalContextValue {
  branches: Array<{ id: string; name: string }>
  branchFilter: string
  setBranchFilter: (id: string) => void
  setBranches: (b: Array<{ id: string; name: string }>) => void
  lowStockCount: number
  expiringCount: number
  setAlertCounts: (low: number, expiring: number) => void
  activeTab: PharmacyPortalTabId
  setActiveTab: (id: PharmacyPortalTabId) => void
  headerSearchQuery: string
  setHeaderSearchQuery: (q: string) => void
}

const PharmacyPortalContext = createContext<PharmacyPortalContextValue | undefined>(undefined)

export function PharmacyPortalProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [lowStockCount, setLowStockCount] = useState(0)
  const [expiringCount, setExpiringCount] = useState(0)
  const [activeTab, setActiveTab] = useState<PharmacyPortalTabId>('overview')
  const [headerSearchQuery, setHeaderSearchQuery] = useState('')

  const setAlertCounts = useCallback((low: number, expiring: number) => {
    setLowStockCount(low)
    setExpiringCount(expiring)
  }, [])

  const value = useMemo<PharmacyPortalContextValue>(
    () => ({
      branches,
      branchFilter,
      setBranchFilter,
      setBranches,
      lowStockCount,
      expiringCount,
      setAlertCounts,
      activeTab,
      setActiveTab,
      headerSearchQuery,
      setHeaderSearchQuery,
    }),
    [branches, branchFilter, lowStockCount, expiringCount, setAlertCounts, activeTab, headerSearchQuery]
  )

  return (
    <PharmacyPortalContext.Provider value={value}>
      {children}
    </PharmacyPortalContext.Provider>
  )
}

export function usePharmacyPortal() {
  const ctx = useContext(PharmacyPortalContext)
  return ctx
}
