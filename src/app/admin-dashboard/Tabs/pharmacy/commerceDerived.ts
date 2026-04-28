import type {
  PharmacyCashierProfile,
  PharmacyCounter,
  PharmacyPurchaseOrder,
  PharmacySale,
  PharmacySupplier,
} from '@/types/pharmacy'
import { toDate } from './overviewDerived'

export const filterSalesRecords = ({
  sales,
  branchFilter,
  search,
  date,
  paymentFilter,
  minAmount,
  maxAmount,
}: {
  sales: PharmacySale[]
  branchFilter: string
  search: string
  date: string
  paymentFilter: string
  minAmount: string
  maxAmount: string
}) => {
  const base = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  const term = search.trim().toLowerCase()
  return base.filter((s) => {
    if (date) {
      const d = toDate(s.dispensedAt)
      if (!d) return false
      const selected = new Date(date)
      d.setHours(0, 0, 0, 0)
      selected.setHours(0, 0, 0, 0)
      if (d.getTime() !== selected.getTime()) return false
    }
    if (paymentFilter !== 'all') {
      const mode = (s.paymentMode || 'unknown').toString()
      if (mode !== paymentFilter) return false
    }
    if (minAmount || maxAmount) {
      const amt = Number(s.netAmount ?? s.totalAmount ?? 0)
      if (minAmount && amt < Number(minAmount)) return false
      if (maxAmount && amt > Number(maxAmount)) return false
    }
    if (!term) return true
    const invoice = (s.invoiceNumber || '').toString().toLowerCase()
    const name = (s.patientName || '').toLowerCase()
    const phone = (s.customerPhone || '').toLowerCase()
    const meds = (s.lines || []).map((l) => l.medicineName).join(' ').toLowerCase()
    return invoice.includes(term) || name.includes(term) || phone.includes(term) || meds.includes(term)
  })
}

export const computeTotalRefundForFilteredSales = (sales: PharmacySale[]) =>
  sales.reduce((sum, s) => sum + (Number(s.refundedAmount) || 0), 0)

export const buildReturnEvents = ({
  sales,
  branchFilter,
}: {
  sales: PharmacySale[]
  branchFilter: string
}) => {
  const base = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  const events: Array<{
    id: string
    saleId: string
    invoice: string
    patientName: string
    phone: string
    createdAt: Date | null
    amount: number
    paymentMode: string | null
    lines: Array<{
      medicineId: string
      medicineName: string
      quantity: number
      unitPrice: number
    }>
  }> = []
  base.forEach((s) => {
    if (!s.returns || s.returns.length === 0) return
    const saleLineMap = new Map<string, { medicineName: string; unitPrice: number }>()
    ;(s.lines || []).forEach((l) => saleLineMap.set(l.medicineId, { medicineName: l.medicineName, unitPrice: l.unitPrice }))
    s.returns.forEach((r) => {
      const createdAt = toDate(r.createdAt)
      events.push({
        id: r.id,
        saleId: s.id,
        invoice: s.invoiceNumber || s.id,
        patientName: s.patientName || 'Walk-in',
        phone: s.customerPhone || '',
        createdAt,
        amount: Number(r.amount) || 0,
        paymentMode: (s.paymentMode as string) || null,
        lines: (r.lines || []).map((rl) => {
          const baseLine = saleLineMap.get(rl.medicineId)
          return {
            medicineId: rl.medicineId,
            medicineName: baseLine?.medicineName || '',
            quantity: rl.quantity,
            unitPrice: baseLine?.unitPrice ?? 0,
          }
        }),
      })
    })
  })
  events.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0
    if (!a.createdAt) return 1
    if (!b.createdAt) return -1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
  return events
}

