import React from 'react'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Pagination from '@/components/ui/navigation/Pagination'
import type { PharmacySale } from '@/types/pharmacy'
import type { OverviewDateRange } from '../overviewDerived'

type PaymentModeSummary = Record<string, { count: number; amount: number }>

export function SalesTabContent(props: {
  overviewDateRange: OverviewDateRange
  setOverviewDateRange: (value: OverviewDateRange) => void
  periodSalesTotal: number
  periodRefundTotal: number
  periodSalesCount: number
  paymentModeSummary: PaymentModeSummary
  salesTrendData: Array<{ date: string; value: number }>
  topSellingMedicines: Array<{ name: string; count: number }>
  salesDate: string
  setSalesDate: (value: string) => void
  salesPaymentFilter: string
  setSalesPaymentFilter: (value: string) => void
  salesMinAmount: string
  setSalesMinAmount: (value: string) => void
  salesMaxAmount: string
  setSalesMaxAmount: (value: string) => void
  salesSearch: string
  setSalesSearch: (value: string) => void
  loading: boolean
  paginatedSales: PharmacySale[]
  selectedSaleDetail: PharmacySale | null
  onToggleSaleDetail: (sale: PharmacySale) => void
  saleDetailRef: React.RefObject<HTMLDivElement | null>
  getSaleReturnedMap: (sale: PharmacySale) => Record<string, number>
  filteredSalesCount: number
  salesPage: number
  salesTotalPages: number
  salesPageSize: number
  goToSalesPage: (page: number) => void
  setSalesPageSize: (size: number) => void
}): React.JSX.Element {
  const {
    overviewDateRange,
    setOverviewDateRange,
    periodSalesTotal,
    periodRefundTotal,
    periodSalesCount,
    paymentModeSummary,
    salesTrendData,
    topSellingMedicines,
    salesDate,
    setSalesDate,
    salesPaymentFilter,
    setSalesPaymentFilter,
    salesMinAmount,
    setSalesMinAmount,
    salesMaxAmount,
    setSalesMaxAmount,
    salesSearch,
    setSalesSearch,
    loading,
    paginatedSales,
    selectedSaleDetail,
    onToggleSaleDetail,
    saleDetailRef,
    getSaleReturnedMap,
    filteredSalesCount,
    salesPage,
    salesTotalPages,
    salesPageSize,
    goToSalesPage,
    setSalesPageSize,
  } = props

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] p-4 sm:p-5">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Selling data</h3>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(['today', '7d', '30d', '6m', 'year', 'all'] as OverviewDateRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setOverviewDateRange(range)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${overviewDateRange === range ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
            >
              {range === 'today' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '6m' ? '6m' : range === 'year' ? 'Year' : 'All'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Sales</p>
            <p className="text-xl font-bold text-slate-900">₹{periodSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-emerald-600">Revenue</p>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Sales returns</p>
            <p className="text-xl font-bold text-rose-600">₹{periodRefundTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-rose-500">Refunded</p>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Bills</p>
            <p className="text-xl font-bold text-slate-900">{periodSalesCount}</p>
            <p className="text-[10px] text-slate-500">In period</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Payments by mode</h4>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-1.5 font-medium text-slate-700">Mode</th>
                  <th className="text-right py-1.5 font-medium text-slate-700">Bills</th>
                  <th className="text-right py-1.5 font-medium text-slate-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {['cash', 'upi', 'card', 'credit', 'other', 'unknown'].map((mode) => {
                  const row = paymentModeSummary[mode]
                  if (!row) return null
                  const label = mode === 'cash' ? 'Cash' : mode === 'upi' ? 'UPI' : mode === 'card' ? 'Card' : mode === 'credit' ? 'Credit' : mode === 'other' ? 'Other' : 'Not set'
                  return (
                    <tr key={mode} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 text-slate-800">{label}</td>
                      <td className="py-1.5 text-right text-slate-700">{row.count}</td>
                      <td className="py-1.5 text-right font-medium text-slate-900">₹{row.amount.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Sales trend</h4>
            <div className="h-32 w-full">
              {salesTrendData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 text-slate-500 text-xs">No data</div>
              ) : (
                <svg viewBox="0 0 400 120" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="salesTrendGradSalesTab" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const maxVal = Math.max(...salesTrendData.map((d) => d.value), 1)
                    const pts = salesTrendData.map((d, i) => {
                      const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                      const y = 100 - (d.value / maxVal) * 80
                      return `${x},${y}`
                    }).join(' ')
                    const areaPoints = `${pts} 390,100 10,100`
                    return (
                      <>
                        <polyline fill="url(#salesTrendGradSalesTab)" points={areaPoints} />
                        <polyline fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                      </>
                    )
                  })()}
                </svg>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
              {salesTrendData.filter((_, i) => (overviewDateRange === '30d' ? i % 5 === 0 : true)).slice(0, 8).map((d, i) => (
                <span key={i}>{d.date}</span>
              ))}
            </div>
          </div>
        </div>
        {topSellingMedicines.length > 0 && (
          <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Top selling medicines</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {topSellingMedicines.map((m, i) => (
                <span key={i} className="text-slate-700"><span className="font-medium text-slate-900">{m.name}</span> <span className="text-slate-500">×{m.count}</span></span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h3 className="font-semibold text-slate-800">Dispensation records</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
            <select value={salesPaymentFilter} onChange={(e) => setSalesPaymentFilter(e.target.value)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500">
              <option value="all">All payments</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="credit">Credit</option>
              <option value="other">Other / Insurance</option>
            </select>
            <input type="number" inputMode="decimal" value={salesMinAmount} onChange={(e) => setSalesMinAmount(e.target.value)} placeholder="Min amount" className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
            <input type="number" inputMode="decimal" value={salesMaxAmount} onChange={(e) => setSalesMaxAmount(e.target.value)} placeholder="Max amount" className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
            <input type="text" value={salesSearch} onChange={(e) => setSalesSearch(e.target.value)} placeholder="Search by invoice, name, phone, medicine…" className="w-full sm:w-64 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500" />
            {(salesDate || salesSearch || salesPaymentFilter !== 'all' || salesMinAmount || salesMaxAmount) && (
              <button
                type="button"
                onClick={() => {
                  setSalesDate('')
                  setSalesSearch('')
                  setSalesPaymentFilter('all')
                  setSalesMinAmount('')
                  setSalesMaxAmount('')
                }}
                className="text-[11px] text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner inline /></div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-3">Invoice #</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Patient / Customer</th>
                  <th className="text-left p-3">Phone</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Payment</th>
                  <th className="text-left p-3">Medicines</th>
                  <th className="text-right p-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.map((s) => {
                  const dateRaw = s.dispensedAt
                  const dateStr = !dateRaw ? '—' : typeof dateRaw === 'string' ? dateRaw.slice(0, 10) : (dateRaw as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '—'
                  const name = s.patientName || '—'
                  const phone = s.customerPhone || '—'
                  const type = s.saleType === 'walk_in' ? 'Walk-in' : 'Prescription'
                  const payment = s.paymentMode ? String(s.paymentMode).charAt(0).toUpperCase() + String(s.paymentMode).slice(1) : '—'
                  const returnedMap = getSaleReturnedMap(s)
                  const meds =
                    s.lines
                      ?.map((l) => {
                        const sold = Number(l.quantity) || 0
                        const returned = Number(returnedMap[l.medicineId] || 0)
                        const remaining = Math.max(0, sold - returned)
                        if (!remaining) return null
                        return `${l.medicineName} × ${remaining}`
                      })
                      .filter(Boolean)
                      .join('; ') || '—'
                  const isSelected = selectedSaleDetail?.id === s.id
                  return (
                    <React.Fragment key={s.id}>
                      <tr className={`border-t border-slate-200 cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-blue-50/40' : ''}`} onClick={() => onToggleSaleDetail(s)}>
                        <td className="p-3 font-mono text-xs">{s.invoiceNumber ?? '—'}</td>
                        <td className="p-3">{dateStr}</td>
                        <td className="p-3">{name}</td>
                        <td className="p-3">{phone}</td>
                        <td className="p-3">{type}</td>
                        <td className="p-3">{payment}</td>
                        <td className="p-3 max-w-xs truncate" title={meds}>{meds}</td>
                        <td className="p-3 text-right">₹{s.netAmount ?? s.totalAmount ?? 0}</td>
                      </tr>
                      <tr className={`border-t border-slate-200 transition-all duration-200 ease-out ${isSelected ? 'bg-blue-50/50' : 'bg-[#EEF3FF]'} ${isSelected ? 'animate-[fadeExpand_0.2s_ease-out] opacity-100' : 'hidden opacity-0'}`}>
                        <td colSpan={8} className="p-0 align-top">
                          <div ref={isSelected ? saleDetailRef : undefined} className="mx-3 mb-3 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-md" style={{ borderRadius: 12 }}>
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-slate-100">
                              <div>
                                <h4 className="text-base font-semibold text-slate-900">Sale Details</h4>
                                <p className="mt-1 text-sm text-slate-600 font-mono">{s.invoiceNumber ?? s.id}</p>
                                <p className="mt-0.5 text-sm text-slate-700">{s.patientName || 'Walk-in'}</p>
                              </div>
                            </div>
                            <div className="mt-5 flex flex-col lg:flex-row gap-6">
                              <div className="flex-1 min-w-0 lg:max-w-[70%]">
                                <div className="rounded-lg border border-slate-100 overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-slate-50/80 border-b border-slate-200">
                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Medicine</th>
                                        <th className="text-left py-3 px-3 font-medium text-slate-600">Batch</th>
                                        <th className="text-left py-3 px-3 font-medium text-slate-600">Expiry</th>
                                        <th className="text-right py-3 px-3 font-medium text-slate-600">Qty</th>
                                        <th className="text-right py-3 px-3 font-medium text-slate-600">Unit Price</th>
                                        <th className="text-right py-3 px-4 font-medium text-slate-600">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {s.lines?.map((l, idx) => {
                                        const unit = Number(l.unitPrice) || 0
                                        const sold = Number(l.quantity) || 0
                                        const returned = Number(returnedMap[l.medicineId] || 0)
                                        const remaining = Math.max(0, sold - returned)
                                        const lineTotal = unit * remaining
                                        return (
                                          <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors">
                                            <td className="py-3 px-4 font-medium text-slate-900">{l.medicineName}</td>
                                            <td className="py-3 px-3 text-slate-600">{l.batchNumber || '—'}</td>
                                            <td className="py-3 px-3 text-slate-500 text-xs">{l.expiryDate || '—'}</td>
                                            <td className="py-3 px-3 text-right">
                                              {returned > 0 && <span className="text-[10px] text-slate-400 mr-1">(sold {sold}, returned {returned})</span>}
                                              <span className="font-medium text-slate-800">{remaining}</span>
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-700 tabular-nums">₹{unit.toFixed(2)}</td>
                                            <td className="py-3 px-4 text-right font-medium text-slate-900 tabular-nums">₹{lineTotal.toFixed(2)}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              <div className="lg:w-[30%] min-w-[240px] flex flex-col gap-4">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                                  <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sale Summary</h5>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center"><span className="text-slate-600">Subtotal</span><span className="font-medium text-slate-900 tabular-nums">₹{s.totalAmount ?? 0}</span></div>
                                    {s.refundedAmount != null && s.refundedAmount > 0 && (
                                      <div className="flex justify-between items-center"><span className="text-slate-600">Refunded</span><span className="font-medium text-rose-600 tabular-nums">₹{s.refundedAmount}</span></div>
                                    )}
                                    <div className="border-t border-slate-200 pt-2 mt-2">
                                      <div className="flex justify-between items-center">
                                        <span className="font-semibold text-slate-700">Net Amount</span>
                                        <span className="text-lg font-bold text-emerald-600 tabular-nums">₹{s.netAmount ?? Math.max(0, (s.totalAmount || 0) - (s.refundedAmount || 0))}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredSalesCount === 0 && (
          <p className="text-slate-500 py-6 text-center">No sales yet. Dispense from the Dispense & Billing tab or sell to walk-in customers above.</p>
        )}
      </div>

      {filteredSalesCount > 0 && (
        <Pagination
          currentPage={salesPage}
          totalPages={salesTotalPages}
          pageSize={salesPageSize}
          totalItems={filteredSalesCount}
          onPageChange={goToSalesPage}
          onPageSizeChange={setSalesPageSize}
          itemLabel="sales"
        />
      )}
    </div>
  )
}
