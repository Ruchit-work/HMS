'use client'

import React, { useRef, useState } from 'react'
import type { PharmacyMedicine, PharmacyPurchaseOrder } from '@/types/pharmacy'
import type { ParsedMedicineRow } from '@/utils/pharmacy/parseMedicineFile'
import { MedicineSearchSelect } from './SearchInputs'

export function TransferStockForm({
  branches,
  medicines,
  onSuccess,
  onError,
  getToken,
  hospitalId: _hospitalId,
}: {
  branches: Array<{ id: string; name: string }>
  medicines: PharmacyMedicine[]
  onSuccess: () => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
  hospitalId: string
}) {
  const [saving, setSaving] = useState(false)
  const [fromBranchId, setFromBranchId] = useState('')
  const [toBranchId, setToBranchId] = useState('')
  const [medicineId, setMedicineId] = useState('')
  const [quantity, setQuantity] = useState('')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fromBranchId || !toBranchId || !medicineId || !quantity) { onError('All fields required'); return }
    if (fromBranchId === toBranchId) { onError('Select different branches'); return }
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch('/api/pharmacy/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromBranchId, toBranchId, medicineId, quantity: Number(quantity) || 0 }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to transfer')
      onSuccess()
      setQuantity('')
    } catch (err: any) {
      onError(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" required>
        <option value="">From branch</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" required>
        <option value="">To branch</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <MedicineSearchSelect
        value={medicineId}
        medicines={medicines}
        onChange={setMedicineId}
        placeholder="Search medicine..."
        showGeneric={false}
      />
      <input type="number" min="1" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" required />
      <button type="submit" disabled={saving} className="btn-modern btn-modern-primary btn-modern-sm">Transfer</button>
    </form>
  )
}

