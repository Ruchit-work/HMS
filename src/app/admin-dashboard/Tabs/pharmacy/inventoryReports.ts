import type {
  BranchMedicineStock,
  ExpiryAlert,
  PharmacyMedicine,
  PharmacySale,
} from '@/types/pharmacy'

type BranchOption = { id: string; name: string }

type StockSoldReportPeriod = 'day' | 'week' | 'month' | 'year'

const resolveBranchName = (branches: BranchOption[], branchId: string) =>
  branches.find((b) => b.id === branchId)?.name ?? branchId

const toMs = (value: unknown): number => {
  if (typeof value === 'string') return new Date(value).getTime()
  return (value as { toDate?: () => Date })?.toDate?.()?.getTime?.() ?? 0
}

const daysUntilDate = (dateStr: string): number => {
  const exp = new Date(dateStr.slice(0, 10))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  exp.setHours(0, 0, 0, 0)
  return Math.ceil((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

export const buildExpiryReportRows = ({
  stock,
  branchFilter,
  branches,
  expiryReportDays,
}: {
  stock: BranchMedicineStock[]
  branchFilter: string
  branches: BranchOption[]
  expiryReportDays: number
}) => {
  const scopedStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  const rows: Array<{
    branchName: string
    medicineName: string
    batchNumber: string
    expiryDate: string
    quantity: number
    daysLeft: number
  }> = []
  scopedStock.forEach((s) => {
    const branchName = resolveBranchName(branches, s.branchId)
    const batches = Array.isArray(s.batches) ? s.batches : []
    batches.forEach((b: { batchNumber?: string; expiryDate?: string; quantity?: number }) => {
      const exp = (b.expiryDate || '').slice(0, 10)
      if (!exp) return
      const qty = Number(b.quantity) || 0
      if (qty <= 0) return
      const days = daysUntilDate(exp)
      if (days <= expiryReportDays) {
        rows.push({
          branchName,
          medicineName: s.medicineName || s.medicineId,
          batchNumber: b.batchNumber || '—',
          expiryDate: exp,
          quantity: qty,
          daysLeft: days,
        })
      }
    })
  })
  rows.sort((a, b) => a.daysLeft - b.daysLeft)
  return rows
}

export const buildValuationReportRows = ({
  stock,
  medicines,
  branchFilter,
  branches,
}: {
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  branchFilter: string
  branches: BranchOption[]
}) => {
  const scopedStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  const byBranch = new Map<string, { cost: number; selling: number; items: number }>()
  scopedStock.forEach((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    const cost = Number(med?.purchasePrice) ?? 0
    const selling = Number(med?.sellingPrice) ?? 0
    const qty = Number(s.totalQuantity) ?? 0
    const key = s.branchId
    const cur = byBranch.get(key) ?? { cost: 0, selling: 0, items: 0 }
    byBranch.set(key, {
      cost: cur.cost + cost * qty,
      selling: cur.selling + selling * qty,
      items: cur.items + 1,
    })
  })
  return Array.from(byBranch.entries()).map(([branchId, v]) => ({
    branchName: resolveBranchName(branches, branchId),
    branchId,
    totalCost: v.cost,
    totalSelling: v.selling,
    itemCount: v.items,
  }))
}

export const buildSalesByProductRows = ({
  sales,
  branchFilter,
}: {
  sales: PharmacySale[]
  branchFilter: string
}) => {
  const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  const map = new Map<string, { name: string; quantity: number; amount: number }>()
  salesFiltered.forEach((s) => {
    ;(s.lines || []).forEach((l: { medicineId?: string; medicineName?: string; quantity?: number; unitPrice?: number }) => {
      const id = l.medicineId || ''
      const name = l.medicineName || id
      const qty = Number(l.quantity) || 0
      const amt = qty * (Number(l.unitPrice) || 0)
      const cur = map.get(id) ?? { name, quantity: 0, amount: 0 }
      map.set(id, { name: cur.name || name, quantity: cur.quantity + qty, amount: cur.amount + amt })
    })
  })
  return Array.from(map.entries())
    .map(([id, v]) => ({ medicineId: id, medicineName: v.name, quantity: v.quantity, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)
}

export const buildSalesByBranchRows = ({
  sales,
  branchFilter,
  branches,
}: {
  sales: PharmacySale[]
  branchFilter: string
  branches: BranchOption[]
}) => {
  const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  const map = new Map<string, { count: number; amount: number }>()
  salesFiltered.forEach((s) => {
    const bid = s.branchId || ''
    const cur = map.get(bid) ?? { count: 0, amount: 0 }
    map.set(bid, { count: cur.count + 1, amount: cur.amount + (Number(s.totalAmount) || 0) })
  })
  return Array.from(map.entries())
    .map(([branchId, v]) => ({
      branchId,
      branchName: resolveBranchName(branches, branchId),
      saleCount: v.count,
      totalAmount: v.amount,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
}

export const buildOverUnderStockRows = ({
  stock,
  medicines,
  branchFilter,
  branches,
}: {
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  branchFilter: string
  branches: BranchOption[]
}) => {
  const scopedStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  const under: Array<{ branchName: string; medicineName: string; current: number; min: number; status: string }> = []
  const over: Array<{ branchName: string; medicineName: string; current: number; min: number; status: string }> = []
  scopedStock.forEach((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    const min = Number(med?.minStockLevel) ?? 0
    const current = Number(s.totalQuantity) ?? 0
    const branchName = resolveBranchName(branches, s.branchId)
    if (min > 0 && current < min) {
      under.push({ branchName, medicineName: s.medicineName || s.medicineId, current, min, status: 'Under stock' })
    } else if (min > 0 && current > min * 2) {
      over.push({ branchName, medicineName: s.medicineName || s.medicineId, current, min, status: 'Over stock' })
    }
  })
  return { under, over, all: [...under, ...over] }
}

export const buildReorderSuggestionRows = ({
  stock,
  medicines,
  sales,
  branchFilter,
  branches,
}: {
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  sales: PharmacySale[]
  branchFilter: string
  branches: BranchOption[]
}) => {
  const now = Date.now()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const cutoff = now - thirtyDaysMs
  const salesFiltered = (branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter))
    .filter((s) => toMs(s.dispensedAt) >= cutoff)
  const consumptionByBranchMed = new Map<string, number>()
  salesFiltered.forEach((s) => {
    const bid = s.branchId || ''
    ;(s.lines || []).forEach((l: { medicineId?: string; quantity?: number }) => {
      const mid = l.medicineId || ''
      if (!mid) return
      const key = `${bid}|${mid}`
      const qty = Number(l.quantity) || 0
      consumptionByBranchMed.set(key, (consumptionByBranchMed.get(key) || 0) + qty)
    })
  })
  const scopedStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  const rows: Array<{ branchName: string; medicineName: string; current: number; min: number; sold30d: number; suggestedQty: number }> = []
  scopedStock.forEach((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    const min = Number(med?.minStockLevel) ?? 0
    const current = Number(s.totalQuantity) ?? 0
    if (min <= 0 || current >= min) return
    const key = `${s.branchId}|${s.medicineId}`
    const sold30d = consumptionByBranchMed.get(key) || 0
    const reorderQty = Number(med?.reorderQuantity) ?? 0
    const toMin = min - current
    const suggestedQty = Math.max(toMin, reorderQty > 0 ? reorderQty : 1, sold30d > 0 ? Math.ceil(sold30d * 1.2) : 1)
    rows.push({
      branchName: resolveBranchName(branches, s.branchId),
      medicineName: s.medicineName || s.medicineId,
      current,
      min,
      sold30d,
      suggestedQty,
    })
  })
  rows.sort((a, b) => a.current - b.current)
  return rows
}

export const buildStockSoldReportData = ({
  stock,
  medicines,
  sales,
  branchFilter,
  stockSoldReportPeriod,
}: {
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  sales: PharmacySale[]
  branchFilter: string
  stockSoldReportPeriod: StockSoldReportPeriod
}) => {
  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfTodayMs = startOfToday.getTime()
  let periodStartMs = startOfTodayMs
  if (stockSoldReportPeriod === 'day') periodStartMs = startOfTodayMs
  else if (stockSoldReportPeriod === 'week') periodStartMs = now - 7 * oneDayMs
  else if (stockSoldReportPeriod === 'month') periodStartMs = now - 30 * oneDayMs
  else if (stockSoldReportPeriod === 'year') periodStartMs = now - 365 * oneDayMs

  const salesFiltered = (branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter))
    .filter((s) => toMs(s.dispensedAt) >= periodStartMs)
  const soldAmount = salesFiltered.reduce((sum, s) => sum + (Number(s.netAmount ?? s.totalAmount) ?? 0), 0)
  const soldCount = salesFiltered.length

  const scopedStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  let totalStockValue = 0
  scopedStock.forEach((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    const selling = Number(med?.sellingPrice) ?? 0
    const qty = Number(s.totalQuantity) ?? 0
    totalStockValue += selling * qty
  })

  return { totalStockValue, soldAmount, soldCount }
}

export const buildRecentDailyConsumptionByBranchMedicine = ({
  branchFilter,
  sales,
}: {
  branchFilter: string
  sales: PharmacySale[]
}) => {
  const map = new Map<string, number>()
  const now = Date.now()
  const cutoff = now - 30 * 24 * 60 * 60 * 1000
  const scopedSales = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  scopedSales.forEach((sale) => {
    const soldAtMs = toMs(sale.dispensedAt)
    if (!soldAtMs || soldAtMs < cutoff || soldAtMs > now) return
    const lines = Array.isArray(sale.lines) ? sale.lines : []
    lines.forEach((line) => {
      const medId = line.medicineId
      if (!medId) return
      const key = `${sale.branchId || 'unknown'}__${medId}`
      map.set(key, (map.get(key) || 0) + (Number(line.quantity) || 0))
    })
  })
  const dailyMap = new Map<string, number>()
  for (const [key, qty30d] of map.entries()) {
    dailyMap.set(key, qty30d / 30)
  }
  return dailyMap
}

export const buildInventorySummary = ({
  stock,
  medicines,
  branchFilter,
  expiring,
}: {
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  branchFilter: string
  expiring: ExpiryAlert[]
}) => {
  const scopedStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  let lowCount = 0
  let outCount = 0
  let totalValue = 0
  scopedStock.forEach((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    const minLevel = med?.minStockLevel ?? 0
    const qty = s.totalQuantity ?? 0
    totalValue += qty * (Number(med?.purchasePrice) || 0)
    if (qty === 0) outCount += 1
    else if (minLevel > 0 && qty < minLevel) lowCount += 1
  })
  const expiringCount = branchFilter === 'all' ? expiring.length : expiring.filter((e) => e.branchId === branchFilter).length
  return {
    totalMedicines: scopedStock.length,
    lowStock: lowCount,
    outOfStock: outCount,
    expiringSoon: expiringCount,
    totalValue,
  }
}

export const buildInventoryHealthDonut = ({
  stock,
  medicines,
  branchFilter,
}: {
  stock: BranchMedicineStock[]
  medicines: PharmacyMedicine[]
  branchFilter: string
}) => {
  const scopedStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
  let inStock = 0
  let lowStock = 0
  let outOfStock = 0
  let expired = 0
  const today = new Date().toISOString().slice(0, 10)
  scopedStock.forEach((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    const minLevel = med?.minStockLevel ?? 0
    const qty = s.totalQuantity ?? 0
    const batches = Array.isArray(s.batches) ? s.batches : []
    const hasExpiredBatch = batches.some((b: { expiryDate?: string }) => (b.expiryDate || '').slice(0, 10) < today)
    if (hasExpiredBatch && qty > 0) expired += 1
    else if (qty === 0) outOfStock += 1
    else if (minLevel > 0 && qty < minLevel) lowStock += 1
    else inStock += 1
  })
  return [
    { label: 'In Stock', value: inStock, color: '#22c55e' },
    { label: 'Low Stock', value: lowStock, color: '#f97316' },
    { label: 'Out of Stock', value: outOfStock, color: '#ef4444' },
    { label: 'Expired', value: expired, color: '#94a3b8' },
  ]
}
