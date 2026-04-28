import React from 'react'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Pagination from '@/components/ui/navigation/Pagination'
import type { LowStockAlert, PharmacyMedicine, PharmacyPurchaseOrder, PharmacySupplier, PurchaseOrderLine } from '@/types/pharmacy'
import { downloadPurchaseOrderPDF, printPurchaseOrderPDF } from '../purchaseOrderPdf'
import { ActionEmptyState, getPurchaseOrderStatusMeta } from './RealWorldUiBlocks'
import { PlaceOrderForm } from './PlaceOrderForm'

type BranchOption = { id: string; name: string }

export function OrdersTabContent(props: {
  isViewOnly: boolean
  branches: BranchOption[]
  suppliers: PharmacySupplier[]
  medicines: PharmacyMedicine[]
  lowStock: LowStockAlert[]
  branchFilter: string
  selectedBranchName?: string
  pendingAddToOrder: { medicineId: string; medicineName: string; quantity: number; manufacturer?: string } | null
  onConsumePendingAddToOrder: () => void
  onSuccess: (message: string) => void
  onError: (message: string) => void
  getToken: () => Promise<string | null>
  loading: boolean
  paginatedOrders: PharmacyPurchaseOrder[]
  purchaseOrders: PharmacyPurchaseOrder[]
  ordersForTableCount: number
  ordersPage: number
  ordersTotalPages: number
  ordersPageSize: number
  goToOrdersPage: (page: number) => void
  setOrdersPageSize: (size: number) => void
  setReceiveOrder: (order: PharmacyPurchaseOrder | null) => void
  setReceiveDetailsForm: (rows: Array<{ batchNumber: string; expiryDate: string; manufacturingDate: string }>) => void
  setReceiveSupplierInvoice: (value: string) => void
  selectedOrderDetail: PharmacyPurchaseOrder | null
  setSelectedOrderDetail: (order: PharmacyPurchaseOrder | null) => void
  receiveOrder: PharmacyPurchaseOrder | null
  receiveDetailsForm: Array<{ batchNumber: string; expiryDate: string; manufacturingDate: string }>
  receiveSupplierInvoice: string
  receiveSubmitting: boolean
  setReceiveSubmitting: (v: boolean) => void
  fetchPharmacy: () => Promise<void>
  activeHospitalName?: string
  activeHospitalAddress?: string
  cancelOrderSubmitting: boolean
  setCancelOrderSubmitting: (v: boolean) => void
}) {
  const {
    isViewOnly,
    branches,
    suppliers,
    medicines,
    lowStock,
    branchFilter,
    selectedBranchName,
    pendingAddToOrder,
    onConsumePendingAddToOrder,
    onSuccess,
    onError,
    getToken,
    loading,
    paginatedOrders,
    purchaseOrders,
    ordersForTableCount,
    ordersPage,
    ordersTotalPages,
    ordersPageSize,
    goToOrdersPage,
    setOrdersPageSize,
    setReceiveOrder,
    setReceiveDetailsForm,
    setReceiveSupplierInvoice,
    selectedOrderDetail,
    setSelectedOrderDetail,
    receiveOrder,
    receiveDetailsForm,
    receiveSupplierInvoice,
    receiveSubmitting,
    setReceiveSubmitting,
    fetchPharmacy,
    activeHospitalName,
    activeHospitalAddress,
    cancelOrderSubmitting,
    setCancelOrderSubmitting,
  } = props

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 w-full max-w-none">
        <h3 className="font-semibold text-slate-800 mb-3">Place order</h3>
        <p className="text-sm text-slate-600 mb-4">Select branch and supplier, then either upload a file to fill order lines or add lines manually.</p>
        <PlaceOrderForm
          branches={branches}
          suppliers={suppliers}
          medicines={medicines}
          lowStock={lowStock}
          selectedBranchId={!isViewOnly ? branchFilter : undefined}
          selectedBranchName={!isViewOnly ? selectedBranchName : undefined}
          pendingAddToOrder={pendingAddToOrder}
          onConsumePendingAddToOrder={onConsumePendingAddToOrder}
          onSuccess={() => { onSuccess('Order placed'); fetchPharmacy() }}
          onError={onError}
          getToken={getToken}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-3 px-1">Purchase orders</h3>
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner inline /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-slate-700">Order #</th>
                <th className="text-left p-3 font-medium text-slate-700">Date</th>
                <th className="text-left p-3 font-medium text-slate-700">Branch</th>
                <th className="text-left p-3 font-medium text-slate-700">Supplier</th>
                <th className="text-left p-3 font-medium text-slate-700">Expected</th>
                <th className="text-left p-3 font-medium text-slate-700">Items</th>
                <th className="text-right p-3 font-medium text-slate-700">Total</th>
                <th className="text-left p-3 font-medium text-slate-700">Status</th>
                <th className="text-left p-3 font-medium text-slate-700">Received</th>
                <th className="text-left p-3 font-medium text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((o) => {
                const supplierName = suppliers.find((s) => s.id === o.supplierId)?.name ?? o.supplierId
                const branchName = branches.find((b) => b.id === o.branchId)?.name ?? o.branchId
                const created = typeof o.createdAt === 'string' ? o.createdAt : (o.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
                const dateStr = created ? new Date(created).toLocaleDateString() : '—'
                const receivedAt = typeof o.receivedAt === 'string' ? o.receivedAt : (o.receivedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
                const receivedStr = o.status === 'received' && receivedAt ? new Date(receivedAt).toLocaleDateString() : '—'
                const expectedStr = o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : '—'
                const { label: statusLabel, badgeClass: statusBadgeClass } = getPurchaseOrderStatusMeta(o.status)
                return (
                  <tr key={o.id} className="border-t border-slate-200 hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-xs">{o.orderNumber ?? o.id.slice(0, 8)}</td>
                    <td className="p-3">{dateStr}</td>
                    <td className="p-3">{branchName}</td>
                    <td className="p-3">{supplierName}</td>
                    <td className="p-3">{expectedStr}</td>
                    <td className="p-3 max-w-xs truncate">{o.items?.map((i: PurchaseOrderLine) => `${i.medicineName} (${i.quantity})`).join(', ') ?? '—'}</td>
                    <td className="p-3 text-right font-medium">₹{Number(o.totalCost ?? 0).toFixed(2)}</td>
                    <td className="p-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>{statusLabel}</span></td>
                    <td className="p-3 text-sm text-slate-600">{receivedStr}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => setSelectedOrderDetail(o)} className="text-sky-600 hover:text-sky-800 font-medium text-sm">View</button>
                        {o.status === 'pending' && !isViewOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              setReceiveOrder(o)
                              setReceiveDetailsForm((o.items ?? []).map(() => ({ batchNumber: '', expiryDate: '', manufacturingDate: '' })))
                              setReceiveSupplierInvoice('')
                            }}
                            className="text-emerald-600 hover:text-emerald-800 font-medium text-sm"
                          >
                            Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && purchaseOrders.length === 0 && (
          <ActionEmptyState
            title="No purchase orders yet."
            hint="Create your first order above to start supplier procurement tracking."
            actions={[{ label: 'Scroll to order form', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), variant: 'secondary' }]}
          />
        )}
        {ordersForTableCount > 0 && (
          <Pagination
            currentPage={ordersPage}
            totalPages={ordersTotalPages}
            pageSize={ordersPageSize}
            totalItems={ordersForTableCount}
            onPageChange={goToOrdersPage}
            onPageSizeChange={setOrdersPageSize}
            itemLabel="orders"
          />
        )}
      </div>

      {receiveOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !receiveSubmitting && setReceiveOrder(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Confirm receive – enter batch details</h3>
              <div className="mt-3">
                <label className="block text-xs text-slate-500 mb-1">Supplier invoice # (optional)</label>
                <input type="text" value={receiveSupplierInvoice} onChange={(e) => setReceiveSupplierInvoice(e.target.value)} placeholder="e.g. INV-2024-001" className="w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-100">
                  <tr><th className="text-left p-2">Medicine</th><th className="text-right p-2 w-16">Qty</th><th className="text-right p-2 w-20">Unit cost</th><th className="text-left p-2">Batch number</th><th className="text-left p-2">Expiry date</th><th className="text-left p-2">Mfg date</th></tr>
                </thead>
                <tbody>
                  {(receiveOrder.items ?? []).map((line: PurchaseOrderLine, idx: number) => (
                    <tr key={`${line.medicineId}-${idx}`} className="border-t border-slate-200">
                      <td className="p-2">{line.medicineName}</td>
                      <td className="p-2 text-right">{line.quantity}</td>
                      <td className="p-2 text-right">₹{Number(line.unitCost ?? 0).toFixed(2)}</td>
                      <td className="p-2"><input type="text" value={receiveDetailsForm[idx]?.batchNumber ?? ''} onChange={(e) => setReceiveDetailsForm(receiveDetailsForm.map((d, i) => i === idx ? { ...d, batchNumber: e.target.value } : d))} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="p-2"><input type="date" value={receiveDetailsForm[idx]?.expiryDate ?? ''} onChange={(e) => setReceiveDetailsForm(receiveDetailsForm.map((d, i) => i === idx ? { ...d, expiryDate: e.target.value } : d))} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="p-2"><input type="date" value={receiveDetailsForm[idx]?.manufacturingDate ?? ''} onChange={(e) => setReceiveDetailsForm(receiveDetailsForm.map((d, i) => i === idx ? { ...d, manufacturingDate: e.target.value } : d))} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setReceiveOrder(null)} disabled={receiveSubmitting} className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button
                type="button"
                disabled={receiveSubmitting}
                onClick={async () => {
                  if (!receiveOrder) return
                  setReceiveSubmitting(true)
                  try {
                    const token = await getToken()
                    if (!token) { onError('Not signed in'); setReceiveSubmitting(false); return }
                    const result = await (await import('../api/pharmacyApiClient')).createPharmacyApiClient(token).patchPurchaseOrder(receiveOrder.id, {
                      supplierInvoiceNumber: receiveSupplierInvoice.trim() || undefined,
                      receiveDetails: receiveDetailsForm.map((d) => ({
                        batchNumber: d.batchNumber.trim() || undefined,
                        expiryDate: d.expiryDate.trim() || undefined,
                        manufacturingDate: d.manufacturingDate.trim() || undefined,
                      })),
                    })
                    if (!result.ok || !result.data.success) throw new Error((result.data.error as string) || 'Failed to receive order')
                    onSuccess('Order received; stock updated with batch details.')
                    setReceiveOrder(null)
                    fetchPharmacy()
                  } catch (err: unknown) {
                    onError(err instanceof Error ? err.message : 'Failed to receive order')
                  } finally {
                    setReceiveSubmitting(false)
                  }
                }}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {receiveSubmitting ? 'Receiving…' : 'Confirm receive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedOrderDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-800">Purchase order – {selectedOrderDetail.orderNumber ?? selectedOrderDetail.id.slice(0, 8)}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{selectedOrderDetail.notes ? `Notes: ${selectedOrderDetail.notes}` : 'No notes'}</p>
                </div>
                <button type="button" onClick={() => setSelectedOrderDetail(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
              </div>
            </div>
            <div className="overflow-auto flex-1 p-4">
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-100"><tr><th className="text-left p-2">Medicine</th><th className="text-left p-2">Manufacturer</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Unit price</th><th className="text-right p-2">Subtotal</th></tr></thead>
                <tbody>
                  {(selectedOrderDetail.items ?? []).map((line: PurchaseOrderLine, idx: number) => (
                    <tr key={`${line.medicineId}-${idx}`} className="border-t border-slate-200"><td className="p-2">{line.medicineName}</td><td className="p-2 text-slate-600">{line.manufacturer ?? '—'}</td><td className="p-2 text-right">{line.quantity}</td><td className="p-2 text-right">₹{Number(line.unitCost ?? 0).toFixed(2)}</td><td className="p-2 text-right font-medium">₹{((line.quantity ?? 0) * Number(line.unitCost ?? 0)).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-200 flex flex-wrap gap-2 justify-between">
              <div className="flex gap-2">
                {(selectedOrderDetail.status === 'draft' || selectedOrderDetail.status === 'pending') && !isViewOnly && (
                  <button
                    type="button"
                    disabled={cancelOrderSubmitting}
                    onClick={async () => {
                      if (!selectedOrderDetail) return
                      setCancelOrderSubmitting(true)
                      try {
                        const token = await getToken()
                        if (!token) { onError('Not signed in'); return }
                        const result = await (await import('../api/pharmacyApiClient')).createPharmacyApiClient(token).patchPurchaseOrder(selectedOrderDetail.id, { cancel: true })
                        if (!result.ok || !result.data.success) throw new Error((result.data.error as string) || 'Failed to cancel')
                        onSuccess('Order cancelled.')
                        setSelectedOrderDetail(null)
                        fetchPharmacy()
                      } catch (err: unknown) {
                        onError(err instanceof Error ? err.message : 'Failed to cancel order')
                      } finally {
                        setCancelOrderSubmitting(false)
                      }
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {cancelOrderSubmitting ? 'Cancelling…' : 'Cancel order'}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => downloadPurchaseOrderPDF(selectedOrderDetail, suppliers.find((s) => s.id === selectedOrderDetail.supplierId)?.name ?? selectedOrderDetail.supplierId, branches.find((b) => b.id === selectedOrderDetail.branchId)?.name ?? selectedOrderDetail.branchId, activeHospitalName, activeHospitalAddress)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => printPurchaseOrderPDF(selectedOrderDetail, suppliers.find((s) => s.id === selectedOrderDetail.supplierId)?.name ?? selectedOrderDetail.supplierId, branches.find((b) => b.id === selectedOrderDetail.branchId)?.name ?? selectedOrderDetail.branchId, activeHospitalName, activeHospitalAddress)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Print
                </button>
                <button type="button" onClick={() => setSelectedOrderDetail(null)} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
