import React from 'react'
import { Button } from '@/shared/components'
import { FilterChip } from '@/shared/components'
import { TableShell } from '@/shared/components'
import type { ExpiryAlert, LowStockAlert, PharmacySale } from '@/types/pharmacy'
import type { OverviewDateRange } from '@/features/pharmacy/utils/overviewDerived'
import {
  PhOpsShell,
  PhOpsPageHeader,
  PhOpsSectionLabel,
  PhOpsMetricGrid,
  PhOpsMetricCard,
  PhOpsPrescriptionQueueCard,
  PhOpsPanel,
  PhOpsWorkflowStrip,
  PhOpsLowStockAlertCard,
  PhOpsExpiryAlertCard,
  PhOpsAlertCard,
  PhOpsEmptyState,
  PhOpsStatusBadge,
  PhOpsBillingSummaryCard,
} from '@/features/pharmacy/ui/PhOps'

type BranchOption = { id: string; name: string }
type AnalyticsSummary = {
  totalMedicines: number
  lowStockCount: number
  expiringCount: number
  mostPrescribed: Array<{ medicineName: string; count: number }>
} | null

type PaymentModeSummary = Record<string, { count: number; amount: number }>

type InventoryHealthCounts = {
  inStock: number
  lowStock: number
  outOfStock: number
  expiringSoon: number
  deadStock: number
}

type InventoryHealthItem = {
  id: string
  medicineName: string
  branchName: string
  qty: number
  minLevel: number
  nearestExpiry: string | null
  daysLeft: number | null
}

const RANGE_LABEL: Record<OverviewDateRange, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  '6m': '6 months',
  year: 'Year',
  all: 'All time',
}

