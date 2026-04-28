'use client'

import React, { useEffect, useState } from 'react'
import type { PharmacyMedicine, PharmacySupplier } from '@/types/pharmacy'

export function AddMedicineForm({
  onSuccess,
  onError,
  getToken,
  hospitalId,
  supplierOptions,
  initialBarcode = '',
}: {
  onSuccess: () => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
  hospitalId: string
  supplierOptions: PharmacySupplier[]
  /** When opening "Add medicine" from barcode lookup, pass the barcode to pre-fill */
  initialBarcode?: string
}) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [genericName, setGenericName] = useState('')
  const [category, setCategory] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [minStockLevel, setMinStockLevel] = useState('')
  const [strength, setStrength] = useState('')
  const [packSize, setPackSize] = useState('')
  const [schedule, setSchedule] = useState<'Rx' | 'OTC' | ''>('')
  const [barcode, setBarcode] = useState(initialBarcode)
  const [hsnCode, setHsnCode] = useState('')
  useEffect(() => {
    if (initialBarcode !== undefined && initialBarcode !== '') setBarcode(initialBarcode)
  }, [initialBarcode])
  const [reorderQuantity, setReorderQuantity] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { onError('Name required'); return }
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch('/api/pharmacy/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          genericName: genericName.trim(),
          category: category.trim(),
          manufacturer: manufacturer.trim(),
          sellingPrice: Number(sellingPrice) || 0,
          minStockLevel: Number(minStockLevel) || 0,
          strength: strength.trim() || undefined,
          packSize: packSize.trim() || undefined,
          schedule: schedule === 'Rx' || schedule === 'OTC' ? schedule : undefined,
          barcode: barcode.trim() || undefined,
          hsnCode: hsnCode.trim() || undefined,
          reorderQuantity: reorderQuantity !== '' ? Number(reorderQuantity) || undefined : undefined,
          leadTimeDays: leadTimeDays !== '' ? Number(leadTimeDays) || undefined : undefined,
          supplierId: supplierId || null,
          unit: 'tablets',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add medicine')
      onSuccess()
      setName(''); setGenericName(''); setCategory(''); setManufacturer(''); setSellingPrice(''); setMinStockLevel(''); setStrength(''); setPackSize(''); setSchedule(''); setBarcode(''); setHsnCode(''); setReorderQuantity(''); setLeadTimeDays(''); setSupplierId('')
    } catch (err: any) {
      onError(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="text" placeholder="Medicine name *" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="text" placeholder="Generic name" value={genericName} onChange={(e) => setGenericName(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="text" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="text" placeholder="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="number" step="0.01" placeholder="Selling price" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="number" min="0" placeholder="Min stock level" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Strength (e.g. 500mg)" value={strength} onChange={(e) => setStrength(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        <input type="text" placeholder="Pack size (e.g. 10 tablets)" value={packSize} onChange={(e) => setPackSize(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={schedule} onChange={(e) => setSchedule(e.target.value as 'Rx' | 'OTC' | '')} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Schedule (Rx/OTC)</option>
          <option value="Rx">Rx (Prescription)</option>
          <option value="OTC">OTC (Over the counter)</option>
        </select>
        <input type="text" placeholder="Barcode / EAN" value={barcode} onChange={(e) => setBarcode(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="HSN code (GST)" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        <input type="number" min="0" placeholder="Reorder qty" value={reorderQuantity} onChange={(e) => setReorderQuantity(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <input type="number" min="0" placeholder="Lead time (days)" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" title="Typical days from order to delivery" />
      <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
        <option value="">No supplier</option>
        {supplierOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button type="submit" disabled={saving} className="btn-modern btn-modern-primary btn-modern-sm">Add medicine</button>
    </form>
  )
}

export function EditMinLevelModal({
  medicine,
  onSave,
  onError,
  onClose,
  getToken,
}: {
  medicine: PharmacyMedicine
  onSave: () => void
  onError: (e: string) => void
  onClose: () => void
  getToken: () => Promise<string | null>
}) {
  const [minStockLevel, setMinStockLevel] = useState(String(medicine.minStockLevel ?? 0))
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = Math.max(0, Number(minStockLevel) || 0)
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not signed in'); setSaving(false); return }
      const res = await fetch('/api/pharmacy/medicines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          medicineId: medicine.medicineId ?? medicine.id,
          minStockLevel: num,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        onError(data?.error || 'Failed to update')
        setSaving(false)
        return
      }
      onSave()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-slate-800 mb-1">Edit minimum stock level</h3>
        <p className="text-sm text-slate-600 mb-4">Adjust for season or conditions. Alerts use this level to warn when stock is low.</p>
        <p className="text-sm font-medium text-slate-700 mb-2">{medicine.name}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm text-slate-600">Minimum stock level</label>
          <input
            type="number"
            min={0}
            value={minStockLevel}
            onChange={e => setMinStockLevel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
