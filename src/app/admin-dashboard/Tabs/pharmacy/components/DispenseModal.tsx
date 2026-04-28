'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { BarcodeCameraScanner } from '@/components/pharmacy/BarcodeCameraScanner'
import type { BranchMedicineStock, MedicineBatch, PharmacyMedicine } from '@/types/pharmacy'
import { generateBillPDFAndPrint } from '@/utils/pharmacy/billPrint'
import { MedicineSearchSelect, POSMedicineSearch } from './SearchInputs'
import type { QueueItem } from '../types'

export function DispenseModal({
  queueItem,
  medicines,
  stock,
  hospitalId,
  onSuccess,
  onError,
  onClose,
  getToken,
  onOpenAddMedicine,
  inline = false,
}: {
  queueItem: QueueItem
  medicines: PharmacyMedicine[]
  stock: BranchMedicineStock[]
  hospitalId: string
  onSuccess: () => void
  onError: (e: string) => void
  onClose: () => void
  getToken: () => Promise<string | null>
  onOpenAddMedicine?: (barcode: string) => void
  inline?: boolean
}) {
  const branchId = queueItem.branchId || ''
  const branchStock = stock.filter((s) => s.branchId === branchId)
  const [saving, setSaving] = useState(false)
  const [pendingDispensePayload, setPendingDispensePayload] = useState<Array<{ medicineId: string; quantity: number }> | null>(null)
  const [pendingBillAmount, setPendingBillAmount] = useState(0)
  const [scannedMedicines, setScannedMedicines] = useState<PharmacyMedicine[]>([])
  const displayMedicines = useMemo(() => {
    const seen = new Set<string>()
    const out: PharmacyMedicine[] = []
    for (const m of medicines) {
      const id = m.medicineId ?? m.id
      if (!seen.has(id)) { seen.add(id); out.push(m) }
    }
    for (const m of scannedMedicines) {
      const id = m.medicineId ?? m.id
      if (!seen.has(id)) { seen.add(id); out.push(m) }
    }
    return out
  }, [medicines, scannedMedicines])
  const [lines, setLines] = useState<Array<{ prescriptionName: string; medicineId: string; quantity: string; available: number }>>(() => {
    return queueItem.medicines.map((m) => {
      const nameLower = m.name.trim().toLowerCase()
      const matched = medicines.find((c) => c.name.toLowerCase() === nameLower || c.name.toLowerCase().includes(nameLower) || nameLower.includes(c.name.toLowerCase()))
      const medId = matched ? (matched.medicineId ?? matched.id) : ''
      const st = branchStock.find((s) => s.medicineId === medId || s.medicineName?.toLowerCase() === m.name.trim().toLowerCase())
      const available = st ? st.totalQuantity : 0
      return { prescriptionName: m.name, medicineId: medId, quantity: available > 0 ? '1' : '0', available }
    })
  })

  const updateLine = (index: number, field: 'medicineId' | 'quantity', value: string) => {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      if (field === 'medicineId') {
        const st = branchStock.find((s) => s.medicineId === value)
        next[index].available = st ? st.totalQuantity : 0
      }
      return next
    })
  }

  const addLine = () => {
    setLines((prev) => [...prev, { prescriptionName: '', medicineId: '', quantity: '', available: 0 }])
  }

  const removeLine = (index: number) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const [scanMode, setScanMode] = useState<'scanner' | 'camera'>('scanner')

  const addMedicineToDispense = useCallback((med: PharmacyMedicine) => {
    const id = med.medicineId ?? med.id
    setScannedMedicines((prev) => {
      if (prev.some((m) => (m.medicineId ?? m.id) === id)) return prev
      return [...prev, med]
    })
    const existingIdx = lines.findIndex((l) => l.medicineId === id)
    if (existingIdx >= 0) {
      const q = Math.max(0, Number(lines[existingIdx].quantity) || 0) + 1
      updateLine(existingIdx, 'quantity', String(q))
    } else {
      const emptyIdx = lines.findIndex((l) => !l.medicineId)
      const st = branchStock.find((s) => s.medicineId === id)
      const newLine = { prescriptionName: med.name ?? '', medicineId: id, quantity: '1', available: st ? st.totalQuantity : 0 }
      if (emptyIdx >= 0) {
        setLines((prev) => {
          const next = [...prev]
          next[emptyIdx] = newLine
          return next
        })
      } else {
        addLine()
        setLines((prev) => {
          const next = [...prev]
          next[next.length - 1] = newLine
          return next
        })
      }
    }
  }, [lines, branchStock, updateLine, addLine])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchId) {
      onError('Appointment has no branch. Cannot dispense.')
      return
    }
    const payload = lines
      .filter((l) => l.medicineId && Number(l.quantity) > 0)
      .map((l) => ({ medicineId: l.medicineId, quantity: Math.floor(Number(l.quantity) || 0) }))
    if (payload.length === 0) {
      onError('Select at least one medicine and enter quantity.')
      return
    }
    const orderLinesForTotal = lines
      .filter((l) => l.medicineId && Number(l.quantity) > 0)
      .map((l) => {
        const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === l.medicineId)
        const qty = Math.max(0, Number(l.quantity) || 0)
        const rate = med ? Number(med.sellingPrice) || 0 : 0
        return { amount: qty * rate }
      })
    const gross = orderLinesForTotal.reduce((sum, l) => sum + l.amount, 0)
    const disc = Math.max(0, Number(discountAmount) || 0)
    const taxable = Math.max(0, gross - disc)
    const taxPct = taxPercent / 100
    const netTotalBill = taxable + taxable * taxPct
    setPendingDispensePayload(payload)
    setPendingBillAmount(netTotalBill)
  }

  const doDispenseWithCash = async (
    amountReceived: number,
    changeGiven: number
  ) => {
    const payload = pendingDispensePayload
    if (!payload || !branchId) return
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          appointmentId: queueItem.appointmentId,
          branchId,
          lines: payload,
          paymentMode: 'cash',
          amountReceived,
          tenderNotes: {},
          changeNotes: {},
          changeGiven,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Dispense failed')
      const billLines = payload.map((p) => {
        const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === p.medicineId)
        const qty = p.quantity
        const rate = med ? Number(med.sellingPrice) || 0 : 0
        const amount = qty * rate
        const tax = amount * (taxPercent / 100)
        return { name: med?.name ?? '', qty, rate, amount, tax }
      })
      const billGross = billLines.reduce((s, l) => s + l.amount, 0)
      const billDiscount = Math.max(0, Number(discountAmount) || 0)
      const billTaxable = Math.max(0, billGross - billDiscount)
      const billTax = billTaxable * (taxPercent / 100)
      const billNet = billTaxable + billTax
      const dispensedAtIso = new Date().toISOString()
      generateBillPDFAndPrint({
        type: 'prescription',
        patientName: queueItem.patientName,
        customerPhone: undefined,
        doctorName: queueItem.doctorName,
        date: dispensedAtIso,
        branchName: queueItem.branchName ?? queueItem.branchId ?? '',
        lines: billLines,
        grossTotal: billGross,
        discountAmount: billDiscount > 0 ? billDiscount : undefined,
        taxTotal: billTax,
        taxPercent,
        netTotal: billNet,
        paymentMethod: 'cash',
      })
      setPendingDispensePayload(null)
      onSuccess()
      onClose()
    } catch (err: any) {
      onError(err?.message || 'Dispense failed')
    } finally {
      setSaving(false)
    }
  }

  const [taxPercent, setTaxPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const prescribedCount = queueItem.medicines.length
  const selectedCount = lines.filter((l) => l.medicineId && Number(l.quantity) > 0).length
  const orderLines = lines
    .map((l) => {
      const med = l.medicineId ? displayMedicines.find((m) => (m.medicineId ?? m.id) === l.medicineId) : null
      const qty = Math.max(0, Number(l.quantity) || 0)
      const rate = med ? Number(med.sellingPrice) || 0 : 0
      const amount = qty * rate
      const tax = amount * (taxPercent / 100)
      return { ...l, amount, tax }
    })
    .filter((l) => l.medicineId && Number(l.quantity) > 0)
  const grossTotal = orderLines.reduce((sum, l) => sum + l.amount, 0)
  const discount = Math.max(0, Number(discountAmount) || 0)
  const taxable = Math.max(0, grossTotal - discount)
  const taxTotal = taxable * (taxPercent / 100)
  const netTotal = taxable + taxTotal
  const modalSize = { width: '95vw', height: '92vh', minWidth: '900px', minHeight: '600px' }

  const content = (
    <>
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          {inline && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>←</span>
              <span>Back to queue</span>
            </button>
          )}
          <h3 className="font-semibold text-slate-800 text-lg">Dispense medicine – Order</h3>
        </div>
        {!inline && (
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-700 p-1 text-xl leading-none">✕</button>
        )}
      </div>
      <div className="p-5 overflow-y-auto flex-1 min-h-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Patient</div>
            <div className="font-medium text-slate-800">{queueItem.patientName}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Doctor · Date</div>
            <div className="text-slate-700">{queueItem.doctorName} · {queueItem.appointmentDate}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Branch</div>
            <div className="text-slate-700">{queueItem.branchName ?? queueItem.branchId ?? '—'}</div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scan toolbar + helpers – aligned with walk-in UI */}
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-700">Order details</span>
              <span className="text-xs text-slate-500">Search or scan barcode to add medicines for this prescription.</span>
            </div>
            {hospitalId && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Scan</span>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setScanMode('scanner')}
                      className={`px-2.5 py-1.5 text-xs font-medium ${
                        scanMode === 'scanner' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Scanner / keyboard
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanMode('camera')}
                      className={`px-2.5 py-1.5 text-xs font-medium ${
                        scanMode === 'camera' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Camera
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {hospitalId && (
            <>
              {scanMode === 'scanner' && (
                <div className="flex flex-col gap-1 mb-2">
                  <POSMedicineSearch
                    medicines={displayMedicines}
                    stock={branchStock}
                    branchId={branchId}
                    onSelect={addMedicineToDispense}
                    placeholder="Search by name, brand or scan barcode..."
                    getToken={getToken}
                    hospitalId={hospitalId}
                    onError={onError}
                    onOpenAddMedicine={onOpenAddMedicine}
                    autoFocus={false}
                  />
                  <span className="text-[11px] text-slate-500">
                    Tip: type name, brand or scan with USB scanner / phone (keyboard mode), then press Enter.
                  </span>
                </div>
              )}
              <BarcodeCameraScanner
                active={scanMode === 'camera'}
                onScan={async (barcodeValue) => {
                  try {
                    const token = await getToken()
                    if (!token) { onError('Not signed in'); return }
                    const res = await fetch(`/api/pharmacy/medicines?hospitalId=${encodeURIComponent(hospitalId)}&barcode=${encodeURIComponent(barcodeValue)}&branchId=${encodeURIComponent(branchId)}`, { headers: { Authorization: `Bearer ${token}` } })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok || !data.medicine) {
                      onError(data.error || data.message || 'Product not found')
                      return
                    }
                    addMedicineToDispense(data.medicine)
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Lookup failed')
                  }
                }}
                onError={onError}
                className={scanMode === 'camera' ? 'max-w-md mt-2' : 'hidden'}
              />
            </>
          )}

          {/* Removed "Add medicine" button; medicines are added via search/scan above */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-slate-50/80">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '2.5rem' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '6rem' }} />
                <col style={{ width: '6rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5rem' }} />
                <col style={{ width: '5.5rem' }} />
                <col style={{ width: '5rem' }} />
                <col style={{ width: '2.5rem' }} />
              </colgroup>
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-3">#</th>
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Batch</th>
                  <th className="text-left p-3">Expiry</th>
                  <th className="text-right p-3">MRP (₹)</th>
                  <th className="text-right p-3">Qty</th>
                  <th className="text-left p-3">Unit</th>
                  <th className="text-right p-3">Amount (₹)</th>
                  <th className="text-right p-3">Tax (₹)</th>
                  <th className="text-center p-3" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const prescribed = queueItem.medicines[idx]
                  const med = line.medicineId ? displayMedicines.find((m) => (m.medicineId ?? m.id) === line.medicineId) : null
                  const qty = Math.max(0, Number(line.quantity) || 0)
                  const rate = med ? Number(med.sellingPrice) || 0 : 0
                  const amount = qty * rate
                  const lineTax = amount * (taxPercent / 100)
                  const stockEntry = line.medicineId
                    ? branchStock.find(
                        (s) =>
                          s.medicineId === line.medicineId ||
                          (s.medicineName || '').toLowerCase() === (med?.name || '').toLowerCase()
                      )
                    : null
                  const expiryFromStock =
                    stockEntry && Array.isArray(stockEntry.batches)
                      ? (stockEntry.batches as MedicineBatch[])
                          .filter((b) => (b.quantity ?? 0) > 0 && (b.expiryDate || '').length > 0)
                          .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))[0]?.expiryDate || null
                      : null
                  const expiryStr = expiryFromStock ? (expiryFromStock as string).slice(0, 10) : '-'
                  const isOut = line.available <= 0
                  return (
                    <tr key={idx} className={`border-t border-slate-200 ${isOut ? 'bg-slate-100/60 opacity-80' : ''}`}>
                      <td className="p-3 text-slate-500 align-top">{idx + 1}</td>
                      <td className="p-3 align-top overflow-hidden">
                        <div className="min-w-0 max-w-full space-y-0.5">
                          <MedicineSearchSelect
                            value={line.medicineId}
                            medicines={displayMedicines}
                            onChange={(id) => updateLine(idx, 'medicineId', id)}
                            placeholder="Search..."
                            showGeneric={true}
                            className="min-w-0 max-w-full"
                          />
                          {med?.genericName && (
                            <div className="text-[11px] text-slate-500 truncate">
                              Generic: {med.genericName}
                            </div>
                          )}
                          {prescribed && (
                            <div className="text-[11px] text-slate-500 truncate">
                              Prescribed: {line.prescriptionName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 align-top text-xs text-slate-600">
                        <div>From stock</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {isOut ? (
                            <span className="inline-flex items-center rounded-full bg-slate-900 text-[10px] font-semibold text-white px-2 py-0.5 opacity-80">
                              Not available
                            </span>
                          ) : (
                            <>Stock: {line.available}</>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-500 align-top">{expiryStr}</td>
                      <td className="p-3 text-right align-top tabular-nums">{rate > 0 ? rate.toFixed(2) : '-'}</td>
                      <td className="p-3 align-top">
                        <div className="flex flex-col items-end gap-0.5">
                          <input
                            type="number"
                            min={0}
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                            className="w-14 rounded border border-slate-300 px-1.5 py-1.5 text-sm text-right disabled:bg-slate-100 disabled:text-slate-400"
                            disabled={isOut}
                          />
                        </div>
                      </td>
                      <td className="p-3 align-top">{med?.unit || 'tablets'}</td>
                      <td className="p-3 text-right font-medium align-top tabular-nums">{amount > 0 ? amount.toFixed(2) : '-'}</td>
                      <td className="p-3 text-right text-slate-600 align-top tabular-nums">{lineTax > 0 ? lineTax.toFixed(2) : '-'}</td>
                      <td className="p-3 text-center align-top">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Remove line"
                            aria-label="Remove line"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-4 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-slate-600">Tax %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={taxPercent}
                onChange={(e) => setTaxPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm text-right"
              />
              <label className="text-sm text-slate-600 ml-2">Discount (₹)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-right"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-slate-600">Items: <strong>{selectedCount}</strong></span>
              <span className="text-slate-600">Gross: <strong>₹{grossTotal.toFixed(2)}</strong></span>
              {discount > 0 && <span className="text-slate-600">Discount: <strong>₹{discount.toFixed(2)}</strong></span>}
              <span className="text-slate-600">Tax: <strong>₹{taxTotal.toFixed(2)}</strong></span>
              <span className="text-slate-800 font-semibold">Total: ₹{netTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-modern btn-modern-sm">Cancel</button>
              <button type="submit" disabled={saving} className="btn-modern btn-modern-primary btn-modern-sm">
                {saving ? 'Processing…' : 'Complete sale & print bill'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )

  if (inline) {
    return (
      <div className="flex flex-col min-h-0">
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden flex flex-col min-h-[480px]">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2" onClick={onClose} style={{ padding: '0.5rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={modalSize}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}