export const computePoStatusCounts = ({
  branchFilter,
  purchaseOrders,
}: {
  branchFilter: string
  purchaseOrders: PharmacyPurchaseOrder[]
}) => {
  const list = branchFilter === 'all' ? purchaseOrders : purchaseOrders.filter((o) => o.branchId === branchFilter)
  const pending = list.filter((o) => (o.status ?? '').toLowerCase() === 'pending').length
  const received = list.filter((o) => (o.status ?? '').toLowerCase() === 'received').length
  const cancelled = list.filter((o) => (o.status ?? '').toLowerCase() === 'cancelled').length
  return { pending, received, cancelled }
}

export const computeOrdersForTable = ({
  purchaseOrders,
  branchFilter,
}: {
  purchaseOrders: PharmacyPurchaseOrder[]
  branchFilter: string
}) => (branchFilter === 'all' ? purchaseOrders : purchaseOrders.filter((o) => o.branchId === branchFilter))

export const filterSuppliers = ({
  suppliers,
  supplierSearchQuery,
  isPharmacyPortal,
  headerSearchQuery,
}: {
  suppliers: PharmacySupplier[]
  supplierSearchQuery: string
  isPharmacyPortal: boolean
  headerSearchQuery: string
}) => {
  const q = supplierSearchQuery.trim().toLowerCase()
  let filtered = q
    ? suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.contactPerson?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q),
    )
    : suppliers
  if (isPharmacyPortal && headerSearchQuery.trim()) {
    const hq = headerSearchQuery.trim().toLowerCase()
    filtered = filtered.filter(
      (s) =>
        s.name?.toLowerCase().includes(hq) ||
        s.contactPerson?.toLowerCase().includes(hq) ||
        s.email?.toLowerCase().includes(hq) ||
        s.phone?.includes(hq),
    )
  }
  return filtered
}

export const filterCashiers = ({
  cashiers,
  cashierSearchQuery,
}: {
  cashiers: PharmacyCashierProfile[]
  cashierSearchQuery: string
}) => {
  const q = cashierSearchQuery.trim().toLowerCase()
  if (!q) return cashiers
  return cashiers.filter((c) => {
    const name = (c.name || '').toLowerCase()
    const phone = (c.phone || '').toLowerCase()
    return name.includes(q) || phone.includes(q)
  })
}

export const filterCounters = ({
  counters,
  counterSearchQuery,
}: {
  counters: PharmacyCounter[]
  counterSearchQuery: string
}) => {
  const q = counterSearchQuery.trim().toLowerCase()
  if (!q) return counters
  return counters.filter((c) => (c.name || '').toLowerCase().includes(q))
}

export const computePaymentModeSummary = ({
  sales,
  branchFilter,
}: {
  sales: PharmacySale[]
  branchFilter: string
}) => {
  const base = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  const summary: Record<string, { count: number; amount: number }> = {}
  base.forEach((s) => {
    const mode = (s.paymentMode || 'unknown') as string
    if (!summary[mode]) summary[mode] = { count: 0, amount: 0 }
    summary[mode].count += 1
    summary[mode].amount += Number(s.totalAmount) || 0
  })
  return summary
}

export const computeTopSellingMedicines = (
  mostPrescribed: Array<{ medicineName: string; count: number }> | undefined
) => {
  const list = mostPrescribed || []
  return list.slice(0, 8).map((m) => ({ name: m.medicineName || '—', count: m.count || 0 }))
}

export const filterOverviewRecentSales = ({
  branchFilter,
  sales,
  overviewRecentSalesSearch,
}: {
  branchFilter: string
  sales: PharmacySale[]
  overviewRecentSalesSearch: string
}) => {
  const list = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
  if (!overviewRecentSalesSearch.trim()) return list.slice(0, 10)
  const q = overviewRecentSalesSearch.toLowerCase()
  return list.filter((s) => {
    const name = (s.patientName ?? '').toLowerCase()
    const meds = (s.lines?.map((l) => l.medicineName).join(' ') ?? '').toLowerCase()
    const phone = (s.customerPhone ?? '').toLowerCase()
    return name.includes(q) || meds.includes(q) || phone.includes(q)
  }).slice(0, 10)
}
