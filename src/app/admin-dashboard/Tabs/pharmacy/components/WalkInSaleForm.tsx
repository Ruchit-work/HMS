'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BarcodeCameraScanner } from '@/components/pharmacy/BarcodeCameraScanner'
import { CashPaymentPanel } from '@/components/pharmacy/CashTenderModal'
import type { BranchMedicineStock, PharmacyMedicine } from '@/types/pharmacy'
import { generateBillPDFAndPrint } from '@/utils/pharmacy/billPrint'
import { BarcodeScanInput, MedicineSearchSelect } from './SearchInputs'

export function WalkInSaleForm({
  branches,
  medicines,
  stock,
  selectedBranchId,
  selectedBranchName,
  hospitalId,
  onSuccess,
  onError,
  getToken,
  onOpenAddMedicine,
}: {
  branches: Array<{ id: string; name: string }>
  medicines: PharmacyMedicine[]
  stock: BranchMedicineStock[]
  selectedBranchId?: string
  selectedBranchName?: string
  hospitalId: string
  onSuccess: () => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
  onOpenAddMedicine?: (barcode: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [branchId, setBranchId] = useState(selectedBranchId ?? '')
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi' | 'credit' | 'other'>('cash')
  useEffect(() => {
    if (selectedBranchId) setBranchId(selectedBranchId)
  }, [selectedBranchId])
  const effectiveBranchId = selectedBranchId ?? branchId
  const [taxPercent, setTaxPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [lines, setLines] = useState<Array<{ medicineId: string; quantity: string }>>([{ medicineId: '', quantity: '' }])
  const [scanMode, setScanMode] = useState<'scanner' | 'camera'>('scanner')
  const [scannedMedicines, setScannedMedicines] = useState<PharmacyMedicine[]>([])
  const [pendingDispensePayload, setPendingDispensePayload] = useState<{
    branchId: string
    customerName: string
    customerPhone: string
    lines: Array<{ medicineId: string; quantity: number }>
  } | null>(null)
  const [pendingBillAmount, setPendingBillAmount] = useState(0)
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

  const addLine = () => setLines((prev) => [...prev, { medicineId: '', quantity: '' }])
  const updateLine = (index: number, field: 'medicineId' | 'quantity', value: string) => {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }
  const removeLine = (index: number) => {
    if (lines.length <= 1) return
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const getAvailable = (medId: string) => {
    if (!medId || !effectiveBranchId) return 0
    const st = stock.find((s) => s.branchId === effectiveBranchId && (s.medicineId === medId || s.medicineName === displayMedicines.find((m) => (m.medicineId ?? m.id) === medId)?.name))
    return st ? st.totalQuantity : 0
  }

  const addMedicineToWalkInOrder = useCallback((med: PharmacyMedicine) => {
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
      if (emptyIdx >= 0) {
        updateLine(emptyIdx, 'medicineId', id)
        updateLine(emptyIdx, 'quantity', '1')
      } else {
        addLine()
        setLines((prev) => {
          const next = [...prev]
          next[next.length - 1] = { medicineId: id, quantity: '1' }
          return next
        })
      }
    }
  }, [lines, updateLine, addLine])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) { onError('Customer name required'); return }
    if (!customerPhone.trim()) { onError('Customer phone number required'); return }
    if (!effectiveBranchId) { onError('Select branch'); return }
    const payload = lines
      .filter((l) => l.medicineId && Number(l.quantity) > 0)
      .map((l) => ({ medicineId: l.medicineId, quantity: Math.floor(Number(l.quantity) || 0) }))
    if (payload.length === 0) { onError('Add at least one medicine with quantity'); return }
    const grossFromPayload = payload.reduce((sum, p) => {
      const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === p.medicineId)
      return sum + p.quantity * (med ? Number(med.sellingPrice) || 0 : 0)
    }, 0)
    const disc = Math.max(0, Number(discountAmount) || 0)
    const taxable = Math.max(0, grossFromPayload - disc)
    const billTax = taxable * (taxPercent / 100)
    const net = taxable + billTax
    if (paymentMode === 'cash') {
      setPendingDispensePayload({
        branchId: effectiveBranchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        lines: payload,
      })
      setPendingBillAmount(net)
      return
    }
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          branchId: effectiveBranchId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          paymentMode,
          lines: payload,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Sale failed')
      const branchName = selectedBranchName ?? branches.find((b) => b.id === effectiveBranchId)?.name ?? ''
      const billedAtIso = new Date().toISOString()
      const billLines = payload.map((p) => {
        const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === p.medicineId)
        const qty = p.quantity
        const rate = med ? Number(med.sellingPrice) || 0 : 0
        const amount = qty * rate
        const tax = amount * (taxPercent / 100)
        return { name: med?.name ?? '', qty, rate, amount, tax }
      })
      const gross = billLines.reduce((s, l) => s + l.amount, 0)
      const disc = Math.max(0, Number(discountAmount) || 0)
      const taxable = Math.max(0, gross - disc)
      const billTax = taxable * (taxPercent / 100)
      const net = taxable + billTax
      generateBillPDFAndPrint({
        type: 'walk_in',
        patientName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        date: billedAtIso,
        branchName,
        lines: billLines,
        grossTotal: gross,
        discountAmount: disc > 0 ? disc : undefined,
        taxTotal: billTax,
        taxPercent,
        netTotal: net,
        paymentMethod: paymentMode,
      })
      onSuccess()
      setCustomerName(''); setCustomerPhone(''); setTaxPercent(0); setDiscountAmount(0); setLines([{ medicineId: '', quantity: '' }])
    } catch (err: any) {
      onError(err?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const doDispenseWithCash = async (
    amountReceived: number,
    changeGiven: number
  ) => {
    const pending = pendingDispensePayload
    if (!pending) return
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          branchId: pending.branchId,
          customerName: pending.customerName,
          customerPhone: pending.customerPhone,
          paymentMode: 'cash',
          lines: pending.lines,
          amountReceived,
          tenderNotes: {},
          changeNotes: {},
          changeGiven,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Sale failed')
      const branchName = selectedBranchName ?? branches.find((b) => b.id === pending.branchId)?.name ?? ''
      const billedAtIso = new Date().toISOString()
      const billLines = pending.lines.map((p) => {
        const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === p.medicineId)
        const qty = p.quantity
        const rate = med ? Number(med.sellingPrice) || 0 : 0
        const amount = qty * rate
        const tax = amount * (taxPercent / 100)
        return { name: med?.name ?? '', qty, rate, amount, tax }
      })
      const gross = billLines.reduce((s, l) => s + l.amount, 0)
      const disc = Math.max(0, Number(discountAmount) || 0)
      const taxable = Math.max(0, gross - disc)
      const billTax = taxable * (taxPercent / 100)
      const net = taxable + billTax
      generateBillPDFAndPrint({
        type: 'walk_in',
        patientName: pending.customerName,
        customerPhone: pending.customerPhone,
        date: billedAtIso,
        branchName,
        lines: billLines,
        grossTotal: gross,
        discountAmount: disc > 0 ? disc : undefined,
        taxTotal: billTax,
        taxPercent,
        netTotal: net,
        paymentMethod: 'cash',
      })
      setPendingDispensePayload(null)
      onSuccess()
      setCustomerName(''); setCustomerPhone(''); setTaxPercent(0); setDiscountAmount(0); setLines([{ medicineId: '', quantity: '' }])
    } catch (err: any) {
      onError(err?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const orderLines = lines.filter((l) => l.medicineId && Number(l.quantity) > 0)
  const grossTotal = orderLines.reduce((sum, l) => {
    const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === l.medicineId)
    const rate = med ? Number(med.sellingPrice) || 0 : 0
    return sum + (Number(l.quantity) || 0) * rate
  }, 0)
  const discount = Math.max(0, Number(discountAmount) || 0)
  const taxable = Math.max(0, grossTotal - discount)
  const taxTotal = taxable * (taxPercent / 100)
  const netTotal = taxable + taxTotal
  const today = new Date().toISOString().slice(0, 10)
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide">Customer name</label>
          <input type="text" placeholder="Customer name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mt-0.5" required />
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide">Phone No.</label>
          <input type="text" placeholder="Phone number *" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mt-0.5" required />
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide">Branch</label>
          {selectedBranchId && selectedBranchName ? (
            <p className="text-slate-700 text-sm mt-0.5 font-medium">{selectedBranchName}</p>
          ) : (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mt-0.5" required>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide">Payment</label>
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as 'cash' | 'card' | 'upi' | 'credit' | 'other')} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm mt-0.5">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="credit">Credit</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide">Date</label>
          <div className="text-sm text-slate-700 mt-1">{today}</div>
        </div>
      </div>
      <div>
        {/* Scan toolbar + helpers */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-700">Order details</span>
            <span className="text-xs text-slate-500">Search or scan medicines to add them to this bill</span>
          </div>
          {hospitalId && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Scan</span>
                <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setScanMode('scanner')}
                    className={`px-2.5 py-1.5 text-xs font-medium ${scanMode === 'scanner' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Scanner / keyboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode('camera')}
                    className={`px-2.5 py-1.5 text-xs font-medium ${scanMode === 'camera' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Camera
                  </button>
                </div>
              </div>
              {scanMode === 'scanner' && (
                <div className="flex flex-col gap-1">
                  <BarcodeScanInput
                    hospitalId={hospitalId}
                    getToken={getToken}
                    onMedicineFound={addMedicineToWalkInOrder}
                    onError={onError}
                    onOpenAddMedicine={onOpenAddMedicine}
                    placeholder="Scan barcode or type and press Enter"
                    autoFocus={true}
                  />
                  <span className="text-[11px] text-slate-500">
                    Tip: focus here, then scan with USB scanner or phone (keyboard mode).
                  </span>
                </div>
              )}
              <BarcodeCameraScanner
                active={scanMode === 'camera'}
                onScan={async (barcodeValue) => {
                  try {
                    const token = await getToken()
                    if (!token) { onError('Not signed in'); return }
                    const res = await fetch(
                      `/api/pharmacy/medicines?hospitalId=${encodeURIComponent(hospitalId)}&barcode=${encodeURIComponent(barcodeValue)}&branchId=${encodeURIComponent(effectiveBranchId)}`,
                      { headers: { Authorization: `Bearer ${token}` } }
                    )
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok || !data.medicine) {
                      onError(data.error || data.message || 'Product not found')
                      return
                    }
                    addMedicineToWalkInOrder(data.medicine)
                  } catch (e) {
                    onError(e instanceof Error ? e.message : 'Lookup failed')
                  }
                }}
                onError={onError}
                className={scanMode === 'camera' ? 'max-w-md' : 'hidden'}
              />
            </div>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: '2rem' }} />
              <col style={{ width: '200px' }} />
              <col style={{ width: '5rem' }} />
              <col style={{ width: '5rem' }} />
              <col style={{ width: '4.5rem' }} />
              <col style={{ width: '4.5rem' }} />
              <col style={{ width: '5rem' }} />
              <col style={{ width: '4.5rem' }} />
              <col style={{ width: '2rem' }} />
            </colgroup>
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Product</th>
                <th className="text-left p-2">Batch</th>
                <th className="text-right p-2">MRP (₹)</th>
                <th className="text-right p-2">Qty</th>
                <th className="text-left p-2">Unit</th>
                <th className="text-right p-2">Amount (₹)</th>
                <th className="text-right p-2">Tax (₹)</th>
                <th className="p-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const med = line.medicineId ? displayMedicines.find((m) => (m.medicineId ?? m.id) === line.medicineId) : null
                const qty = Math.max(0, Number(line.quantity) || 0)
                const rate = med ? Number(med.sellingPrice) || 0 : 0
                const amount = qty * rate
                const lineTax = amount * (taxPercent / 100)
                const isOut = line.medicineId && getAvailable(line.medicineId) <= 0
                return (
                  <tr
                    key={idx}
                    className={`border-t border-slate-200 ${isOut ? 'bg-slate-100/60 opacity-80' : ''}`}
                  >
                    <td className="p-2 text-slate-500 align-top">{idx + 1}</td>
                    <td className="p-2 align-top overflow-hidden">
                      <div className="min-w-0 max-w-full">
                        <MedicineSearchSelect
                          value={line.medicineId}
                          medicines={displayMedicines}
                          onChange={(id) => updateLine(idx, 'medicineId', id)}
                          placeholder="Search..."
                          showGeneric={true}
                          className="min-w-0 max-w-full"
                        />
                      </div>
                    </td>
                    <td className="p-2 text-slate-500 align-top">From stock</td>
                    <td className="p-2 text-right align-top tabular-nums">{rate > 0 ? rate.toFixed(2) : '—'}</td>
                    <td className="p-2 align-top">
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="number"
                          min={0}
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          className="w-14 rounded border border-slate-300 px-1.5 py-1 text-sm text-right disabled:bg-slate-100 disabled:text-slate-400"
                          disabled={!!isOut}
                        />
                        <div className="text-xs text-slate-500">
                          {line.medicineId ? (
                            !isOut ? (
                              <>Stock: {getAvailable(line.medicineId)}</>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-900 text-[10px] font-semibold text-white px-2 py-0.5 opacity-80">
                                Not available
                              </span>
                            )
                          ) : (
                            'Stock: 0'
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 align-top">{med?.unit || 'tablets'}</td>
                    <td className="p-2 text-right font-medium align-top tabular-nums">{amount > 0 ? amount.toFixed(2) : '—'}</td>
                    <td className="p-2 text-right text-slate-600 align-top tabular-nums">{lineTax > 0 ? lineTax.toFixed(2) : '—'}</td>
                    <td className="p-2 align-top">{lines.length > 1 ? <button type="button" onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600">✕</button> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-3 mt-3 border-t border-slate-200 pt-3">
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
            <span className="text-slate-600">Items: <strong>{orderLines.length}</strong></span>
            <span className="text-slate-600">Gross: <strong>₹{grossTotal.toFixed(2)}</strong></span>
            {discount > 0 && <span className="text-slate-600">Discount: <strong>₹{discount.toFixed(2)}</strong></span>}
            <span className="text-slate-600">Tax: <strong>₹{taxTotal.toFixed(2)}</strong></span>
            <span className="font-semibold">Total: ₹{netTotal.toFixed(2)}</span>
          </div>
          <button type="submit" disabled={saving} className="btn-modern btn-modern-primary btn-modern-sm">{saving ? 'Processing…' : 'Complete sale & print bill'}</button>
        </div>
      </div>
      {pendingDispensePayload && pendingBillAmount > 0 && paymentMode === 'cash' && (
        <div className="mt-3">
          <CashPaymentPanel
            billAmount={pendingBillAmount}
            onConfirm={doDispenseWithCash}
            confirmLabel="Confirm & complete sale"
            onCancel={() => setPendingDispensePayload(null)}
          />
        </div>
      )}
    </form>
  )
}
