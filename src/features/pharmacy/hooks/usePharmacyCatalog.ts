'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { fetchBranches } from '@/services/BranchService'
import type { Branch } from '@/types/branch'
import type {
  PharmacyMedicine,
  BranchMedicineStock,
  PharmacySupplier,
  PharmacySale,
  LowStockAlert,
  ExpiryAlert,
  StockTransfer,
  PharmacyPurchaseOrder,
} from '@/types/pharmacy'
import type { PharmacyPortalContextValue } from '@/providers/PharmacyPortalProvider'
import { createPharmacyApiClient } from '@/features/pharmacy/pharmacyApiClient'
import type { QueueItem } from '@/features/pharmacy/queueTypes'

const FETCH_PHARMACY_TIMEOUT_MS = 60000

type PharmacyAnalytics = {
  totalMedicines: number
  totalStockItems: number
  lowStockCount: number
  expiringCount: number
  dailySalesTotal: number
  mostPrescribed: Array<{ medicineName: string; count: number }>
}

export type UsePharmacyCatalogParams = {
  activeHospitalId: string | null | undefined
  isSuperAdmin: boolean
  isAdmin: boolean
  isPharmacyPortal: boolean
  branchFilter: string
  branchFilterRef: MutableRefObject<string>
  portalRef: MutableRefObject<PharmacyPortalContextValue | null | undefined>
  getToken: () => Promise<string | null>
  setError: (message: string | null) => void
}