export function OverviewTabContent(props: {
  overviewDateRange: OverviewDateRange
  setOverviewDateRange: (value: OverviewDateRange) => void
  branches: BranchOption[]
  branchFilter: string
  setBranchFilter: (id: string) => void
  analytics: AnalyticsSummary
  medicinesCount: number
  lowStock: LowStockAlert[]
  expiring: ExpiryAlert[]
  applyInventoryQuickFilter: (filter: 'low_stock' | 'expiring_soon') => void
  periodRefundTotal: number
  periodSalesTotal: number
  queueCount: number
  poStatusCounts: { pending: number; received: number; cancelled: number }
  paymentModeSummary: PaymentModeSummary
  salesTrendData: Array<{ date: string; value: number }>
  topSellingMedicines: Array<{ name: string; count: number }>
  categoryDonutData: Array<{ name: string; pct: number; color: string }>
  inventoryHealthFilter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'dead_stock'
  setInventoryHealthFilter: (value: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'dead_stock') => void
  inventoryHealthCounts: InventoryHealthCounts
  inventoryHealthItems: InventoryHealthItem[]
  recentSalesFiltered: PharmacySale[]
  isPharmacyPortal: boolean
  headerSearchQuery: string
  onGoToQueue?: () => void
  onGoToOrders?: () => void
  onGoToBilling?: () => void
  onGoToCash?: () => void
}): React.JSX.Element {
  const {
    overviewDateRange,
    setOverviewDateRange,
    branches,
    branchFilter,
    setBranchFilter,
    analytics,
    medicinesCount,
    lowStock,
    expiring,
    applyInventoryQuickFilter,
    periodRefundTotal,
    periodSalesTotal,
    queueCount,
    poStatusCounts,
    paymentModeSummary,
    salesTrendData,
    topSellingMedicines,
    categoryDonutData,
    inventoryHealthFilter,
    setInventoryHealthFilter,
    inventoryHealthCounts,
    inventoryHealthItems,
    recentSalesFiltered,
    isPharmacyPortal,
    headerSearchQuery,
    onGoToQueue,
    onGoToOrders,
    onGoToBilling,
    onGoToCash,
  } = props

  const lowCount = analytics?.lowStockCount ?? lowStock.length
  const expiryCount = analytics?.expiringCount ?? expiring.length
  const cashCollected = Object.entries(paymentModeSummary).reduce((sum, [, row]) => sum + (row?.amount ?? 0), 0)
  const salesLabel =
    overviewDateRange === 'today'
      ? "Today's sales"
      : `Sales (${RANGE_LABEL[overviewDateRange]})`

  return (
    <PhOpsShell>
      <PhOpsPageHeader
        eyebrow="Pharmacy Operations Center"
        title="Today at the counter"
        description="Receive → verify stock → dispense → invoice → collect payment → restock. Scan alerts first, then work the queue."
        actions={
          <>
            <div className="flex flex-wrap gap-1.5">
              {(['today', '7d', '30d', '6m', 'year', 'all'] as OverviewDateRange[]).map((range) => (
                <FilterChip key={range} active={overviewDateRange === range} onClick={() => setOverviewDateRange(range)}>
                  {RANGE_LABEL[range]}
                </FilterChip>
              ))}
            </div>
            {branches.length > 1 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="ph-ops-input"
                aria-label="Branch filter"
              >
                <option value="all">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            {onGoToBilling ? (
              <Button type="button" size="sm" variant="primary" onClick={onGoToBilling}>
                Open POS
              </Button>
            ) : null}
          </>
        }
      />

      <PhOpsWorkflowStrip
        steps={[
          { label: 'Receive Rx', active: queueCount > 0, done: queueCount === 0 },
          { label: 'Verify stock', active: lowCount > 0 },
          { label: 'Dispense' },
          { label: 'Invoice' },
          { label: 'Collect payment' },
          { label: 'Restock', active: poStatusCounts.pending > 0 },
          { label: 'Close counter' },
        ]}
      />

      <PhOpsSectionLabel>Today&apos;s operations</PhOpsSectionLabel>
      <PhOpsMetricGrid columns={6}>
        <PhOpsPrescriptionQueueCard
          label="Prescriptions waiting"
          value={queueCount}
          hint="Ready to dispense"
          actionLabel={onGoToQueue ? 'Open queue' : undefined}
          onClick={onGoToQueue}
        />
        <PhOpsMetricCard
          label="Low stock"
          value={lowCount}
          hint={lowCount > 0 ? 'Needs reorder' : 'Within threshold'}
          tone={lowCount > 0 ? 'warn' : 'ok'}
          actionLabel={lowCount > 0 ? 'Review inventory' : undefined}
          onClick={lowCount > 0 ? () => applyInventoryQuickFilter('low_stock') : undefined}
        />
        <PhOpsMetricCard
          label="Expiring soon"
          value={expiryCount}
          hint={expiryCount > 0 ? 'Next 30–90 days' : 'No near-expiry risk'}
          tone={expiryCount > 0 ? 'danger' : 'ok'}
          actionLabel={expiryCount > 0 ? 'Review expiry' : undefined}
          onClick={expiryCount > 0 ? () => applyInventoryQuickFilter('expiring_soon') : undefined}
        />
        <PhOpsMetricCard
          label={salesLabel}
          value={`₹${periodSalesTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          hint="Revenue"
          tone="ok"
        />
        <PhOpsMetricCard
          label="Pending POs"
          value={poStatusCounts.pending}
          hint={`${poStatusCounts.received} received · ${poStatusCounts.cancelled} cancelled`}
          tone={poStatusCounts.pending > 0 ? 'warn' : 'neutral'}
          actionLabel={onGoToOrders ? 'Purchase orders' : undefined}
          onClick={onGoToOrders}
        />
        <PhOpsMetricCard
          label="Cash counter"
          value={`₹${cashCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          hint={`Returns ₹${periodRefundTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          tone="info"
          actionLabel={onGoToCash ? 'Cash & expenses' : undefined}
          onClick={onGoToCash}
        />
      </PhOpsMetricGrid>

      <PhOpsSectionLabel>Alert center</PhOpsSectionLabel>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <PhOpsLowStockAlertCard
          title="Low stock"
          count={lowCount}
          description="Medicines below minimum level"
          actionLabel="Open inventory"
          onAction={lowCount > 0 ? () => applyInventoryQuickFilter('low_stock') : undefined}
        />
        <PhOpsExpiryAlertCard
          title="Near expiry"
          count={expiryCount}
          description="Batches approaching expiry"
          actionLabel="Open inventory"
          onAction={expiryCount > 0 ? () => applyInventoryQuickFilter('expiring_soon') : undefined}
        />
        <PhOpsAlertCard
          title="Out of stock"
          count={inventoryHealthCounts.outOfStock}
          description="Cannot dispense until restocked"
          tone="danger"
          actionLabel="Filter health"
          onAction={
            inventoryHealthCounts.outOfStock > 0
              ? () => setInventoryHealthFilter('out_of_stock')
              : undefined
          }
        />
        <PhOpsAlertCard
          title="Pending deliveries"
          count={poStatusCounts.pending}
          description="Purchase orders awaiting receipt"
          tone="warn"
          actionLabel="Orders"
          onAction={onGoToOrders}
        />
      </div>

      <div className="ph-ops-workspace ph-ops-workspace--split">
        <div className="space-y-3 min-w-0">
          <PhOpsBillingSummaryCard
            title="Payments by mode"
            subtitle={`Collected this period${branchFilter !== 'all' ? ' · current branch' : ''}`}
            actions={
              onGoToCash ? (
                <Button type="button" size="sm" variant="outline" onClick={onGoToCash}>
                  Close counter
                </Button>
              ) : null
            }
          >
            <TableShell>
              <table className="min-w-[320px] w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-[var(--color-neutral-200)]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-700">Payment mode</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-700">Bills</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {['cash', 'upi', 'card', 'credit', 'other', 'unknown'].map((mode) => {
                    const row = paymentModeSummary[mode]
                    if (!row) return null
                    const label =
                      mode === 'cash'
                        ? 'Cash'
                        : mode === 'upi'
                          ? 'UPI'
                          : mode === 'card'
                            ? 'Card'
                            : mode === 'credit'
                              ? 'Credit'
                              : mode === 'other'
                                ? 'Other / Insurance'
                                : 'Not set'
                    return (
                      <tr key={mode} className="border-b border-[var(--color-neutral-200)] last:border-0">
                        <td className="px-3 py-2 text-slate-800">{label}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{row.count}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">₹{row.amount.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableShell>
          </PhOpsBillingSummaryCard>

          <PhOpsPanel
            title="Sales trend"
            subtitle={
              overviewDateRange === 'today'
                ? 'Today'
                : overviewDateRange === '7d'
                  ? 'Last 7 days'
                  : overviewDateRange === '30d'
                    ? 'Last 30 days'
                    : overviewDateRange === '6m'
                      ? 'By month (6 months)'
                      : overviewDateRange === 'year'
                        ? 'By month (year)'
                        : 'By month (last 12 months)'
            }
          >
            <div className="h-48 w-full">
              {salesTrendData.length === 0 ? (
                <PhOpsEmptyState title="No sales data" description="Dispense or walk-in sales will appear here." />
              ) : (
                <svg viewBox="0 0 400 160" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="phOpsSalesGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0f766e" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const maxVal = Math.max(...salesTrendData.map((d) => d.value), 1)
                    const pts = salesTrendData
                      .map((d, i) => {
                        const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                        const y = 140 - (d.value / maxVal) * 120
                        return `${x},${y}`
                      })
                      .join(' ')
                    const areaPoints = `${pts} 390,140 10,140`
                    return (
                      <>
                        <polyline fill="url(#phOpsSalesGrad)" points={areaPoints} />
                        <polyline fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                        {salesTrendData.map((d, i) => {
                          const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                          const y = 140 - (d.value / maxVal) * 120
                          return <circle key={i} cx={x} cy={y} r="3" fill="#0f766e" />
                        })}
                      </>
                    )
                  })()}
                </svg>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 justify-between text-xs text-slate-500">
              {salesTrendData
                .filter((_, i) => (overviewDateRange === '30d' ? i % 5 === 0 : true))
                .slice(0, 12)
                .map((d, i) => (
                  <span key={i}>{d.date}</span>
                ))}
            </div>
          </PhOpsPanel>

          <div className="grid gap-3 lg:grid-cols-3">
            <PhOpsPanel title="High-demand medicines" subtitle="Top sellers this period" className="lg:col-span-2">
              {topSellingMedicines.length === 0 ? (
                <PhOpsEmptyState title="No sales data" />
              ) : (
                <div className="flex flex-col gap-2.5">
                  {topSellingMedicines.map((m, i) => {
                    const maxQ = Math.max(...topSellingMedicines.map((x) => x.count), 1)
                    const w = (m.count / maxQ) * 100
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-28 truncate text-xs font-medium text-slate-700" title={m.name}>
                          {m.name}
                        </span>
                        <div className="flex-1 h-6 rounded-md bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-md bg-teal-700/90 transition-all" style={{ width: `${Math.max(w, 4)}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-900 w-10 text-right tabular-nums">{m.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </PhOpsPanel>
            <PhOpsPanel title="Catalog mix" subtitle="Form / category share">
              {categoryDonutData.length === 0 || (categoryDonutData.length === 1 && categoryDonutData[0].name === 'No data') ? (
                <PhOpsEmptyState title="No category data" />
              ) : (
                <>
                  <div className="relative h-32 w-32 mx-auto">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      {categoryDonutData.map((seg, i) => {
                        const start = categoryDonutData.slice(0, i).reduce((s, x) => s + x.pct, 0)
                        const angle = (seg.pct / 100) * 360
                        const end = start + angle
                        const x1 = 50 + 40 * Math.cos((start * Math.PI) / 180)
                        const y1 = 50 + 40 * Math.sin((start * Math.PI) / 180)
                        const x2 = 50 + 40 * Math.cos((end * Math.PI) / 180)
                        const y2 = 50 + 40 * Math.sin((end * Math.PI) / 180)
                        const large = angle > 180 ? 1 : 0
                        return (
                          <path
                            key={i}
                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${large} 1 ${x2} ${y2} Z`}
                            fill={seg.color}
                            stroke="white"
                            strokeWidth="2"
                          />
                        )
                      })}
                      <circle cx="50" cy="50" r="26" fill="white" />
                    </svg>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {categoryDonutData.map((c, i) => (
                      <li key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                        <span className="font-medium text-slate-700 tabular-nums">{c.pct.toFixed(0)}%</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </PhOpsPanel>
          </div>

          <PhOpsPanel
            title="Inventory health"
            subtitle={`${analytics?.totalMedicines ?? medicinesCount} medicines in catalog`}
            actions={
              inventoryHealthFilter !== 'all' ? (
                <Button type="button" variant="link" size="sm" onClick={() => setInventoryHealthFilter('all')}>
                  Clear filter
                </Button>
              ) : null
            }
          >
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['in_stock', 'In stock', inventoryHealthCounts.inStock, 'ok'],
                  ['low_stock', 'Low stock', inventoryHealthCounts.lowStock, 'warn'],
                  ['out_of_stock', 'Out of stock', inventoryHealthCounts.outOfStock, 'danger'],
                  ['expiring_soon', 'Expiring soon', inventoryHealthCounts.expiringSoon, 'danger'],
                  ['dead_stock', 'Dead stock', inventoryHealthCounts.deadStock, 'neutral'],
                ] as const
              ).map(([key, label, count, tone]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setInventoryHealthFilter(key)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                    inventoryHealthFilter === key
                      ? 'bg-teal-800 text-white border-teal-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300'
                  }`}
                >
                  <span>{label}</span>
                  <PhOpsStatusBadge label={String(count)} tone={inventoryHealthFilter === key ? 'neutral' : tone} />
                </button>
              ))}
            </div>

            {inventoryHealthFilter !== 'all' && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-800">
                    {inventoryHealthFilter === 'low_stock'
                      ? 'Low stock medicines'
                      : inventoryHealthFilter === 'out_of_stock'
                        ? 'Out of stock medicines'
                        : inventoryHealthFilter === 'expiring_soon'
                          ? 'Expiring soon medicines'
                          : inventoryHealthFilter === 'dead_stock'
                            ? 'Dead stock (last 3 months)'
                            : 'In stock medicines'}
                  </p>
                  <span className="text-[11px] text-slate-500">{inventoryHealthItems.length} item(s)</span>
                </div>
                {inventoryHealthItems.length === 0 ? (
                  <PhOpsEmptyState title="No medicines in this category" description="Try another filter or change branch." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 border-b border-[var(--color-neutral-200)]">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Medicine</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Branch</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-700">Qty</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-700">Min</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Nearest expiry</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-700">Days left</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryHealthItems.slice(0, 50).map((row) => (
                          <tr key={row.id} className="border-t border-[var(--color-neutral-200)] hover:bg-slate-50/60">
                            <td className="px-3 py-2 font-medium text-slate-900">{row.medicineName}</td>
                            <td className="px-3 py-2 text-slate-600">{row.branchName}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{row.qty}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.minLevel || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.nearestExpiry || '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{row.daysLeft != null ? `${row.daysLeft}d` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </PhOpsPanel>
        </div>

        <div className="space-y-3 min-w-0">
          <PhOpsPanel
            title="Expiring medicines"
            subtitle="Batch & days remaining"
            actions={
              expiryCount > 0 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => applyInventoryQuickFilter('expiring_soon')}>
                  Inventory
                </Button>
              ) : null
            }
            padded={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-[var(--color-neutral-200)]">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-700">Medicine</th>
                    <th className="text-left p-3 font-medium text-slate-700">Batch</th>
                    <th className="text-left p-3 font-medium text-slate-700">Days</th>
                    <th className="text-right p-3 font-medium text-slate-700">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6">
                        <PhOpsEmptyState title="No near-expiry batches" description="Nothing expiring in the next 90 days." />
                      </td>
                    </tr>
                  ) : (
                    expiring.slice(0, 8).map((a, i) => {
                      const urgent = a.daysUntilExpiry <= 7
                      return (
                        <tr key={i} className={`border-t border-[var(--color-neutral-200)] ${urgent ? 'bg-rose-50/50' : ''}`}>
                          <td className="p-3 font-medium text-slate-900">{a.medicineName}</td>
                          <td className="p-3 text-slate-600 font-mono text-[11px]">{a.batchNumber}</td>
                          <td className="p-3">
                            <PhOpsStatusBadge
                              label={`${a.daysUntilExpiry}d`}
                              tone={urgent ? 'danger' : a.daysUntilExpiry <= 30 ? 'warn' : 'neutral'}
                            />
                          </td>
                          <td className="p-3 text-right font-medium tabular-nums">{a.quantity}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </PhOpsPanel>

          <PhOpsPanel title="Recent activity" subtitle="Latest pharmacy sales" padded={false}>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {recentSalesFiltered.length === 0 ? (
                <PhOpsEmptyState title="No recent sales" description="Completed dispenses appear here." />
              ) : (
                recentSalesFiltered.slice(0, 8).map((s) => {
                  const dateRaw = s.dispensedAt
                  const timeStr =
                    !dateRaw
                      ? '—'
                      : typeof dateRaw === 'string'
                        ? new Date(dateRaw).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : (dateRaw as { toDate?: () => Date })?.toDate?.()?.toLocaleTimeString?.('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }) ?? '—'
                  const med = s.lines?.[0]
                  const medName = (med?.medicineName ?? s.lines?.map((l) => l.medicineName).join(', ')) || '—'
                  const qty = med?.quantity ?? s.lines?.reduce((sum, l) => sum + (l.quantity ?? 0), 0) ?? 0
                  return (
                    <div key={s.id} className="px-4 py-3 hover:bg-slate-50/80 transition">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-slate-900">{s.patientName || 'Walk-in'}</p>
                        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{timeStr}</span>
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-0.5">{medName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {qty} {qty === 1 ? 'unit' : 'units'}
                        {s.totalAmount != null ? ` · ₹${Number(s.totalAmount).toFixed(0)}` : ''}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </PhOpsPanel>

          <PhOpsPanel title="Purchase orders" subtitle="Supply pipeline">
            <ul className="ph-ops-list">
              <li className="ph-ops-list-row">
                <span className="text-sm text-amber-800 font-medium">Pending</span>
                <PhOpsStatusBadge label={String(poStatusCounts.pending)} tone="warn" />
              </li>
              <li className="ph-ops-list-row">
                <span className="text-sm text-emerald-800 font-medium">Received</span>
                <PhOpsStatusBadge label={String(poStatusCounts.received)} tone="ok" />
              </li>
              <li className="ph-ops-list-row">
                <span className="text-sm text-slate-700 font-medium">Cancelled</span>
                <PhOpsStatusBadge label={String(poStatusCounts.cancelled)} tone="neutral" />
              </li>
            </ul>
            {onGoToOrders ? (
              <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={onGoToOrders}>
                Manage purchase orders
              </Button>
            ) : null}
          </PhOpsPanel>

          <PhOpsPanel title="Most prescribed" subtitle="From analytics">
            {!analytics ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (() => {
              const list = analytics.mostPrescribed || []
              const headerQ = headerSearchQuery.trim().toLowerCase()
              const filteredList =
                isPharmacyPortal && headerQ
                  ? list.filter((m) => (m.medicineName || '').toLowerCase().includes(headerQ))
                  : list
              if (filteredList.length === 0) {
                return (
                  <PhOpsEmptyState
                    title={list.length === 0 ? 'No prescription data yet' : 'No matches'}
                    description={
                      list.length === 0
                        ? 'Dispense prescriptions to see demand patterns.'
                        : 'No medicines match your search.'
                    }
                  />
                )
              }
              return (
                <ul className="ph-ops-list">
                  {filteredList.map((m, i) => (
                    <li key={i} className="ph-ops-list-row">
                      <span className="text-sm text-slate-800 truncate">{m.medicineName}</span>
                      <span className="text-xs font-semibold text-teal-800 tabular-nums shrink-0">{m.count} sold</span>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </PhOpsPanel>
        </div>
      </div>
    </PhOpsShell>
  )
}
