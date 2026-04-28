import type {
  BranchMedicineStock,
  ExpiryAlert,
  PharmacyMedicine,
  PharmacyPurchaseOrder,
  PharmacySale,
} from '@/types/pharmacy'
import { daysUntilExpiryForBatch, getNearestExpiry } from './inventoryFilters'

type BranchOption = { id: string; name: string }

export type RecordPeriod = 'weekly' | 'monthly' | 'six_months' | 'year' | 'all'
export type OverviewDateRange = 'today' | '7d' | '30d' | '6m' | 'year' | 'all'
export type InventoryHealthFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'dead_stock'

export const toDate = (value: unknown): Date | null => {
  if (value == null) return null
  if (typeof value === 'string') return new Date(value)
  const parsed = (value as { toDate?: () => Date })?.toDate?.()
  return parsed ? new Date(parsed) : null
}

export const computeRecordTotals = ({
  recordPeriod,
  branchFilter,
  sales,
  purchaseOrders,
}: {
  recordPeriod: RecordPeriod
  branchFilter: string
  sales: PharmacySale[]
  purchaseOrders: PharmacyPurchaseOrder[]
}) => {
  const now = Date.now()
  const periodMs: Record<RecordPeriod, number | null> = {
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    six_months: 180 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
    all: null,
  }
  const cutoff = periodMs[recordPeriod] ? now - periodMs[recordPeriod]! : 0
  const salesFiltered = (branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter))
    .filter((s) => {
      const d = toDate(s.dispensedAt)
      return Boolean(d && (recordPeriod === 'all' || d.getTime() >= cutoff))
    })
  const ordersFiltered = (branchFilter === 'all' ? purchaseOrders : purchaseOrders.filter((o) => o.branchId === branchFilter))
    .filter((o) => {
      const d = toDate(o.createdAt)
      return Boolean(d && (recordPeriod === 'all' || d.getTime() >= cutoff))
    })
  const salesRecordTotal = salesFiltered.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0)
  const purchaseRecordTotal = ordersFiltered.reduce((sum, o) => sum + (Number(o.totalCost) || 0), 0)
  return { salesRecordTotal, purchaseRecordTotal }
}

export const computeLast7DaysSales = ({
  branchFilter,
  sales,
}: {
  branchFilter: string
  sales: PharmacySale[]
}) => {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  return [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    start.setTime(start.getTime() - daysAgo * dayMs)
    const end = new Date(start.getTime() + dayMs)
    const dayTotal = salesFiltered.reduce((sum, s) => {
      const d = toDate(s.dispensedAt)
      if (!d || d < start || d >= end) return sum
      return sum + (Number(s.totalAmount) || 0)
    }, 0)
    return { label: start.toLocaleDateString('en-IN', { weekday: 'short' }), value: dayTotal }
  })
}

export const computePieChartData = ({
  salesRecordTotal,
  purchaseRecordTotal,
  suppliersCount,
}: {
  salesRecordTotal: number
  purchaseRecordTotal: number
  suppliersCount: number
}) => {
  const salesVal = salesRecordTotal || 0
  const purchaseVal = purchaseRecordTotal || 0
  const suppliersVal = Math.max(suppliersCount * 5000, 0)
  const noSalesVal = Math.max(10000 - salesVal - purchaseVal - suppliersVal, 0)
  const total = salesVal + purchaseVal + suppliersVal + noSalesVal
  return [
    { label: 'Purchases', value: purchaseVal, color: '#5EEAD4' },
    { label: 'Suppliers', value: suppliersVal, color: '#86EFAC' },
    { label: 'Sales', value: salesVal, color: '#F9A8D4' },
    { label: 'No Sales', value: noSalesVal, color: '#E5E7EB' },
  ].map((s) => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 25 }))
}

const buildRangeCutoff = (overviewDateRange: OverviewDateRange): number | null => {
  const dayMs = 24 * 60 * 60 * 1000
  const cutoffMs: Record<OverviewDateRange, number | null> = {
    today: dayMs,
    '7d': 7 * dayMs,
    '30d': 30 * dayMs,
    '6m': 180 * dayMs,
    year: 365 * dayMs,
    all: null,
  }
  return cutoffMs[overviewDateRange]
}

