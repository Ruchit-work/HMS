'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { LowStockAlert, PharmacyMedicine, PharmacySupplier } from '@/types/pharmacy'
import { MedicineSearchSelect } from './SearchInputs'

export function PlaceOrderForm({
  branches,
  suppliers,
  medicines,
  lowStock,
  selectedBranchId,
  selectedBranchName,
  pendingAddToOrder,
  onConsumePendingAddToOrder,
  onSuccess,
  onError,
  getToken,
}: {
  branches: Array<{ id: string; name: string }>
  suppliers: PharmacySupplier[]
  medicines: PharmacyMedicine[]
  lowStock: LowStockAlert[]
  selectedBranchId?: string
  selectedBranchName?: string
  pendingAddToOrder?: { medicineId: string; medicineName: string; quantity: number; manufacturer?: string } | null
  onConsumePendingAddToOrder?: () => void
  onSuccess: () => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
}) {
  const [saving, setSaving] = useState(false)
  const [uploadingParse, setUploadingParse] = useState(false)
  const [parsedMessage, setParsedMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [branchId, setBranchId] = useState(selectedBranchId ?? '')
  const [supplierId, setSupplierId] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (selectedBranchId) setBranchId(selectedBranchId)
  }, [selectedBranchId])
  useEffect(() => {
    if (!pendingAddToOrder || !onConsumePendingAddToOrder) return
    const med = medicines.find((m) => (m.medicineId ?? m.id) === pendingAddToOrder.medicineId)
    setLines((prev) => [...prev, {
      ...emptyLine,
      medicineId: pendingAddToOrder.medicineId,
      medicineName: pendingAddToOrder.medicineName,
      manufacturer: pendingAddToOrder.manufacturer ?? med?.manufacturer ?? '',
      quantity: pendingAddToOrder.quantity,
      unitCost: med?.purchasePrice ?? 0,
    }])
    onConsumePendingAddToOrder()
  }, [pendingAddToOrder])
  const effectiveBranchId = selectedBranchId ?? branchId
  type Line = {
    medicineId: string; medicineName: string; manufacturer?: string; quantity: number; unitCost: number; isNewMedicine?: boolean
    genericName?: string; category?: string; sellingPrice?: string | number
    minStockLevel?: string | number; strength?: string; packSize?: string; schedule?: '' | 'Rx' | 'OTC'
    barcode?: string; hsnCode?: string; leadTimeDays?: string
    expiryDate?: string
  }
  const emptyLine: Line = {
    medicineId: '', medicineName: '', manufacturer: '', quantity: 0, unitCost: 0, isNewMedicine: false,
    genericName: '', category: '', sellingPrice: '', minStockLevel: '', strength: '', packSize: '', schedule: '',
    barcode: '', hsnCode: '', leadTimeDays: '', expiryDate: '',
  }
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }])

  const addLine = () => {
    setLines((prev) => [...prev, { ...emptyLine }])
  }
  const removeLine = (i: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== i))
  }
  const setLine = (i: number, upd: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...upd } : l)))
  }
  const setLineMedicine = (i: number, medicineId: string) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === medicineId)
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? {
              ...l,
              medicineId: medicineId || l.medicineId,
              medicineName: med?.name ?? l.medicineName,
              manufacturer: med?.manufacturer ?? '',
              unitCost: med?.purchasePrice ?? l.unitCost,
              isNewMedicine: false,
            }
          : l
      )
    )
  }
  const setLineNewMedicineName = (i: number, name: string) => {
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i ? { ...l, medicineName: name, medicineId: '', isNewMedicine: true } : l
      )
    )
  }
  const updateNewMedicineField = (i: number, field: keyof Line, value: string | number) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  }

  const handleUploadParse = async (file: File | null) => {
    if (!file || !effectiveBranchId || !supplierId) return
    setUploadingParse(true)
    setParsedMessage(null)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const form = new FormData()
      form.append('file', file)
      form.append('branchId', effectiveBranchId)
      form.append('supplierId', supplierId)
      form.append('parseOnly', 'true')
      const res = await fetch('/api/pharmacy/purchase-orders/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      const items = data.items as Array<{ medicineId: string; medicineName: string; quantity: number; unitCost: number; batchNumber?: string; expiryDate?: string }> | undefined
      if (items && items.length > 0) {
        const newLines: Line[] = items.map((it) => ({
          medicineId: it.medicineId,
          medicineName: it.medicineName,
          quantity: it.quantity,
          unitCost: it.unitCost,
          isNewMedicine: false,
          genericName: '',
          category: '',
          manufacturer: '',
          sellingPrice: '',
          minStockLevel: '',
          strength: '',
          packSize: '',
          schedule: '',
          barcode: '',
          hsnCode: '',
          leadTimeDays: '',
          expiryDate: it.expiryDate || '',
        }))
        setLines(newLines)
        setParsedMessage(data.message || `Filled ${items.length} line(s) from file. Review below, add any missing items, then click Place order.`)
      } else {
        setParsedMessage(data.message || 'No items parsed. Add lines manually or check file format.')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Upload parse failed')
    } finally {
      setUploadingParse(false)
    }
  }

  const addFromLowStock = () => {
    const added = new Set(lines.map((l) => l.medicineId))
    lowStock.forEach((a) => {
      if (added.has(a.medicineId)) return
      const med = medicines.find((m) => (m.medicineId ?? m.id) === a.medicineId)
      const qty = Math.max(a.minStockLevel - a.currentStock, 1)
      setLines((prev) => [...prev, {
        ...emptyLine,
        medicineId: a.medicineId,
        medicineName: a.medicineName,
        manufacturer: med?.manufacturer ?? '',
        quantity: qty,
        unitCost: med?.purchasePrice ?? 0,
      }])
      added.add(a.medicineId)
    })
  }

  const handleSubmit = async (e: React.FormEvent, sendAsDraft: boolean) => {
    e.preventDefault()
    if (!effectiveBranchId || !supplierId) {
      onError('Select branch and supplier')
      return
    }
    const validLines = lines
      .map((l) => ({ ...l, quantity: Math.floor(Number(l.quantity)) || 0, unitCost: Number(l.unitCost) || 0 }))
      .filter((l) => {
        const hasMedicine = l.medicineId || (typeof l.medicineName === 'string' && l.medicineName.trim().length > 0)
        return hasMedicine && l.quantity > 0
      })
    if (validLines.length === 0) {
      onError('Add at least one medicine (select from catalog or type new name) with quantity')
      return
    }
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) {
        onError('Not authenticated')
        setSaving(false)
        return
      }
      const res = await fetch('/api/pharmacy/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          branchId: effectiveBranchId,
          supplierId,
          receive: false,
          status: sendAsDraft ? 'draft' : 'pending',
          expectedDeliveryDate: expectedDeliveryDate.trim() || undefined,
          notes: notes.trim() || undefined,
          items: validLines.map((l) => ({
            medicineId: l.medicineId || undefined,
            medicineName: (l.medicineName && l.medicineName.trim()) || (l.medicineId ? medicines.find((m) => (m.medicineId ?? m.id) === l.medicineId)?.name : '') || '',
            manufacturer: (l.manufacturer && String(l.manufacturer).trim()) || undefined,
            quantity: l.quantity,
            unitCost: l.unitCost,
            batchNumber: '',
            expiryDate: (l.expiryDate && String(l.expiryDate).trim()) || '',
            ...(l.isNewMedicine && {
              newMedicine: {
                genericName: (l.genericName && String(l.genericName).trim()) || '',
                category: (l.category && String(l.category).trim()) || '',
                manufacturer: (l.manufacturer && String(l.manufacturer).trim()) || '',
                sellingPrice: Number(l.sellingPrice) || 0,
                minStockLevel: Math.max(0, Number(l.minStockLevel) || 0),
                strength: (l.strength && String(l.strength).trim()) || undefined,
                packSize: (l.packSize && String(l.packSize).trim()) || undefined,
                schedule: l.schedule === 'Rx' || l.schedule === 'OTC' ? l.schedule : undefined,
                barcode: (l.barcode && String(l.barcode).trim()) || undefined,
                hsnCode: (l.hsnCode && String(l.hsnCode).trim()) || undefined,
                leadTimeDays: l.leadTimeDays !== '' ? Math.max(0, Number(l.leadTimeDays) || 0) : undefined,
                expiryDate: (l.expiryDate && String(l.expiryDate).trim()) || undefined,
              },
            }),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save order')
      onSuccess()
      if (!selectedBranchId) setBranchId('')
      setSupplierId('')
      setExpectedDeliveryDate('')
      setNotes('')
      setLines([{ ...emptyLine }])
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e, false); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {selectedBranchId && selectedBranchName ? (
          <div>
            <span className="text-xs text-slate-500">Branch</span>
            <p className="text-sm font-medium text-slate-800">{selectedBranchName}</p>
          </div>
        ) : (
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            required
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          required
        >
          <option value="">Select supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="date" placeholder="Expected delivery" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" title="Expected delivery date" />
        <input type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Fill lines from file or add manually below</p>
        <p className="text-xs text-slate-600 mb-3">Upload an Excel or PDF (columns: name, quantity; optional: purchase/cost). Parsed items will appear in the order lines so you can review, add missing info, or add more lines before placing order.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.pdf"
          className="hidden"
          onChange={(e) => handleUploadParse(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingParse || !effectiveBranchId || !supplierId}
          className="rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploadingParse ? 'Parsing…' : 'Upload file to fill order lines'}
        </button>
        <span className="ml-2 text-xs text-slate-500">.xlsx, .xls, .pdf</span>
        {parsedMessage && (
          <p className="mt-3 text-sm text-emerald-700 font-medium">{parsedMessage}</p>
        )}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Medicine table</span>
          <div className="flex gap-2">
            {lowStock.length > 0 && (
              <button type="button" onClick={addFromLowStock} className="text-sm text-amber-700 hover:text-amber-800 font-medium">
                Add from low stock
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="text-left p-2 font-medium text-slate-700">Medicine</th>
                <th className="text-left p-2 font-medium text-slate-700">Manufacturer</th>
                <th className="text-right p-2 font-medium text-slate-700 w-20">Qty</th>
                <th className="text-right p-2 font-medium text-slate-700 w-24">Unit price</th>
                <th className="text-right p-2 font-medium text-slate-700 w-24">Subtotal</th>
                <th className="w-10 p-1" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const qty = Math.floor(Number(line.quantity)) || 0
                const unitCost = Number(line.unitCost) || 0
                const subtotal = qty * unitCost
                return (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="p-2">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={!!line.isNewMedicine}
                          onChange={(e) => {
                            const isNew = e.target.checked
                            setLine(i, { isNewMedicine: isNew, medicineId: isNew ? '' : line.medicineId, medicineName: isNew ? line.medicineName : (medicines.find((m) => (m.medicineId ?? m.id) === line.medicineId)?.name ?? '') })
                          }}
                          className="rounded border-slate-300"
                        />
                        <span className="text-xs text-slate-500">New</span>
                      </label>
                      {line.isNewMedicine ? (
                        <input
                          type="text"
                          value={line.medicineName}
                          onChange={(e) => setLineNewMedicineName(i, e.target.value)}
                          placeholder="Medicine name"
                          className="mt-1 w-full min-w-[140px] rounded border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      ) : (
                        <div className="min-w-[180px] mt-1">
                          <MedicineSearchSelect
                            value={line.medicineId}
                            medicines={medicines}
                            onChange={(id) => setLineMedicine(i, id)}
                            placeholder="Search medicine"
                            showGeneric={false}
                            showStrengthManufacturer
                            className="text-sm"
                          />
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-slate-600">{line.manufacturer || '—'}</td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity || ''}
                        onChange={(e) => setLine(i, { quantity: Number(e.target.value) || 0 })}
                        className="w-16 text-right rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.unitCost || ''}
                        onChange={(e) => setLine(i, { unitCost: Number(e.target.value) || 0 })}
                        className="w-20 text-right rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="p-2 text-right font-medium text-slate-800">₹{subtotal.toFixed(2)}</td>
                    <td className="p-1">
                      <button type="button" onClick={() => removeLine(i)} className="text-slate-400 hover:text-red-600 p-1" title="Remove row">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {medicines.length === 0 && (
          <p className="text-amber-700 text-sm mt-1">Loading medicines… Select branch and wait for the list to load, or use &quot;New&quot; to add by name.</p>
        )}
        <div className="mt-3 flex justify-end">
          <p className="text-sm font-semibold text-slate-800">
            Order total: ₹{lines.reduce((sum, l) => sum + (Math.floor(Number(l.quantity)) || 0) * (Number(l.unitCost) || 0), 0).toFixed(2)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={(e) => handleSubmit(e, true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        <button type="button" disabled={saving} onClick={(e) => handleSubmit(e, false)} className="btn-modern btn-modern-primary btn-modern-sm">
          {saving ? 'Sending…' : 'Send Purchase Order'}
        </button>
      </div>
    </form>
  )
}
