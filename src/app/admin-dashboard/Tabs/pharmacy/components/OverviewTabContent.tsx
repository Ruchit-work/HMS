import React from 'react'
import type { ExpiryAlert, LowStockAlert, PharmacySale } from '@/types/pharmacy'
import type { OverviewDateRange } from '../overviewDerived'

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
  } = props

  return (
    <div className="space-y-8 rounded-xl bg-[#F7F9FC] p-6" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1e293b]">Overview</h2>
          <p className="mt-1 text-sm text-slate-600">Pharmacy performance and inventory insights</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
            {(['today', '7d', '30d', '6m', 'year', 'all'] as OverviewDateRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setOverviewDateRange(range)}
                className={`px-3 py-2.5 text-sm font-medium transition sm:px-4 ${overviewDateRange === range ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {range === 'today' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '6m' ? '6 month' : range === 'year' ? 'Year' : 'All time'}
              </button>
            ))}
          </div>
          {branches.length > 1 && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500">Total Medicines</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{analytics?.totalMedicines ?? medicinesCount}</p>
              <p className="mt-1 text-xs text-slate-500">In inventory</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => applyInventoryQuickFilter('low_stock')}
          disabled={lowStock.length === 0}
          className={`rounded-xl border border-[#E5E7EB] bg-white p-6 text-left shadow-sm transition ${
            lowStock.length > 0 ? 'hover:shadow-md hover:border-amber-300' : 'cursor-not-allowed opacity-80'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500">Low Stock Medicines</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{analytics?.lowStockCount ?? lowStock.length}</p>
              <p className="mt-1 text-xs text-amber-600">{lowStock.length > 0 ? 'Click to open Inventory with low-stock filter' : 'No medicines below threshold'}</p>
            </div>
          </div>
        </button>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500">Sales Returns</p>
              <p className="mt-2 text-2xl font-bold text-rose-600">₹{periodRefundTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
              <p className="mt-1 text-xs text-rose-500">Refunded to patients in this period</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => applyInventoryQuickFilter('expiring_soon')}
          disabled={expiring.length === 0}
          className={`rounded-xl border border-[#E5E7EB] bg-white p-6 text-left shadow-sm transition ${
            expiring.length > 0 ? 'hover:shadow-md hover:border-rose-300' : 'cursor-not-allowed opacity-80'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500">Expiring Soon</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{analytics?.expiringCount ?? expiring.length}</p>
              <p className="mt-1 text-xs text-rose-600">{expiring.length > 0 ? 'Click to open Inventory with expiry filter' : 'No items expiring in next 30 days'}</p>
            </div>
          </div>
        </button>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500">{overviewDateRange === 'today' ? "Today's Sales" : overviewDateRange === '7d' ? 'Sales (7 days)' : overviewDateRange === '30d' ? 'Sales (30 days)' : overviewDateRange === '6m' ? 'Sales (6 months)' : overviewDateRange === 'year' ? 'Sales (Year)' : 'Sales (All time)'}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">₹{periodSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
              <p className="mt-1 text-xs text-emerald-600">Revenue</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-500">Pending Prescriptions</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{queueCount}</p>
              <p className="mt-1 text-xs text-slate-500">To dispense</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Payments by mode</h3>
        <p className="text-xs text-slate-500 mb-3">Number of bills and total amount collected by each payment method{branchFilter !== 'all' && ' for this branch'}.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-[#E5E7EB]">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Payment mode</th>
                <th className="text-right px-3 py-2 font-medium text-slate-700">Bills</th>
                <th className="text-right px-3 py-2 font-medium text-slate-700">Total amount</th>
              </tr>
            </thead>
            <tbody>
              {['cash', 'upi', 'card', 'credit', 'other', 'unknown'].map((mode) => {
                const row = paymentModeSummary[mode]
                if (!row) return null
                const label = mode === 'cash' ? 'Cash' : mode === 'upi' ? 'UPI' : mode === 'card' ? 'Card' : mode === 'credit' ? 'Credit' : mode === 'other' ? 'Other / Insurance' : 'Not set'
                return (
                  <tr key={mode} className="border-b border-[#E5E7EB] last:border-0">
                    <td className="px-3 py-2 text-slate-800">{label}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{row.count}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">₹{row.amount.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Pharmacy Sales Trend</h3>
        <p className="text-sm text-slate-500 mb-4">Sales {overviewDateRange === 'today' ? 'today' : overviewDateRange === '7d' ? 'for last 7 days' : overviewDateRange === '30d' ? 'for last 30 days' : overviewDateRange === '6m' ? 'by month (6 months)' : overviewDateRange === 'year' ? 'by month (year)' : 'by month (last 12 months)'}</p>
        <div className="h-56 w-full">
          {salesTrendData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50/50 text-slate-500 text-sm">No sales data</div>
          ) : (
            <svg viewBox="0 0 400 160" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="salesLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              {(() => {
                const maxVal = Math.max(...salesTrendData.map((d) => d.value), 1)
                const pts = salesTrendData.map((d, i) => {
                  const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                  const y = 140 - (d.value / maxVal) * 120
                  return `${x},${y}`
                }).join(' ')
                const areaPoints = `${pts} 390,140 10,140`
                return (
                  <>
                    <polyline fill="url(#salesLineGrad)" points={areaPoints} />
                    <polyline fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                    {salesTrendData.map((d, i) => {
                      const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                      const y = 140 - (d.value / maxVal) * 120
                      return <circle key={i} cx={x} cy={y} r="3" fill="#2563EB" />
                    })}
                  </>
                )
              })()}
            </svg>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 justify-between text-xs text-slate-500">
          {salesTrendData.filter((_, i) => (overviewDateRange === '30d' ? i % 5 === 0 : true)).slice(0, 12).map((d, i) => (
            <span key={i}>{d.date}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Selling Medicines</h3>
          {topSellingMedicines.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50/50 text-slate-500 text-sm">No sales data</div>
          ) : (
            <div className="flex flex-col gap-3">
              {topSellingMedicines.map((m, i) => {
                const maxQ = Math.max(...topSellingMedicines.map((x) => x.count), 1)
                const w = (m.count / maxQ) * 100
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm font-medium text-slate-700" title={m.name}>{m.name}</span>
                    <div className="flex-1 h-8 rounded-lg bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-lg bg-[#2563EB] transition-all duration-300" style={{ width: `${Math.max(w, 4)}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 w-12 text-right">{m.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Medicine Category Distribution</h3>
          {categoryDonutData.length === 0 || (categoryDonutData.length === 1 && categoryDonutData[0].name === 'No data') ? (
            <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50/50 text-slate-500 text-sm">No category data</div>
          ) : (
            <>
              <div className="relative h-40 w-40 mx-auto">
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
                    return <path key={i} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${large} 1 ${x2} ${y2} Z`} fill={seg.color} stroke="white" strokeWidth="2" />
                  })}
                  <circle cx="50" cy="50" r="26" fill="white" />
                </svg>
              </div>
              <ul className="mt-4 space-y-1.5">
                {categoryDonutData.map((c, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />{c.name}</span>
                    <span className="font-medium text-slate-700">{c.pct.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Inventory Health Status</h3>
          {inventoryHealthFilter !== 'all' && (
            <button type="button" onClick={() => setInventoryHealthFilter('all')} className="text-xs font-medium text-slate-600 hover:text-slate-900 underline">
              Clear filter
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => setInventoryHealthFilter('in_stock')} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${inventoryHealthFilter === 'in_stock' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}><span>In Stock</span><span className="font-bold">{inventoryHealthCounts.inStock}</span></button>
          <button type="button" onClick={() => setInventoryHealthFilter('low_stock')} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${inventoryHealthFilter === 'low_stock' ? 'bg-amber-600 text-white border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}><span>Low Stock</span><span className="font-bold">{inventoryHealthCounts.lowStock}</span></button>
          <button type="button" onClick={() => setInventoryHealthFilter('out_of_stock')} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${inventoryHealthFilter === 'out_of_stock' ? 'bg-red-600 text-white border-red-700' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}><span>Out of Stock</span><span className="font-bold">{inventoryHealthCounts.outOfStock}</span></button>
          <button type="button" onClick={() => setInventoryHealthFilter('expiring_soon')} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${inventoryHealthFilter === 'expiring_soon' ? 'bg-rose-600 text-white border-rose-700' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}><span>Expiring Soon</span><span className="font-bold">{inventoryHealthCounts.expiringSoon}</span></button>
          <button type="button" onClick={() => setInventoryHealthFilter('dead_stock')} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${inventoryHealthFilter === 'dead_stock' ? 'bg-slate-800 text-white border-slate-900' : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'}`}><span>Dead Stock (last 3 months)</span><span className="font-bold">{inventoryHealthCounts.deadStock}</span></button>
        </div>
      </div>

      {inventoryHealthFilter !== 'all' && (
        <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800">
              {inventoryHealthFilter === 'low_stock' ? 'Low stock medicines' : inventoryHealthFilter === 'out_of_stock' ? 'Out of stock medicines' : inventoryHealthFilter === 'expiring_soon' ? 'Expiring soon medicines' : inventoryHealthFilter === 'dead_stock' ? 'Dead stock medicines (last 3 months)' : 'In stock medicines'}
            </h4>
            <span className="text-xs text-slate-500">{inventoryHealthItems.length} item{inventoryHealthItems.length === 1 ? '' : 's'}</span>
          </div>
          {inventoryHealthItems.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No medicines found for this category with the current branch filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-[#E5E7EB]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-700">Medicine</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-700">Branch</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-700">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-700">Min Level</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-700">Nearest Expiry</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-700">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryHealthItems.slice(0, 50).map((row) => (
                    <tr key={row.id} className="border-t border-[#E5E7EB] hover:bg-slate-50/60 transition">
                      <td className="px-3 py-2 font-medium text-slate-900">{row.medicineName}</td>
                      <td className="px-3 py-2 text-slate-600">{row.branchName}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">{row.qty}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{row.minLevel || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.nearestExpiry || '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{row.daysLeft != null ? `${row.daysLeft}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#E5E7EB] px-6 py-4"><h3 className="text-lg font-semibold text-slate-800">Expiring Medicines</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-700">Medicine Name</th>
                  <th className="text-left p-3 font-medium text-slate-700">Batch</th>
                  <th className="text-left p-3 font-medium text-slate-700">Expiry Date</th>
                  <th className="text-left p-3 font-medium text-slate-700">Days Left</th>
                  <th className="text-right p-3 font-medium text-slate-700">Stock</th>
                </tr>
              </thead>
              <tbody>
                {expiring.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-slate-500">No medicines expiring in the next 90 days.</td></tr>
                ) : (
                  expiring.slice(0, 8).map((a, i) => {
                    const urgent = a.daysUntilExpiry <= 7
                    return (
                      <tr key={i} className={`border-t border-[#E5E7EB] transition hover:bg-slate-50/50 ${urgent ? 'bg-rose-50/50' : ''}`}>
                        <td className="p-3 font-medium text-slate-900">{a.medicineName}</td>
                        <td className="p-3 text-slate-600">{a.batchNumber}</td>
                        <td className="p-3 text-slate-600">{a.expiryDate}</td>
                        <td className="p-3"><span className={`font-medium ${urgent ? 'text-rose-600' : 'text-slate-700'}`}>{a.daysUntilExpiry} days</span></td>
                        <td className="p-3 text-right font-medium text-slate-900">{a.quantity}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#E5E7EB] px-6 py-4"><h3 className="text-lg font-semibold text-slate-800">Recent Pharmacy Sales</h3></div>
            <div className="divide-y divide-[#E5E7EB] max-h-64 overflow-y-auto">
              {recentSalesFiltered.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 text-center">No recent sales.</p>
              ) : (
                recentSalesFiltered.slice(0, 6).map((s) => {
                  const dateRaw = s.dispensedAt
                  const timeStr = !dateRaw ? '—' : typeof dateRaw === 'string' ? new Date(dateRaw).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (dateRaw as { toDate?: () => Date })?.toDate?.()?.toLocaleTimeString?.('en-IN', { hour: '2-digit', minute: '2-digit' }) ?? '—'
                  const med = s.lines?.[0]
                  const medName = (med?.medicineName ?? s.lines?.map((l) => l.medicineName).join(', ')) || '—'
                  const qty = med?.quantity ?? s.lines?.reduce((sum, l) => sum + (l.quantity ?? 0), 0) ?? 0
                  return (
                    <div key={s.id} className="px-4 py-3 hover:bg-slate-50/50 transition">
                      <p className="font-medium text-slate-900">{s.patientName || 'Walk-in'}</p>
                      <p className="text-sm text-slate-600 truncate">{medName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{qty} {qty === 1 ? 'unit' : 'units'} · {timeStr}</p>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Purchase Orders</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-2"><span className="text-sm font-medium text-amber-800">Pending</span><span className="font-bold text-amber-900">{poStatusCounts.pending}</span></div>
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2"><span className="text-sm font-medium text-emerald-800">Received</span><span className="font-bold text-emerald-900">{poStatusCounts.received}</span></div>
              <div className="flex items-center justify-between rounded-lg bg-slate-100 border border-slate-200 px-4 py-2"><span className="text-sm font-medium text-slate-700">Cancelled</span><span className="font-bold text-slate-800">{poStatusCounts.cancelled}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className={`rounded-xl border p-5 ${isPharmacyPortal ? 'border-[#E0E0E0] bg-white shadow-sm' : 'border-slate-200 bg-slate-50/50'}`}>
        <h3 className={`font-semibold mb-3 ${isPharmacyPortal ? 'text-[#263238] text-lg' : 'text-slate-800'}`}>Top selling / most prescribed</h3>
        {!analytics ? (
          <p className="text-sm text-[#607D8B]">Loading...</p>
        ) : (() => {
          const list = analytics.mostPrescribed || []
          const headerQ = headerSearchQuery.trim().toLowerCase()
          const filteredList = (isPharmacyPortal && headerQ) ? list.filter((m) => (m.medicineName || '').toLowerCase().includes(headerQ)) : list
          return (
            <>
              <ul className="space-y-2">
                {filteredList.map((m, i) => (
                  <li key={i} className="flex justify-between items-center text-sm py-1 border-b border-[#E0E0E0] last:border-0">
                    <span className={isPharmacyPortal ? 'text-[#263238]' : 'text-slate-700'}>{m.medicineName}</span>
                    <span className={`font-medium ${isPharmacyPortal ? 'text-[#1565C0]' : 'text-slate-900'}`}>{m.count} sold</span>
                  </li>
                ))}
              </ul>
              {filteredList.length === 0 && (
                <p className="text-sm text-[#607D8B] py-2">{list.length === 0 ? 'No sales data yet. Dispense prescriptions to see most prescribed medicines.' : 'No medicines match your search.'}</p>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