export function ReceiveByFileForm({
  pendingOrders,
  onSuccess,
  onError,
  getToken,
  branchIdForSimpleUpload,
}: {
  pendingOrders: PharmacyPurchaseOrder[]
  onSuccess: () => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
  branchIdForSimpleUpload?: string
}) {
  const [orderId, setOrderId] = useState('')
  const [supplierInvoice, setSupplierInvoice] = useState('')
  const [parsing, setParsing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedMedicineRow[] | null>(null)
  const [parsedOrder, setParsedOrder] = useState<{ orderNumber?: string; branchId?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedOrder = orderId ? pendingOrders.find((o) => o.id === orderId) : null
  const isPendingAndSelected = !!selectedOrder && selectedOrder.status === 'pending'
  // Keep validation in handleParse/handleConfirm, but always keep the file input and button enabled
  const uploadEnabled = true

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file || file.size === 0) {
      onError('Select a PDF or Excel file from the supplier')
      return
    }
    setParsing(true)
    setParsedRows(null)
    setParsedOrder(null)
    try {
      const token = await getToken()
      if (!token) {
        onError('Not signed in')
        setParsing(false)
        return
      }
      const form = new FormData()
      form.append('orderId', orderId)
      form.append('file', file)
      form.append('parseOnly', '1')
      const res = await fetch('/api/pharmacy/purchase-orders/receive-by-file', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to parse file')
      const rows = Array.isArray(data.rows) ? data.rows : []
      setParsedOrder(data.order || null)
      setParsedRows(rows.length > 0 ? rows : null)
      if (rows.length === 0) onError('No medicine rows found in file. Check columns (name, quantity, manufacturer, etc.).')
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to parse file')
    } finally {
      setParsing(false)
    }
  }

  const updateRow = (index: number, field: keyof ParsedMedicineRow, value: string | number | undefined) => {
    if (!parsedRows) return
    const next = [...parsedRows]
    const row = { ...next[index], [field]: value }
    next[index] = row
    setParsedRows(next)
  }

  const deleteRow = (index: number) => {
    if (!parsedRows) return
    const next = parsedRows.filter((_, i) => i !== index)
    setParsedRows(next.length > 0 ? next : null)
  }

  const clearPreview = () => {
    setParsedRows(null)
    setParsedOrder(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleConfirm = async () => {
    if (!parsedRows || parsedRows.length === 0) {
      onError('No data to confirm')
      return
    }
    setConfirming(true)
    try {
      const token = await getToken()
      if (!token) {
        onError('Not signed in')
        setConfirming(false)
        return
      }

      // If no orderId, treat this as a simple bulk upload: call upload-medicines API
      if (!orderId) {
        const file = fileInputRef.current?.files?.[0]
        if (!file || file.size === 0) {
          onError('Select a PDF or Excel file from the supplier')
          setConfirming(false)
          return
        }
        if (!branchIdForSimpleUpload) {
          onError('Select a branch first to add stock to.')
          setConfirming(false)
          return
        }
        const form = new FormData()
        form.append('file', file)
        form.append('branchId', branchIdForSimpleUpload)
        const res = await fetch('/api/pharmacy/upload-medicines', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to import medicines')
      } else {
        // Existing behavior: confirm receive for a specific order
        const res = await fetch('/api/pharmacy/purchase-orders/receive-by-file/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            orderId,
            rows: parsedRows,
            supplierInvoiceNumber: supplierInvoice.trim() || undefined,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to confirm')
      }
      onSuccess()
      setOrderId('')
      setSupplierInvoice('')
      setParsedRows(null)
      setParsedOrder(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to confirm receive')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="font-semibold text-slate-800 mb-2">Import inventory – receive from supplier file</h3>
      <p className="text-sm text-slate-600 mb-3">
        Select the purchase order (must be pending/Sent). Then upload the supplier&apos;s PDF or Excel. Review and edit the parsed rows, then Confirm to update stock and mark the order as Delivered.
      </p>

      {/* Step 1: Order ID – green when pending */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Order number</label>
          <select
            value={orderId}
            onChange={(e) => {
              setOrderId(e.target.value)
              setParsedRows(null)
              setParsedOrder(null)
            }}
            className={`rounded border px-2 py-1.5 text-sm min-w-[200px] ${isPendingAndSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'}`}
          >
            <option value="">Select order</option>
            {pendingOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber ?? o.id} – {(o.items ?? []).length} item(s)
              </option>
            ))}
          </select>
        </div>
        {isPendingAndSelected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Pending – ready to upload
          </span>
        )}
      </div>

      {/* Step 2: File upload – enabled only when order selected and pending */}
      <form onSubmit={handleParse} className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Supplier file (PDF / Excel)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            disabled={!uploadEnabled}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Invoice # (optional)</label>
          <input
            type="text"
            value={supplierInvoice}
            onChange={(e) => setSupplierInvoice(e.target.value)}
            placeholder="e.g. INV-001"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm w-32"
          />
        </div>
        <button type="submit" disabled={parsing || !uploadEnabled} className="btn-modern btn-modern-primary btn-modern-sm">
          {parsing ? 'Parsing…' : 'Upload and preview'}
        </button>
      </form>

      {/* Step 3: Editable preview + Confirm */}
      {parsedRows && parsedRows.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-medium text-slate-700 mb-2">
            Parsed from file{parsedOrder?.orderNumber ? ` for ${parsedOrder.orderNumber}` : ''} – edit if needed, then confirm. Company = manufacturer.
          </p>
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm border border-slate-200 rounded">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="text-left p-2">Medicine</th>
                  <th className="text-left p-2">Generic name</th>
                  <th className="text-left p-2">Company</th>
                  <th className="text-left p-2">Strength</th>
                  <th className="text-left p-2">Barcode</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-left p-2">Batch</th>
                  <th className="text-left p-2">Expiry</th>
                  <th className="text-left p-2" title="Manufacturing date (not company)">Mfg date</th>
                  <th className="text-right p-2">Price</th>
                  <th className="text-center p-2 w-10">Delete</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.name || ''}
                        onChange={(e) => updateRow(idx, 'name', e.target.value)}
                        placeholder="Medicine name"
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.genericName ?? ''}
                        onChange={(e) => updateRow(idx, 'genericName', e.target.value)}
                        placeholder="Generic"
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.manufacturer ?? ''}
                        onChange={(e) => updateRow(idx, 'manufacturer', e.target.value)}
                        placeholder="Company"
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.strength ?? ''}
                        onChange={(e) => updateRow(idx, 'strength', e.target.value)}
                        placeholder="e.g. 500mg"
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.barcode ?? ''}
                        onChange={(e) => updateRow(idx, 'barcode', e.target.value)}
                        placeholder="Barcode"
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={row.quantity ?? ''}
                        onChange={(e) => updateRow(idx, 'quantity', e.target.value === '' ? undefined : Number(e.target.value))}
                        className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.batchNumber ?? ''}
                        onChange={(e) => updateRow(idx, 'batchNumber', e.target.value)}
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD"
                        value={row.expiryDate ?? ''}
                        onChange={(e) => updateRow(idx, 'expiryDate', e.target.value)}
                        className="w-28 rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="date"
                        value={row.manufacturingDate ?? ''}
                        onChange={(e) => updateRow(idx, 'manufacturingDate', e.target.value || undefined)}
                        title="Manufacturing date"
                        className="w-28 rounded border border-slate-200 px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={row.sellingPrice ?? ''}
                        onChange={(e) => updateRow(idx, 'sellingPrice', e.target.value === '' ? undefined : Number(e.target.value))}
                        className="w-20 rounded border border-slate-200 px-1.5 py-1 text-xs text-right"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(idx)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Remove row"
                        aria-label="Remove row"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {parsedRows.length} item(s). Same name + same company will update existing medicine stock; otherwise a new medicine is created. Remove rows you don&apos;t want to import.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={clearPreview}
              className="btn-modern btn-modern-secondary"
            >
              Clear / Discard
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="btn-modern btn-modern-primary"
            >
              {confirming ? 'Confirming…' : 'Confirm and mark order Delivered'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