export const computePeriodSalesTotal = ({
  overviewDateRange,
  branchFilter,
  sales,
}: {
  overviewDateRange: OverviewDateRange
  branchFilter: string
  sales: PharmacySale[]
}) => {
  const now = Date.now()
  const cutoff = buildRangeCutoff(overviewDateRange)
  const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  return salesFiltered.reduce((sum, s) => {
    const d = toDate(s.dispensedAt)
    if (!d) return sum
    if (cutoff !== null && now - d.getTime() > cutoff) return sum
    return sum + (Number(s.totalAmount) || 0)
  }, 0)
}

export const computePeriodRefundTotal = ({
  overviewDateRange,
  branchFilter,
  sales,
}: {
  overviewDateRange: OverviewDateRange
  branchFilter: string
  sales: PharmacySale[]
}) => {
  const now = Date.now()
  const cutoff = buildRangeCutoff(overviewDateRange)
  const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  return salesFiltered.reduce((sum, s) => {
    const d = toDate(s.dispensedAt)
    if (!d) return sum
    if (cutoff !== null && now - d.getTime() > cutoff) return sum
    return sum + (Number(s.refundedAmount) || 0)
  }, 0)
}

export const computePeriodSalesCount = ({
  overviewDateRange,
  branchFilter,
  sales,
}: {
  overviewDateRange: OverviewDateRange
  branchFilter: string
  sales: PharmacySale[]
}) => {
  const now = Date.now()
  const cutoff = buildRangeCutoff(overviewDateRange)
  const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  return salesFiltered.filter((s) => {
    const d = toDate(s.dispensedAt)
    if (!d) return false
    if (cutoff !== null && now - d.getTime() > cutoff) return false
    return true
  }).length
}

export const computeSalesTrendData = ({
  overviewDateRange,
  branchFilter,
  sales,
}: {
  overviewDateRange: OverviewDateRange
  branchFilter: string
  sales: PharmacySale[]
}) => {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)

  if (overviewDateRange === 'today' || overviewDateRange === '7d' || overviewDateRange === '30d') {
    const days = overviewDateRange === 'today' ? 1 : overviewDateRange === '7d' ? 7 : 30
    return Array.from({ length: days }, (_, i) => days - 1 - i).map((daysAgo) => {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      start.setTime(start.getTime() - daysAgo * dayMs)
      const end = new Date(start.getTime() + dayMs)
      const dayTotal = salesFiltered.reduce((sum, s) => {
        const d = toDate(s.dispensedAt)
        if (!d || d < start || d >= end) return sum
        return sum + (Number(s.totalAmount) || 0)
      }, 0)
      return {
        date: start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        value: dayTotal,
        fullDate: start.toISOString().slice(0, 10),
      }
    })
  }

  const monthsCount = overviewDateRange === '6m' ? 6 : 12
  const result: { date: string; value: number; fullDate: string }[] = []
  for (let i = monthsCount - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0)
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999)
    const monthTotal = salesFiltered.reduce((sum, s) => {
      const d = toDate(s.dispensedAt)
      if (!d || d < monthStart || d > monthEnd) return sum
      return sum + (Number(s.totalAmount) || 0)
    }, 0)
    result.push({
      date: monthStart.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      value: monthTotal,
      fullDate: monthStart.toISOString().slice(0, 7),
    })
  }
  return result
}

export const computeCategoryDistribution = ({
  medicines,
  stock,
  branchFilter,
}: {
  medicines: PharmacyMedicine[]
  stock: BranchMedicineStock[]
  branchFilter: string
}) => {
  const categoryList = ['Tablets', 'Capsules', 'Syrups', 'Injections', 'Ointments', 'Drops']
  const branchStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  const medicineIds = new Set(branchStock.map((s) => s.medicineId))
  const map = new Map<string, number>()
  categoryList.forEach((c) => map.set(c, 0))
  map.set('Other', 0)
  medicines.forEach((m) => {
    if (!medicineIds.has(m.medicineId ?? m.id)) return
    const cat = (m as PharmacyMedicine & { category?: string }).category || ''
    const normalized = categoryList.find((c) => c.toLowerCase() === (cat || '').toLowerCase()) || 'Other'
    map.set(normalized, (map.get(normalized) ?? 0) + 1)
  })
  const colors = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#E5E7EB']
  return Array.from(map.entries())
    .filter(([, count]) => count > 0)
    .map(([name, count], i) => ({ name, count, color: colors[i % colors.length] }))
    .sort((a, b) => b.count - a.count)
}