export function usePharmacyCatalog({
  activeHospitalId,
  isSuperAdmin,
  isAdmin,
  isPharmacyPortal,
  branchFilter,
  branchFilterRef,
  portalRef,
  getToken,
  setError,
}: UsePharmacyCatalogParams) {
  const [loading, setLoading] = useState(true)
  const [branches, setBranchesState] = useState<Array<{ id: string; name: string }>>([])
  const [medicines, setMedicines] = useState<PharmacyMedicine[]>([])
  const [stock, setStock] = useState<BranchMedicineStock[]>([])
  const [suppliers, setSuppliers] = useState<PharmacySupplier[]>([])
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([])
  const [expiring, setExpiring] = useState<ExpiryAlert[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [sales, setSales] = useState<PharmacySale[]>([])
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [pharmacists, setPharmacists] = useState<
    Array<{ id: string; email: string; firstName: string; lastName: string; branchName: string }>
  >([])
  const [purchaseOrders, setPurchaseOrders] = useState<PharmacyPurchaseOrder[]>([])
  const [analytics, setAnalytics] = useState<PharmacyAnalytics | null>(null)

  const loadBranches = useCallback(async () => {
    if (!activeHospitalId) return
    const result = await fetchBranches(activeHospitalId)
    if (result.success) {
      const list = result.branches.map((b: Branch) => ({ id: b.id, name: b.name }))
      setBranchesState(list)
      const p = portalRef.current
      if (isPharmacyPortal && p) p.setBranches(list)
    }
  }, [activeHospitalId, isPharmacyPortal, portalRef])

  const fetchPharmacy = useCallback(
    async (silent = false) => {
      if (!activeHospitalId) {
        if (!silent) setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      setError(null)
      const token = await getToken()
      if (!token) {
        if (!silent) setLoading(false)
        return
      }
      const client = createPharmacyApiClient(token)
      const currentBranch = branchFilterRef.current
      const scopedBranchId = currentBranch !== 'all' ? currentBranch : undefined

      const runFetches = async () => {
        const [
          medRes,
          stockRes,
          suppliersRes,
          alertsRes,
          queueRes,
          salesRes,
          analyticsRes,
          transfersRes,
          pharmacistsRes,
          ordersRes,
        ] = await Promise.all([
          client.getMedicines({ hospitalId: activeHospitalId }),
          client.getStock({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
          client.getSuppliers({ hospitalId: activeHospitalId }),
          client.getAlerts({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
          client.getPrescriptionQueue({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
          client.getSales({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
          client.getAnalytics({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
          isSuperAdmin ? client.getTransfers({ hospitalId: activeHospitalId }) : Promise.resolve(null),
          isAdmin ? client.getPharmacists() : Promise.resolve(null),
          client.getPurchaseOrders({ hospitalId: activeHospitalId, branchId: scopedBranchId }),
        ])

        if (medRes.ok && medRes.data.success) {
          setMedicines((medRes.data.medicines as PharmacyMedicine[] | undefined) || [])
        }
        if (stockRes.ok && stockRes.data.success) {
          setStock((stockRes.data.stock as BranchMedicineStock[] | undefined) || [])
        }
        if (suppliersRes.ok && suppliersRes.data.success) {
          setSuppliers((suppliersRes.data.suppliers as PharmacySupplier[] | undefined) || [])
        }
        if (alertsRes.ok && alertsRes.data.success) {
          const nextLowStock = (alertsRes.data.lowStock as LowStockAlert[] | undefined) || []
          const nextExpiring = (alertsRes.data.expiring as ExpiryAlert[] | undefined) || []
          setLowStock(nextLowStock)
          setExpiring(nextExpiring)
          const p = portalRef.current
          if (isPharmacyPortal && p) p.setAlertCounts(nextLowStock.length, nextExpiring.length)
        }
        if (queueRes.ok && queueRes.data.success) {
          setQueue((queueRes.data.queue as QueueItem[] | undefined) || [])
        }
        if (salesRes.ok && salesRes.data.success) {
          setSales((salesRes.data.sales as PharmacySale[] | undefined) || [])
        }
        if (analyticsRes.ok && analyticsRes.data.success && analyticsRes.data.analytics) {
          setAnalytics(
            analyticsRes.data.analytics as {
              totalMedicines: number
              totalStockItems: number
              lowStockCount: number
              expiringCount: number
              dailySalesTotal: number
              mostPrescribed: Array<{ medicineName: string; count: number }>
            }
          )
        }
        if (transfersRes?.ok && transfersRes.data.success) {
          setTransfers((transfersRes.data.transfers as StockTransfer[] | undefined) || [])
        }
        if (pharmacistsRes?.ok && pharmacistsRes.data.success) {
          setPharmacists(
            (pharmacistsRes.data.pharmacists as Array<{
              id: string
              email: string
              firstName: string
              lastName: string
              branchName: string
            }> | undefined) || []
          )
        }
        if (ordersRes.ok && ordersRes.data.success) {
          setPurchaseOrders((ordersRes.data.orders as PharmacyPurchaseOrder[] | undefined) || [])
        }
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), FETCH_PHARMACY_TIMEOUT_MS)
      })

      try {
        await Promise.race([runFetches(), timeoutPromise])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load pharmacy data'
        if (msg.includes('Request timed out') && isPharmacyPortal) {
          console.warn('Pharmacy portal initial load timed out; showing partial data.')
        } else {
          setError(msg)
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [
      activeHospitalId,
      isSuperAdmin,
      isAdmin,
      getToken,
      branchFilterRef,
      portalRef,
      isPharmacyPortal,
      setError,
    ]
  )

  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    loadBranches()
  }, [loadBranches])

  useEffect(() => {
    const isInitial = !hasLoadedOnceRef.current
    if (isInitial) hasLoadedOnceRef.current = true
    fetchPharmacy(isInitial ? false : true)
  }, [fetchPharmacy, branchFilter])

  return {
    loading,
    setLoading,
    branches,
    setBranchesState,
    medicines,
    setMedicines,
    stock,
    setStock,
    suppliers,
    setSuppliers,
    lowStock,
    setLowStock,
    expiring,
    setExpiring,
    queue,
    setQueue,
    sales,
    setSales,
    transfers,
    setTransfers,
    pharmacists,
    setPharmacists,
    purchaseOrders,
    setPurchaseOrders,
    analytics,
    setAnalytics,
    loadBranches,
    fetchPharmacy,
  }
}
