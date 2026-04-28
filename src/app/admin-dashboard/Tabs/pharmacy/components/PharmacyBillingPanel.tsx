'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarcodeCameraScanner } from '@/components/pharmacy/BarcodeCameraScanner'
import { CashPaymentPanel } from '@/components/pharmacy/CashTenderModal'
import type { BranchMedicineStock, PharmacyMedicine } from '@/types/pharmacy'
import { generateBillPDFAndPrint } from '@/utils/pharmacy/billPrint'
import { BillingRiskStrip } from './RealWorldUiBlocks'
import { POSMedicineSearch } from './SearchInputs'
import type { QueueItem } from '../types'

/** POS-style billing panel: customer info, medicine search, order table with batch, totals, payment. Used in Prescription Queue & Billing page. */
export function PharmacyBillingPanel({
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
  posSearchRef,
  queueItems,
  hasActiveSession = true,
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
  posSearchRef?: React.RefObject<HTMLInputElement | null>
  /** Optional: pending prescriptions to power unified patient/prescription search */
  queueItems?: QueueItem[]
  /** If false, user must start a cash session before completing sales */
  hasActiveSession?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [phoneHighlight, setPhoneHighlight] = useState(false)
  const [noPhoneHospitalPatient, setNoPhoneHospitalPatient] = useState(false)
  const [branchId, setBranchId] = useState(selectedBranchId ?? '')
  const paymentOptions = [{ id: 'cash' as const, label: 'Cash' }, { id: 'upi' as const, label: 'UPI' }, { id: 'card' as const, label: 'Card' }, { id: 'other' as const, label: 'Insurance' }]
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi' | 'credit' | 'other'>('cash')
  useEffect(() => { if (selectedBranchId) setBranchId(selectedBranchId) }, [selectedBranchId])
  const effectiveBranchId = selectedBranchId ?? branchId
  const [taxPercent, setTaxPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [lines, setLines] = useState<Array<{ medicineId: string; quantity: string; batchId?: string }>>([])
  const [scannedMedicines, setScannedMedicines] = useState<PharmacyMedicine[]>([])
  const [scanMode, setScanMode] = useState<'scanner' | 'camera'>('scanner')
  const [pendingDispensePayload, setPendingDispensePayload] = useState<{
    branchId: string
    customerName: string
    customerPhone: string
    lines: Array<{ medicineId: string; quantity: number; batchId?: string }>
  } | null>(null)
  const [pendingBillAmount, setPendingBillAmount] = useState(0)
  const [searchPatientQuery, setSearchPatientQuery] = useState('')
  const [searchPatientOpen, setSearchPatientOpen] = useState(false)
  const [hasHeldBill, setHasHeldBill] = useState(false)
  const [billingInfo, setBillingInfo] = useState<string | null>(null)
  const patientSearchRef = useRef<HTMLDivElement | null>(null)
  const refocusSearchInput = useCallback(() => {
    const t = setTimeout(() => posSearchRef?.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [posSearchRef])
  const displayMedicines = useMemo(() => {
    const seen = new Set<string>()
    const out: PharmacyMedicine[] = []
    for (const m of medicines) { const id = m.medicineId ?? m.id; if (!seen.has(id)) { seen.add(id); out.push(m) } }
    for (const m of scannedMedicines) { const id = m.medicineId ?? m.id; if (!seen.has(id)) { seen.add(id); out.push(m) } }
    return out
  }, [medicines, scannedMedicines])

  const matchingQueueItems = useMemo(() => {
    if (!queueItems || !searchPatientQuery.trim()) return []
    const q = searchPatientQuery.trim().toLowerCase()
    return queueItems
      .filter((item) => {
        const inPatient = item.patientName.toLowerCase().includes(q)
        const inDoctor = item.doctorName.toLowerCase().includes(q)
        const inAppt = item.appointmentId.toLowerCase().includes(q)
        return inPatient || inDoctor || inAppt
      })
      .slice(0, 8)
  }, [queueItems, searchPatientQuery])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setSearchPatientOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getBatches = useCallback((medId: string) => {
    if (!effectiveBranchId) return []
    const st = stock.find((s) => s.branchId === effectiveBranchId && (s.medicineId === medId || s.medicineName === displayMedicines.find((m) => (m.medicineId ?? m.id) === medId)?.name))
    const batches = (st?.batches ?? []).filter((b) => (b.quantity ?? 0) > 0).sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))
    return batches
  }, [stock, effectiveBranchId, displayMedicines])

  const getAvailable = useCallback((medId: string) => {
    if (!medId || !effectiveBranchId) return 0
    const st = stock.find((s) => s.branchId === effectiveBranchId && (s.medicineId === medId || s.medicineName === displayMedicines.find((m) => (m.medicineId ?? m.id) === medId)?.name))
    return st ? st.totalQuantity : 0
  }, [stock, effectiveBranchId, displayMedicines])

  const holdBillStorageKey = useMemo(
    () => `pharmacy_hold_bill_${hospitalId}_${effectiveBranchId || 'unknown'}`,
    [hospitalId, effectiveBranchId]
  )

  const refreshHeldBillStatus = useCallback(() => {
    if (typeof window === 'undefined') return
    setHasHeldBill(Boolean(window.sessionStorage.getItem(holdBillStorageKey)))
  }, [holdBillStorageKey])

  const holdCurrentBill = useCallback(() => {
    if (typeof window === 'undefined') return
    const payload = {
      customerName,
      customerPhone,
      customerAddress,
      doctorName,
      paymentMode,
      taxPercent,
      discountAmount,
      lines,
      savedAt: new Date().toISOString(),
    }
    window.sessionStorage.setItem(holdBillStorageKey, JSON.stringify(payload))
    setBillingInfo('Bill placed on hold. Resume when ready.')
    refreshHeldBillStatus()
  }, [
    customerName,
    customerPhone,
    customerAddress,
    doctorName,
    paymentMode,
    taxPercent,
    discountAmount,
    lines,
    holdBillStorageKey,
    onError,
    refreshHeldBillStatus,
  ])

  const resumeHeldBill = useCallback(() => {
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem(holdBillStorageKey)
    if (!raw) {
      onError('No held bill found for this branch.')
      refreshHeldBillStatus()
      return
    }
    try {
      const parsed = JSON.parse(raw) as {
        customerName?: string
        customerPhone?: string
        customerAddress?: string
        doctorName?: string
        paymentMode?: 'cash' | 'card' | 'upi' | 'credit' | 'other'
        taxPercent?: number
        discountAmount?: number
        lines?: Array<{ medicineId: string; quantity: string; batchId?: string }>
      }
      setCustomerName(parsed.customerName || '')
      setCustomerPhone(parsed.customerPhone || '')
      setCustomerAddress(parsed.customerAddress || '')
      setDoctorName(parsed.doctorName || '')
      setPaymentMode(parsed.paymentMode || 'cash')
      setTaxPercent(Number(parsed.taxPercent) || 0)
      setDiscountAmount(Number(parsed.discountAmount) || 0)
      setLines(Array.isArray(parsed.lines) ? parsed.lines : [])
      window.sessionStorage.removeItem(holdBillStorageKey)
      setBillingInfo('Held bill resumed.')
    } catch {
      onError('Held bill data is invalid. Could not resume.')
    } finally {
      refreshHeldBillStatus()
      refocusSearchInput()
    }
  }, [holdBillStorageKey, onError, refreshHeldBillStatus, refocusSearchInput])

  useEffect(() => {
    refreshHeldBillStatus()
  }, [refreshHeldBillStatus])

  const loadFromQueueItem = useCallback(
    (item: QueueItem) => {
      setCustomerName(item.patientName)
      setDoctorName(item.doctorName)
      // phone is not available on QueueItem; user can still type it
      setLines(() => {
        return item.medicines.map((m) => {
          const nameLower = m.name.trim().toLowerCase()
          const matched = medicines.find((c) => {
            const base = c.name.toLowerCase()
            return base === nameLower || base.includes(nameLower) || nameLower.includes(base)
          })
          const medId = matched ? (matched.medicineId ?? matched.id) : ''
          if (!medId) return { medicineId: '', quantity: '0' }
          const batches = getBatches(medId)
          const firstBatchId = batches[0]?.id
          const available = getAvailable(medId)
          const quantity = available > 0 ? '1' : '0'
          return { medicineId: medId, quantity: String(quantity), batchId: firstBatchId }
        })
      })
    },
    [getBatches, getAvailable, medicines]
  )

  const addMedicineToOrder = useCallback((med: PharmacyMedicine) => {
    const id = med.medicineId ?? med.id
    setScannedMedicines((prev) => (prev.some((m) => (m.medicineId ?? m.id) === id) ? prev : [...prev, med]))
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.medicineId === id)
      if (idx >= 0) {
        const next = [...prev]
        const prevQ = Math.max(0, Number(next[idx].quantity) || 0)
        next[idx] = { ...next[idx], quantity: String(prevQ + 1) }
        return next
      }
      const batches = getBatches(id)
      const firstBatchId = batches[0]?.id
      return [...prev, { medicineId: id, quantity: '1', batchId: firstBatchId }]
    })
    refocusSearchInput()
  }, [getBatches, refocusSearchInput])

  const updateLine = (index: number, field: 'medicineId' | 'quantity' | 'batchId', value: string) => {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      if (field === 'medicineId') {
        const batches = getBatches(value)
        next[index].batchId = batches[0]?.id
      }
      return next
    })
  }
  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index))
    refocusSearchInput()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasActiveSession) {
      onError('Please start a cash session first (Cash & expenses → Start shift).')
      return
    }
    if (!customerName.trim()) { onError('Customer name required'); return }
    if (!customerPhone.trim() && !noPhoneHospitalPatient) {
      onError('Enter phone number or mark as hospital patient without phone.')
      setPhoneHighlight(true)
      setTimeout(() => setPhoneHighlight(false), 2500)
      return
    }
    if (customerPhone.trim() && !noPhoneHospitalPatient) {
      const digits = customerPhone.replace(/\D/g, '')
      let normalized = digits
      if (digits.length === 11 && digits.startsWith('0')) normalized = digits.slice(1)
      else if (digits.length === 12 && digits.startsWith('91')) normalized = digits.slice(2)
      if (normalized.length !== 10) {
        onError('Enter a valid 10-digit Indian mobile number (e.g. 9876543210).')
        setPhoneHighlight(true)
        setTimeout(() => setPhoneHighlight(false), 2500)
        return
      }
      const firstDigit = normalized.charAt(0)
      if (!['6', '7', '8', '9'].includes(firstDigit)) {
        onError('Indian mobile number must start with 6, 7, 8 or 9.')
        setPhoneHighlight(true)
        setTimeout(() => setPhoneHighlight(false), 2500)
        return
      }
    }
    if (!effectiveBranchId) { onError('Select branch'); return }
    const validLines = lines.filter((l) => l.medicineId && Number(l.quantity) > 0)
    const duplicateCheck = new Set<string>()
    for (const line of validLines) {
      if (duplicateCheck.has(line.medicineId)) {
        const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === line.medicineId)
        onError(`Duplicate medicine line found for ${med?.name ?? 'medicine'}. Merge quantities before billing.`)
        return
      }
      duplicateCheck.add(line.medicineId)
    }
    for (const l of validLines) {
      const available = getAvailable(l.medicineId)
      const qty = Math.floor(Number(l.quantity) || 0)
      if (available <= 0) {
        const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === l.medicineId)
        onError(`${med?.name ?? 'Medicine'} is out of stock. Cannot sell.`)
        return
      }
      if (qty > available) {
        const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === l.medicineId)
        onError(`Insufficient stock for ${med?.name ?? 'medicine'}. Available: ${available}, ordered: ${qty}. Reduce quantity or remove item.`)
        return
      }
    }
    const payload = validLines.map((l) => ({ medicineId: l.medicineId!, quantity: Math.floor(Number(l.quantity) || 0), ...(l.batchId ? { batchId: l.batchId } : {}) }))
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
      setCustomerName('')
      setCustomerPhone('')
      setTaxPercent(0)
      setDiscountAmount(0)
      setLines([])
      setBillingInfo(null)
      refocusSearchInput()
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
      setCustomerName('')
      setCustomerPhone('')
      setTaxPercent(0)
      setDiscountAmount(0)
      setLines([])
      setBillingInfo(null)
      refocusSearchInput()
    } catch (err: any) {
      onError(err?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const orderLines = lines.filter((l) => l.medicineId && Number(l.quantity) > 0)
  const duplicateMedicineIds = useMemo(() => {
    const seen = new Set<string>()
    const dup = new Set<string>()
    for (const line of orderLines) {
      if (seen.has(line.medicineId)) dup.add(line.medicineId)
      seen.add(line.medicineId)
    }
    return dup
  }, [orderLines])
  const nearExpiryLineCount = useMemo(() => {
    const now = Date.now()
    return orderLines.filter((line) => {
      const batch = line.batchId ? getBatches(line.medicineId).find((b) => b.id === line.batchId) : getBatches(line.medicineId)[0]
      if (!batch?.expiryDate) return false
      const days = Math.ceil((new Date(batch.expiryDate).getTime() - now) / (24 * 60 * 60 * 1000))
      return days >= 0 && days <= 30
    }).length
  }, [getBatches, orderLines])
  const stockRiskLineCount = useMemo(() => {
    return orderLines.filter((line) => {
      const avail = getAvailable(line.medicineId)
      const qty = Math.floor(Number(line.quantity) || 0)
      return avail <= 0 || qty > avail
    }).length
  }, [getAvailable, orderLines])
  const canCompleteSale = orderLines.length > 0 && orderLines.every((l) => {
    const avail = getAvailable(l.medicineId)
    const q = Math.floor(Number(l.quantity) || 0)
    return avail > 0 && q <= avail
  }) && duplicateMedicineIds.size === 0
  const grossTotal = orderLines.reduce((sum, l) => {
    const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === l.medicineId)
    return sum + (Number(l.quantity) || 0) * (med ? Number(med.sellingPrice) || 0 : 0)
  }, 0)
  const discount = Math.max(0, Number(discountAmount) || 0)
  const taxable = Math.max(0, grossTotal - discount)
  const taxTotal = taxable * (taxPercent / 100)
  const netTotal = taxable + taxTotal
  const today = new Date().toISOString().slice(0, 10)
  const showCashPanel = paymentMode === 'cash' && !!pendingDispensePayload && pendingBillAmount > 0

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      {/* Universal patient / prescription search */}
      <div className="shrink-0 p-4 border-b border-[#E5E7EB] bg-white" ref={patientSearchRef}>
        <label className="block text-xs font-medium text-slate-500 mb-1">Search patient / prescription</label>
        <div className="relative">
          <input
            type="text"
            value={searchPatientQuery}
            onChange={(e) => {
              setSearchPatientQuery(e.target.value)
              setSearchPatientOpen(true)
            }}
            onFocus={() => setSearchPatientOpen(true)}
            placeholder="Type patient name, doctor or prescription ID..."
            className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 pl-10 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          {searchPatientOpen && matchingQueueItems.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-64 overflow-auto text-sm">
              {matchingQueueItems.map((item) => (
                <button
                  key={item.appointmentId}
                  type="button"
                  onClick={() => {
                    setSearchPatientQuery(`${item.patientName} · ${item.appointmentDate}`)
                    setSearchPatientOpen(false)
                    loadFromQueueItem(item)
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex flex-col gap-0.5"
                >
                  <span className="font-medium text-slate-800 truncate">{item.patientName}</span>
                  <span className="text-xs text-slate-500 truncate">
                    {item.doctorName} · {item.appointmentDate} · {item.branchName ?? item.branchId ?? '—'}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">Prescription ID: {item.appointmentId}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer information - vertical layout; Branch & Date beside heading */}
      <div className="shrink-0 p-4 border-b border-[#E5E7EB] bg-[#F8FAFC]">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Customer</h3>
          <span className="text-slate-400">·</span>
          <span className="text-sm text-slate-600">
            {selectedBranchId && selectedBranchName ? selectedBranchName : branchId ? branches.find((b) => b.id === branchId)?.name ?? 'Branch' : 'Select branch'}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-sm text-slate-600">{today}</span>
          {!selectedBranchId && (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="ml-1 rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-[#2563EB]/20" required>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Customer Name</label>
              <input type="text" placeholder="Name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" required />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-xs text-slate-500">Phone Number (India)</label>
                <label htmlFor="noPhoneHospitalPatient" className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
              <span> Patient from hospital – without phone</span>
                <input
                  id="noPhoneHospitalPatient"
                  type="checkbox"
                  checked={noPhoneHospitalPatient}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setNoPhoneHospitalPatient(checked)
                    if (checked) setCustomerPhone('')
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]/30"
                />
               
              </label>
            </div>
            <input
              type="text"
              inputMode="tel"
              placeholder="10-digit Indian mobile (e.g. 9876543210)"
              maxLength={14}
              value={customerPhone}
              onChange={(e) => {
                const raw = e.target.value
                const cleaned = raw.replace(/[^0-9+\s]/g, '').slice(0, 14)
                setCustomerPhone(cleaned)
              }}
              disabled={noPhoneHospitalPatient}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:border-[#2563EB] focus:ring-[#2563EB]/20 ${
                phoneHighlight && !customerPhone.trim() && !noPhoneHospitalPatient
                  ? 'border-red-400 bg-rose-50'
                  : 'border-[#E5E7EB] bg-white'
              } ${noPhoneHospitalPatient ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Doctor Name (optional)</label>
              <input
                type="text"
                placeholder="Doctor"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Address</label>
              <input type="text" placeholder="Address (optional)" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment Mode</label>
            <div className="flex flex-wrap gap-1.5">
              {paymentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentMode(opt.id === 'other' ? 'other' : opt.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${paymentMode === (opt.id === 'other' ? 'other' : opt.id) ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-slate-600 border-[#E5E7EB] hover:bg-slate-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Medicine search + scan */}
      <div className="shrink-0 p-4 border-b border-[#E5E7EB]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="flex flex-col gap-0.5">
            <label className="block text-sm font-medium text-slate-700">Add medicine</label>
            <span className="text-xs text-slate-500">Search or scan barcode to add medicines to this bill.</span>
          </div>
          {effectiveBranchId && hospitalId && (
            <div className="flex flex-wrap items-center gap-2">
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
          )}
        </div>

        {effectiveBranchId && hospitalId ? (
          <>
            {scanMode === 'scanner' && (
              <POSMedicineSearch
                medicines={displayMedicines}
                stock={stock}
                branchId={effectiveBranchId}
                onSelect={addMedicineToOrder}
                placeholder="Search by name, brand or scan barcode..."
                getToken={getToken}
                hospitalId={hospitalId}
                onError={onError}
                onOpenAddMedicine={onOpenAddMedicine}
                autoFocus={false}
                inputRef={posSearchRef}
              />
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
                  addMedicineToOrder(data.medicine)
                } catch (e) {
                  onError(e instanceof Error ? e.message : 'Lookup failed')
                }
              }}
              onError={onError}
              className={scanMode === 'camera' ? 'max-w-md mt-2' : 'hidden'}
            />
            {scanMode === 'scanner' && (
              <p className="mt-1 text-[11px] text-slate-500">
                Tip: focus the search field, then scan with USB scanner or phone (keyboard mode).
              </p>
            )}
          </>
        ) : (
          <p className="text-slate-500 text-sm">Select a branch to search medicines.</p>
        )}
        <BillingRiskStrip
          duplicateLineCount={duplicateMedicineIds.size}
          nearExpiryLineCount={nearExpiryLineCount}
          stockRiskLineCount={stockRiskLineCount}
          billingInfo={billingInfo}
          onDismissBillingInfo={() => setBillingInfo(null)}
        />
      </div>

      {/* Order table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-3">
          <table className="w-full text-xs sm:text-sm table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-slate-50/80">
                <th className="text-left py-2 px-3 text-slate-600 font-semibold">Medicine</th>
                <th className="text-left py-2 px-3 text-slate-600 font-semibold">Batch</th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold">Expiry</th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold">MRP</th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold">Qty</th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold">Amount</th>
                <th className="py-2 px-2 text-center text-slate-600 font-semibold w-12" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const med = line.medicineId ? displayMedicines.find((m) => (m.medicineId ?? m.id) === line.medicineId) : null
                const qty = Math.max(0, Number(line.quantity) || 0)
                const rate = med ? Number(med.sellingPrice) || 0 : 0
                const amount = qty * rate
                const lineTax = amount * (taxPercent / 100)
                const batches = line.medicineId ? getBatches(line.medicineId) : []
                const available = line.medicineId ? getAvailable(line.medicineId) : 0
                const selectedBatch = line.batchId ? batches.find((b) => b.id === line.batchId) : batches[0]
                const lowStock = med && (med.minStockLevel ?? 0) > 0 && available < (med.minStockLevel ?? 0)
                const outOfStock = available <= 0
                const formatDate = (d: string | null | undefined) => (d ? new Date(d.slice(0, 10)).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
                const handleQtyChange = (raw: string) => {
                  const digits = raw.replace(/\D/g, '')
                  if (digits === '') { updateLine(idx, 'quantity', ''); return }
                  const num = Math.min(available, Math.max(0, parseInt(digits, 10) || 0))
                  updateLine(idx, 'quantity', String(num))
                }
                const applyQtyDelta = (delta: number) => {
                  if (outOfStock) return
                  const nextQty = Math.min(available, Math.max(0, qty + delta))
                  updateLine(idx, 'quantity', String(nextQty))
                }
                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-100 hover:bg-slate-50/70 align-middle transition ${
                      outOfStock ? 'bg-red-50/60' : ''
                    }`}
                  >
                    <td className="py-1.5 px-3 align-middle">
                      <div className="space-y-0.5">
                        <span
                          className="block font-medium text-slate-900 truncate"
                          title={med?.name ?? '—'}
                        >
                          {med?.name ?? '—'}
                        </span>
                        {med?.genericName && (
                          <span className="block text-[11px] text-slate-500 truncate">
                            Generic: {med.genericName}
                          </span>
                        )}
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {lowStock && !outOfStock && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-100">
                              Low stock
                            </span>
                          )}
                          {outOfStock && (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 border border-red-100">
                              Out of stock
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 align-middle">
                      {batches.length > 1 ? (
                        <select
                          value={line.batchId ?? ''}
                          onChange={(e) => updateLine(idx, 'batchId', e.target.value)}
                          className="w-full max-w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] text-slate-700 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] min-w-0"
                          title="Batch"
                        >
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>{b.batchNumber}</option>
                          ))}
                        </select>
                      ) : batches.length === 1 ? (
                        <div className="text-slate-600 text-[11px]">
                          <span className="font-medium text-slate-700">{batches[0].batchNumber}</span>
                          <div className="mt-1 text-[10px] text-slate-500">Mfg: {formatDate(batches[0].manufacturingDate)}</div>
                          {(() => {
                            const exp = batches[0].expiryDate
                            if (!exp) return null
                            const days = Math.ceil((new Date(exp).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                            if (days <= 0) return <span className="text-red-600 font-medium">Expired</span>
                            if (days <= 30) return <span className="text-amber-600 font-medium">Expiring soon</span>
                            return null
                          })()}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-right text-[11px] text-slate-700 align-middle tabular-nums">
                      {selectedBatch ? formatDate(selectedBatch.expiryDate) : '—'}
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums text-slate-700 font-medium align-middle">
                      ₹{rate.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-3 text-right align-middle">
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={line.quantity}
                          onChange={(e) => handleQtyChange(e.target.value)}
                          placeholder="0"
                          disabled={outOfStock}
                          className={`w-16 rounded-full border px-2.5 py-1 text-xs text-right font-medium focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] ${
                            outOfStock ? 'border-red-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-[#E5E7EB] text-slate-800'
                          }`}
                        />
                        <span className="text-[10px] text-slate-500">
                          Stock:{' '}
                          <span className={outOfStock ? 'text-red-600 font-semibold' : 'font-semibold text-slate-700'}>
                            {available}
                          </span>
                        </span>
                        {!outOfStock && (
                          <div className="mt-0.5 flex items-center gap-1">
                            {[1, 5, 10].map((step) => (
                              <button
                                key={step}
                                type="button"
                                onClick={() => applyQtyDelta(step)}
                                className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                              >
                                +{step}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-middle">
                      ₹{amount.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {lines.length === 0 && (
            <p className="py-8 text-center text-slate-400 text-sm">
              Search and add medicines above. Use barcode scanner or type name.
            </p>
          )}
          {/* Removed "Add more medicine" button; use search/scan above to add items */}
        </div>
      </div>

      {/* Totals */}
      <div className="sticky bottom-0 z-10 shrink-0 p-4 border-t border-[#E5E7EB] bg-[#F8FAFC]/95 backdrop-blur space-y-2">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Items</span>
          <span className="font-medium text-slate-800">{orderLines.length}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span className="tabular-nums">₹{grossTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Discount applied</span>
          <span className="tabular-nums">₹{discount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Taxable (Subtotal − Discount)</span>
          <span className="tabular-nums">₹{taxable.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Tax ({taxPercent}%)</span>
          <span className="tabular-nums">₹{taxTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-[#E5E7EB]">
          <span className="text-base font-semibold text-slate-800">Total payable</span>
          <span className="text-2xl font-bold text-[#2563EB] tabular-nums">₹{netTotal.toFixed(2)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={holdCurrentBill}
            disabled={orderLines.length === 0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hold bill
          </button>
          <button
            type="button"
            onClick={resumeHeldBill}
            disabled={!hasHeldBill}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resume held bill
          </button>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600" htmlFor="queue-tax-percent">Tax %</label>
            <input
              id="queue-tax-percent"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={taxPercent}
              onChange={(e) => setTaxPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="w-20 rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-xs text-right"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600" htmlFor="queue-discount-amount">Discount ₹</label>
            <input
              id="queue-discount-amount"
              type="number"
              min={0}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-xs text-right"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !canCompleteSale || !hasActiveSession}
            className="ml-auto rounded-full bg-[#2563EB] text-white font-semibold py-2.5 px-6 text-xs sm:text-sm hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition"
            title={
              !hasActiveSession
                ? 'Start a cash session first (Cash & expenses → Start shift)'
                : duplicateMedicineIds.size > 0
                  ? 'Remove duplicate medicine lines before billing.'
                : !canCompleteSale && orderLines.length > 0
                  ? 'Reduce quantity to available stock or remove out-of-stock items'
                  : paymentMode === 'cash'
                    ? 'After this, use the inline cash panel below to confirm payment and complete billing.'
                    : ''
            }
          >
            {saving ? 'Processing…' : paymentMode === 'cash' ? 'Review & open cash panel' : 'Complete sale & print bill'}
          </button>
        </div>

        {showCashPanel && (
          <div className="mt-3">
            <CashPaymentPanel
              billAmount={pendingBillAmount}
              onConfirm={doDispenseWithCash}
              confirmLabel="Confirm & complete sale"
              onCancel={() => setPendingDispensePayload(null)}
            />
          </div>
        )}
      </div>
    </form>
  )
}
