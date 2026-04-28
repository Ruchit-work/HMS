import React from 'react'
import { exportToExcel, exportToPdf } from '@/utils/pharmacy/exportReports'

type ReportType = 'expiry' | 'valuation' | 'sales' | 'over_under' | 'reorder' | 'stock_sold'

export function ReportsTabContent(props: {
  reportType: ReportType
  setReportType: (value: ReportType) => void
  expiryReportDays: 30 | 60 | 90
  setExpiryReportDays: (value: 30 | 60 | 90) => void
  expiryReportRows: Array<{ branchName: string; medicineName: string; batchNumber: string; expiryDate: string; quantity: number; daysLeft: number }>
  valuationReportRows: Array<{ branchName: string; totalCost: number; totalSelling: number; itemCount: number }>
  stockSoldReportPeriod: 'day' | 'week' | 'month' | 'year'
  setStockSoldReportPeriod: (value: 'day' | 'week' | 'month' | 'year') => void
  stockSoldReportData: { totalStockValue: number; soldAmount: number; soldCount: number }
  branchFilter: string
  salesByProductRows: Array<{ medicineName: string; quantity: number; amount: number }>
  salesByBranchRows: Array<{ branchName: string; saleCount: number; totalAmount: number }>
  overUnderStockRows: {
    under: Array<{ branchName: string; medicineName: string; current: number; min: number; status: string }>
    over: Array<{ branchName: string; medicineName: string; current: number; min: number; status: string }>
    all: Array<{ branchName: string; medicineName: string; current: number; min: number; status: string }>
  }
  reorderSuggestionsRows: Array<{ branchName: string; medicineName: string; current: number; min: number; sold30d: number; suggestedQty: number }>
}) {
  const {
    reportType,
    setReportType,
    expiryReportDays,
    setExpiryReportDays,
    expiryReportRows,
    valuationReportRows,
    stockSoldReportPeriod,
    setStockSoldReportPeriod,
    stockSoldReportData,
    branchFilter,
    salesByProductRows,
    salesByBranchRows,
    overUnderStockRows,
    reorderSuggestionsRows,
  } = props

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-slate-800">Reports</span>
          <span className="text-xs text-slate-500">Switch between expiry, valuation, sales and stock health views</span>
        </div>
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium text-slate-600">
          {(['expiry', 'valuation', 'sales', 'stock_sold', 'over_under', 'reorder'] as ReportType[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReportType(r)}
              className={`px-3 py-1.5 rounded-full transition ${
                reportType === r
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r === 'expiry'
                ? 'Expiry'
                : r === 'valuation'
                ? 'Stock valuation'
                : r === 'sales'
                ? 'Sales by product/branch'
                : r === 'stock_sold'
                ? 'Total stock & sold'
                : r === 'over_under'
                ? 'Over/Under stock'
                : 'Reorder suggestions'}
            </button>
          ))}
        </div>
      </div>

      {reportType === 'expiry' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold text-slate-800">Expiry report – stock expiring in</h3>
            <div className="flex items-center gap-2">
              {([30, 60, 90] as const).map((d) => (
                <button key={d} type="button" onClick={() => setExpiryReportDays(d)} className={`rounded px-2 py-1 text-sm ${expiryReportDays === d ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{d} days</button>
              ))}
              <button type="button" onClick={() => exportToExcel('expiry-report', 'Expiry', [{ header: 'Branch', key: 'branchName' }, { header: 'Medicine', key: 'medicineName' }, { header: 'Batch', key: 'batchNumber' }, { header: 'Expiry date', key: 'expiryDate' }, { header: 'Qty', key: 'quantity' }, { header: 'Days left', key: 'daysLeft' }], expiryReportRows)} className="rounded px-2 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700">Export Excel</button>
              <button type="button" onClick={() => exportToPdf(`Expiry report (${expiryReportDays} days)`, ['Branch', 'Medicine', 'Batch', 'Expiry', 'Qty', 'Days left'], expiryReportRows.map((r) => [r.branchName, r.medicineName, r.batchNumber, r.expiryDate, r.quantity, r.daysLeft]), 'expiry-report')} className="rounded px-2 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50">Export PDF</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg">
              <thead className="bg-slate-100"><tr><th className="text-left p-2">Branch</th><th className="text-left p-2">Medicine</th><th className="text-left p-2">Batch</th><th className="text-left p-2">Expiry date</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Days left</th></tr></thead>
              <tbody>
                {expiryReportRows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200"><td className="p-2">{r.branchName}</td><td className="p-2">{r.medicineName}</td><td className="p-2">{r.batchNumber}</td><td className="p-2">{r.expiryDate}</td><td className="p-2 text-right">{r.quantity}</td><td className="p-2 text-right">{r.daysLeft}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {expiryReportRows.length === 0 && <p className="text-slate-500 py-4 text-center">No stock expiring in the selected period.</p>}
        </div>
      )}

      {reportType === 'valuation' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold text-slate-800">Stock valuation by branch</h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => exportToExcel('stock-valuation', 'Valuation', [{ header: 'Branch', key: 'branchName' }, { header: 'Total cost (₹)', key: 'totalCost' }, { header: 'Total selling value (₹)', key: 'totalSelling' }, { header: 'Item count', key: 'itemCount' }], valuationReportRows.map((r) => ({ ...r, totalCost: r.totalCost.toFixed(2), totalSelling: r.totalSelling.toFixed(2) })))} className="rounded px-2 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700">Export Excel</button>
              <button type="button" onClick={() => exportToPdf('Stock valuation by branch', ['Branch', 'Cost (₹)', 'Selling (₹)', 'Items'], valuationReportRows.map((r) => [r.branchName, r.totalCost.toFixed(2), r.totalSelling.toFixed(2), r.itemCount]), 'stock-valuation')} className="rounded px-2 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50">Export PDF</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg">
              <thead className="bg-slate-100"><tr><th className="text-left p-2">Branch</th><th className="text-right p-2">Total cost (₹)</th><th className="text-right p-2">Total selling value (₹)</th><th className="text-right p-2">Items</th></tr></thead>
              <tbody>
                {valuationReportRows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200"><td className="p-2">{r.branchName}</td><td className="p-2 text-right">₹{r.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td className="p-2 text-right">₹{r.totalSelling.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td><td className="p-2 text-right">{r.itemCount}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {valuationReportRows.length === 0 && <p className="text-slate-500 py-4 text-center">No stock data for selected branch.</p>}
        </div>
      )}

      {reportType === 'stock_sold' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-slate-800">Total stock value & sold</h3>
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium text-slate-600">
              {(['day', 'week', 'month', 'year'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setStockSoldReportPeriod(p)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    stockSoldReportPeriod === p ? 'bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === 'day' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            {stockSoldReportPeriod === 'day' && 'Sales from start of today.'}
            {stockSoldReportPeriod === 'week' && 'Sales in last 7 days.'}
            {stockSoldReportPeriod === 'month' && 'Sales in last 30 days.'}
            {stockSoldReportPeriod === 'year' && 'Sales in last 365 days.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-600 mb-1">Total stock value (current)</p>
              <p className="text-2xl font-bold text-slate-900">₹{stockSoldReportData.totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-500 mt-1">Selling value of inventory{branchFilter !== 'all' ? ' in selected branch' : ''}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
              <p className="text-sm font-medium text-emerald-700 mb-1">Sold in period</p>
              <p className="text-2xl font-bold text-emerald-900">₹{stockSoldReportData.soldAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-emerald-600 mt-1">{stockSoldReportData.soldCount} sale(s)</p>
            </div>
          </div>
        </div>
      )}

      {reportType === 'sales' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Sales by product (top items)</h3>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => exportToExcel('sales-by-product', 'By Product', [{ header: 'Medicine', key: 'medicineName' }, { header: 'Quantity sold', key: 'quantity' }, { header: 'Amount (₹)', key: 'amount' }], salesByProductRows.map((r) => ({ ...r, amount: r.amount.toFixed(2) })))} className="rounded px-2 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700">Export Excel</button>
              <button type="button" onClick={() => exportToPdf('Sales by product', ['Medicine', 'Qty', 'Amount (₹)'], salesByProductRows.slice(0, 50).map((r) => [r.medicineName, r.quantity, r.amount.toFixed(2)]), 'sales-by-product')} className="rounded px-2 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50">Export PDF</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-100"><tr><th className="text-left p-2">Medicine</th><th className="text-right p-2">Quantity sold</th><th className="text-right p-2">Amount (₹)</th></tr></thead>
                <tbody>
                  {salesByProductRows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t border-slate-200"><td className="p-2">{r.medicineName}</td><td className="p-2 text-right">{r.quantity}</td><td className="p-2 text-right">₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Sales by branch</h3>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => exportToExcel('sales-by-branch', 'By Branch', [{ header: 'Branch', key: 'branchName' }, { header: 'Sale count', key: 'saleCount' }, { header: 'Total amount (₹)', key: 'totalAmount' }], salesByBranchRows.map((r) => ({ ...r, totalAmount: r.totalAmount.toFixed(2) })))} className="rounded px-2 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700">Export Excel</button>
              <button type="button" onClick={() => exportToPdf('Sales by branch', ['Branch', 'Sales', 'Amount (₹)'], salesByBranchRows.map((r) => [r.branchName, r.saleCount, r.totalAmount.toFixed(2)]), 'sales-by-branch')} className="rounded px-2 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50">Export PDF</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-100"><tr><th className="text-left p-2">Branch</th><th className="text-right p-2">Sale count</th><th className="text-right p-2">Total amount (₹)</th></tr></thead>
                <tbody>
                  {salesByBranchRows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-200"><td className="p-2">{r.branchName}</td><td className="p-2 text-right">{r.saleCount}</td><td className="p-2 text-right">₹{r.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reportType === 'over_under' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="font-semibold text-slate-800">Overstock / Understock (MIS)</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => exportToExcel('over-under-stock', 'MIS', [{ header: 'Branch', key: 'branchName' }, { header: 'Medicine', key: 'medicineName' }, { header: 'Current', key: 'current' }, { header: 'Min', key: 'min' }, { header: 'Status', key: 'status' }], overUnderStockRows.all)} className="rounded px-2 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700">Export Excel</button>
              <button type="button" onClick={() => exportToPdf('Over/Under stock', ['Branch', 'Medicine', 'Current', 'Min', 'Status'], overUnderStockRows.all.map((r) => [r.branchName, r.medicineName, r.current, r.min, r.status]), 'over-under-stock')} className="rounded px-2 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50">Export PDF</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg">
              <thead className="bg-slate-100"><tr><th className="text-left p-2">Branch</th><th className="text-left p-2">Medicine</th><th className="text-right p-2">Current</th><th className="text-right p-2">Min</th><th className="text-left p-2">Status</th></tr></thead>
              <tbody>
                {overUnderStockRows.under.map((r, i) => (
                  <tr key={`u-${i}`} className="border-t border-slate-200 bg-amber-50"><td className="p-2">{r.branchName}</td><td className="p-2">{r.medicineName}</td><td className="p-2 text-right">{r.current}</td><td className="p-2 text-right">{r.min}</td><td className="p-2 text-amber-700">{r.status}</td></tr>
                ))}
                {overUnderStockRows.over.map((r, i) => (
                  <tr key={`o-${i}`} className="border-t border-slate-200 bg-sky-50"><td className="p-2">{r.branchName}</td><td className="p-2">{r.medicineName}</td><td className="p-2 text-right">{r.current}</td><td className="p-2 text-right">{r.min}</td><td className="p-2 text-sky-700">{r.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {overUnderStockRows.all.length === 0 && <p className="text-slate-500 py-4 text-center">No overstock or understock items (all within min level, or no min set).</p>}
        </div>
      )}

      {reportType === 'reorder' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h3 className="font-semibold text-slate-800">Reorder suggestions</h3>
            <div className="flex gap-2">
              <button type="button" onClick={() => exportToExcel('reorder-suggestions', 'Reorder', [{ header: 'Branch', key: 'branchName' }, { header: 'Medicine', key: 'medicineName' }, { header: 'Current', key: 'current' }, { header: 'Min', key: 'min' }, { header: 'Sold (30d)', key: 'sold30d' }, { header: 'Suggested qty', key: 'suggestedQty' }], reorderSuggestionsRows)} className="rounded px-2 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700">Export Excel</button>
              <button type="button" onClick={() => exportToPdf('Reorder suggestions', ['Branch', 'Medicine', 'Current', 'Min', 'Sold 30d', 'Suggested'], reorderSuggestionsRows.map((r) => [r.branchName, r.medicineName, r.current, r.min, r.sold30d, r.suggestedQty]), 'reorder-suggestions')} className="rounded px-2 py-1.5 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50">Export PDF</button>
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-3">Items below min level. Suggested qty = max(min − current, reorder quantity, or ~1.2× sold in last 30 days).</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200 rounded-lg">
              <thead className="bg-slate-100"><tr><th className="text-left p-2">Branch</th><th className="text-left p-2">Medicine</th><th className="text-right p-2">Current</th><th className="text-right p-2">Min</th><th className="text-right p-2">Sold (30d)</th><th className="text-right p-2">Suggested qty</th></tr></thead>
              <tbody>
                {reorderSuggestionsRows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200"><td className="p-2">{r.branchName}</td><td className="p-2">{r.medicineName}</td><td className="p-2 text-right">{r.current}</td><td className="p-2 text-right">{r.min}</td><td className="p-2 text-right">{r.sold30d}</td><td className="p-2 text-right font-medium">{r.suggestedQty}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {reorderSuggestionsRows.length === 0 && <p className="text-slate-500 py-4 text-center">No reorder suggestions. All items are at or above minimum level.</p>}
        </div>
      )}
    </div>
  )
}
