import type {
  BranchMedicineStock,
  ExpiryAlert,
  PharmacyMedicine,
  PharmacySale,
} from '@/types/pharmacy'
import { daysUntilExpiryForBatch, getNearestExpiry } from './inventoryFilters'

type BranchOption = { id: string; name: string }

export type OverviewDateRange = 'today' | '7d' | '30d' | '6m' | 'year' | 'all'
export type InventoryHealthFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'dead_stock'

export const toDate = (value: unknown): Date | null => {
  if (value == null) return null
  if (typeof value === 'string') return new Date(value)
  const parsed = (value as { toDate?: () => Date })?.toDate?.()
  return parsed ? new Date(parsed) : null
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

const MEDICINE_FORM_TYPES = ['Tablets', 'Capsules', 'Syrups', 'Injections', 'Ointments', 'Drops'] as const
type MedicineFormType = (typeof MEDICINE_FORM_TYPES)[number]

const FORM_TYPE_SYNONYMS: Record<string, MedicineFormType> = {
  tablet: 'Tablets',
  tablets: 'Tablets',
  tab: 'Tablets',
  capsule: 'Capsules',
  capsules: 'Capsules',
  cap: 'Capsules',
  caps: 'Capsules',
  syrup: 'Syrups',
  syrups: 'Syrups',
  liquid: 'Syrups',
  suspension: 'Syrups',
  injection: 'Injections',
  injections: 'Injections',
  injectable: 'Injections',
  vial: 'Injections',
  ampoule: 'Injections',
  ointment: 'Ointments',
  ointments: 'Ointments',
  cream: 'Ointments',
  gel: 'Ointments',
  lotion: 'Ointments',
  drop: 'Drops',
  drops: 'Drops',
}

const matchMedicineFormType = (...candidates: Array<string | null | undefined>): MedicineFormType | null => {
  for (const raw of candidates) {
    const text = (raw ?? '').trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (FORM_TYPE_SYNONYMS[key]) return FORM_TYPE_SYNONYMS[key]
    const exact = MEDICINE_FORM_TYPES.find((form) => form.toLowerCase() === key)
    if (exact) return exact
    for (const [syn, form] of Object.entries(FORM_TYPE_SYNONYMS)) {
      if (key.includes(syn)) return form
    }
  }
  return null
}

/** Label for overview donut: dosage form when detectable, else catalog category text. */
const resolveMedicineDistributionLabel = (medicine: PharmacyMedicine): string => {
  const form = matchMedicineFormType(medicine.category, medicine.unit, medicine.packSize ?? undefined)
  if (form) return form
  const category = (medicine.category ?? '').trim()
  if (category) {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }
  return 'Uncategorized'
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
  const branchStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  const medicineIds = new Set(branchStock.map((s) => s.medicineId))
  const map = new Map<string, number>()
  medicines.forEach((m) => {
    const id = m.medicineId ?? m.id
    if (!medicineIds.has(id)) return
    const label = resolveMedicineDistributionLabel(m)
    map.set(label, (map.get(label) ?? 0) + 1)
  })
  const colors = ['var(--color-primary)', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#64748B', 'var(--color-neutral-200)']
  const sorted = Array.from(map.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
  const maxSlices = 7
  const top = sorted.slice(0, maxSlices)
  const rest = sorted.slice(maxSlices)
  const merged =
    rest.length > 0
      ? [...top, ['Other', rest.reduce((sum, [, count]) => sum + count, 0)] as [string, number]]
      : top
  return merged.map(([name, count], i) => ({ name, count, color: colors[i % colors.length] }))
}

export const computeCategoryDonutData = (
  categoryDistribution: Array<{ name: string; count: number; color: string }>
) => {
  const total = categoryDistribution.reduce((s, c) => s + c.count, 0)
  if (total === 0) {
    return [{ name: 'No data', count: 1, pct: 100, color: 'var(--color-neutral-200)' }]
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
