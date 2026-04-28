'use client'

import React, { useEffect, useState } from 'react'
import type { PharmacyMedicine } from '@/types/pharmacy'
import { MedicineSearchSelect } from './SearchInputs'

export function AddStockForm({
  branches,
  medicines,
  selectedBranchId,
  selectedBranchName,
  onSuccess,
  onError,
  getToken,
  hospitalId,
}: {
  branches: Array<{ id: string; name: string }>
  medicines: PharmacyMedicine[]
  selectedBranchId?: string
  selectedBranchName?: string
  onSuccess: () => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
  hospitalId: string
}) {
  const [saving, setSaving] = useState(false)
  const [branchId, setBranchId] = useState(selectedBranchId ?? '')
  const [medicineId, setMedicineId] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [quantity, setQuantity] = useState('')
  useEffect(() => {
    if (selectedBranchId) setBranchId(selectedBranchId)
  }, [selectedBranchId])
  const effectiveBranchId = selectedBranchId ?? branchId
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveBranchId || !medicineId || !quantity) { onError('Branch, medicine and quantity required'); return }
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch('/api/pharmacy/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          branchId: effectiveBranchId,
          medicineId,
          batchNumber: batchNumber || undefined,
          expiryDate: expiryDate || undefined,
          quantity: Number(quantity) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add stock')
      onSuccess()
      setQuantity(''); setBatchNumber(''); setExpiryDate('')
    } catch (err: any) {
      onError(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {selectedBranchId && selectedBranchName ? (
        <p className="text-sm text-slate-600"><strong>Branch:</strong> {selectedBranchName}</p>
      ) : (
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" required>
          <option value="">Select branch</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      <MedicineSearchSelect
        value={medicineId}
        medicines={medicines}
        onChange={setMedicineId}
        placeholder="Search medicine by name..."
      />
      <input type="text" placeholder="Batch number" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="date" placeholder="Expiry date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="number" min="1" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" required />
      <button type="submit" disabled={saving} className="btn-modern btn-modern-primary btn-modern-sm">Add stock</button>
    </form>
  )
}
