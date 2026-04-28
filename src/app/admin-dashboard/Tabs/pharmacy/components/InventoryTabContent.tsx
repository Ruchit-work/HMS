import React from 'react'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Pagination from '@/components/ui/navigation/Pagination'
import type { BranchMedicineStock, MedicineBatch, PharmacyMedicine, PharmacyPurchaseOrder, PharmacySupplier } from '@/types/pharmacy'
import { DaysCoverBadge } from './RealWorldUiBlocks'
import { ReceiveByFileForm } from './StockTransferAndImportForms'
import { BarcodeScanInput } from './SearchInputs'
import { MedicineFileUploader } from './Uploaders'

type BranchOption = { id: string; name: string }
type InventoryStatusFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
type InventoryExpiryFilter = 'all' | 'expiring_soon' | 'expired'

export function InventoryTabContent(props: {
  isViewOnly: boolean
  inventorySummary: { totalMedicines: number; lowStock: number; outOfStock: number; expiringSoon: number; totalValue: number }
  purchaseOrders: PharmacyPurchaseOrder[]
  setSuccess: (v: string | null) => void
  fetchPharmacy: (silent?: boolean) => Promise<void>
  setError: (v: string | null) => void
  getToken: () => Promise<string | null>
  branchFilter: string
  activeHospitalId?: string
  setAddMedicineModalBarcode: (v: string | null) => void
  inventorySearch: string
  setInventorySearch: (v: string) => void
  inventoryStatusFilter: InventoryStatusFilter
  setInventoryStatusFilter: (v: InventoryStatusFilter) => void
  suppliers: PharmacySupplier[]
  inventorySupplierFilter: string
  setInventorySupplierFilter: (v: string) => void
  inventoryExpiryFilter: InventoryExpiryFilter
  setInventoryExpiryFilter: (v: InventoryExpiryFilter) => void
  hasInventoryFiltersApplied: boolean
  clearInventoryFilters: () => void
  inventoryTableRows: BranchMedicineStock[]
  filteredStock: BranchMedicineStock[]
  isPharmacyPortal: boolean
  lowStock: Array<{ medicineId: string; medicineName: string; branchName: string; currentStock: number; minStockLevel: number }>
  medicines: PharmacyMedicine[]
  setPendingAddToOrder: (v: { medicineId: string; medicineName: string; quantity: number; manufacturer?: string } | null) => void
  setSubTab: (v: string) => void
  loading: boolean
  paginatedInventoryRows: BranchMedicineStock[]
  branches: BranchOption[]
  getNearestExpiry: (s: BranchMedicineStock) => string | null
  getDaysOfCover: (row: BranchMedicineStock) => number | null
  inventoryRowActionsOpen: string | null
  setInventoryRowActionsOpen: (v: string | null) => void
  setInventoryDetailView: (v: { stock: BranchMedicineStock; medicine: PharmacyMedicine | null } | null) => void
  setInventoryViewBatchesStock: (v: BranchMedicineStock | null) => void
  setInventoryDeleteTarget: (v: BranchMedicineStock | null) => void
  inventoryPage: number
  inventoryTotalPages: number
  inventoryPageSize: number
  goToInventoryPage: (v: number) => void
  setInventoryPageSize: (v: number) => void
  inventoryHealthDonut: Array<{ label: string; value: number; color: string }>
  inventoryDetailView: { stock: BranchMedicineStock; medicine: PharmacyMedicine | null } | null
  setEditMinLevelMedicine: (v: PharmacyMedicine | null) => void
  inventoryViewBatchesStock: BranchMedicineStock | null
}): React.JSX.Element {
  const {
    isViewOnly,
    inventorySummary,
    purchaseOrders,
    setSuccess,
    fetchPharmacy,
    setError,
    getToken,
    branchFilter,
    activeHospitalId,
    setAddMedicineModalBarcode,
    inventorySearch,
    setInventorySearch,
    inventoryStatusFilter,
    setInventoryStatusFilter,
    suppliers,
    inventorySupplierFilter,
    setInventorySupplierFilter,
    inventoryExpiryFilter,
    setInventoryExpiryFilter,
    hasInventoryFiltersApplied,
    clearInventoryFilters,
    inventoryTableRows,
    filteredStock,
    isPharmacyPortal,
    lowStock,
    medicines,
    setPendingAddToOrder,
    setSubTab,
    loading,
    paginatedInventoryRows,
    branches,
    getNearestExpiry,
    getDaysOfCover,
    inventoryRowActionsOpen,
    setInventoryRowActionsOpen,
    setInventoryDetailView,
    setInventoryViewBatchesStock,
    setInventoryDeleteTarget,
    inventoryPage,
    inventoryTotalPages,
    inventoryPageSize,
    goToInventoryPage,
    setInventoryPageSize,
    inventoryHealthDonut,
    inventoryDetailView,
    setEditMinLevelMedicine,
    inventoryViewBatchesStock,
  } = props

  return (
    <div className="space-y-6" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div>
        <h2 className="text-xl font-semibold text-[#1e293b]">Medicine stock</h2>
        <p className="mt-0.5 text-sm text-slate-600">View and manage stock levels, batches and expiry</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md"><p className="text-xs font-medium text-slate-500">Total Medicines</p><p className="mt-1 text-xl font-bold text-slate-900">{inventorySummary.totalMedicines}</p></div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md"><p className="text-xs font-medium text-slate-500">Low Stock</p><p className="mt-1 text-xl font-bold text-slate-900">{inventorySummary.lowStock}</p></div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md"><p className="text-xs font-medium text-slate-500">Out of Stock</p><p className="mt-1 text-xl font-bold text-slate-900">{inventorySummary.outOfStock}</p></div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md"><p className="text-xs font-medium text-slate-500">Expiring Soon</p><p className="mt-1 text-xl font-bold text-slate-900">{inventorySummary.expiringSoon}</p></div>
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md"><p className="text-xs font-medium text-slate-500">Total Inventory Value</p><p className="mt-1 text-xl font-bold text-slate-900">₹{inventorySummary.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
      </div>

      {!isViewOnly && (
        <ReceiveByFileForm
          pendingOrders={purchaseOrders.filter((o) => o.status === 'pending')}
          onSuccess={() => { setSuccess('Stock updated from supplier file.'); fetchPharmacy() }}
          onError={(e) => setError(e)}
          getToken={getToken}
          branchIdForSimpleUpload={!isViewOnly ? branchFilter : undefined}
        />
      )}

      {activeHospitalId && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Barcode lookup</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <BarcodeScanInput
                className="barcode-lookup-prominent"
                hospitalId={activeHospitalId}
                getToken={getToken}
                onMedicineFound={() => {}}
                onError={(e) => setError(e)}
                onOpenAddMedicine={(b) => setAddMedicineModalBarcode(b)}
                placeholder="Scan or type barcode and press Enter"
                showFoundInline
              />
            </div>
            <button type="button" onClick={() => setAddMedicineModalBarcode('')} className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">Add Medicine</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <input type="search" placeholder="Search medicine by name" value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm w-48 max-w-full focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]" />
        <select value={inventoryStatusFilter} onChange={(e) => setInventoryStatusFilter(e.target.value as InventoryStatusFilter)} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm">
          <option value="all">All status</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option>
        </select>
        <select value={inventorySupplierFilter} onChange={(e) => setInventorySupplierFilter(e.target.value)} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm">
          <option value="all">All suppliers</option>{suppliers.map((sup) => (<option key={sup.id} value={sup.id}>{sup.name}</option>))}
        </select>
        <select value={inventoryExpiryFilter} onChange={(e) => setInventoryExpiryFilter(e.target.value as InventoryExpiryFilter)} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm">
          <option value="all">All expiry</option><option value="expiring_soon">Expiring soon (30d)</option><option value="expired">Expired</option>
        </select>
        {hasInventoryFiltersApplied && <button type="button" onClick={clearInventoryFilters} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear filters</button>}
        <span className="text-slate-500 text-sm ml-auto">{inventoryTableRows.length} of {filteredStock.length} row(s)</span>
      </div>

      {!isPharmacyPortal && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Bulk add / update</h3>
          <MedicineFileUploader
            branchId={branchFilter !== 'all' ? branchFilter : undefined}
            branchName={branchFilter !== 'all' ? branches.find((b) => b.id === branchFilter)?.name : undefined}
            branchRequired
            onSuccess={(msg) => { setSuccess(msg); fetchPharmacy() }}
            onError={(e) => setError(e)}
            getToken={getToken}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner inline /></div>
      ) : (
        <div className="hidden md:block rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]"><tr><th className="text-left p-4">Medicine Name</th><th className="text-left p-4">Branch</th><th className="text-right p-4">Quantity</th><th className="text-right p-4">Days Cover</th><th className="text-left p-4">Nearest Expiry</th><th className="text-right p-4">Actions</th></tr></thead>
              <tbody>
                {paginatedInventoryRows.map((s) => {
                  const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
                  const nearestExpiry = getNearestExpiry(s)
                  const isActionsOpen = inventoryRowActionsOpen === s.id
                  return (
                    <tr key={s.id} className="border-t border-[#E5E7EB] hover:bg-slate-50/80 transition">
                      <td className="p-4 font-medium text-slate-900">{s.medicineName}</td>
                      <td className="p-4 text-slate-600">{branches.find((b) => b.id === s.branchId)?.name ?? s.branchId}</td>
                      <td className="p-4 text-right font-medium text-slate-900">{s.totalQuantity}</td>
                      <td className="p-4 text-right text-slate-600"><DaysCoverBadge daysCover={getDaysOfCover(s)} /></td>
                      <td className="p-4 text-slate-600">{nearestExpiry ?? '—'}</td>
                      <td className="p-4 text-right">
                        <div className="relative inline-block">
                          <button type="button" onClick={() => setInventoryRowActionsOpen(isActionsOpen ? null : s.id)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition">...</button>
                          {isActionsOpen && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setInventoryRowActionsOpen(null)} aria-hidden />
                              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                                <button type="button" onClick={() => { setInventoryRowActionsOpen(null); setInventoryDetailView({ stock: s, medicine: med ?? null }) }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 font-medium">View full details</button>
                                <button type="button" onClick={() => { setInventoryRowActionsOpen(null); setInventoryViewBatchesStock(s) }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">View Batches</button>
                                <button type="button" onClick={() => { setInventoryRowActionsOpen(null); setInventoryDeleteTarget(s) }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 font-semibold">Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inventoryTableRows.length > 0 && (
        <Pagination currentPage={inventoryPage} totalPages={inventoryTotalPages} pageSize={inventoryPageSize} totalItems={inventoryTableRows.length} onPageChange={goToInventoryPage} onPageSizeChange={setInventoryPageSize} itemLabel="items" className="mt-3 rounded-xl border border-slate-200" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Inventory health</h3>
          <ul className="space-y-2">{inventoryHealthDonut.map((seg, i) => (<li key={i} className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} /><span className="text-slate-700">{seg.label}</span><span className="font-semibold text-slate-900">{seg.value}</span></li>))}</ul>
        </div>
      </div>

      {inventoryDetailView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setInventoryDetailView(null)}>
          <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Medicine details</h3>
              <button type="button" onClick={() => setInventoryDetailView(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">x</button>
            </div>
            <div className="overflow-y-auto p-6">
              {(() => {
                const { stock, medicine: med } = inventoryDetailView
                return (
                  <div className="space-y-3">
                    <p className="font-medium text-slate-900">{stock.medicineName}</p>
                    <p className="text-sm text-slate-600">Branch: {branches.find((b) => b.id === stock.branchId)?.name ?? stock.branchId}</p>
                    <p className="text-sm text-slate-600">Qty: {stock.totalQuantity}</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setInventoryDetailView(null); if (med) setEditMinLevelMedicine(med) }} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Edit medicine</button>
                      <button type="button" onClick={() => { setInventoryDetailView(null); setInventoryViewBatchesStock(stock) }} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">View batches</button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {inventoryViewBatchesStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setInventoryViewBatchesStock(null)}>
          <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Batch details – {inventoryViewBatchesStock.medicineName}</h3>
              <button type="button" onClick={() => setInventoryViewBatchesStock(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">x</button>
            </div>
            <div className="overflow-y-auto p-6">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#E5E7EB]"><th className="text-left py-2 font-medium text-slate-700">Batch Number</th><th className="text-right py-2 font-medium text-slate-700">Quantity</th><th className="text-left py-2 font-medium text-slate-700">Mfg Date</th><th className="text-left py-2 font-medium text-slate-700">Expiry Date</th></tr></thead>
                <tbody>
                  {(Array.isArray(inventoryViewBatchesStock.batches) ? inventoryViewBatchesStock.batches : []).map((b: MedicineBatch, i: number) => (
                    <tr key={i} className="border-b border-[#E5E7EB]"><td className="py-3 font-medium text-slate-900">{b.batchNumber ?? '—'}</td><td className="py-3 text-right text-slate-700">{b.quantity ?? 0}</td><td className="py-3 text-slate-600">{((b.manufacturingDate ?? '') as string).slice(0, 10) || '—'}</td><td className="py-3 text-slate-600">{(b.expiryDate ?? '').slice(0, 10) || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {lowStock.length > 0 && !isPharmacyPortal && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <h3 className="font-semibold text-amber-800 mb-2">Below minimum stock</h3>
          <ul className="space-y-1.5 text-sm text-amber-900">
            {lowStock.map((a, i) => {
              const suggestedQty = Math.max((a.minStockLevel ?? 0) - a.currentStock, 1)
              const med = medicines.find((m) => (m.medicineId ?? m.id) === a.medicineId)
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span><span className="font-medium">{a.medicineName}</span> – {a.branchName}: <span className="font-medium">{a.currentStock} in stock</span></span>
                  <button type="button" onClick={() => { setPendingAddToOrder({ medicineId: a.medicineId, medicineName: a.medicineName, quantity: suggestedQty, manufacturer: med?.manufacturer }); setSubTab('orders') }} className="text-xs font-medium text-sky-600 hover:text-sky-800">Create Purchase Order</button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