export const computeCategoryDonutData = (
  categoryDistribution: Array<{ name: string; count: number; color: string }>
) => {
  const total = categoryDistribution.reduce((s, c) => s + c.count, 0)
  if (total === 0) {
    return [{ name: 'No data', count: 1, pct: 100, color: '#E5E7EB' }]
  }
  return categoryDistribution.map((c) => ({ ...c, pct: (c.count / total) * 100 }))
}

export const computeInventoryHealthCounts = ({
  stock,
  medicines,
  branchFilter,
  expiring,
  sales,
}: {
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  branchFilter: string
  expiring: ExpiryAlert[]
  sales: PharmacySale[]
}) => {
  const branchStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  let inStock = 0
  let lowStockCount = 0
  let outOfStock = 0
  let deadStock = 0
  const deadStockIds: string[] = []

  const now = new Date()
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const salesInWindow = sales.filter((sale) => {
    const dRaw = sale.dispensedAt
    if (!dRaw) return false
    const d = typeof dRaw === 'string' ? new Date(dRaw) : (dRaw as { toDate?: () => Date })?.toDate?.() ?? null
    if (!d) return false
    return d >= cutoff && d <= now
  })
  const soldMap = new Map<string, number>()
  salesInWindow.forEach((sale) => {
    const lines = sale.lines || []
    lines.forEach((l) => {
      const id = l.medicineId || l.medicineName || ''
      if (!id) return
      const qty = Number(l.quantity) || 0
      if (qty <= 0) return
      soldMap.set(id, (soldMap.get(id) || 0) + qty)
    })
  })

  const soldValues = Array.from(soldMap.values()).filter((v) => v > 0).sort((a, b) => a - b)
  const threshold = soldValues.length > 0 ? soldValues[Math.floor(soldValues.length * 0.2)] || soldValues[0] : 0

  branchStock.forEach((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    const min = med?.minStockLevel ?? 0
    const qty = s.totalQuantity ?? 0
    const soldQty = soldMap.get(s.medicineId || s.medicineName || '') || 0

    if (qty <= 0) outOfStock += 1
    else if (min > 0 && qty < min) lowStockCount += 1
    else {
      inStock += 1
      if (threshold > 0 && soldQty > 0 && soldQty <= threshold) {
        deadStock += 1
        if (s.medicineId) deadStockIds.push(s.medicineId)
      }
    }
  })

  const expiringSoon = branchFilter === 'all'
    ? expiring.length
    : expiring.filter((e) => e.branchId === branchFilter).length

  return { inStock, lowStock: lowStockCount, outOfStock, expiringSoon, deadStock, deadStockIds }
}

export const computeInventoryHealthItems = ({
  inventoryHealthFilter,
  stock,
  medicines,
  branches,
  branchFilter,
  expiring,
  deadStockIds,
}: {
  inventoryHealthFilter: InventoryHealthFilter
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  branches: BranchOption[]
  branchFilter: string
  expiring: ExpiryAlert[]
  deadStockIds: string[]
}) => {
  if (inventoryHealthFilter === 'all') return []
  const branchStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  const deadIds = new Set<string>(deadStockIds || [])
  return branchStock
    .map((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const min = med?.minStockLevel ?? 0
      const qty = s.totalQuantity ?? 0
      const branchName = branches.find((b) => b.id === s.branchId)?.name ?? s.branchId
      const nearestExpiry = getNearestExpiry(s)
      const daysLeft = nearestExpiry ? daysUntilExpiryForBatch(nearestExpiry) : null
      const hasExpiring = expiring.some((e) => e.medicineId === s.medicineId && e.branchId === s.branchId)

      let category: Exclude<InventoryHealthFilter, 'all'> = 'in_stock'
      if (qty <= 0) category = 'out_of_stock'
      else if (min > 0 && qty < min) category = 'low_stock'
      else if (hasExpiring) category = 'expiring_soon'
      else if (deadIds.has(s.medicineId)) category = 'dead_stock'

      return {
        id: s.id,
        medicineName: s.medicineName || med?.name || s.medicineId,
        branchName,
        qty,
        minLevel: min,
        nearestExpiry,
        daysLeft,
        category,
      }
    })
    .filter((row) => row.category === inventoryHealthFilter)
}
