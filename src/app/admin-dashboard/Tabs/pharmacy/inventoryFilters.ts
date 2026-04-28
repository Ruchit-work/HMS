import type { BranchMedicineStock, PharmacyMedicine } from '@/types/pharmacy'

type BranchOption = { id: string; name: string }

export type InventoryStatusFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
export type InventoryExpiryFilter = 'all' | 'expiring_soon' | 'expired'

export const daysUntilExpiryForBatch = (expiryStr: string): number => {
  const exp = new Date(expiryStr.slice(0, 10))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export const getNearestExpiry = (stock: BranchMedicineStock): string | null => {
  const batches = Array.isArray(stock.batches) ? stock.batches : []
  let nearest: string | null = null
  batches.forEach((b: { expiryDate?: string }) => {
    const e = (b.expiryDate || '').slice(0, 10)
    if (!e) return
    if (!nearest || e < nearest) nearest = e
  })
  return nearest
}

export const buildInventoryFilterRows = ({
  stock,
  medicines,
  branches,
  branchFilter,
  inventorySearch,
  headerSearchQuery,
  isPharmacyPortal,
  inventoryStatusFilter,
  inventorySupplierFilter,
  inventoryExpiryFilter,
}: {
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  branches: BranchOption[]
  branchFilter: string
  inventorySearch: string
  headerSearchQuery: string
  isPharmacyPortal: boolean
  inventoryStatusFilter: InventoryStatusFilter
  inventorySupplierFilter: string
  inventoryExpiryFilter: InventoryExpiryFilter
}) => {
  const filteredStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)

  const inventorySearchLower = inventorySearch.trim().toLowerCase()
  const searchFilteredStock = inventorySearchLower
    ? filteredStock.filter((s) => {
      const medName = (s.medicineName || '').toLowerCase()
      const branchName = ((branches.find((b) => b.id === s.branchId)?.name ?? s.branchId) || '').toLowerCase()
      return medName.includes(inventorySearchLower) || branchName.includes(inventorySearchLower)
    })
    : filteredStock

  const headerSearchLower = headerSearchQuery.trim().toLowerCase()
  const searchFilteredStockWithHeader = (isPharmacyPortal && headerSearchLower)
    ? searchFilteredStock.filter((s) => (s.medicineName || '').toLowerCase().includes(headerSearchLower))
    : searchFilteredStock

  const statusFilteredStock = inventoryStatusFilter === 'all'
    ? searchFilteredStockWithHeader
    : searchFilteredStockWithHeader.filter((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const minLevel = med?.minStockLevel ?? 0
      const qty = s.totalQuantity ?? 0
      if (inventoryStatusFilter === 'out_of_stock') return qty === 0
      if (inventoryStatusFilter === 'low_stock') return minLevel > 0 && qty > 0 && qty < minLevel
      if (inventoryStatusFilter === 'in_stock') return qty >= minLevel || (minLevel === 0 && qty > 0)
      return true
    })

  const supplierFilteredStock = inventorySupplierFilter === 'all'
    ? statusFilteredStock
    : statusFilteredStock.filter((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      return med?.supplierId === inventorySupplierFilter
    })

  const inventoryTableRows = inventoryExpiryFilter === 'all'
    ? supplierFilteredStock
    : supplierFilteredStock.filter((s) => {
      const nearest = getNearestExpiry(s)
      if (!nearest) return inventoryExpiryFilter === 'expired'
      const days = daysUntilExpiryForBatch(nearest)
      if (inventoryExpiryFilter === 'expiring_soon') return days >= 0 && days <= 30
      if (inventoryExpiryFilter === 'expired') return days < 0
      return true
    })

  const hasInventoryFiltersApplied = Boolean(
    inventorySearch.trim() ||
    inventoryStatusFilter !== 'all' ||
    inventorySupplierFilter !== 'all' ||
    inventoryExpiryFilter !== 'all'
  )

  return { filteredStock, inventoryTableRows, hasInventoryFiltersApplied }
}
