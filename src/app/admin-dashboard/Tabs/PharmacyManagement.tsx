'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { auth } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { usePharmacyPortal } from '@/contexts/PharmacyPortalContext'
import type { PharmacyPortalTabId } from '@/contexts/PharmacyPortalContext'
import SubTabNavigation from '@/components/admin/SubTabNavigation'
import Notification from '@/components/ui/feedback/Notification'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Pagination from '@/components/ui/navigation/Pagination'
import { useTablePagination } from '@/hooks/useTablePagination'
import { RevealModal, useRevealModalClose } from '@/components/ui/overlays/RevealModal'
import { ConfirmDialog } from '@/components/ui/overlays/Modals'
import { CashTenderModal } from '@/components/pharmacy/CashTenderModal'
import { RefundCashModal } from '@/components/pharmacy/RefundCashModal'
import type { Branch } from '@/types/branch'
import type {
  PharmacyMedicine,
  BranchMedicineStock,
  MedicineBatch,
  PharmacySupplier,
  PharmacySale,
  LowStockAlert,
  ExpiryAlert,
  StockTransfer,
  PharmacyPurchaseOrder,
  PurchaseOrderLine,
  PharmacyCashSession,
  PharmacyCashierProfile,
  PharmacyCounter,
  PharmacyExpense,
  PharmacyExpenseCategory,
} from '@/types/pharmacy'
import { generateBillPDFAndPrint } from '@/utils/pharmacy/billPrint'
import { exportToExcel, exportToPdf, printReport } from '@/utils/pharmacy/exportReports'
import type { ParsedMedicineRow } from '@/utils/pharmacy/parseMedicineFile'
import { playScanBeep } from '@/utils/scanBeep'
import { BarcodeCameraScanner } from '@/components/pharmacy/BarcodeCameraScanner'
import jsPDF from 'jspdf'

type PharmacySubTab = 'overview' | 'inventory' | 'queue' | 'sales' | 'returns' | 'suppliers' | 'orders' | 'transfers' | 'analytics' | 'reports' | 'users' | 'cash_and_expenses'

const PDF_CURRENCY = 'Rs. '

/** Build PO PDF (header, details, items table, total). Returns jsPDF instance. */
function buildPurchaseOrderPDF(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
): jsPDF {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 20
  let y = 20

  pdf.setFillColor(37, 99, 235)
  const headerHeight = hospitalName || hospitalAddress ? 44 : 32
  pdf.rect(0, 0, pageWidth, headerHeight, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Purchase Order', margin, 22)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text((order.orderNumber ?? order.id) + '', pageWidth - margin, 22, { align: 'right' })
  if (hospitalName || hospitalAddress) {
    pdf.setFontSize(9)
    if (hospitalName) pdf.text(hospitalName, margin, 34)
    if (hospitalAddress) pdf.text(hospitalAddress, margin, 40)
  }

  y = headerHeight + 10
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Supplier', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(supplierName, margin + 45, y)
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.text('Branch', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(branchName, margin + 45, y)
  y += 8
  const orderDate = typeof order.createdAt === 'string' ? order.createdAt : (order.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
  pdf.setFont('helvetica', 'bold')
  pdf.text('Order date', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(orderDate ? new Date(orderDate).toLocaleDateString() : '—', margin + 45, y)
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.text('Expected delivery', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : '—', margin + 45, y)
  y += 8
  if (order.notes) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('Notes', margin, y)
    pdf.setFont('helvetica', 'normal')
    const noteLines = pdf.splitTextToSize(order.notes, pageWidth - margin - 50)
    pdf.text(noteLines, margin + 45, y)
    y += noteLines.length * 5 + 4
  }
  y += 6

  const colW = [60, 45, 18, 28, 32]
  const headers = ['Medicine', 'Manufacturer', 'Qty', 'Unit price', 'Subtotal']
  pdf.setFillColor(241, 245, 249)
  pdf.rect(margin, y, colW.reduce((a, b) => a + b, 0), 8, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  let x = margin
  headers.forEach((h, i) => {
    pdf.text(h, x + (i < 2 ? 2 : colW[i] - 2), y + 5.5, i >= 2 ? { align: 'right' } : {})
    x += colW[i]
  })
  y += 10

  pdf.setFont('helvetica', 'normal')
  const items = order.items ?? []
  for (let i = 0; i < items.length; i++) {
    const line = items[i]
    const subtotal = (line.quantity ?? 0) * Number(line.unitCost ?? 0)
    if (y > 260) { pdf.addPage(); y = 20 }
    x = margin
    pdf.setFontSize(9)
    const medText = pdf.splitTextToSize(line.medicineName ?? '', colW[0] - 4)
    pdf.text(medText[0], x + 2, y + 4)
    x += colW[0]
    const mfrText = pdf.splitTextToSize((line.manufacturer ?? '—'), colW[1] - 4)
    pdf.text(mfrText[0], x + 2, y + 4)
    x += colW[1]
    pdf.text(String(line.quantity ?? 0), x + colW[2] - 2, y + 4, { align: 'right' })
    x += colW[2]
    pdf.text(PDF_CURRENCY + Number(line.unitCost ?? 0).toFixed(2), x + colW[3] - 2, y + 4, { align: 'right' })
    x += colW[3]
    pdf.text(PDF_CURRENCY + subtotal.toFixed(2), x + colW[4] - 2, y + 4, { align: 'right' })
    y += Math.max(8, medText.length * 5, mfrText.length * 5)
  }
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.text('Order total: ' + PDF_CURRENCY + Number(order.totalCost ?? 0).toFixed(2), pageWidth - margin, y, { align: 'right' })

  return pdf
}

/** Generate PO PDF and trigger download */
function downloadPurchaseOrderPDF(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
) {
  const pdf = buildPurchaseOrderPDF(order, supplierName, branchName, hospitalName, hospitalAddress)
  const raw = (order.orderNumber ?? order.id).replace(/\s/g, '-')
  const filename = raw.toUpperCase().startsWith('PO-') ? `${raw}.pdf` : `PO-${raw}.pdf`
  pdf.save(filename)
}

/** Generate PO PDF and open in new window for printing (no download) */
function printPurchaseOrderPDF(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
) {
  const pdf = buildPurchaseOrderPDF(order, supplierName, branchName, hospitalName, hospitalAddress)
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank', 'noopener')
  if (w) w.onload = () => { URL.revokeObjectURL(url); w.print() }
  else URL.revokeObjectURL(url)
}

const PHARMACY_UI = {
  primary: '#2563EB',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E5E7EB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const

function AddMedicineForm({
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

function EditMinLevelModal({
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

/** Format: "Name strength – Manufacturer" for PO dropdown; otherwise "Name (generic)" */
function formatMedicineOption(m: PharmacyMedicine, showStrengthManufacturer: boolean): string {
  if (showStrengthManufacturer) {
    const strength = (m.strength || '').trim()
    const manufacturer = (m.manufacturer || '').trim()
    const part2 = [strength, manufacturer].filter(Boolean).join(' – ')
    return part2 ? `${m.name} ${part2}` : m.name
  }
  return m.genericName ? `${m.name} (${m.genericName})` : m.name
}

/** Searchable medicine selector – dropdown only opens after user types; list uses fixed position so it stays visible */
function MedicineSearchSelect({
  value,
  medicines,
  onChange,
  placeholder = 'Search medicine by name...',
  className = '',
  showGeneric = true,
  showStrengthManufacturer = false,
}: {
  value: string
  medicines: PharmacyMedicine[]
  onChange: (medicineId: string) => void
  placeholder?: string
  className?: string
  showGeneric?: boolean
  /** When true, dropdown shows "Name strength – Manufacturer" (e.g. Paracetamol 500mg – GSK) */
  showStrengthManufacturer?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = value ? medicines.find((m) => (m.medicineId ?? m.id) === value) : null
  const displayValue = open ? query : (selected ? formatMedicineOption(selected, showStrengthManufacturer) : '')
  const q = query.trim().toLowerCase()
  const isBarcodeLike = /^\d+$/.test(q) && q.length >= 6
  const filtered = q.length < 1
    ? []
    : medicines.filter((m) => {
        const name = (m.name || '').toLowerCase()
        const generic = (m.genericName || '').toLowerCase()
        const manufacturer = (m.manufacturer || '').toLowerCase()
        const strength = (m.strength || '').toLowerCase()
        const barcodeMatch = isBarcodeLike && (m.barcode || '').trim() === q
        return barcodeMatch || name.includes(q) || generic.includes(q) || manufacturer.includes(q) || strength.includes(q)
      }).slice(0, 80)
  const showList = open && query.length >= 1
  useEffect(() => {
    if (showList && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 260) })
    } else {
      setDropdownRect(null)
    }
  }, [showList, query])
  useEffect(() => {
    const onBlur = () => setTimeout(() => { setOpen(false); setDropdownRect(null); }, 180)
    const el = containerRef.current
    el?.addEventListener('focusout', onBlur)
    return () => el?.removeEventListener('focusout', onBlur)
  }, [])
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={(e) => {
          const v = e.target.value
          setQuery(v)
          setOpen(true)
          if (!v) onChange('')
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm min-w-[160px]"
        autoComplete="off"
      />
      {showList && dropdownRect && typeof document !== 'undefined' && document.body && (
        <ul
          className="fixed z-[10000] max-h-56 overflow-auto rounded border border-slate-200 bg-white py-1 shadow-xl"
          style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, minWidth: 260 }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No match. Keep typing to search.</li>
          ) : (
            filtered.map((m) => {
              const id = m.medicineId ?? m.id
              const label = showStrengthManufacturer ? formatMedicineOption(m, true) : `${m.name}${showGeneric && m.genericName ? ` (${m.genericName})` : ''}`
              return (
                <li
                  key={id}
                  role="option"
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100 aria-selected:bg-slate-100"
                  aria-selected={id === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange(id); setQuery(''); setOpen(false); setDropdownRect(null); inputRef.current?.blur(); }}
                >
                  {label}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

/** POS-style medicine search: autocomplete shows Name, Strength, Stock, Price; barcode on Enter; keyboard nav */
function POSMedicineSearch({
  medicines,
  stock,
  branchId,
  onSelect,
  placeholder = 'Search by name, brand or scan barcode...',
  getToken,
  hospitalId,
  onError,
  onOpenAddMedicine,
  autoFocus = false,
  inputRef: externalRef,
}: {
  medicines: PharmacyMedicine[]
  stock: BranchMedicineStock[]
  branchId: string
  onSelect: (med: PharmacyMedicine) => void
  placeholder?: string
  getToken: () => Promise<string | null>
  hospitalId: string
  onError: (msg: string) => void
  onOpenAddMedicine?: (barcode: string) => void
  autoFocus?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const internalRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = externalRef ?? internalRef

  const getStock = useCallback((medId: string) => {
    if (!branchId) return 0
    const s = stock.find((st) => st.branchId === branchId && (st.medicineId === medId || st.medicineName === medicines.find((m) => (m.medicineId ?? m.id) === medId)?.name))
    return s ? s.totalQuantity : 0
  }, [stock, branchId, medicines])

  const q = query.trim().toLowerCase()
  const isBarcodeLike = /^\d+$/.test(q) && q.length >= 6
  const filtered = useMemo(() => {
    if (q.length < 1) return []
    const list = medicines.filter((m) => {
      const name = (m.name || '').toLowerCase()
      const generic = (m.genericName || '').toLowerCase()
      const manufacturer = (m.manufacturer || '').toLowerCase()
      const strength = (m.strength || '').toLowerCase()
      const barcodeMatch = isBarcodeLike && (m.barcode || '').trim() === q
      return barcodeMatch || name.includes(q) || generic.includes(q) || manufacturer.includes(q) || strength.includes(q)
    }).slice(0, 50)
    return list
  }, [medicines, q, isBarcodeLike])

  useEffect(() => {
    if (open && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 420) })
    } else setDropdownRect(null)
  }, [open, query, inputRef])
  useEffect(() => { setHighlightIdx(0) }, [query])
  useEffect(() => {
    const onBlur = () => setTimeout(() => { setOpen(false); setDropdownRect(null); }, 180)
    const el = containerRef.current
    el?.addEventListener('focusout', onBlur)
    return () => el?.removeEventListener('focusout', onBlur)
  }, [])
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [autoFocus, inputRef])

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0 && highlightIdx >= 0 && highlightIdx < filtered.length) {
        onSelect(filtered[highlightIdx])
        setQuery('')
        setOpen(false)
        return
      }
      if (isBarcodeLike && q.length >= 6) {
        try {
          const token = await getToken()
          if (!token) { onError('Not signed in'); return }
          const res = await fetch(`/api/pharmacy/medicines?hospitalId=${encodeURIComponent(hospitalId)}&barcode=${encodeURIComponent(q)}&branchId=${encodeURIComponent(branchId)}`, { headers: { Authorization: `Bearer ${token}` } })
          const data = await res.json().catch(() => ({}))
          if (res.ok && data.medicine) {
            onSelect(data.medicine)
            setQuery('')
            setOpen(false)
          } else if (onOpenAddMedicine) onOpenAddMedicine(q)
          else onError(data.error || data.message || 'Product not found')
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Lookup failed')
        }
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => (i + 1) % Math.max(1, filtered.length)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0)) }
  }

  const showList = open && query.length >= 1
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border-2 border-[#E5E7EB] bg-white py-3 pl-10 pr-4 text-base text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
        />
      </div>
      {showList && dropdownRect && typeof document !== 'undefined' && document.body && (
        <ul
          className="fixed z-[10000] max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width, minWidth: 420 }}
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">No match. Type name or scan barcode and press Enter.</li>
          ) : (
            filtered.map((m, idx) => {
              const id = m.medicineId ?? m.id
              const st = getStock(id)
              const price = Number(m.sellingPrice) || 0
              const lowStock = (m.minStockLevel ?? 0) > 0 && st < (m.minStockLevel ?? 0)
              return (
                <li
                  key={id}
                  role="option"
                  aria-selected={idx === highlightIdx}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onSelect(m); setQuery(''); setOpen(false); }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`cursor-pointer px-4 py-2.5 text-sm border-b border-slate-100 last:border-0 ${idx === highlightIdx ? 'bg-[#2563EB]/10' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800">{m.name}</span>
                      {m.genericName && <span className="text-slate-500 ml-1">({m.genericName})</span>}
                      {m.strength && <span className="text-slate-500 ml-1"> · {m.strength}</span>}
                    </div>
                    <span className="shrink-0 font-semibold text-[#2563EB] tabular-nums">₹{price.toFixed(2)}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-slate-500">
                    <span>Stock: <span className={lowStock ? 'text-amber-600 font-medium' : 'tabular-nums'}>{st}</span></span>
                    {lowStock && <span className="text-amber-600">Low stock</span>}
                  </div>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

/** Barcode scan input: scan or type barcode + Enter to lookup medicine and auto-fill. When not found, can open Add medicine with barcode. */
function BarcodeScanInput({
  hospitalId,
  getToken,
  onMedicineFound,
  onError,
  onOpenAddMedicine,
  placeholder = 'Scan barcode or type and press Enter',
  className = '',
  disabled = false,
  showFoundInline = false,
  autoFocus = false,
}: {
  hospitalId: string
  getToken: () => Promise<string | null>
  onMedicineFound: (medicine: PharmacyMedicine) => void
  onError: (message: string) => void
  /** When barcode not found, call with barcode so parent can open Add medicine modal with it */
  onOpenAddMedicine?: (barcode: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** When true, show "Found: name" under input and allow adding from here */
  showFoundInline?: boolean
  /** When true, focus this input on mount (for phone/USB scanner: scan sends barcode + Enter here) */
  autoFocus?: boolean
}) {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [lastFound, setLastFound] = useState<PharmacyMedicine | null>(null)
  const [lastNotFoundBarcode, setLastNotFoundBarcode] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [autoFocus, disabled])

  const lookupByBarcode = useCallback(async () => {
    const code = barcodeInput.trim()
    if (!code || !hospitalId) return
    setLookingUp(true)
    setLastFound(null)
    setLastNotFoundBarcode(null)
    try {
      const token = await getToken()
      if (!token) {
        onError('Not signed in')
        return
      }
      const res = await fetch(
        `/api/pharmacy/medicines?hospitalId=${encodeURIComponent(hospitalId)}&barcode=${encodeURIComponent(code)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.medicine) {
        onError(data.error || 'No medicine found with this barcode')
        if (res.status === 404 || !data.medicine) setLastNotFoundBarcode(code)
        return
      }
      const med = data.medicine as PharmacyMedicine
      if (showFoundInline) {
        setLastFound(med)
      } else {
        playScanBeep()
        onMedicineFound(med)
        setBarcodeInput('')
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLookingUp(false)
      inputRef.current?.focus()
    }
  }, [barcodeInput, hospitalId, getToken, onMedicineFound, onError, showFoundInline])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      lookupByBarcode()
    }
  }

  const handleUseFound = () => {
    if (lastFound) {
      playScanBeep()
      onMedicineFound(lastFound)
      setLastFound(null)
      setBarcodeInput('')
    }
  }

  const isProminent = className.includes('barcode-lookup-prominent')
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className={`flex items-center gap-2 ${isProminent ? 'flex-wrap' : ''}`}>
        <div className={isProminent ? 'relative flex-1 min-w-[200px]' : ''}>
          {isProminent && (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={barcodeInput}
            onChange={(e) => {
              setBarcodeInput(e.target.value)
              setLastNotFoundBarcode(null)
            }}
            onKeyDown={onKeyDown}
            disabled={disabled || lookingUp}
            className={isProminent
              ? 'w-full rounded-xl border-2 border-[#E5E7EB] bg-white py-3 pl-11 pr-4 text-base text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 min-w-[240px]'
              : 'rounded border border-slate-300 px-2 py-1.5 text-sm min-w-[180px] placeholder:text-slate-400'}
            title="Scan barcode or type EAN/UPC and press Enter"
          />
        </div>
        <button
          type="button"
          onClick={lookupByBarcode}
          disabled={disabled || lookingUp || !barcodeInput.trim()}
          className={isProminent
            ? 'rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
            : 'rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm hover:bg-slate-100'}
        >
          Look up
        </button>
      </div>
      {lookingUp && <span className="text-xs text-slate-500">Looking up…</span>}
      {showFoundInline && lastFound && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-emerald-50 border border-emerald-200 px-2 py-1.5 text-sm">
          <span className="text-emerald-800">Found: <strong>{lastFound.name}</strong>{lastFound.strength ? ` ${lastFound.strength}` : ''}{lastFound.manufacturer ? ` – ${lastFound.manufacturer}` : ''}</span>
          <button type="button" onClick={handleUseFound} className="text-emerald-700 font-medium hover:underline">Use this</button>
        </div>
      )}
      {lastNotFoundBarcode && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-amber-50 border border-amber-200 px-2 py-1.5 text-sm">
          <span className="text-amber-800">No medicine with this barcode.</span>
          {onOpenAddMedicine && (
            <button type="button" onClick={() => onOpenAddMedicine(lastNotFoundBarcode)} className="text-amber-800 font-medium hover:underline">
              Add medicine with this barcode
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AddStockForm({
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

function MedicineFileUploader({
  branchId,
  branchName,
  branchRequired,
  onSuccess,
  onError,
  getToken,
}: {
  branchId?: string
  branchName?: string
  /** When true, upload is disabled until a branch is selected (for adding stock) */
  branchRequired?: boolean
  onSuccess: (message: string) => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const accept = '.xlsx,.xls,.pdf,.png,.jpg,.jpeg'
  const canUpload = !branchRequired || !!branchId

  const handleFile = async (file: File | null) => {
    if (!file) return
    if (branchRequired && !branchId) {
      onError('Select a branch above to import inventory. Stock will be added to the selected branch.')
      return
    }
    setUploading(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const form = new FormData()
      form.append('file', file)
      if (branchId) form.append('branchId', branchId)
      const res = await fetch('/api/pharmacy/upload-medicines', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const msg = data.message || (data.created !== undefined ? `Processed: ${data.created} new, ${data.updated ?? 0} existing.` : 'Upload complete.')
      onSuccess(msg)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err: any) {
      onError(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {branchRequired && !branchId && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Select a branch from the dropdown above to import inventory. If your file has no branch column, stock will be added to the selected branch.
        </p>
      )}
      {branchRequired && branchId && branchName && (
        <p className="text-sm text-slate-600">
          Stock will be added to: <strong>{branchName}</strong>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          disabled={uploading || !canUpload}
        />
        <div
          role="button"
          tabIndex={canUpload ? 0 : -1}
          onKeyDown={(e) => canUpload && e.key === 'Enter' && inputRef.current?.click()}
          onClick={() => canUpload && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (canUpload) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (canUpload) handleFile(e.dataTransfer.files?.[0] ?? null) }}
          className={`rounded-lg border-2 border-dashed px-4 py-2 text-sm font-medium transition ${!canUpload ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed' : dragOver ? 'border-slate-400 bg-slate-100' : 'border-slate-300 bg-white hover:bg-slate-50'} ${uploading ? 'pointer-events-none opacity-70' : canUpload ? 'cursor-pointer' : ''}`}
        >
          {uploading ? 'Uploading…' : canUpload ? 'Upload Excel / PDF / image' : 'Select a branch to enable upload'}
        </div>
        <span className="text-xs text-slate-500">.xlsx, .xls, .pdf, .png, .jpg</span>
      </div>
    </div>
  )
}

function OrderFileUploader({
  branches,
  suppliers,
  selectedBranchId,
  selectedBranchName,
  onSuccess,
  onError,
  getToken,
}: {
  branches: Array<{ id: string; name: string }>
  suppliers: PharmacySupplier[]
  selectedBranchId?: string
  selectedBranchName?: string
  onSuccess: (message: string) => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [branchId, setBranchId] = useState(selectedBranchId ?? '')
  const [supplierId, setSupplierId] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const accept = '.xlsx,.xls,.pdf'
  useEffect(() => {
    if (selectedBranchId) setBranchId(selectedBranchId)
  }, [selectedBranchId])
  const effectiveBranchId = selectedBranchId ?? branchId
  const handleFile = async (file: File | null) => {
    if (!file) return
    if (!effectiveBranchId || !supplierId) {
      onError('Select branch and supplier first')
      return
    }
    setUploading(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const form = new FormData()
      form.append('file', file)
      form.append('branchId', effectiveBranchId)
      form.append('supplierId', supplierId)
      const res = await fetch('/api/pharmacy/purchase-orders/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onSuccess(data.message || `Order created with ${data.itemsCount ?? 0} item(s).`)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Select supplier, then upload an Excel or PDF file. File should have columns like <strong>name</strong> and <strong>quantity</strong> (and optionally purchase/cost). Medicines are matched to your catalog by name.</p>
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
        >
          <option value="">Select supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          disabled={uploading || !effectiveBranchId || !supplierId}
        />
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onClick={() => (effectiveBranchId && supplierId ? inputRef.current?.click() : null)}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (effectiveBranchId && supplierId) handleFile(e.dataTransfer.files?.[0] ?? null) }}
          className={`rounded-lg border-2 border-dashed px-4 py-2 text-sm font-medium transition ${dragOver ? 'border-slate-400 bg-slate-100' : 'border-slate-300 bg-white hover:bg-slate-50'} ${uploading || !effectiveBranchId || !supplierId ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}
        >
          {uploading ? 'Uploading…' : 'Upload Excel or PDF'}
        </div>
        <span className="text-xs text-slate-500">.xlsx, .xls, .pdf</span>
      </div>
    </div>
  )
}

function AddSupplierForm({
  onSuccess,
  onError,
  getToken,
  hospitalId,
}: {
  onSuccess: () => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
  hospitalId: string
}) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState('')
  const [minOrderValue, setMinOrderValue] = useState('')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { onError('Name required'); return }
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch('/api/pharmacy/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          paymentTerms: paymentTerms.trim(),
          leadTimeDays: leadTimeDays !== '' ? Number(leadTimeDays) : undefined,
          minOrderValue: minOrderValue !== '' ? Number(minOrderValue) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add supplier')
      onSuccess()
      setName(''); setContactPerson(''); setPhone(''); setEmail(''); setAddress(''); setPaymentTerms(''); setLeadTimeDays(''); setMinOrderValue('')
    } catch (err: any) {
      onError(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="text" placeholder="Supplier name *" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="text" placeholder="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="text" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="text" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <input type="text" placeholder="Payment terms (e.g. Net 30)" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min="0" placeholder="Lead time (days)" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        <input type="number" min="0" step="0.01" placeholder="Min order value" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      <button type="submit" disabled={saving} className="btn-modern btn-modern-primary btn-modern-sm">Add supplier</button>
    </form>
  )
}

function EditSupplierForm({
  supplier,
  onSuccess,
  onError,
  onCancel,
  getToken,
}: {
  supplier: PharmacySupplier
  onSuccess: () => void
  onError: (e: string) => void
  onCancel: () => void
  getToken: () => Promise<string | null>
}) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(supplier.name)
  const [contactPerson, setContactPerson] = useState(supplier.contactPerson ?? '')
  const [phone, setPhone] = useState(supplier.phone ?? '')
  const [email, setEmail] = useState(supplier.email ?? '')
  const [address, setAddress] = useState(supplier.address ?? '')
  const [paymentTerms, setPaymentTerms] = useState(supplier.paymentTerms ?? '')
  const [leadTimeDays, setLeadTimeDays] = useState(supplier.leadTimeDays != null ? String(supplier.leadTimeDays) : '')
  const [minOrderValue, setMinOrderValue] = useState(supplier.minOrderValue != null ? String(supplier.minOrderValue) : '')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { onError('Name required'); return }
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch(`/api/pharmacy/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          paymentTerms: paymentTerms.trim(),
          leadTimeDays: leadTimeDays !== '' ? Number(leadTimeDays) : undefined,
          minOrderValue: minOrderValue !== '' ? Number(minOrderValue) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update supplier')
      onSuccess()
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="text" placeholder="Supplier name *" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm text-[#263238]" />
      <input type="text" placeholder="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm text-[#263238]" />
      <input type="text" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm text-[#263238]" />
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm text-[#263238]" />
      <input type="text" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm text-[#263238]" />
      <input type="text" placeholder="Payment terms (e.g. Net 30)" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm text-[#263238]" />
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min="0" placeholder="Lead time (days)" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm text-[#263238]" />
        <input type="number" min="0" step="0.01" placeholder="Min order value" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} className="rounded-lg border border-[#E0E0E0] px-3 py-2 text-sm text-[#263238]" />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-[#E0E0E0] px-4 py-2 text-sm font-medium text-[#607D8B] hover:bg-[#F5F5F5]">Cancel</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-[#1565C0] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D47A1] disabled:opacity-50">Save changes</button>
      </div>
    </form>
  )
}

function PlaceOrderForm({
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

function CreatePharmacyUserForm({
  branches,
  onSuccess,
  onError,
  getToken,
}: {
  branches: Array<{ id: string; name: string }>
  onSuccess: (message: string) => void
  onError: (e: string) => void
  getToken: () => Promise<string | null>
}) {
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [branchId, setBranchId] = useState('')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) { onError('Email and password required'); return }
    if (password.length < 6) { onError('Password must be at least 6 characters'); return }
    setSaving(true)
    try {
      const token = await getToken()
      if (!token) { onError('Not authenticated'); return }
      const res = await fetch('/api/admin/create-pharmacist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          branchId: branchId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create user')
      onSuccess(`Pharmacy user created. They can login at /auth/login?role=pharmacy with email: ${email.trim()} and the password you set.`)
      setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setBranchId('')
    } catch (err: any) {
      onError(err.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input type="email" placeholder="Email (login ID) *" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" required />
      <input type="password" placeholder="Password (min 6) *" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" minLength={6} required />
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        <input type="text" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </div>
      {branches.length > 0 && (
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">All branches (optional)</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      <button type="submit" disabled={saving} className="btn-modern btn-modern-primary btn-modern-sm">Create pharmacy user</button>
    </form>
  )
}

function AddPharmacistModalContent({
  form,
  setForm,
  branches,
  saving,
  onSubmit,
}: {
  form: { firstName: string; lastName: string; email: string; password: string; branchId: string }
  setForm: React.Dispatch<React.SetStateAction<{ firstName: string; lastName: string; email: string; password: string; branchId: string }>>
  branches: Array<{ id: string; name: string }>
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  const requestClose = useRevealModalClose()
  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl min-w-[360px] max-h-[95vh] overflow-hidden flex flex-col border border-slate-200/80">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 sm:px-10 pt-7 pb-5 rounded-t-2xl shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5h4.01M7 20h4c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2zM7 6V4c0-1.103.897-2 2-2h4c1.103 0 2 .897 2 2v2" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Create New Pharmacist</h3>
              <p className="text-base text-slate-500 mt-1">Add a new pharmacy login for a specific branch</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-6 min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">First Name *</label>
            <input
              type="text"
              required
              value={form.firstName}
              onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter first name"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">Last Name *</label>
            <input
              type="text"
              required
              value={form.lastName}
              onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter last name"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter email address"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Min 6 characters"
            />
            <p className="text-sm text-slate-500 mt-1.5">Password must be at least 6 characters</p>
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">
              Branch{branches.length > 0 ? ' *' : ''}
            </label>
            <select
              required={branches.length > 0}
              value={form.branchId}
              onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">
                {branches.length === 0 ? 'No branches configured' : 'Select a branch'}
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {branches.length === 0 && (
              <p className="text-sm text-slate-500 mt-1.5">Create branches first from the Branches tab, then assign pharmacists.</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="px-6 py-3 text-base border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 text-base bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating...' : 'Create Pharmacist'}
          </button>
        </div>
      </form>
    </div>
  )
}

type QueueItem = {
  appointmentId: string
  patientName: string
  doctorName: string
  appointmentDate: string
  branchId?: string
  branchName?: string
  medicineText: string
  medicines: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  dispensed: boolean
}

function DispenseModal({
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
  const [showCashTenderModal, setShowCashTenderModal] = useState(false)
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
    setShowCashTenderModal(true)
  }

  const doDispenseWithCash = async (
    tenderNotes: Record<string, number>,
    changeNotes: Record<string, number>,
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
          tenderNotes,
          changeNotes,
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
      generateBillPDFAndPrint({
        type: 'prescription',
        patientName: queueItem.patientName,
        customerPhone: undefined,
        doctorName: queueItem.doctorName,
        date: queueItem.appointmentDate,
        branchName: queueItem.branchName ?? queueItem.branchId ?? '',
        lines: billLines,
        grossTotal: billGross,
        discountAmount: billDiscount > 0 ? billDiscount : undefined,
        taxTotal: billTax,
        taxPercent,
        netTotal: billNet,
      })
      setPendingDispensePayload(null)
      setShowCashTenderModal(false)
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
      <CashTenderModal
        isOpen={showCashTenderModal}
        onClose={() => { setShowCashTenderModal(false); setPendingDispensePayload(null) }}
        billAmount={pendingBillAmount}
        onConfirm={doDispenseWithCash}
      />
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

            {/* Removed \"Add medicine\" button; medicines are added via search/scan above */}
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
                    const expiryStr = expiryFromStock ? (expiryFromStock as string).slice(0, 10) : '—'
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
                        <td className="p-3 text-right align-top tabular-nums">{rate > 0 ? rate.toFixed(2) : '—'}</td>
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
                        <td className="p-3 text-right font-medium align-top tabular-nums">{amount > 0 ? amount.toFixed(2) : '—'}</td>
                        <td className="p-3 text-right text-slate-600 align-top tabular-nums">{lineTax > 0 ? lineTax.toFixed(2) : '—'}</td>
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

/** POS-style billing panel: customer info, medicine search, order table with batch, totals, payment. Used in Prescription Queue & Billing page. */
function PharmacyBillingPanel({
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
  const [showCashTenderModal, setShowCashTenderModal] = useState(false)
  const [pendingDispensePayload, setPendingDispensePayload] = useState<{
    branchId: string
    customerName: string
    customerPhone: string
    lines: Array<{ medicineId: string; quantity: number; batchId?: string }>
  } | null>(null)
  const [pendingBillAmount, setPendingBillAmount] = useState(0)
  const [searchPatientQuery, setSearchPatientQuery] = useState('')
  const [searchPatientOpen, setSearchPatientOpen] = useState(false)
  const patientSearchRef = useRef<HTMLDivElement | null>(null)
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
  }, [getBatches])

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
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

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
      setShowCashTenderModal(true)
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
      const today = new Date().toISOString().slice(0, 10)
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
        date: today,
        branchName,
        lines: billLines,
        grossTotal: gross,
        discountAmount: disc > 0 ? disc : undefined,
        taxTotal: billTax,
        taxPercent,
        netTotal: net,
      })
      onSuccess()
      setCustomerName('')
      setCustomerPhone('')
      setTaxPercent(0)
      setDiscountAmount(0)
      setLines([])
    } catch (err: any) {
      onError(err?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const doDispenseWithCash = async (
    tenderNotes: Record<string, number>,
    changeNotes: Record<string, number>,
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
          tenderNotes,
          changeNotes,
          changeGiven,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Sale failed')
      const branchName = selectedBranchName ?? branches.find((b) => b.id === pending.branchId)?.name ?? ''
      const today = new Date().toISOString().slice(0, 10)
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
        date: today,
        branchName,
        lines: billLines,
        grossTotal: gross,
        discountAmount: disc > 0 ? disc : undefined,
        taxTotal: billTax,
        taxPercent,
        netTotal: net,
      })
      setPendingDispensePayload(null)
      setShowCashTenderModal(false)
      onSuccess()
      setCustomerName('')
      setCustomerPhone('')
      setTaxPercent(0)
      setDiscountAmount(0)
      setLines([])
    } catch (err: any) {
      onError(err?.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const orderLines = lines.filter((l) => l.medicineId && Number(l.quantity) > 0)
  const canCompleteSale = orderLines.length > 0 && orderLines.every((l) => {
    const avail = getAvailable(l.medicineId)
    const q = Math.floor(Number(l.quantity) || 0)
    return avail > 0 && q <= avail
  })
  const grossTotal = orderLines.reduce((sum, l) => {
    const med = displayMedicines.find((m) => (m.medicineId ?? m.id) === l.medicineId)
    return sum + (Number(l.quantity) || 0) * (med ? Number(med.sellingPrice) || 0 : 0)
  }, 0)
  const discount = Math.max(0, Number(discountAmount) || 0)
  const taxable = Math.max(0, grossTotal - discount)
  const taxTotal = taxable * (taxPercent / 100)
  const netTotal = taxable + taxTotal
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <CashTenderModal
        isOpen={showCashTenderModal}
        onClose={() => { setShowCashTenderModal(false); setPendingDispensePayload(null) }}
        billAmount={pendingBillAmount}
        onConfirm={doDispenseWithCash}
      />
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
      </div>

      {/* Order table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="p-4">
          <table className="w-full text-sm table-fixed">
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
              <tr className="border-b-2 border-[#E5E7EB] bg-slate-50/80">
                <th className="text-left py-3 px-3 text-slate-600 font-semibold">Medicine</th>
                <th className="text-left py-3 px-3 text-slate-600 font-semibold">Batch</th>
                <th className="text-right py-3 px-3 text-slate-600 font-semibold">Expiry</th>
                <th className="text-right py-3 px-3 text-slate-600 font-semibold">MRP</th>
                <th className="text-right py-3 px-3 text-slate-600 font-semibold">Qty</th>
                <th className="text-right py-3 px-3 text-slate-600 font-semibold">Amount</th>
                <th className="py-3 px-2 text-center text-slate-600 font-semibold w-12" />
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
                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-100 hover:bg-slate-50/70 align-middle transition ${
                      outOfStock ? 'bg-red-50/60' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 align-middle">
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
                    <td className="py-2.5 px-4 align-middle">
                      {batches.length > 1 ? (
                        <select
                          value={line.batchId ?? ''}
                          onChange={(e) => updateLine(idx, 'batchId', e.target.value)}
                          className="w-full max-w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] min-w-0"
                          title="Batch"
                        >
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>{b.batchNumber}</option>
                          ))}
                        </select>
                      ) : batches.length === 1 ? (
                        <div className="text-slate-600 text-xs">
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
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-xs text-slate-700 align-middle tabular-nums">
                      {selectedBatch ? formatDate(selectedBatch.expiryDate) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-700 font-medium align-middle">
                      ₹{rate.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right align-middle">
                      <div className="flex flex-col items-end gap-0.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={line.quantity}
                          onChange={(e) => handleQtyChange(e.target.value)}
                          placeholder="0"
                          disabled={outOfStock}
                          className={`w-16 rounded-full border px-3 py-1.5 text-sm text-right font-medium focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] ${
                            outOfStock ? 'border-red-200 bg-slate-100 text-slate-500 cursor-not-allowed' : 'border-[#E5E7EB] text-slate-800'
                          }`}
                        />
                        <span className="text-[10px] text-slate-500">
                          Stock:{' '}
                          <span className={outOfStock ? 'text-red-600 font-semibold' : 'font-semibold text-slate-700'}>
                            {available}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-slate-900 align-middle">
                      ₹{amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-center align-middle">
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
            <p className="py-8 text-center text-slate-400 text-sm">Search and add medicines above. Use barcode scanner or type name.</p>
          )}
          {/* Removed \"Add more medicine\" button; use search/scan above to add items */}
        </div>
      </div>

      {/* Totals */}
      <div className="shrink-0 p-4 border-t border-[#E5E7EB] bg-[#F8FAFC] space-y-2">
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
            title={!hasActiveSession ? 'Start a cash session first (Cash & expenses → Start shift)' : !canCompleteSale && orderLines.length > 0 ? 'Reduce quantity to available stock or remove out-of-stock items' : ''}
          >
            {saving ? 'Processing…' : 'Complete sale & print bill'}
          </button>
        </div>
      </div>
    </form>
  )
}

function WalkInSaleForm({
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
  const [showCashTenderModal, setShowCashTenderModal] = useState(false)
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
      setShowCashTenderModal(true)
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
      const today = new Date().toISOString().slice(0, 10)
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
        date: today,
        branchName,
        lines: billLines,
        grossTotal: gross,
        discountAmount: disc > 0 ? disc : undefined,
        taxTotal: billTax,
        taxPercent,
        netTotal: net,
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
    tenderNotes: Record<string, number>,
    changeNotes: Record<string, number>,
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
          tenderNotes,
          changeNotes,
          changeGiven,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Sale failed')
      const branchName = selectedBranchName ?? branches.find((b) => b.id === pending.branchId)?.name ?? ''
      const today = new Date().toISOString().slice(0, 10)
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
        date: today,
        branchName,
        lines: billLines,
        grossTotal: gross,
        discountAmount: disc > 0 ? disc : undefined,
        taxTotal: billTax,
        taxPercent,
        netTotal: net,
      })
      setPendingDispensePayload(null)
      setShowCashTenderModal(false)
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
      <CashTenderModal
        isOpen={showCashTenderModal}
        onClose={() => { setShowCashTenderModal(false); setPendingDispensePayload(null) }}
        billAmount={pendingBillAmount}
        onConfirm={doDispenseWithCash}
      />
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
    </form>
  )
}

function TransferStockForm({
  branches,
  medicines,
  onSuccess,
  onError,
  getToken,
  hospitalId,
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

function ReceiveByFileForm({
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

export default function PharmacyManagement() {
  const { user: authUser } = useAuth()
  const pathname = usePathname()
  const isPharmacyPortal = pathname === '/pharmacy'
  const isAdmin = authUser?.role === 'admin'
  const { activeHospitalId, activeHospital, isSuperAdmin } = useMultiHospital()
  const portal = usePharmacyPortal()

  const [branchFilterLocal, setBranchFilterLocal] = useState<string>('all')
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [inventorySupplierFilter, setInventorySupplierFilter] = useState<string>('all')
  const [inventoryExpiryFilter, setInventoryExpiryFilter] = useState<'all' | 'expiring_soon' | 'expired'>('all')
  const [inventoryViewBatchesStock, setInventoryViewBatchesStock] = useState<BranchMedicineStock | null>(null)
  const [inventoryDetailView, setInventoryDetailView] = useState<{ stock: BranchMedicineStock; medicine: PharmacyMedicine | null } | null>(null)
  const [inventoryRowActionsOpen, setInventoryRowActionsOpen] = useState<string | null>(null)
  const [inventoryDeleteTarget, setInventoryDeleteTarget] = useState<BranchMedicineStock | null>(null)
  const [inventoryDeleteLoading, setInventoryDeleteLoading] = useState(false)
  const [branches, setBranchesState] = useState<Array<{ id: string; name: string }>>([])
  const branchFilter = isPharmacyPortal && portal ? portal.branchFilter : branchFilterLocal
  const setBranchFilter = isPharmacyPortal && portal ? (id: string) => portal.setBranchFilter(id) : setBranchFilterLocal

  const branchFilterRef = useRef(branchFilter)
  const portalRef = useRef(portal)
  branchFilterRef.current = branchFilter
  portalRef.current = portal

  const [subTabLocal, setSubTabLocal] = useState<PharmacySubTab>('queue')
  const subTab = (isPharmacyPortal && portal ? portal.activeTab : subTabLocal) as PharmacySubTab
  const headerSearchQuery = (isPharmacyPortal && portal ? portal.headerSearchQuery : '') || ''
  const setSubTab = (isPharmacyPortal && portal
    ? (id: PharmacySubTab) => portal.setActiveTab(id as PharmacyPortalTabId)
    : setSubTabLocal) as (id: PharmacySubTab) => void
  const [queueInnerTab, setQueueInnerTab] = useState<'walk_in' | 'prescriptions'>('walk_in')
  const [isQueueFullscreen, setIsQueueFullscreen] = useState(false)
  const queueFullscreenRef = useRef<HTMLDivElement>(null)
  const keepFullscreenAfterSaleRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [medicines, setMedicines] = useState<PharmacyMedicine[]>([])
  const [stock, setStock] = useState<BranchMedicineStock[]>([])
  const [suppliers, setSuppliers] = useState<PharmacySupplier[]>([])
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([])
  const [expiring, setExpiring] = useState<ExpiryAlert[]>([])
  const [inventoryHealthFilter, setInventoryHealthFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'dead_stock'>('all')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [dispenseQueueItem, setDispenseQueueItem] = useState<QueueItem | null>(null)
  const queuePosSearchRef = useRef<HTMLInputElement>(null)
  const [editMinLevelMedicine, setEditMinLevelMedicine] = useState<PharmacyMedicine | null>(null)
  const [sales, setSales] = useState<PharmacySale[]>([])
  const [transfers, setTransfers] = useState<StockTransfer[]>([])
  const [pharmacists, setPharmacists] = useState<Array<{ id: string; email: string; firstName: string; lastName: string; branchName: string }>>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PharmacyPurchaseOrder[]>([])
  const [receiveOrder, setReceiveOrder] = useState<PharmacyPurchaseOrder | null>(null)
  const [receiveDetailsForm, setReceiveDetailsForm] = useState<Array<{ batchNumber: string; expiryDate: string; manufacturingDate: string }>>([])
  const [receiveSupplierInvoice, setReceiveSupplierInvoice] = useState('')
  const [receiveSubmitting, setReceiveSubmitting] = useState(false)
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<PharmacyPurchaseOrder | null>(null)
  const [cancelOrderSubmitting, setCancelOrderSubmitting] = useState(false)
  const [pendingAddToOrder, setPendingAddToOrder] = useState<{ medicineId: string; medicineName: string; quantity: number; manufacturer?: string } | null>(null)
  const [addMedicineModalBarcode, setAddMedicineModalBarcode] = useState<string | null>(null)
  const [addSupplierModalOpen, setAddSupplierModalOpen] = useState(false)
  const [viewSupplier, setViewSupplier] = useState<PharmacySupplier | null>(null)
  const [editSupplier, setEditSupplier] = useState<PharmacySupplier | null>(null)
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('')
  const [analytics, setAnalytics] = useState<{
    totalMedicines: number
    totalStockItems: number
    lowStockCount: number
    expiringCount: number
    dailySalesTotal: number
    mostPrescribed: Array<{ medicineName: string; count: number }>
  } | null>(null)
  const [selectedReturnSale, setSelectedReturnSale] = useState<PharmacySale | null>(null)
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({})
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [showRefundPaymentModal, setShowRefundPaymentModal] = useState(false)
  const [pendingReturnPayload, setPendingReturnPayload] = useState<{
    saleId: string
    lines: { medicineId: string; quantity: number }[]
    refundAmount: number
  } | null>(null)
  const [refundPaymentMode, setRefundPaymentMode] = useState<'cash' | 'upi' | 'card' | 'other'>('cash')
  const [showRefundCashModal, setShowRefundCashModal] = useState(false)
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<PharmacySale | null>(null)
  const [salesSearch, setSalesSearch] = useState('')
  const [returnsSearch, setReturnsSearch] = useState('')
  const saleDetailRef = useRef<HTMLDivElement | null>(null)
  const [salesDate, setSalesDate] = useState<string>('')
  const [returnsDate, setReturnsDate] = useState<string>('')
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('all')
  const [returnsPaymentFilter, setReturnsPaymentFilter] = useState<string>('all')
  const [salesMinAmount, setSalesMinAmount] = useState<string>('')
  const [salesMaxAmount, setSalesMaxAmount] = useState<string>('')
  const [returnsMinAmount, setReturnsMinAmount] = useState<string>('')
  const [returnsMaxAmount, setReturnsMaxAmount] = useState<string>('')
  const [returnsInnerTab, setReturnsInnerTab] = useState<'by_sale' | 'by_return'>('by_sale')
  const [activeCashSession, setActiveCashSession] = useState<PharmacyCashSession | null>(null)
  const [recentCashSessions, setRecentCashSessions] = useState<PharmacyCashSession[]>([])
  const [cashSessionsLoading, setCashSessionsLoading] = useState(false)
  const [viewShiftReportSession, setViewShiftReportSession] = useState<PharmacyCashSession | null>(null)
  const [shiftReportExpenses, setShiftReportExpenses] = useState<PharmacyExpense[]>([])
  const [cashOpeningNotes, setCashOpeningNotes] = useState<Record<string, string>>({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
  const [cashClosingNotes, setCashClosingNotes] = useState<Record<string, string>>({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
  const openCounterSectionRef = useRef<HTMLDivElement>(null)
  const closeCounterSectionRef = useRef<HTMLDivElement>(null)
  const [highlightOpenCounter, setHighlightOpenCounter] = useState(false)
  const [highlightCloseCounter, setHighlightCloseCounter] = useState(false)
  const lastPreFilledSessionIdRef = useRef<string | null>(null)
  const [lastClosedSummary, setLastClosedSummary] = useState<{
    openingCashTotal: number
    closingCashTotal: number
    cashSales: number
    upiSales: number
    cardSales: number
    refunds: number
    cashExpenses: number
    profit: number
  } | null>(null)
  useEffect(() => {
    if (!highlightOpenCounter && !highlightCloseCounter) return
    const t = setTimeout(() => {
      setHighlightOpenCounter(false)
      setHighlightCloseCounter(false)
    }, 4000)
    return () => clearTimeout(t)
  }, [highlightOpenCounter, highlightCloseCounter])

  // Pre-fill close counter form with expected notes from runningNotes (from dispense/billing)
  useEffect(() => {
    const session = activeCashSession
    if (!session?.id || !session.runningNotes) return
    if (lastPreFilledSessionIdRef.current === session.id) return
    lastPreFilledSessionIdRef.current = session.id
    const denoms = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
    const next: Record<string, string> = {}
    denoms.forEach((d) => {
      const n = session.runningNotes![d]
      next[d] = n != null && n > 0 ? String(n) : ''
    })
    setCashClosingNotes(next)
  }, [activeCashSession?.id, activeCashSession?.runningNotes])

  useEffect(() => {
    if (!activeCashSession) lastPreFilledSessionIdRef.current = null
  }, [activeCashSession])

  const [expenseCategories, setExpenseCategories] = useState<import('@/types/pharmacy').PharmacyExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<import('@/types/pharmacy').PharmacyExpense[]>([])
  const [expenseFilters, setExpenseFilters] = useState<{ dateFrom: string; dateTo: string; categoryId: string; paymentMethod: string }>({
    dateFrom: '',
    dateTo: '',
    categoryId: 'all',
    paymentMethod: 'all',
  })
  const [expenseForm, setExpenseForm] = useState<{ date: string; amount: string; paymentMethod: string; note: string }>({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    paymentMethod: 'cash',
    note: '',
  })
  const [showExpenseCashModal, setShowExpenseCashModal] = useState(false)
  const [pendingExpensePayload, setPendingExpensePayload] = useState<{ amount: number; date: string; note: string; paymentMethod: string } | null>(null)
  const [openedByName, setOpenedByName] = useState<string>('')
  const [selectedCashierId, setSelectedCashierId] = useState<string>('')
  const [selectedCounterId, setSelectedCounterId] = useState<string>('')
  const [cashiers, setCashiers] = useState<PharmacyCashierProfile[]>([])
  const [counters, setCounters] = useState<PharmacyCounter[]>([])
  const [showCreateCashierModal, setShowCreateCashierModal] = useState(false)
  const [showCreateCounterModal, setShowCreateCounterModal] = useState(false)
  const [newCashier, setNewCashier] = useState<{ name: string; phone: string }>({ name: '', phone: '' })
  const [newCounterName, setNewCounterName] = useState<string>('')
  const [editingCashierId, setEditingCashierId] = useState<string | null>(null)
  const [editingCounterId, setEditingCounterId] = useState<string | null>(null)
  const [manageCashierCounterTab, setManageCashierCounterTab] = useState<'cashier' | 'counter'>('cashier')
  const [showCloseShiftConfirm, setShowCloseShiftConfirm] = useState(false)
  const [closedByName, setClosedByName] = useState<string>('')
  const [showAddPharmacistModal, setShowAddPharmacistModal] = useState(false)
  const [pharmacistForm, setPharmacistForm] = useState<{ firstName: string; lastName: string; email: string; password: string; branchId: string }>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    branchId: '',
  })

  const getSaleReturnedMap = useCallback((sale: PharmacySale) => {
    const map: Record<string, number> = {}
    if (!sale.returns) return map
    for (const ret of sale.returns) {
      for (const line of ret.lines || []) {
        const key = line.medicineId
        const qty = Number(line.quantity) || 0
        if (!qty) continue
        map[key] = (map[key] || 0) + qty
      }
    }
    return map
  }, [])

  const getToken = useCallback(async () => {
    const user = auth.currentUser
    if (!user) return null
    return user.getIdToken()
  }, [])

  useEffect(() => {
    const s = viewShiftReportSession
    if (!s?.branchId || !activeHospitalId) {
      setShiftReportExpenses([])
      return
    }
    let dateFrom = ''
    let dateTo = ''
    const opened = typeof s.openedAt === 'string' ? s.openedAt : (s.openedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
    const closed = s.closedAt && (typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.())
    if (opened) dateFrom = opened.slice(0, 10)
    if (closed) dateTo = closed.slice(0, 10)
    else dateTo = new Date().toISOString().slice(0, 10)
    if (!dateFrom) {
      setShiftReportExpenses([])
      return
    }
    getToken().then((token) => {
      if (!token) return
      const params = new URLSearchParams()
      params.set('hospitalId', activeHospitalId)
      params.set('branchId', s.branchId)
      params.set('dateFrom', dateFrom)
      params.set('dateTo', dateTo)
      fetch(`/api/pharmacy/expenses?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.expenses)) setShiftReportExpenses(data.expenses)
          else setShiftReportExpenses([])
        })
        .catch(() => setShiftReportExpenses([]))
    })
  }, [viewShiftReportSession, activeHospitalId, getToken])

  const fetchCashSessions = useCallback(async () => {
    setCashSessionsLoading(true)
    try {
      const token = await getToken()
      if (!token) return null
      const params = new URLSearchParams()
      if (activeHospitalId) params.set('hospitalId', activeHospitalId)
      if (branchFilter && branchFilter !== 'all') params.set('branchId', branchFilter)
      const res = await fetch(`/api/pharmacy/cash-session?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        console.warn('Failed to load cash sessions', { status: res.status, body: data })
        setActiveCashSession(null)
        return null
      }
      setActiveCashSession(data.activeSession ?? null)
      setRecentCashSessions(data.recentSessions ?? [])
      return data.activeSession ?? null
    } catch (e) {
      console.error(e)
      return null
    } finally {
      setCashSessionsLoading(false)
    }
  }, [getToken, activeHospitalId, branchFilter])

  const fetchExpensesAndCategories = useCallback(async () => {
    if (!activeHospitalId) return
    try {
      const token = await getToken()
      if (!token) return
      const params = new URLSearchParams()
      params.set('hospitalId', activeHospitalId)
      if (branchFilter && branchFilter !== 'all') params.set('branchId', branchFilter)
      if (expenseFilters.dateFrom) params.set('dateFrom', expenseFilters.dateFrom)
      if (expenseFilters.dateTo) params.set('dateTo', expenseFilters.dateTo)
      if (expenseFilters.categoryId !== 'all') params.set('categoryId', expenseFilters.categoryId)
      if (expenseFilters.paymentMethod !== 'all') params.set('paymentMethod', expenseFilters.paymentMethod)

      const [catRes, expRes] = await Promise.all([
        fetch(`/api/pharmacy/expenses/categories?hospitalId=${activeHospitalId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/pharmacy/expenses?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      const catData = await catRes.json().catch(() => ({}))
      const expData = await expRes.json().catch(() => ({}))
      if (catRes.ok && catData.success && Array.isArray(catData.categories)) {
        setExpenseCategories(catData.categories)
      }
      if (expRes.ok && expData.success && Array.isArray(expData.expenses)) {
        setExpenses(expData.expenses)
      }
    } catch (e) {
      // ignore for now; page will show empty state
    }
  }, [activeHospitalId, branchFilter, expenseFilters, getToken])

  const fetchCashiersAndCounters = useCallback(async () => {
    if (!activeHospitalId) return
    try {
      const token = await getToken()
      if (!token) return
      const params = new URLSearchParams()
      params.set('hospitalId', activeHospitalId)
      if (branchFilter && branchFilter !== 'all') params.set('branchId', branchFilter)
      const [cashiersRes, countersRes] = await Promise.all([
        fetch(`/api/pharmacy/cashiers?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/pharmacy/counters?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (cashiersRes.ok) {
        const data = await cashiersRes.json().catch(() => ({}))
        if (data.success && Array.isArray(data.cashiers)) {
          setCashiers(data.cashiers)
        }
      }
      if (countersRes.ok) {
        const data = await countersRes.json().catch(() => ({}))
        if (data.success && Array.isArray(data.counters)) {
          setCounters(data.counters)
        }
      }
    } catch {
      // ignore, UI will show empty dropdowns
    }
  }, [activeHospitalId, branchFilter, getToken])

  useEffect(() => {
    fetchCashiersAndCounters()
  }, [fetchCashiersAndCounters])

  const fetchBranches = useCallback(async () => {
    if (!activeHospitalId) return
    const token = await getToken()
    if (!token) return
    const res = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.success && data.branches) {
      const list = data.branches.map((b: Branch) => ({ id: b.id, name: b.name }))
      setBranchesState(list)
      const p = portalRef.current
      if (isPharmacyPortal && p) p.setBranches(list)
    }
  }, [activeHospitalId, getToken])

  const FETCH_PHARMACY_TIMEOUT_MS = 60000

  const fetchPharmacy = useCallback(async (silent = false) => {
    if (!activeHospitalId) {
      if (!silent) setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    setError(null)
    const token = await getToken()
    if (!token) {
      if (!silent) setLoading(false)
      return
    }
    const base = { headers: { Authorization: `Bearer ${token}` } }
    const hospitalQ = `hospitalId=${activeHospitalId}`
    const currentBranch = branchFilterRef.current
    const branchQ = currentBranch !== 'all' ? `&branchId=${currentBranch}` : ''

    const runFetches = async () => {
      const [medRes, stockRes, suppliersRes, alertsRes, queueRes, salesRes, analyticsRes, transfersRes, pharmacistsRes, ordersRes] = await Promise.all([
        fetch(`/api/pharmacy/medicines?${hospitalQ}`, base),
        fetch(`/api/pharmacy/stock?${hospitalQ}${branchQ}`, base),
        fetch(`/api/pharmacy/suppliers?${hospitalQ}`, base),
        fetch(`/api/pharmacy/alerts?${hospitalQ}${branchQ}`, base),
        fetch(`/api/pharmacy/prescription-queue?${hospitalQ}${branchQ}`, base),
        fetch(`/api/pharmacy/sales?${hospitalQ}${branchQ}`, base),
        fetch(`/api/pharmacy/analytics?${hospitalQ}${branchQ}`, base),
        isSuperAdmin ? fetch(`/api/pharmacy/transfers?${hospitalQ}`, base) : Promise.resolve(null),
        isAdmin ? fetch('/api/admin/pharmacists', base) : Promise.resolve(null),
        fetch(`/api/pharmacy/purchase-orders?${hospitalQ}${branchQ}`, base),
      ])

      if (medRes.ok) {
        const d = await medRes.json()
        if (d.success) setMedicines(d.medicines || [])
      }
      if (stockRes.ok) {
        const d = await stockRes.json()
        if (d.success) setStock(d.stock || [])
      }
      if (suppliersRes.ok) {
        const d = await suppliersRes.json()
        if (d.success) setSuppliers(d.suppliers || [])
      }
      if (alertsRes.ok) {
        const d = await alertsRes.json()
        if (d.success) {
          setLowStock(d.lowStock || [])
          setExpiring(d.expiring || [])
          const p = portalRef.current
          if (isPharmacyPortal && p) p.setAlertCounts((d.lowStock || []).length, (d.expiring || []).length)
        }
      }
      if (queueRes.ok) {
        const d = await queueRes.json()
        if (d.success) setQueue(d.queue || [])
      }
      if (salesRes.ok) {
        const d = await salesRes.json()
        if (d.success) setSales(d.sales || [])
      }
      if (analyticsRes.ok) {
        const d = await analyticsRes.json()
        if (d.success && d.analytics) setAnalytics(d.analytics)
      }
      if (transfersRes?.ok) {
        const d = await transfersRes.json()
        if (d.success) setTransfers(d.transfers || [])
      }
      if (pharmacistsRes?.ok) {
        const d = await pharmacistsRes.json()
        if (d.success) setPharmacists(d.pharmacists || [])
      }
      if (ordersRes?.ok) {
        const d = await ordersRes.json()
        if (d.success) setPurchaseOrders(d.orders || [])
      }
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), FETCH_PHARMACY_TIMEOUT_MS)
    })

    try {
      await Promise.race([runFetches(), timeoutPromise])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load pharmacy data'
      if (msg.includes('Request timed out') && isPharmacyPortal) {
        console.warn('Pharmacy portal initial load timed out; showing partial data.')
      } else {
        setError(msg)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [activeHospitalId, isSuperAdmin, isAdmin, getToken])

  const submitReturn = useCallback(
    async (mode: 'cash' | 'upi' | 'card' | 'other', notes?: Record<string, number>) => {
      if (!pendingReturnPayload) return
      setReturnSubmitting(true)
      setError(null)
      try {
        const token = await getToken()
        if (!token) throw new Error('Not authenticated')
        const res = await fetch('/api/pharmacy/sales/return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            saleId: pendingReturnPayload.saleId,
            lines: pendingReturnPayload.lines,
            refundPaymentMode: mode,
            ...(mode === 'cash' && notes && Object.keys(notes).length > 0 && { refundNotes: notes }),
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) throw new Error(data.error || 'Sales return failed')
        setSuccess('Sales return recorded and stock updated.')
        setReturnQuantities({})
        setSelectedReturnSale(null)
        setPendingReturnPayload(null)
        setShowRefundPaymentModal(false)
        setShowRefundCashModal(false)
        await fetchPharmacy(true)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Sales return failed')
      } finally {
        setReturnSubmitting(false)
      }
    },
    [pendingReturnPayload, getToken, fetchPharmacy]
  )

  const hasLoadedOnceRef = useRef(false)
  useEffect(() => {
    fetchBranches()
  }, [fetchBranches])

  useEffect(() => {
    const isInitial = !hasLoadedOnceRef.current
    if (isInitial) hasLoadedOnceRef.current = true
    fetchPharmacy(isInitial ? false : true)
    fetchCashSessions()
    if (subTab === 'cash_and_expenses') {
      fetchExpensesAndCategories()
    }
  }, [fetchPharmacy, fetchCashSessions, fetchExpensesAndCategories, branchFilter, subTab])

  type RecordPeriod = 'weekly' | 'monthly' | 'six_months' | 'year' | 'all'
  const [recordPeriod, setRecordPeriod] = useState<RecordPeriod>('monthly')
  const toDate = (v: unknown): Date | null => {
    if (v == null) return null
    if (typeof v === 'string') return new Date(v)
    const d = (v as { toDate?: () => Date })?.toDate?.()
    return d ? new Date(d) : null
  }
  const { salesRecordTotal, purchaseRecordTotal } = useMemo(() => {
    const now = Date.now()
    const periodMs: Record<RecordPeriod, number | null> = {
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
      six_months: 180 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
      all: null,
    }
    const cutoff = periodMs[recordPeriod] ? now - periodMs[recordPeriod]! : 0
    const salesFiltered = (branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter))
      .filter((s) => {
        const d = toDate(s.dispensedAt)
        return d && (recordPeriod === 'all' || d.getTime() >= cutoff)
      })
    const ordersFiltered = (branchFilter === 'all' ? purchaseOrders : purchaseOrders.filter((o) => o.branchId === branchFilter))
      .filter((o) => {
        const d = toDate(o.createdAt)
        return d && (recordPeriod === 'all' || d.getTime() >= cutoff)
      })
    const salesTotal = salesFiltered.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0)
    const purchaseTotal = ordersFiltered.reduce((sum, o) => sum + (Number(o.totalCost) || 0), 0)
    return { salesRecordTotal: salesTotal, purchaseRecordTotal: purchaseTotal }
  }, [recordPeriod, branchFilter, sales, purchaseOrders])

  /** Last 7 days sales for bar chart (by day) */
  const last7DaysSales = useMemo(() => {
    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000
    const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    return [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      start.setTime(start.getTime() - daysAgo * dayMs)
      const end = new Date(start.getTime() + dayMs)
      const dayTotal = salesFiltered.reduce((sum, s) => {
        const d = toDate(s.dispensedAt)
        if (!d || d < start || d >= end) return sum
        return sum + (Number(s.totalAmount) || 0)
      }, 0)
      return { label: start.toLocaleDateString('en-IN', { weekday: 'short' }), value: dayTotal }
    })
  }, [branchFilter, sales])

  /** Pie chart segments: Purchases, Suppliers, Sales, No Sales (reference design) */
  const pieChartData = useMemo(() => {
    const salesVal = salesRecordTotal || 0
    const purchaseVal = purchaseRecordTotal || 0
    const suppliersVal = Math.max(suppliers.length * 5000, 0)
    const noSalesVal = Math.max(10000 - salesVal - purchaseVal - suppliersVal, 0)
    const total = salesVal + purchaseVal + suppliersVal + noSalesVal
    return [
      { label: 'Purchases', value: purchaseVal, color: '#5EEAD4' },
      { label: 'Suppliers', value: suppliersVal, color: '#86EFAC' },
      { label: 'Sales', value: salesVal, color: '#F9A8D4' },
      { label: 'No Sales', value: noSalesVal, color: '#E5E7EB' },
    ].map((s) => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 25 }))
  }, [salesRecordTotal, purchaseRecordTotal, suppliers.length])

  /** Overview dashboard date range: today, 7d, 30d, 6m, year, all */
  type OverviewDateRange = 'today' | '7d' | '30d' | '6m' | 'year' | 'all'
  const [overviewDateRange, setOverviewDateRange] = useState<OverviewDateRange>('7d')

  /** Period sales total for the selected range (drives Sales card and updates with date filter) */
  const periodSalesTotal = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const cutoffMs: Record<OverviewDateRange, number | null> = {
      today: dayMs,
      '7d': 7 * dayMs,
      '30d': 30 * dayMs,
      '6m': 180 * dayMs,
      year: 365 * dayMs,
      all: null,
    }
    const cutoff = cutoffMs[overviewDateRange]
    const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    return salesFiltered.reduce((sum, s) => {
      const d = toDate(s.dispensedAt)
      if (!d) return sum
      if (cutoff !== null && now - d.getTime() > cutoff) return sum
      return sum + (Number(s.totalAmount) || 0)
    }, 0)
  }, [overviewDateRange, branchFilter, sales])

  /** Period refund total for selected range (sum of refundedAmount on matching sales) */
  const periodRefundTotal = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const cutoffMs: Record<OverviewDateRange, number | null> = {
      today: dayMs,
      '7d': 7 * dayMs,
      '30d': 30 * dayMs,
      '6m': 180 * dayMs,
      year: 365 * dayMs,
      all: null,
    }
    const cutoff = cutoffMs[overviewDateRange]
    const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    return salesFiltered.reduce((sum, s) => {
      const d = toDate(s.dispensedAt)
      if (!d) return sum
      if (cutoff !== null && now - d.getTime() > cutoff) return sum
      return sum + (Number(s.refundedAmount) || 0)
    }, 0)
  }, [overviewDateRange, branchFilter, sales])

  /** Period sales count (number of bills) for the selected range */
  const periodSalesCount = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const cutoffMs: Record<OverviewDateRange, number | null> = {
      today: dayMs,
      '7d': 7 * dayMs,
      '30d': 30 * dayMs,
      '6m': 180 * dayMs,
      year: 365 * dayMs,
      all: null,
    }
    const cutoff = cutoffMs[overviewDateRange]
    const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    return salesFiltered.filter((s) => {
      const d = toDate(s.dispensedAt)
      if (!d) return false
      if (cutoff !== null && now - d.getTime() > cutoff) return false
      return true
    }).length
  }, [overviewDateRange, branchFilter, sales])

  /** Sales trend for line chart: daily for 7d/30d, monthly for 6m/year/all */
  const salesTrendData = useMemo(() => {
    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000
    const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)

    if (overviewDateRange === 'today' || overviewDateRange === '7d' || overviewDateRange === '30d') {
      const days = overviewDateRange === 'today' ? 1 : overviewDateRange === '7d' ? 7 : 30
      return Array.from({ length: days }, (_, i) => days - 1 - i).map((daysAgo) => {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        start.setTime(start.getTime() - daysAgo * dayMs)
        const end = new Date(start.getTime() + dayMs)
        const dayTotal = salesFiltered.reduce((sum, s) => {
          const d = toDate(s.dispensedAt)
          if (!d || d < start || d >= end) return sum
          return sum + (Number(s.totalAmount) || 0)
        }, 0)
        return {
          date: start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          value: dayTotal,
          fullDate: start.toISOString().slice(0, 10),
        }
      })
    }

    // 6m = 6 months, year = 12 months, all = last 12 months
    const monthsCount = overviewDateRange === '6m' ? 6 : overviewDateRange === 'year' ? 12 : 12
    const result: { date: string; value: number; fullDate: string }[] = []
    for (let i = monthsCount - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0)
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999)
      const monthTotal = salesFiltered.reduce((sum, s) => {
        const d = toDate(s.dispensedAt)
        if (!d || d < monthStart || d > monthEnd) return sum
        return sum + (Number(s.totalAmount) || 0)
      }, 0)
      result.push({
        date: monthStart.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        value: monthTotal,
        fullDate: monthStart.toISOString().slice(0, 7),
      })
    }
    return result
  }, [overviewDateRange, branchFilter, sales])

  /** Medicine category distribution for donut (Tablets, Capsules, etc.) */
  const categoryDistribution = useMemo(() => {
    const categoryList = ['Tablets', 'Capsules', 'Syrups', 'Injections', 'Ointments', 'Drops']
    const branchStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    const medicineIds = new Set(branchStock.map((s) => s.medicineId))
    const map = new Map<string, number>()
    categoryList.forEach((c) => map.set(c, 0))
    map.set('Other', 0)
    medicines.forEach((m) => {
      if (!medicineIds.has(m.medicineId ?? m.id)) return
      const cat = (m as PharmacyMedicine & { category?: string }).category || ''
      const normalized = categoryList.find((c) => c.toLowerCase() === (cat || '').toLowerCase()) || 'Other'
      map.set(normalized, (map.get(normalized) ?? 0) + 1)
    })
    const colors = ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#E5E7EB']
    return Array.from(map.entries())
      .filter(([, count]) => count > 0)
      .map(([name, count], i) => ({
        name,
        count,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.count - a.count)
  }, [medicines, stock, branchFilter])

  /** Category donut percentages */
  const categoryDonutData = useMemo(() => {
    const total = categoryDistribution.reduce((s, c) => s + c.count, 0)
    if (total === 0) {
      return [{ name: 'No data', count: 1, pct: 100, color: '#E5E7EB' }]
    }
    return categoryDistribution.map((c) => ({ ...c, pct: (c.count / total) * 100 }))
  }, [categoryDistribution])

  /** Inventory health: In Stock, Low Stock, Out of Stock, Expiring Soon, Dead Stock */
  const inventoryHealthCounts = useMemo(() => {
    const branchStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    let inStock = 0
    let lowStockCount = 0
    let outOfStock = 0
    let deadStock = 0
    const deadStockIds: string[] = []

    // Build map of medicineId -> total quantity sold in last 90 days
    const now = new Date()
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const salesInWindow = sales.filter((sale) => {
      const dRaw = sale.dispensedAt
      if (!dRaw) return false
      const d = typeof dRaw === 'string' ? new Date(dRaw) : (dRaw as any)?.toDate?.() ?? null
      if (!d) return false
      return d >= cutoff && d <= now
    })
    const soldMap = new Map<string, number>()
    salesInWindow.forEach((sale) => {
      const lines = sale.lines || []
      lines.forEach((l) => {
        const id = l.medicineId || l.medicineName || ''
        if (!id) return
        const qty = Number(l.quantity) || 0
        if (qty <= 0) return
        soldMap.set(id, (soldMap.get(id) || 0) + qty)
      })
    })

    // Determine threshold for "dead stock" – lowest 20% of sold quantities (excluding zero)
    const soldValues = Array.from(soldMap.values()).filter((v) => v > 0).sort((a, b) => a - b)
    const threshold = soldValues.length > 0 ? soldValues[Math.floor(soldValues.length * 0.2)] || soldValues[0] : 0

    branchStock.forEach((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const min = med?.minStockLevel ?? 0
      const qty = s.totalQuantity ?? 0
      const soldQty = soldMap.get(s.medicineId || s.medicineName || '') || 0

      if (qty <= 0) {
        outOfStock += 1
      } else if (min > 0 && qty < min) {
        lowStockCount += 1
      } else {
        inStock += 1
        if (threshold > 0 && soldQty > 0 && soldQty <= threshold) {
          deadStock += 1
          if (s.medicineId) deadStockIds.push(s.medicineId)
        }
      }
    })

    const expiringCount = branchFilter === 'all'
      ? expiring.length
      : expiring.filter((e) => e.branchId === branchFilter).length

    return {
      inStock,
      lowStock: lowStockCount,
      outOfStock,
      expiringSoon: expiringCount,
      deadStock,
      deadStockIds,
    }
  }, [stock, medicines, branchFilter, expiring, sales])

  const inventoryHealthItems = useMemo(() => {
    if (inventoryHealthFilter === 'all') return []
    const branchStock = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    const deadIds = new Set<string>(inventoryHealthCounts.deadStockIds || [])

    return branchStock
      .map((s) => {
        const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
        const min = med?.minStockLevel ?? 0
        const qty = s.totalQuantity ?? 0
        const branchName = branches.find((b) => b.id === s.branchId)?.name ?? s.branchId
        const nearestExpiry = getNearestExpiry(s)
        const daysLeft = nearestExpiry ? daysUntilExpiryForBatch(nearestExpiry) : null
        const hasExpiring = expiring.some((e) => e.medicineId === s.medicineId && e.branchId === s.branchId)

        let category: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'dead_stock' = 'in_stock'
        if (qty <= 0) category = 'out_of_stock'
        else if (min > 0 && qty < min) category = 'low_stock'
        else if (hasExpiring) category = 'expiring_soon'
        else if (deadIds.has(s.medicineId)) category = 'dead_stock'

        return {
          id: s.id,
          medicineName: s.medicineName || med?.name || s.medicineId,
          branchName,
          qty,
          minLevel: min,
          nearestExpiry,
          daysLeft,
          category,
        }
      })
      .filter((row) => row.category === inventoryHealthFilter)
  }, [inventoryHealthFilter, stock, medicines, branches, branchFilter, expiring, inventoryHealthCounts.deadStockIds])

  // Auto-scroll sales detail into view when selection changes
  useEffect(() => {
    if (!selectedSaleDetail) return
    if (!saleDetailRef.current) return
    // Small timeout to ensure layout has rendered before scrolling
    const id = window.setTimeout(() => {
      saleDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => window.clearTimeout(id)
  }, [selectedSaleDetail])

  // Filtered sales for search + branch
  const filteredSales = useMemo(() => {
    const base = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    const term = salesSearch.trim().toLowerCase()
    return base.filter((s) => {
      // Date filter (single specific date)
      if (salesDate) {
        const raw = s.dispensedAt
        const d =
          typeof raw === 'string'
            ? new Date(raw)
            : (raw as { toDate?: () => Date })?.toDate?.() ?? null
        if (!d) return false
        const selected = new Date(salesDate)
        d.setHours(0, 0, 0, 0)
        selected.setHours(0, 0, 0, 0)
        if (d.getTime() !== selected.getTime()) return false
      }
      // Payment mode filter
      if (salesPaymentFilter !== 'all') {
        const mode = (s.paymentMode || 'unknown').toString()
        if (mode !== salesPaymentFilter) return false
      }
      // Amount range filter – use net if available
      if (salesMinAmount || salesMaxAmount) {
        const amt = Number(s.netAmount ?? s.totalAmount ?? 0)
        if (salesMinAmount && amt < Number(salesMinAmount)) return false
        if (salesMaxAmount && amt > Number(salesMaxAmount)) return false
      }
      if (!term) return true
      const invoice = (s.invoiceNumber || '').toString().toLowerCase()
      const name = (s.patientName || '').toLowerCase()
      const phone = (s.customerPhone || '').toLowerCase()
      const meds = (s.lines || []).map((l) => l.medicineName).join(' ').toLowerCase()
      return invoice.includes(term) || name.includes(term) || phone.includes(term) || meds.includes(term)
    })
  }, [sales, branchFilter, salesSearch, salesDate, salesPaymentFilter, salesMinAmount, salesMaxAmount])

  const {
    currentPage: salesPage,
    pageSize: salesPageSize,
    totalPages: salesTotalPages,
    paginatedItems: paginatedSales,
    goToPage: goToSalesPage,
    setPageSize: setSalesPageSize,
  } = useTablePagination(filteredSales, { initialPageSize: 10 })

  // Daily income & expense for Cash & Expenses tab (today only)
  const dailySummary = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const baseSales = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    const todaySalesTotal = baseSales.reduce((sum, s) => {
      const raw = s.dispensedAt
      const d =
        typeof raw === 'string'
          ? new Date(raw)
          : (raw as { toDate?: () => Date })?.toDate?.() ?? null
      if (!d) return sum
      const saleDateStr = d.toISOString().slice(0, 10)
      if (saleDateStr !== todayStr) return sum
      return sum + Number(s.netAmount ?? s.totalAmount ?? 0)
    }, 0)
    const todayExpenseTotal = expenses.reduce((sum, e) => {
      const dateStr = typeof e.date === 'string' ? e.date.slice(0, 10) : (e.date as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? ''
      if (dateStr !== todayStr) return sum
      return sum + Number(e.amount ?? 0)
    }, 0)
    return { todayStr, todaySalesTotal, todayExpenseTotal, net: todaySalesTotal - todayExpenseTotal }
  }, [sales, expenses, branchFilter])

  // Filtered sales for returns tab (can share logic, separate search term)
  const filteredReturnSales = useMemo(() => {
    const base = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    const term = returnsSearch.trim().toLowerCase()
    return base.filter((s) => {
      // Date filter (single specific date)
      if (returnsDate) {
        const raw = s.dispensedAt
        const d =
          typeof raw === 'string'
            ? new Date(raw)
            : (raw as { toDate?: () => Date })?.toDate?.() ?? null
        if (!d) return false
        const selected = new Date(returnsDate)
        d.setHours(0, 0, 0, 0)
        selected.setHours(0, 0, 0, 0)
        if (d.getTime() !== selected.getTime()) return false
      }
      // Payment mode filter
      if (returnsPaymentFilter !== 'all') {
        const mode = (s.paymentMode || 'unknown').toString()
        if (mode !== returnsPaymentFilter) return false
      }
      // Amount range filter – use net if available
      if (returnsMinAmount || returnsMaxAmount) {
        const amt = Number(s.netAmount ?? s.totalAmount ?? 0)
        if (returnsMinAmount && amt < Number(returnsMinAmount)) return false
        if (returnsMaxAmount && amt > Number(returnsMaxAmount)) return false
      }
      if (!term) return true
      const invoice = (s.invoiceNumber || '').toString().toLowerCase()
      const name = (s.patientName || '').toLowerCase()
      const phone = (s.customerPhone || '').toLowerCase()
      const meds = (s.lines || []).map((l) => l.medicineName).join(' ').toLowerCase()
      return invoice.includes(term) || name.includes(term) || phone.includes(term) || meds.includes(term)
    })
  }, [sales, branchFilter, returnsSearch, returnsDate, returnsPaymentFilter, returnsMinAmount, returnsMaxAmount])

  const totalRefundForFilteredSales = useMemo(
    () => filteredReturnSales.reduce((sum, s) => sum + (Number(s.refundedAmount) || 0), 0),
    [filteredReturnSales],
  )

  const returnEvents = useMemo(() => {
    const base = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    const events: Array<{
      id: string
      saleId: string
      invoice: string
      patientName: string
      phone: string
      createdAt: Date | null
      amount: number
      paymentMode: string | null
      lines: Array<{
        medicineId: string
        medicineName: string
        quantity: number
        unitPrice: number
      }>
    }> = []
    base.forEach((s) => {
      if (!s.returns || s.returns.length === 0) return
      const saleLineMap = new Map<string, { medicineName: string; unitPrice: number }>()
      ;(s.lines || []).forEach((l) => saleLineMap.set(l.medicineId, { medicineName: l.medicineName, unitPrice: l.unitPrice }))
      s.returns.forEach((r) => {
        const createdAt = toDate(r.createdAt)
        events.push({
          id: r.id,
          saleId: s.id,
          invoice: s.invoiceNumber || s.id,
          patientName: s.patientName || 'Walk-in',
          phone: s.customerPhone || '',
          createdAt,
          amount: Number(r.amount) || 0,
          paymentMode: (s.paymentMode as string) || null,
          lines: (r.lines || []).map((rl) => {
            const baseLine = saleLineMap.get(rl.medicineId)
            return {
              medicineId: rl.medicineId,
              medicineName: baseLine?.medicineName || '',
              quantity: rl.quantity,
              unitPrice: baseLine?.unitPrice ?? 0,
            }
          }),
        })
      })
    })
    events.sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0
      if (!a.createdAt) return 1
      if (!b.createdAt) return -1
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
    return events
  }, [sales, branchFilter])

  const {
    currentPage: returnsPage,
    pageSize: returnsPageSize,
    totalPages: returnsTotalPages,
    paginatedItems: paginatedReturnSales,
    goToPage: goToReturnsPage,
    setPageSize: setReturnsPageSize,
  } = useTablePagination(filteredReturnSales, { initialPageSize: 10 })

  /** Purchase order status counts */
  const poStatusCounts = useMemo(() => {
    const list = branchFilter === 'all' ? purchaseOrders : purchaseOrders.filter((o) => o.branchId === branchFilter)
    const pending = list.filter((o) => (o.status ?? '').toLowerCase() === 'pending').length
    const received = list.filter((o) => (o.status ?? '').toLowerCase() === 'received').length
    const cancelled = list.filter((o) => (o.status ?? '').toLowerCase() === 'cancelled').length
    return { pending, received, cancelled }
  }, [branchFilter, purchaseOrders])

  const ordersForTable = useMemo(
    () => (branchFilter === 'all' ? purchaseOrders : purchaseOrders.filter((o) => o.branchId === branchFilter)),
    [purchaseOrders, branchFilter],
  )

  const {
    currentPage: ordersPage,
    pageSize: ordersPageSize,
    totalPages: ordersTotalPages,
    paginatedItems: paginatedOrders,
    goToPage: goToOrdersPage,
    setPageSize: setOrdersPageSize,
  } = useTablePagination(ordersForTable, { initialPageSize: 10 })

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearchQuery.trim().toLowerCase()
    let filtered = q
      ? suppliers.filter(
          (s) =>
            s.name?.toLowerCase().includes(q) ||
            s.contactPerson?.toLowerCase().includes(q) ||
            s.email?.toLowerCase().includes(q) ||
            s.phone?.includes(q),
        )
      : suppliers
    if (isPharmacyPortal && headerSearchQuery.trim()) {
      const hq = headerSearchQuery.trim().toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.name?.toLowerCase().includes(hq) ||
          s.contactPerson?.toLowerCase().includes(hq) ||
          s.email?.toLowerCase().includes(hq) ||
          s.phone?.includes(hq),
      )
    }
    return filtered
  }, [suppliers, supplierSearchQuery, isPharmacyPortal, headerSearchQuery])

  const {
    currentPage: supplierPage,
    pageSize: supplierPageSize,
    totalPages: supplierTotalPages,
    paginatedItems: paginatedSuppliers,
    goToPage: goToSupplierPage,
    setPageSize: setSupplierPageSize,
  } = useTablePagination(filteredSuppliers, { initialPageSize: 10 })

  // simple keyframes for row expand animation (fade + slight slide)
  const expandStyle = `
    @keyframes fadeExpand {
      0% { opacity: 0; transform: translateY(-4px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `

  const paymentModeSummary = useMemo(() => {
    const base = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    const summary: Record<string, { count: number; amount: number }> = {}
    base.forEach((s) => {
      const mode = (s.paymentMode || 'unknown') as string
      if (!summary[mode]) summary[mode] = { count: 0, amount: 0 }
      summary[mode].count += 1
      summary[mode].amount += Number(s.totalAmount) || 0
    })
    return summary
  }, [sales, branchFilter])

  /** Top selling medicines (top 8) for bar chart */
  const topSellingMedicines = useMemo(() => {
    const list = analytics?.mostPrescribed || []
    return list.slice(0, 8).map((m) => ({ name: m.medicineName || '—', count: m.count || 0 }))
  }, [analytics?.mostPrescribed])

  const [overviewRecentSalesSearch, setOverviewRecentSalesSearch] = useState('')
  const recentSalesFiltered = useMemo(() => {
    const list = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    if (!overviewRecentSalesSearch.trim()) return list.slice(0, 10)
    const q = overviewRecentSalesSearch.toLowerCase()
    return list.filter((s) => {
      const name = (s.patientName ?? '').toLowerCase()
      const meds = (s.lines?.map((l) => l.medicineName).join(' ') ?? '').toLowerCase()
      const phone = (s.customerPhone ?? '').toLowerCase()
      return name.includes(q) || meds.includes(q) || phone.includes(q)
    }).slice(0, 10)
  }, [branchFilter, sales, overviewRecentSalesSearch])

  type ReportType = 'expiry' | 'valuation' | 'sales' | 'over_under' | 'reorder' | 'stock_sold'
  const [reportType, setReportType] = useState<ReportType>('expiry')
  const [expiryReportDays, setExpiryReportDays] = useState<30 | 60 | 90>(30)
  const [stockSoldReportPeriod, setStockSoldReportPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day')
  const reportPrintRef = useRef<HTMLDivElement>(null)

  const daysUntilExpiry = (expiryStr: string) => {
    const exp = new Date(expiryStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    exp.setHours(0, 0, 0, 0)
    return Math.ceil((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  }

  const expiryReportRows = useMemo(() => {
    const st = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    const rows: { branchName: string; medicineName: string; batchNumber: string; expiryDate: string; quantity: number; daysLeft: number }[] = []
    st.forEach((s) => {
      const branchName = branches.find((b) => b.id === s.branchId)?.name ?? s.branchId
      const batches = Array.isArray((s as BranchMedicineStock).batches) ? (s as BranchMedicineStock).batches : []
      batches.forEach((b: { batchNumber?: string; expiryDate?: string; quantity?: number }) => {
        const exp = (b.expiryDate || '').slice(0, 10)
        if (!exp) return
        const qty = Number(b.quantity) || 0
        if (qty <= 0) return
        const days = daysUntilExpiry(exp)
        if (days <= expiryReportDays) {
          rows.push({
            branchName,
            medicineName: s.medicineName || s.medicineId,
            batchNumber: b.batchNumber || '—',
            expiryDate: exp,
            quantity: qty,
            daysLeft: days,
          })
        }
      })
    })
    rows.sort((a, b) => a.daysLeft - b.daysLeft)
    return rows
  }, [stock, branchFilter, branches, expiryReportDays])

  const valuationReportRows = useMemo(() => {
    const st = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    const byBranch = new Map<string, { cost: number; selling: number; items: number }>()
    st.forEach((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const cost = Number(med?.purchasePrice) ?? 0
      const selling = Number(med?.sellingPrice) ?? 0
      const qty = Number(s.totalQuantity) ?? 0
      const key = s.branchId
      const cur = byBranch.get(key) ?? { cost: 0, selling: 0, items: 0 }
      byBranch.set(key, {
        cost: cur.cost + cost * qty,
        selling: cur.selling + selling * qty,
        items: cur.items + 1,
      })
    })
    return Array.from(byBranch.entries()).map(([branchId, v]) => ({
      branchName: branches.find((b) => b.id === branchId)?.name ?? branchId,
      branchId,
      totalCost: v.cost,
      totalSelling: v.selling,
      itemCount: v.items,
    }))
  }, [stock, medicines, branchFilter, branches])

  const salesByProductRows = useMemo(() => {
    const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    const map = new Map<string, { name: string; quantity: number; amount: number }>()
    salesFiltered.forEach((s) => {
      (s.lines || []).forEach((l: { medicineId?: string; medicineName?: string; quantity?: number; unitPrice?: number }) => {
        const id = l.medicineId || ''
        const name = l.medicineName || id
        const qty = Number(l.quantity) || 0
        const amt = qty * (Number(l.unitPrice) || 0)
        const cur = map.get(id) ?? { name, quantity: 0, amount: 0 }
        map.set(id, { name: cur.name || name, quantity: cur.quantity + qty, amount: cur.amount + amt })
      })
    })
    return Array.from(map.entries())
      .map(([id, v]) => ({ medicineId: id, medicineName: v.name, quantity: v.quantity, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [sales, branchFilter])

  const salesByBranchRows = useMemo(() => {
    const salesFiltered = branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter)
    const map = new Map<string, { count: number; amount: number }>()
    salesFiltered.forEach((s) => {
      const bid = s.branchId || ''
      const cur = map.get(bid) ?? { count: 0, amount: 0 }
      map.set(bid, { count: cur.count + 1, amount: cur.amount + (Number(s.totalAmount) || 0) })
    })
    return Array.from(map.entries()).map(([branchId, v]) => ({
      branchId,
      branchName: branches.find((b) => b.id === branchId)?.name ?? branchId,
      saleCount: v.count,
      totalAmount: v.amount,
    })).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [sales, branchFilter, branches])

  const overUnderStockRows = useMemo(() => {
    const st = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    const under: { branchName: string; medicineName: string; current: number; min: number; status: string }[] = []
    const over: { branchName: string; medicineName: string; current: number; min: number; status: string }[] = []
    st.forEach((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const min = Number(med?.minStockLevel) ?? 0
      const current = Number(s.totalQuantity) ?? 0
      const branchName = branches.find((b) => b.id === s.branchId)?.name ?? s.branchId
      if (min > 0 && current < min) {
        under.push({ branchName, medicineName: s.medicineName || s.medicineId, current, min, status: 'Under stock' })
      } else if (min > 0 && current > min * 2) {
        over.push({ branchName, medicineName: s.medicineName || s.medicineId, current, min, status: 'Over stock' })
      }
    })
    return { under, over, all: [...under, ...over] }
  }, [stock, medicines, branchFilter, branches])

  const reorderSuggestionsRows = useMemo(() => {
    const now = Date.now()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const cutoff = now - thirtyDaysMs
    const salesFiltered = (branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter))
      .filter((s) => {
        const d = toDate(s.dispensedAt)
        return d && d.getTime() >= cutoff
      })
    const consumptionByBranchMed = new Map<string, number>()
    salesFiltered.forEach((s) => {
      const bid = s.branchId || ''
      ;(s.lines || []).forEach((l: { medicineId?: string; quantity?: number }) => {
        const mid = l.medicineId || ''
        if (!mid) return
        const key = `${bid}|${mid}`
        const qty = Number(l.quantity) || 0
        consumptionByBranchMed.set(key, (consumptionByBranchMed.get(key) || 0) + qty)
      })
    })
    const st = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    const rows: { branchName: string; medicineName: string; current: number; min: number; sold30d: number; suggestedQty: number }[] = []
    st.forEach((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const min = Number(med?.minStockLevel) ?? 0
      const current = Number(s.totalQuantity) ?? 0
      if (min <= 0 || current >= min) return
      const key = `${s.branchId}|${s.medicineId}`
      const sold30d = consumptionByBranchMed.get(key) || 0
      const reorderQty = Number(med?.reorderQuantity) ?? 0
      const toMin = min - current
      const suggestedQty = Math.max(toMin, reorderQty > 0 ? reorderQty : 1, sold30d > 0 ? Math.ceil(sold30d * 1.2) : 1)
      rows.push({
        branchName: branches.find((b) => b.id === s.branchId)?.name ?? s.branchId,
        medicineName: s.medicineName || s.medicineId,
        current,
        min,
        sold30d,
        suggestedQty,
      })
    })
    rows.sort((a, b) => a.current - b.current)
    return rows
  }, [stock, medicines, sales, branchFilter, branches, toDate])

  const stockSoldReportData = useMemo(() => {
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()
    let periodStartMs = startOfTodayMs
    if (stockSoldReportPeriod === 'day') periodStartMs = startOfTodayMs
    else if (stockSoldReportPeriod === 'week') periodStartMs = now - 7 * oneDayMs
    else if (stockSoldReportPeriod === 'month') periodStartMs = now - 30 * oneDayMs
    else if (stockSoldReportPeriod === 'year') periodStartMs = now - 365 * oneDayMs

    const salesFiltered = (branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter))
      .filter((s) => {
        const d = toDate(s.dispensedAt)
        return d && d.getTime() >= periodStartMs
      })
    const soldAmount = salesFiltered.reduce((sum, s) => sum + (Number(s.netAmount ?? s.totalAmount) ?? 0), 0)
    const soldCount = salesFiltered.length

    const st = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    let totalStockValue = 0
    st.forEach((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const selling = Number(med?.sellingPrice) ?? 0
      const qty = Number(s.totalQuantity) ?? 0
      totalStockValue += selling * qty
    })

    return { totalStockValue, soldAmount, soldCount }
  }, [stock, medicines, sales, branchFilter, stockSoldReportPeriod, toDate])

  const isViewOnly = false
  const selectedBranchName = branchFilter !== 'all' ? branches.find((b) => b.id === branchFilter)?.name : undefined

  const filteredStock = branchFilter === 'all' ? stock : stock.filter(s => s.branchId === branchFilter)
  const inventorySearchLower = inventorySearch.trim().toLowerCase()
  const searchFilteredStock = inventorySearchLower
    ? filteredStock.filter((s) => {
        const medName = (s.medicineName || '').toLowerCase()
        const branchName = ((branches.find(b => b.id === s.branchId)?.name ?? s.branchId) || '').toLowerCase()
        return medName.includes(inventorySearchLower) || branchName.includes(inventorySearchLower)
      })
    : filteredStock
  const headerSearchLower = headerSearchQuery.trim().toLowerCase()
  const searchFilteredStockWithHeader = (isPharmacyPortal && headerSearchLower)
    ? searchFilteredStock.filter((s) => (s.medicineName || '').toLowerCase().includes(headerSearchLower))
    : searchFilteredStock
  const statusFilteredStock = inventoryStatusFilter === 'all' ? searchFilteredStockWithHeader : searchFilteredStockWithHeader.filter((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    const minLevel = med?.minStockLevel ?? 0
    const qty = s.totalQuantity ?? 0
    if (inventoryStatusFilter === 'out_of_stock') return qty === 0
    if (inventoryStatusFilter === 'low_stock') return minLevel > 0 && qty > 0 && qty < minLevel
    if (inventoryStatusFilter === 'in_stock') return qty >= minLevel || (minLevel === 0 && qty > 0)
    return true
  })
  const supplierFilteredStock = inventorySupplierFilter === 'all' ? statusFilteredStock : statusFilteredStock.filter((s) => {
    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
    return med?.supplierId === inventorySupplierFilter
  })
  function daysUntilExpiryForBatch(expiryStr: string) {
    const exp = new Date(expiryStr.slice(0, 10))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    exp.setHours(0, 0, 0, 0)
    return Math.ceil((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  }

  function getNearestExpiry(s: BranchMedicineStock) {
    const batches = Array.isArray(s.batches) ? s.batches : []
    let nearest: string | null = null
    batches.forEach((b: { expiryDate?: string }) => {
      const e = (b.expiryDate || '').slice(0, 10)
      if (!e) return
      if (!nearest || e < nearest) nearest = e
    })
    return nearest
  }
  const inventoryTableRows = inventoryExpiryFilter === 'all' ? supplierFilteredStock : supplierFilteredStock.filter((s) => {
    const nearest = getNearestExpiry(s)
    if (!nearest) return inventoryExpiryFilter === 'expired'
    const days = daysUntilExpiryForBatch(nearest)
    if (inventoryExpiryFilter === 'expiring_soon') return days >= 0 && days <= 30
    if (inventoryExpiryFilter === 'expired') return days < 0
    return true
  })

  const {
    currentPage: inventoryPage,
    pageSize: inventoryPageSize,
    totalPages: inventoryTotalPages,
    paginatedItems: paginatedInventoryRows,
    goToPage: goToInventoryPage,
    setPageSize: setInventoryPageSize,
  } = useTablePagination(inventoryTableRows, { initialPageSize: 20 })

  /** Inventory page: summary metrics (based on branch-filtered stock only) */
  const inventorySummary = useMemo(() => {
    const st = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    let lowCount = 0
    let outCount = 0
    let totalValue = 0
    st.forEach((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const minLevel = med?.minStockLevel ?? 0
      const qty = s.totalQuantity ?? 0
      totalValue += qty * (Number(med?.purchasePrice) || 0)
      if (qty === 0) outCount += 1
      else if (minLevel > 0 && qty < minLevel) lowCount += 1
    })
    const expiringCount = branchFilter === 'all' ? expiring.length : expiring.filter((e) => e.branchId === branchFilter).length
    return {
      totalMedicines: st.length,
      lowStock: lowCount,
      outOfStock: outCount,
      expiringSoon: expiringCount,
      totalValue,
    }
  }, [stock, medicines, branchFilter, expiring.length])

  /** Inventory health donut: In Stock, Low Stock, Out of Stock, Expired (batches past expiry) */
  const inventoryHealthDonut = useMemo(() => {
    const st = branchFilter === 'all' ? stock : stock.filter((s) => s.branchId === branchFilter)
    let inStock = 0
    let lowStock = 0
    let outOfStock = 0
    let expired = 0
    const today = new Date().toISOString().slice(0, 10)
    st.forEach((s) => {
      const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
      const minLevel = med?.minStockLevel ?? 0
      const qty = s.totalQuantity ?? 0
      const batches = Array.isArray(s.batches) ? s.batches : []
      const hasExpiredBatch = batches.some((b: { expiryDate?: string }) => (b.expiryDate || '').slice(0, 10) < today)
      if (hasExpiredBatch && qty > 0) expired += 1
      else if (qty === 0) outOfStock += 1
      else if (minLevel > 0 && qty < minLevel) lowStock += 1
      else inStock += 1
    })
    return [{ label: 'In Stock', value: inStock, color: '#22c55e' }, { label: 'Low Stock', value: lowStock, color: '#f97316' }, { label: 'Out of Stock', value: outOfStock, color: '#ef4444' }, { label: 'Expired', value: expired, color: '#94a3b8' }]
  }, [stock, medicines, branchFilter])

  const queueToShow = branchFilter === 'all' ? queue : queue.filter(q => q.branchId === branchFilter)
  const pendingQueue = queueToShow.filter(q => !q.dispensed)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2' && subTab === 'queue') {
        e.preventDefault()
        queuePosSearchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [subTab])

  // Fullscreen for Dispense & Billing: listen for change and re-enter if it exited right after a sale
  useEffect(() => {
    const onFullscreenChange = () => {
      const inFullscreen = !!(document.fullscreenElement && document.fullscreenElement === queueFullscreenRef.current)
      setIsQueueFullscreen(inFullscreen)
      if (!inFullscreen && keepFullscreenAfterSaleRef.current && queueFullscreenRef.current) {
        keepFullscreenAfterSaleRef.current = false
        queueFullscreenRef.current.requestFullscreen?.().catch(() => {})
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const enterQueueFullscreen = useCallback(() => {
    queueFullscreenRef.current?.requestFullscreen?.().catch(() => {})
  }, [])
  const exitQueueFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }, [])

  if (!activeHospitalId) {
    return (
      <>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-slate-600">Select a hospital to manage pharmacy.</p>
        </div>
        <ConfirmDialog
          isOpen={!!inventoryDeleteTarget}
          title="Remove from branch inventory?"
          message={
            inventoryDeleteTarget
              ? `This will remove "${inventoryDeleteTarget.medicineName}" from this branch's inventory. Existing sales history will remain.`
              : ''
          }
          confirmText="Delete"
          cancelText="Cancel"
          confirmLoading={inventoryDeleteLoading}
          onCancel={() => {
            if (inventoryDeleteLoading) return
            setInventoryDeleteTarget(null)
          }}
          onConfirm={async () => {
            if (!inventoryDeleteTarget) return
            try {
              setInventoryDeleteLoading(true)
              const token = await getToken()
              if (!token) {
                setError('Not signed in')
                return
              }
              const res = await fetch('/api/pharmacy/stock', {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ stockId: inventoryDeleteTarget.id }),
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to delete stock')
              }
              setSuccess('Medicine removed from this branch inventory.')
              fetchPharmacy()
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to delete stock')
            } finally {
              setInventoryDeleteLoading(false)
              setInventoryDeleteTarget(null)
            }
          }}
        />
      </>
    )
  }

  return (
    <>
      <div className={isPharmacyPortal ? 'bg-white rounded-[12px] border border-[#E0E0E0] shadow-sm p-6' : 'bg-white/70 backdrop-blur-xl shadow-xl border border-slate-200/50 rounded-2xl'}>
        {!isPharmacyPortal && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 px-6 py-3">
            <span className="text-sm text-slate-600">Pharmacy management</span>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setPharmacistForm({ firstName: '', lastName: '', email: '', password: '', branchId: '' })
                    setShowAddPharmacistModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Pharmacist
                </button>
              )}
              <Link
                href="/pharmacy"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1565C0] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-[#0D47A1]"
              >
                Open Pharmacy Portal
              </Link>
            </div>
          </div>
        )}
        {!isPharmacyPortal && (
          <div className="border-b border-slate-200 px-6 pt-6">
            <SubTabNavigation
              variant="default"
              tabs={[
                { id: 'queue', label: 'Dispense & Billing' },     // 1
                { id: 'returns', label: 'Sales returns' },        // 2
                { id: 'sales', label: 'Sales records' },          // 3
                { id: 'inventory', label: 'Inventory' },          // 4
                { id: 'orders', label: 'Orders' },                // 5
                ...(isSuperAdmin ? [{ id: 'transfers' as const, label: 'Transfers' }] : []),
                { id: 'reports', label: 'Reports' },              // 6
                { id: 'suppliers', label: 'Suppliers' },          // 7
                ...(isAdmin ? [{ id: 'users' as const, label: 'Pharmacy Users' }] : []),
                { id: 'overview', label: 'Overview' },            // 8
              ]}
              activeTab={subTab}
              onTabChange={(id) => setSubTab(id as PharmacySubTab)}
            />
          </div>
        )}
        <div className={isPharmacyPortal ? '' : 'p-6'}>
        {error && !(subTab === 'queue' && isQueueFullscreen) && (
          <Notification type="error" message={error} onClose={() => setError(null)} />
        )}
        {success && !(subTab === 'queue' && isQueueFullscreen) && (
          <Notification type="success" message={success} onClose={() => setSuccess(null)} />
        )}
        {/* Branch filter - only when not in pharmacy portal (portal has it in header) */}
        {!isPharmacyPortal && branches.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Branch:</span>
            <select
              value={branchFilter}
              onChange={(e) => {
                const newVal = e.target.value
                if (newVal === branchFilter) return
                if (!window.confirm('Are you sure you want to change the branch? Inventory and data will filter by the new branch.')) return
                setBranchFilter(newVal)
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {loading && subTab === 'overview' ? (
          <div className="flex justify-center py-12"><LoadingSpinner inline /></div>
        ) : subTab === 'overview' && (
          <div className="space-y-8 rounded-xl bg-[#F7F9FC] p-6" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Page header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#1e293b]">Overview</h2>
                <p className="mt-1 text-sm text-slate-600">Pharmacy performance and inventory insights</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
                  {(['today', '7d', '30d', '6m', 'year', 'all'] as OverviewDateRange[]).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setOverviewDateRange(range)}
                      className={`px-3 py-2.5 text-sm font-medium transition sm:px-4 ${overviewDateRange === range ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {range === 'today' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '6m' ? '6 month' : range === 'year' ? 'Year' : 'All time'}
                    </button>
                  ))}
                </div>
                {branches.length > 1 && (
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  >
                    <option value="all">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* 6 summary cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">Total Medicines</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{analytics?.totalMedicines ?? medicines.length}</p>
                    <p className="mt-1 text-xs text-slate-500">In inventory</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">Low Stock Medicines</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{analytics?.lowStockCount ?? lowStock.length}</p>
                    <p className="mt-1 text-xs text-amber-600">Below threshold</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">Sales Returns</p>
                    <p className="mt-2 text-2xl font-bold text-rose-600">
                      ₹{periodRefundTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="mt-1 text-xs text-rose-500">Refunded to patients in this period</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">Expiring Soon</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{analytics?.expiringCount ?? expiring.length}</p>
                    <p className="mt-1 text-xs text-rose-600">Within 30 days</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">{overviewDateRange === 'today' ? "Today's Sales" : overviewDateRange === '7d' ? 'Sales (7 days)' : overviewDateRange === '30d' ? 'Sales (30 days)' : overviewDateRange === '6m' ? 'Sales (6 months)' : overviewDateRange === 'year' ? 'Sales (Year)' : 'Sales (All time)'}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">₹{periodSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                    <p className="mt-1 text-xs text-emerald-600">Revenue</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">Pending Prescriptions</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{queue.length}</p>
                    <p className="mt-1 text-xs text-slate-500">To dispense</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-500">Pending Orders</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{poStatusCounts.pending}</p>
                    <p className="mt-1 text-xs text-slate-500">From suppliers</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  </span>
                </div>
              </div>
            </div>

            {/* Payment mode breakdown */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Payments by mode</h3>
              <p className="text-xs text-slate-500 mb-3">
                Number of bills and total amount collected by each payment method{branchFilter !== 'all' && ' for this branch'}.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-[#E5E7EB]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-700">Payment mode</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-700">Bills</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-700">Total amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['cash', 'upi', 'card', 'credit', 'other', 'unknown'].map((mode) => {
                      const row = paymentModeSummary[mode]
                      if (!row) return null
                      const label =
                        mode === 'cash'
                          ? 'Cash'
                          : mode === 'upi'
                          ? 'UPI'
                          : mode === 'card'
                          ? 'Card'
                          : mode === 'credit'
                          ? 'Credit'
                          : mode === 'other'
                          ? 'Other / Insurance'
                          : 'Not set'
                      return (
                        <tr key={mode} className="border-b border-[#E5E7EB] last:border-0">
                          <td className="px-3 py-2 text-slate-800">{label}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{row.count}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-900">
                            ₹{row.amount.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pharmacy Sales Trend - line chart */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Pharmacy Sales Trend</h3>
              <p className="text-sm text-slate-500 mb-4">Sales {overviewDateRange === 'today' ? 'today' : overviewDateRange === '7d' ? 'for last 7 days' : overviewDateRange === '30d' ? 'for last 30 days' : overviewDateRange === '6m' ? 'by month (6 months)' : overviewDateRange === 'year' ? 'by month (year)' : 'by month (last 12 months)'}</p>
              <div className="h-56 w-full">
                {salesTrendData.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50/50 text-slate-500 text-sm">No sales data</div>
                ) : (
                  <svg viewBox="0 0 400 160" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="salesLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const maxVal = Math.max(...salesTrendData.map((d) => d.value), 1)
                      const pts = salesTrendData.map((d, i) => {
                        const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                        const y = 140 - (d.value / maxVal) * 120
                        return `${x},${y}`
                      }).join(' ')
                      const areaPoints = `${pts} 390,140 10,140`
                      return (
                        <>
                          <polyline fill="url(#salesLineGrad)" points={areaPoints} />
                          <polyline fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                          {salesTrendData.map((d, i) => {
                            const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                            const y = 140 - (d.value / maxVal) * 120
                            return <circle key={i} cx={x} cy={y} r="3" fill="#2563EB" />
                          })}
                        </>
                      )
                    })()}
                  </svg>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 justify-between text-xs text-slate-500">
                {salesTrendData.filter((_, i) => (overviewDateRange === '30d' ? i % 5 === 0 : true)).slice(0, 12).map((d, i) => (
                  <span key={i}>{d.date}</span>
                ))}
              </div>
            </div>

            {/* Top Selling Medicines + Category Distribution */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Selling Medicines</h3>
                {topSellingMedicines.length === 0 ? (
                  <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50/50 text-slate-500 text-sm">No sales data</div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topSellingMedicines.map((m, i) => {
                      const maxQ = Math.max(...topSellingMedicines.map((x) => x.count), 1)
                      const w = (m.count / maxQ) * 100
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-32 truncate text-sm font-medium text-slate-700" title={m.name}>{m.name}</span>
                          <div className="flex-1 h-8 rounded-lg bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-lg bg-[#2563EB] transition-all duration-300" style={{ width: `${Math.max(w, 4)}%` }} />
                          </div>
                          <span className="text-sm font-semibold text-slate-900 w-12 text-right">{m.count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Medicine Category Distribution</h3>
                {categoryDonutData.length === 0 || (categoryDonutData.length === 1 && categoryDonutData[0].name === 'No data') ? (
                  <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-slate-50/50 text-slate-500 text-sm">No category data</div>
                ) : (
                  <>
                    <div className="relative h-40 w-40 mx-auto">
                      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                        {categoryDonutData.map((seg, i) => {
                          const start = categoryDonutData.slice(0, i).reduce((s, x) => s + x.pct, 0)
                          const angle = (seg.pct / 100) * 360
                          const end = start + angle
                          const x1 = 50 + 40 * Math.cos((start * Math.PI) / 180)
                          const y1 = 50 + 40 * Math.sin((start * Math.PI) / 180)
                          const x2 = 50 + 40 * Math.cos((end * Math.PI) / 180)
                          const y2 = 50 + 40 * Math.sin((end * Math.PI) / 180)
                          const large = angle > 180 ? 1 : 0
                          return (
                            <path key={i} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${large} 1 ${x2} ${y2} Z`} fill={seg.color} stroke="white" strokeWidth="2" />
                          )
                        })}
                        <circle cx="50" cy="50" r="26" fill="white" />
                      </svg>
                    </div>
                    <ul className="mt-4 space-y-1.5">
                      {categoryDonutData.map((c, i) => (
                        <li key={i} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />{c.name}</span>
                          <span className="font-medium text-slate-700">{c.pct.toFixed(0)}%</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {/* Inventory Health Status */}
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Inventory Health Status</h3>
                {inventoryHealthFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setInventoryHealthFilter('all')}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter('in_stock')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${
                    inventoryHealthFilter === 'in_stock'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <span>In Stock</span>
                  <span className="font-bold">{inventoryHealthCounts.inStock}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter('low_stock')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${
                    inventoryHealthFilter === 'low_stock'
                      ? 'bg-amber-600 text-white border-amber-700'
                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span>Low Stock</span>
                  <span className="font-bold">{inventoryHealthCounts.lowStock}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter('out_of_stock')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${
                    inventoryHealthFilter === 'out_of_stock'
                      ? 'bg-red-600 text-white border-red-700'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <span>Out of Stock</span>
                  <span className="font-bold">{inventoryHealthCounts.outOfStock}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter('expiring_soon')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${
                    inventoryHealthFilter === 'expiring_soon'
                      ? 'bg-rose-600 text-white border-rose-700'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <span>Expiring Soon</span>
                  <span className="font-bold">{inventoryHealthCounts.expiringSoon}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryHealthFilter('dead_stock')}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition ${
                    inventoryHealthFilter === 'dead_stock'
                      ? 'bg-slate-800 text-white border-slate-900'
                      : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span>Dead Stock (last 3 months)</span>
                  <span className="font-bold">{inventoryHealthCounts.deadStock}</span>
                </button>
              </div>
            </div>

            {inventoryHealthFilter !== 'all' && (
              <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-800">
                    {inventoryHealthFilter === 'low_stock'
                      ? 'Low stock medicines'
                      : inventoryHealthFilter === 'out_of_stock'
                      ? 'Out of stock medicines'
                      : inventoryHealthFilter === 'expiring_soon'
                      ? 'Expiring soon medicines'
                      : inventoryHealthFilter === 'dead_stock'
                      ? 'Dead stock medicines (last 3 months)'
                      : 'In stock medicines'}
                  </h4>
                  <span className="text-xs text-slate-500">
                    {inventoryHealthItems.length} item{inventoryHealthItems.length === 1 ? '' : 's'}
                  </span>
                </div>
                {inventoryHealthItems.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No medicines found for this category with the current branch filter.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 border-b border-[#E5E7EB]">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Medicine</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Branch</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-700">Qty</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-700">Min Level</th>
                          <th className="text-left px-3 py-2 font-medium text-slate-700">Nearest Expiry</th>
                          <th className="text-right px-3 py-2 font-medium text-slate-700">Days Left</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryHealthItems.slice(0, 50).map((row) => (
                          <tr key={row.id} className="border-t border-[#E5E7EB] hover:bg-slate-50/60 transition">
                            <td className="px-3 py-2 font-medium text-slate-900">{row.medicineName}</td>
                            <td className="px-3 py-2 text-slate-600">{row.branchName}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900">{row.qty}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{row.minLevel || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{row.nearestExpiry || '—'}</td>
                            <td className="px-3 py-2 text-right text-slate-700">
                              {row.daysLeft != null ? `${row.daysLeft}d` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Expiring Medicines table + Recent Sales + Purchase Orders */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#E5E7EB] px-6 py-4">
                  <h3 className="text-lg font-semibold text-slate-800">Expiring Medicines</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-[#E5E7EB]">
                      <tr>
                        <th className="text-left p-3 font-medium text-slate-700">Medicine Name</th>
                        <th className="text-left p-3 font-medium text-slate-700">Batch</th>
                        <th className="text-left p-3 font-medium text-slate-700">Expiry Date</th>
                        <th className="text-left p-3 font-medium text-slate-700">Days Left</th>
                        <th className="text-right p-3 font-medium text-slate-700">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiring.length === 0 ? (
                        <tr><td colSpan={5} className="p-6 text-center text-slate-500">No medicines expiring in the next 90 days.</td></tr>
                      ) : (
                        expiring.slice(0, 8).map((a, i) => {
                          const urgent = a.daysUntilExpiry <= 7
                          return (
                            <tr key={i} className={`border-t border-[#E5E7EB] transition hover:bg-slate-50/50 ${urgent ? 'bg-rose-50/50' : ''}`}>
                              <td className="p-3 font-medium text-slate-900">{a.medicineName}</td>
                              <td className="p-3 text-slate-600">{a.batchNumber}</td>
                              <td className="p-3 text-slate-600">{a.expiryDate}</td>
                              <td className="p-3"><span className={`font-medium ${urgent ? 'text-rose-600' : 'text-slate-700'}`}>{a.daysUntilExpiry} days</span></td>
                              <td className="p-3 text-right font-medium text-slate-900">{a.quantity}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-[#E5E7EB] px-6 py-4">
                    <h3 className="text-lg font-semibold text-slate-800">Recent Pharmacy Sales</h3>
                  </div>
                  <div className="divide-y divide-[#E5E7EB] max-h-64 overflow-y-auto">
                    {recentSalesFiltered.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500 text-center">No recent sales.</p>
                    ) : (
                      recentSalesFiltered.slice(0, 6).map((s) => {
                        const dateRaw = s.dispensedAt
                        const timeStr = !dateRaw ? '—' : typeof dateRaw === 'string' ? new Date(dateRaw).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (dateRaw as { toDate?: () => Date })?.toDate?.()?.toLocaleTimeString?.('en-IN', { hour: '2-digit', minute: '2-digit' }) ?? '—'
                        const med = s.lines?.[0]
                        const medName = (med?.medicineName ?? s.lines?.map((l) => l.medicineName).join(', ')) || '—'
                        const qty = med?.quantity ?? s.lines?.reduce((sum, l) => sum + (l.quantity ?? 0), 0) ?? 0
                        return (
                          <div key={s.id} className="px-4 py-3 hover:bg-slate-50/50 transition">
                            <p className="font-medium text-slate-900">{s.patientName || 'Walk-in'}</p>
                            <p className="text-sm text-slate-600 truncate">{medName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{qty} {qty === 1 ? 'unit' : 'units'} · {timeStr}</p>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Purchase Orders</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-4 py-2"><span className="text-sm font-medium text-amber-800">Pending</span><span className="font-bold text-amber-900">{poStatusCounts.pending}</span></div>
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2"><span className="text-sm font-medium text-emerald-800">Received</span><span className="font-bold text-emerald-900">{poStatusCounts.received}</span></div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-100 border border-slate-200 px-4 py-2"><span className="text-sm font-medium text-slate-700">Cancelled</span><span className="font-bold text-slate-800">{poStatusCounts.cancelled}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top selling / most prescribed - always show on Overview, filter by header search */}
            {subTab === 'overview' && (
              <div className={`rounded-xl border p-5 ${isPharmacyPortal ? 'border-[#E0E0E0] bg-white shadow-sm' : 'border-slate-200 bg-slate-50/50'}`}>
                <h3 className={`font-semibold mb-3 ${isPharmacyPortal ? 'text-[#263238] text-lg' : 'text-slate-800'}`}>Top selling / most prescribed</h3>
                {!analytics ? (
                  <p className="text-sm text-[#607D8B]">Loading...</p>
                ) : (() => {
                  const list = analytics.mostPrescribed || []
                  const headerQ = headerSearchQuery.trim().toLowerCase()
                  const filteredList = (isPharmacyPortal && headerQ)
                    ? list.filter((m) => (m.medicineName || '').toLowerCase().includes(headerQ))
                    : list
                  return (
                    <>
                      <ul className="space-y-2">
                        {filteredList.map((m, i) => (
                          <li key={i} className="flex justify-between items-center text-sm py-1 border-b border-[#E0E0E0] last:border-0">
                            <span className={isPharmacyPortal ? 'text-[#263238]' : 'text-slate-700'}>{m.medicineName}</span>
                            <span className={`font-medium ${isPharmacyPortal ? 'text-[#1565C0]' : 'text-slate-900'}`}>{m.count} sold</span>
                          </li>
                        ))}
                      </ul>
                      {filteredList.length === 0 && (
                        <p className="text-sm text-[#607D8B] py-2">
                          {list.length === 0 ? 'No sales data yet. Dispense prescriptions to see most prescribed medicines.' : 'No medicines match your search.'}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {subTab === 'inventory' && (
          <div className="space-y-6" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Section heading (global header already shows "Inventory"; use different text here) */}
            <div>
              <h2 className="text-xl font-semibold text-[#1e293b]">Medicine stock</h2>
              <p className="mt-0.5 text-sm text-slate-600">View and manage stock levels, batches and expiry</p>
            </div>

            {/* Inventory summary cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">Total Medicines</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{inventorySummary.totalMedicines}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">Low Stock</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{inventorySummary.lowStock}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">Out of Stock</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{inventorySummary.outOfStock}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">Expiring Soon</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{inventorySummary.expiringSoon}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">Total Inventory Value</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">₹{inventorySummary.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Import inventory – receive from supplier file (move above barcode lookup) */}
            {!isViewOnly && (
              <ReceiveByFileForm
                pendingOrders={purchaseOrders.filter((o) => o.status === 'pending')}
                onSuccess={() => { setSuccess('Stock updated from supplier file.'); fetchPharmacy(); }}
                onError={setError}
                getToken={getToken}
                branchIdForSimpleUpload={!isViewOnly ? branchFilter : undefined}
              />
            )}

            {/* Barcode lookup */}
            {activeHospitalId && (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Barcode lookup</h3>
                <p className="text-sm text-slate-600 mb-4">Scan barcode or enter manually. Look up medicine or add new if not found.</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <BarcodeScanInput
                      className="barcode-lookup-prominent"
                      hospitalId={activeHospitalId}
                      getToken={getToken}
                      onMedicineFound={() => {}}
                      onError={setError}
                      onOpenAddMedicine={(b) => setAddMedicineModalBarcode(b)}
                      placeholder="Scan or type barcode and press Enter"
                      showFoundInline
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddMedicineModalBarcode('')}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Medicine
                  </button>
                </div>
              </div>
            )}

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <input
                type="search"
                placeholder="Search medicine by name"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm w-48 max-w-full focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
              />
              <select value={inventoryStatusFilter} onChange={(e) => setInventoryStatusFilter(e.target.value as 'all' | 'in_stock' | 'low_stock' | 'out_of_stock')} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm">
                <option value="all">All status</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
              <select value={inventorySupplierFilter} onChange={(e) => setInventorySupplierFilter(e.target.value)} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm">
                <option value="all">All suppliers</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
              <select value={inventoryExpiryFilter} onChange={(e) => setInventoryExpiryFilter(e.target.value as 'all' | 'expiring_soon' | 'expired')} className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm">
                <option value="all">All expiry</option>
                <option value="expiring_soon">Expiring soon (30d)</option>
                <option value="expired">Expired</option>
              </select>
              <span className="text-slate-500 text-sm ml-auto">{inventoryTableRows.length} of {filteredStock.length} row(s)</span>
            </div>

            {!isPharmacyPortal && (
              <p className="text-sm text-slate-600 rounded-lg bg-slate-50 border border-slate-200 px-4 py-2">
                <strong>Inventory policy:</strong> Each medicine has a minimum stock level. Alerts are shown when stock falls below that level so you can reorder in time.
              </p>
            )}
            {lowStock.length > 0 && !isPharmacyPortal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <span className="text-lg">⚠</span> Below minimum stock
                </h3>
                <p className="text-sm text-amber-700 mb-2">The following items are below the set minimum. Consider reordering.</p>
                <ul className="space-y-1.5 text-sm text-amber-900">
                  {lowStock.map((a, i) => {
                    const suggestedQty = Math.max((a.minStockLevel ?? 0) - a.currentStock, 1)
                    const med = medicines.find((m) => (m.medicineId ?? m.id) === a.medicineId)
                    return (
                      <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span><span className="font-medium">{a.medicineName}</span> – {a.branchName}: <span className="font-medium">{a.currentStock} in stock</span> (min {a.minStockLevel}, suggest order {suggestedQty})</span>
                        <button
                          type="button"
                          onClick={() => { setPendingAddToOrder({ medicineId: a.medicineId, medicineName: a.medicineName, quantity: suggestedQty, manufacturer: med?.manufacturer }); setSubTab('orders'); }}
                          className="text-xs font-medium text-sky-600 hover:text-sky-800"
                        >
                          Create Purchase Order
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {/* Bulk add and forms: when portal we show tabbed forms + bulk after table */}
            {!isPharmacyPortal && (
              <>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Bulk add / update</h3>
              <p className="text-sm text-slate-600 mb-3">Select a branch above first. If your file has no branch column, stock will be added to the selected branch. Rows missing medicine name are skipped.</p>
              <div className="flex flex-wrap items-center gap-4">
                <MedicineFileUploader
                  branchId={branchFilter !== 'all' ? branchFilter : undefined}
                  branchName={branchFilter !== 'all' ? branches.find(b => b.id === branchFilter)?.name : undefined}
                  branchRequired
                  onSuccess={(msg) => { setSuccess(msg); fetchPharmacy(); }}
                  onError={setError}
                  getToken={getToken}
                />
              </div>
            </div>
            </>
            )}

            {/* Inventory table (desktop) + cards (mobile) */}
            {loading ? (
              <div className="flex justify-center py-12"><LoadingSpinner inline /></div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
                        <tr>
                          <th className="text-left p-4 font-medium text-slate-700">Medicine Name</th>
                          <th className="text-left p-4 font-medium text-slate-700">Generic Name</th>
                          <th className="text-left p-4 font-medium text-slate-700">Strength</th>
                          <th className="text-left p-4 font-medium text-slate-700">Branch</th>
                          <th className="text-right p-4 font-medium text-slate-700">Quantity</th>
                          <th className="text-right p-4 font-medium text-slate-700">Min Level</th>
                          <th className="text-right p-4 font-medium text-slate-700">Price (₹)</th>
                          <th className="text-left p-4 font-medium text-slate-700">Stock Status</th>
                          <th className="text-center p-4 font-medium text-slate-700">Batch Count</th>
                          <th className="text-left p-4 font-medium text-slate-700">Nearest Expiry</th>
                          <th className="text-right p-4 font-medium text-slate-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInventoryRows.map((s) => {
                          const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
                          const minLevel = med?.minStockLevel ?? 0
                          const belowMin = minLevel > 0 && (s.totalQuantity ?? 0) < minLevel
                          const outOfStock = (s.totalQuantity ?? 0) === 0
                          const statusLabel = outOfStock ? 'Out of Stock' : belowMin ? 'Low Stock' : 'In Stock'
                          const statusClass = outOfStock ? 'bg-red-100 text-red-800' : belowMin ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          const supplierName = med?.supplierId ? suppliers.find((sup) => sup.id === med.supplierId)?.name ?? '—' : '—'
                          const nearestExpiry = getNearestExpiry(s)
                          const isActionsOpen = inventoryRowActionsOpen === s.id
                          return (
                            <tr key={s.id} className="border-t border-[#E5E7EB] hover:bg-slate-50/80 transition">
                              <td className="p-4 font-medium text-slate-900">{s.medicineName}</td>
                              <td className="p-4 text-slate-600">{med?.genericName ?? '—'}</td>
                              <td className="p-4 text-slate-600">{med?.strength ?? '—'}</td>
                              <td className="p-4 text-slate-600">{branches.find((b) => b.id === s.branchId)?.name ?? s.branchId}</td>
                              <td className="p-4 text-right font-medium text-slate-900">{s.totalQuantity}</td>
                              <td className="p-4 text-right text-slate-600">{minLevel}</td>
                              <td className="p-4 text-right font-medium tabular-nums text-slate-900">
                                {med?.sellingPrice != null && Number(med.sellingPrice) !== 0 ? `₹${Number(med.sellingPrice).toFixed(2)}` : '—'}
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>{statusLabel}</span>
                              </td>
                              <td className="p-4 text-center text-slate-600">{s.batches?.length ?? 0}</td>
                              <td className="p-4 text-slate-600">{nearestExpiry ?? '—'}</td>
                              <td className="p-4 text-right">
                                <div className="relative inline-block">
                                  <button
                                    type="button"
                                    onClick={() => setInventoryRowActionsOpen(isActionsOpen ? null : s.id)}
                                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition"
                                    aria-expanded={isActionsOpen}
                                  >
                                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                                  </button>
                                  {isActionsOpen && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setInventoryRowActionsOpen(null)} aria-hidden />
                                      <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg">
                                        <button type="button" onClick={() => { setInventoryRowActionsOpen(null); setInventoryDetailView({ stock: s, medicine: med ?? null }); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 font-medium">View full details</button>
                                        <button type="button" onClick={() => { setInventoryRowActionsOpen(null); setPendingAddToOrder({ medicineId: s.medicineId, medicineName: s.medicineName, quantity: med?.reorderQuantity ?? 10 }); setSubTab('orders'); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Add Stock</button>
                                        <button type="button" onClick={() => { setInventoryRowActionsOpen(null); setInventoryViewBatchesStock(s); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">View Batches</button>
                                        <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">Print Barcode</button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setInventoryRowActionsOpen(null)
                                            setInventoryDeleteTarget(s)
                                          }}
                                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 font-semibold"
                                        >
                                          Delete
                                        </button>
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
                  {inventoryTableRows.length === 0 && (
                    <p className="p-8 text-center text-slate-500">
                      {filteredStock.length === 0 ? 'No stock for selected branch. Use bulk upload below or receive stock from the Orders tab.' : 'No inventory matches your filters. Try adjusting search or filters.'}
                    </p>
                  )}
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-4">
                  {paginatedInventoryRows.map((s) => {
                    const med = medicines.find((m) => (m.medicineId ?? m.id) === s.medicineId)
                    const minLevel = med?.minStockLevel ?? 0
                    const belowMin = minLevel > 0 && (s.totalQuantity ?? 0) < minLevel
                    const outOfStock = (s.totalQuantity ?? 0) === 0
                    const statusLabel = outOfStock ? 'Out of Stock' : belowMin ? 'Low Stock' : 'In Stock'
                    const statusClass = outOfStock ? 'bg-red-100 text-red-800' : belowMin ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    const supplierName = med?.supplierId ? suppliers.find((sup) => sup.id === med.supplierId)?.name ?? '—' : '—'
                    const nearestExpiry = getNearestExpiry(s)
                    return (
                      <div key={s.id} className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{s.medicineName}</p>
                            <p className="text-sm text-slate-500">{med?.genericName ?? '—'} · {med?.strength ?? '—'}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>{statusLabel}</span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <dt className="text-slate-500">Branch</dt><dd className="text-slate-900">{branches.find((b) => b.id === s.branchId)?.name ?? s.branchId}</dd>
                          <dt className="text-slate-500">Quantity</dt><dd className="text-slate-900 font-medium">{s.totalQuantity}</dd>
                          <dt className="text-slate-500">Min level</dt><dd className="text-slate-900">{minLevel}</dd>
                          <dt className="text-slate-500">Price</dt><dd className="text-slate-900 font-medium">{med?.sellingPrice != null && Number(med.sellingPrice) !== 0 ? `₹${Number(med.sellingPrice).toFixed(2)}` : '—'}</dd>
                          <dt className="text-slate-500">Nearest expiry</dt><dd className="text-slate-900">{nearestExpiry ?? '—'}</dd>
                          <dt className="text-slate-500">Supplier name</dt><dd className="text-slate-900 truncate" title={supplierName}>{supplierName}</dd>
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setEditMinLevelMedicine(med ?? null)} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Edit</button>
                          <button type="button" onClick={() => setInventoryViewBatchesStock(s)} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">View Batches</button>
                        </div>
                      </div>
                    )
                  })}
                  {inventoryTableRows.length === 0 && (
                    <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-slate-50 p-8 text-center text-slate-500">No inventory matches your filters.</p>
                  )}
                </div>
              </>
            )}

            {inventoryTableRows.length > 0 && (
              <Pagination
                currentPage={inventoryPage}
                totalPages={inventoryTotalPages}
                pageSize={inventoryPageSize}
                totalItems={inventoryTableRows.length}
                onPageChange={goToInventoryPage}
                onPageSizeChange={setInventoryPageSize}
                itemLabel="items"
                className="mt-3 rounded-xl border border-slate-200"
              />
            )}

            {/* Inventory health donut */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Inventory health</h3>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="relative h-40 w-40 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      {inventoryHealthDonut.map((seg, i) => {
                        const total = inventoryHealthDonut.reduce((a, x) => a + x.value, 0)
                        const pct = total > 0 ? (seg.value / total) * 100 : 25
                        const start = inventoryHealthDonut.slice(0, i).reduce((a, x) => a + (total > 0 ? (x.value / total) * 360 : 90), 0)
                        const angle = pct * 3.6
                        const x1 = 50 + 40 * Math.cos((start * Math.PI) / 180)
                        const y1 = 50 + 40 * Math.sin((start * Math.PI) / 180)
                        const x2 = 50 + 40 * Math.cos(((start + angle) * Math.PI) / 180)
                        const y2 = 50 + 40 * Math.sin(((start + angle) * Math.PI) / 180)
                        const large = angle > 180 ? 1 : 0
                        return (
                          <path key={i} d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${large} 1 ${x2} ${y2} Z`} fill={seg.color} stroke="white" strokeWidth="2" />
                        )
                      })}
                      <circle cx="50" cy="50" r="26" fill="white" />
                    </svg>
                  </div>
                  <ul className="space-y-2">
                    {inventoryHealthDonut.map((seg, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                        <span className="text-slate-700">{seg.label}</span>
                        <span className="font-semibold text-slate-900">{seg.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Medicine full details modal */}
            {inventoryDetailView && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setInventoryDetailView(null)}>
                <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-semibold text-slate-800">Medicine details</h3>
                    <button type="button" onClick={() => setInventoryDetailView(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto p-6 space-y-6">
                    {(() => {
                      const { stock, medicine: med } = inventoryDetailView
                      const supplierName = med?.supplierId ? suppliers.find((sup) => sup.id === med.supplierId)?.name ?? '—' : '—'
                      const branchName = branches.find((b) => b.id === stock.branchId)?.name ?? stock.branchId
                      const minLevel = med?.minStockLevel ?? 0
                      const belowMin = minLevel > 0 && (stock.totalQuantity ?? 0) < minLevel
                      const outOfStock = (stock.totalQuantity ?? 0) === 0
                      const statusLabel = outOfStock ? 'Out of Stock' : belowMin ? 'Low Stock' : 'In Stock'
                      const statusClass = outOfStock ? 'bg-red-100 text-red-800' : belowMin ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      const nearestExpiry = getNearestExpiry(stock)
                      return (
                        <>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Basic info</h4>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div><dt className="text-slate-500">Medicine name</dt><dd className="font-medium text-slate-900">{stock.medicineName}</dd></div>
                              <div><dt className="text-slate-500">Generic name</dt><dd className="text-slate-900">{med?.genericName ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Strength</dt><dd className="text-slate-900">{med?.strength ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Manufacturer</dt><dd className="text-slate-900">{med?.manufacturer ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Category</dt><dd className="text-slate-900">{med?.category ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Unit</dt><dd className="text-slate-900">{med?.unit ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Pack size</dt><dd className="text-slate-900">{med?.packSize ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Schedule</dt><dd className="text-slate-900">{med?.schedule ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Barcode</dt><dd className="text-slate-900 font-mono text-xs">{med?.barcode ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">HSN code</dt><dd className="text-slate-900">{med?.hsnCode ?? '—'}</dd></div>
                            </dl>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Pricing & reorder</h4>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div><dt className="text-slate-500">Purchase price</dt><dd className="font-medium text-slate-900">₹{med?.purchasePrice != null ? Number(med.purchasePrice).toFixed(2) : '—'}</dd></div>
                              <div><dt className="text-slate-500">Selling price</dt><dd className="font-medium text-slate-900">₹{med?.sellingPrice != null ? Number(med.sellingPrice).toFixed(2) : '—'}</dd></div>
                              <div><dt className="text-slate-500">Min stock level</dt><dd className="text-slate-900">{minLevel}</dd></div>
                              <div><dt className="text-slate-500">Reorder quantity</dt><dd className="text-slate-900">{med?.reorderQuantity ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Lead time (days)</dt><dd className="text-slate-900">{med?.leadTimeDays ?? '—'}</dd></div>
                              <div><dt className="text-slate-500">Supplier name</dt><dd className="text-slate-900">{supplierName}</dd></div>
                            </dl>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Stock at branch</h4>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div><dt className="text-slate-500">Branch</dt><dd className="text-slate-900">{branchName}</dd></div>
                              <div><dt className="text-slate-500">Quantity</dt><dd className="font-medium text-slate-900">{stock.totalQuantity}</dd></div>
                              <div><dt className="text-slate-500">Stock status</dt><dd><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>{statusLabel}</span></dd></div>
                              <div><dt className="text-slate-500">Batch count</dt><dd className="text-slate-900">{stock.batches?.length ?? 0}</dd></div>
                              <div><dt className="text-slate-500">Nearest expiry</dt><dd className="text-slate-900">{nearestExpiry ?? '—'}</dd></div>
                            </dl>
                          </div>
                          {(Array.isArray(stock.batches) && stock.batches.length > 0) && (
                            <div>
                              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Batches</h4>
                              <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 border-b border-[#E5E7EB]">
                                    <tr>
                                      <th className="text-left py-2 px-3 font-medium text-slate-700">Batch</th>
                                      <th className="text-right py-2 px-3 font-medium text-slate-700">Qty</th>
                                      <th className="text-left py-2 px-3 font-medium text-slate-700">Expiry</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stock.batches.slice(0, 10).map((b: MedicineBatch, i: number) => (
                                      <tr key={i} className="border-b border-[#E5E7EB] last:border-0">
                                        <td className="py-2 px-3 font-medium text-slate-900">{b.batchNumber ?? '—'}</td>
                                        <td className="py-2 px-3 text-right text-slate-700">{b.quantity ?? 0}</td>
                                        <td className="py-2 px-3 text-slate-600">{(b.expiryDate ?? '').slice(0, 10) || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {stock.batches.length > 10 && <p className="text-xs text-slate-500 px-3 py-2 bg-slate-50">+{stock.batches.length - 10} more. Use View Batches for full list.</p>}
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E5E7EB]">
                            <button type="button" onClick={() => { setInventoryDetailView(null); if (med) setEditMinLevelMedicine(med); }} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">Edit medicine</button>
                            <button type="button" onClick={() => { setInventoryDetailView(null); setInventoryViewBatchesStock(stock); }} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">View batches</button>
                            <button type="button" onClick={() => { setInventoryDetailView(null); setPendingAddToOrder({ medicineId: stock.medicineId, medicineName: stock.medicineName, quantity: med?.reorderQuantity ?? 10 }); setSubTab('orders'); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Add stock</button>
      </div>

    </>
  )
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Batch detail modal */}
            {inventoryViewBatchesStock && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setInventoryViewBatchesStock(null)}>
                <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800">Batch details – {inventoryViewBatchesStock.medicineName}</h3>
                    <button type="button" onClick={() => setInventoryViewBatchesStock(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto p-6">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E5E7EB]">
                          <th className="text-left py-2 font-medium text-slate-700">Batch Number</th>
                          <th className="text-right py-2 font-medium text-slate-700">Quantity</th>
                          <th className="text-left py-2 font-medium text-slate-700">Mfg Date</th>
                          <th className="text-left py-2 font-medium text-slate-700">Expiry Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(inventoryViewBatchesStock.batches) ? inventoryViewBatchesStock.batches : []).map((b: MedicineBatch, i: number) => (
                          <tr key={i} className="border-b border-[#E5E7EB]">
                            <td className="py-3 font-medium text-slate-900">{b.batchNumber ?? '—'}</td>
                            <td className="py-3 text-right text-slate-700">{b.quantity ?? 0}</td>
                            <td className="py-3 text-slate-600">{((b.manufacturingDate ?? '') as string).slice(0, 10) || '—'}</td>
                            <td className="py-3 text-slate-600">{(b.expiryDate ?? '').slice(0, 10) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(!inventoryViewBatchesStock.batches || inventoryViewBatchesStock.batches.length === 0) && (
                      <p className="py-4 text-center text-slate-500">No batch records.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {subTab === 'queue' && (
          <div
            ref={queueFullscreenRef}
            className={`flex flex-col min-h-[480px] bg-white rounded-xl overflow-hidden ${isQueueFullscreen ? 'h-screen min-h-0 overflow-y-auto' : ''}`}
            data-fullscreen={isQueueFullscreen ? '' : undefined}
          >
            {/* Toasts inside fullscreen so they are visible and focus stays in fullscreen */}
            {isQueueFullscreen && error && (
              <Notification type="error" message={error} onClose={() => setError(null)} />
            )}
            {isQueueFullscreen && success && (
              <Notification type="success" message={success} onClose={() => setSuccess(null)} />
            )}
            <div className={isQueueFullscreen ? 'flex flex-col space-y-4 p-1' : 'flex-1 min-h-0 flex flex-col space-y-4 p-1 overflow-y-auto'}>
            {!cashSessionsLoading && !activeCashSession && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                <span className="font-medium">Start a cash session to complete sales and returns.</span>
                <span>Go to{' '}
                  <button
                    type="button"
                    onClick={() => setSubTab('cash_and_expenses')}
                    className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
                  >
                    Cash & expenses
                  </button>
                  {' '}and click <strong>Start shift</strong>.</span>
              </div>
            )}
            {/* Inner tabs for queue: Walk-in vs Prescription list */}
            <div className="inline-flex rounded-full border border-[#E5E7EB] bg-[#F9FAFB] p-0.5 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setQueueInnerTab('walk_in')}
                className={`px-3 py-1.5 rounded-full transition ${
                  queueInnerTab === 'walk_in'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Walk-in customer
              </button>
              <button
                type="button"
                onClick={() => setQueueInnerTab('prescriptions')}
                className={`px-3 py-1.5 rounded-full transition ${
                  queueInnerTab === 'prescriptions'
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Prescription queue
              </button>
            </div>

            {queueInnerTab === 'walk_in' && (
              <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden min-h-[480px] lg:min-h-[calc(100vh-12rem)] flex flex-col">
                <div className="flex-1 min-h-0 flex flex-col px-4 py-4 lg:px-5 lg:py-5">
                  <PharmacyBillingPanel
                    branches={branches}
                    medicines={medicines}
                    stock={stock}
                    selectedBranchId={!isViewOnly ? branchFilter : undefined}
                    selectedBranchName={!isViewOnly ? selectedBranchName : undefined}
                    hospitalId={activeHospitalId ?? ''}
                    onSuccess={() => {
                      keepFullscreenAfterSaleRef.current = true
                      setSuccess('Sale recorded; stock updated.')
                      fetchPharmacy()
                      fetchCashSessions()
                    }}
                    onError={setError}
                    getToken={getToken}
                    onOpenAddMedicine={(b) => setAddMedicineModalBarcode(b)}
                    posSearchRef={queuePosSearchRef}
                    queueItems={pendingQueue}
                    hasActiveSession={!!activeCashSession}
                  />
                </div>
                <p className="px-4 pb-4 text-xs text-slate-500 border-t border-[#E5E7EB] bg-[#F8FAFC]">
                  Shortcut: <kbd className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">F2</kbd> focus search · Scan barcode or type name
                </p>
              </div>
            )}

            {queueInnerTab === 'prescriptions' && (
              <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden min-h-[320px] lg:min-h-[calc(100vh-16rem)] flex flex-col">
                {dispenseQueueItem ? (
                  <DispenseModal
                    inline
                    queueItem={dispenseQueueItem}
                    medicines={medicines}
                    stock={stock}
                    hospitalId={activeHospitalId ?? ''}
                    onSuccess={() => {
                      keepFullscreenAfterSaleRef.current = true
                      setSuccess('Medicine dispensed; stock updated.')
                      setDispenseQueueItem(null)
                      fetchPharmacy()
                      fetchCashSessions()
                    }}
                    onError={setError}
                    onClose={() => setDispenseQueueItem(null)}
                    getToken={getToken}
                    onOpenAddMedicine={(b) => setAddMedicineModalBarcode(b)}
                  />
                ) : (
                  <>
                    <div className="shrink-0 px-4 py-3 border-b border-[#E5E7EB] bg-[#F8FAFC] flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800">Prescription queue</h3>
                      <span className="text-sm text-slate-600">{pendingQueue.length} pending</span>
                    </div>
                    {loading ? (
                      <div className="flex justify-center py-12"><LoadingSpinner inline /></div>
                    ) : (
                      <div className="flex-1 min-h-0 overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-medium text-slate-700">Patient Name</th>
                              <th className="text-left p-3 font-medium text-slate-700">Doctor</th>
                              <th className="text-left p-3 font-medium text-slate-700">Prescription Date</th>
                              <th className="text-right p-3 font-medium text-slate-700">Medicines</th>
                              <th className="text-left p-3 font-medium text-slate-700">Branch</th>
                              <th className="text-right p-3 font-medium text-slate-700 w-28">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingQueue.slice(0, 50).map((q) => (
                              <tr key={q.appointmentId} className="border-t border-[#E5E7EB] hover:bg-slate-50/80 transition">
                                <td className="p-3 font-medium text-slate-900">{q.patientName}</td>
                                <td className="p-3 text-slate-700">{q.doctorName}</td>
                                <td className="p-3 text-slate-600">{q.appointmentDate}</td>
                                <td className="p-3 text-right text-slate-700">{q.medicines.length}</td>
                                <td className="p-3 text-slate-600">{q.branchName ?? q.branchId ?? '—'}</td>
                                <td className="p-3 text-right">
                                  {q.branchId ? (
                                    isViewOnly ? (
                                      <span className="text-slate-400 text-xs">Select branch to dispense</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setDispenseQueueItem(q)}
                                        disabled={!activeCashSession}
                                        title={!activeCashSession ? 'Start a cash session first (Cash & expenses → Start shift)' : ''}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1d4ed8] transition disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Dispense
                                      </button>
                                    )
                                  ) : (
                                    <span className="text-slate-400 text-xs">No branch</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {pendingQueue.length === 0 && (
                          <p className="p-8 text-center text-slate-500 text-sm">
                            No pending prescriptions. Completed checkups with prescribed medicine appear here; click Dispense to fulfill.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            </div>
            {/* Full screen / Exit full screen bar at bottom — ESC also exits; left-aligned */}
            <div className="shrink-0 flex items-center justify-start gap-2 py-2 pl-3 pr-2 border-t border-slate-200 bg-slate-50/80">
              {!isQueueFullscreen ? (
                <button
                  type="button"
                  onClick={enterQueueFullscreen}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Full screen
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={exitQueueFullscreen}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Exit full screen
                  </button>
                  <span className="text-xs text-slate-500">Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 font-mono">Esc</kbd> to exit</span>
                </>
              )}
            </div>
          </div>
        )}

        {subTab === 'sales' && (
          <div className="space-y-6">
            {/* Selling data – same as Overview */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] p-4 sm:p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Selling data</h3>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {(['today', '7d', '30d', '6m', 'year', 'all'] as OverviewDateRange[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setOverviewDateRange(range)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${overviewDateRange === range ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {range === 'today' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '6m' ? '6m' : range === 'year' ? 'Year' : 'All'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Sales</p>
                  <p className="text-xl font-bold text-slate-900">₹{periodSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-emerald-600">Revenue</p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Sales returns</p>
                  <p className="text-xl font-bold text-rose-600">₹{periodRefundTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-rose-500">Refunded</p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Bills</p>
                  <p className="text-xl font-bold text-slate-900">{periodSalesCount}</p>
                  <p className="text-[10px] text-slate-500">In period</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Payments by mode</h4>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-1.5 font-medium text-slate-700">Mode</th>
                        <th className="text-right py-1.5 font-medium text-slate-700">Bills</th>
                        <th className="text-right py-1.5 font-medium text-slate-700">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['cash', 'upi', 'card', 'credit', 'other', 'unknown'].map((mode) => {
                        const row = paymentModeSummary[mode]
                        if (!row) return null
                        const label = mode === 'cash' ? 'Cash' : mode === 'upi' ? 'UPI' : mode === 'card' ? 'Card' : mode === 'credit' ? 'Credit' : mode === 'other' ? 'Other' : 'Not set'
                        return (
                          <tr key={mode} className="border-b border-slate-100 last:border-0">
                            <td className="py-1.5 text-slate-800">{label}</td>
                            <td className="py-1.5 text-right text-slate-700">{row.count}</td>
                            <td className="py-1.5 text-right font-medium text-slate-900">₹{row.amount.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Sales trend</h4>
                  <div className="h-32 w-full">
                    {salesTrendData.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 text-slate-500 text-xs">No data</div>
                    ) : (
                      <svg viewBox="0 0 400 120" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="salesTrendGradSalesTab" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        {(() => {
                          const maxVal = Math.max(...salesTrendData.map((d) => d.value), 1)
                          const pts = salesTrendData.map((d, i) => {
                            const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                            const y = 100 - (d.value / maxVal) * 80
                            return `${x},${y}`
                          }).join(' ')
                          const areaPoints = `${pts} 390,100 10,100`
                          return (
                            <>
                              <polyline fill="url(#salesTrendGradSalesTab)" points={areaPoints} />
                              <polyline fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                            </>
                          )
                        })()}
                      </svg>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                    {salesTrendData.filter((_, i) => (overviewDateRange === '30d' ? i % 5 === 0 : true)).slice(0, 8).map((d, i) => (
                      <span key={i}>{d.date}</span>
                    ))}
                  </div>
                </div>
              </div>
              {topSellingMedicines.length > 0 && (
                <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Top selling medicines</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {topSellingMedicines.map((m, i) => (
                      <span key={i} className="text-slate-700"><span className="font-medium text-slate-900">{m.name}</span> <span className="text-slate-500">×{m.count}</span></span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h3 className="font-semibold text-slate-800">Dispensation records</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={salesDate}
                    onChange={(e) => setSalesDate(e.target.value)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <select
                    value={salesPaymentFilter}
                    onChange={(e) => setSalesPaymentFilter(e.target.value)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All payments</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit</option>
                    <option value="other">Other / Insurance</option>
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={salesMinAmount}
                    onChange={(e) => setSalesMinAmount(e.target.value)}
                    placeholder="Min amount"
                    className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={salesMaxAmount}
                    onChange={(e) => setSalesMaxAmount(e.target.value)}
                    placeholder="Max amount"
                    className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={salesSearch}
                    onChange={(e) => setSalesSearch(e.target.value)}
                    placeholder="Search by invoice, name, phone, medicine…"
                    className="w-full sm:w-64 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {(salesDate || salesSearch || salesPaymentFilter !== 'all' || salesMinAmount || salesMaxAmount) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSalesDate('')
                        setSalesSearch('')
                        setSalesPaymentFilter('all')
                        setSalesMinAmount('')
                        setSalesMaxAmount('')
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><LoadingSpinner inline /></div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left p-3">Invoice #</th>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Patient / Customer</th>
                        <th className="text-left p-3">Phone</th>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Payment</th>
                        <th className="text-left p-3">Medicines</th>
                        <th className="text-right p-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSales.map((s) => {
                        const dateRaw = s.dispensedAt
                        const dateStr = !dateRaw ? '—' : typeof dateRaw === 'string' ? dateRaw.slice(0, 10) : (dateRaw as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '—'
                        const name = s.patientName || '—'
                        const phone = s.customerPhone || '—'
                        const type = s.saleType === 'walk_in' ? 'Walk-in' : 'Prescription'
                        const payment = s.paymentMode ? String(s.paymentMode).charAt(0).toUpperCase() + String(s.paymentMode).slice(1) : '—'
                        const returnedMap = getSaleReturnedMap(s)
                        const meds =
                          s.lines
                            ?.map((l) => {
                              const sold = Number(l.quantity) || 0
                              const returned = Number(returnedMap[l.medicineId] || 0)
                              const remaining = Math.max(0, sold - returned)
                              if (!remaining) return null
                              return `${l.medicineName} × ${remaining}`
                            })
                            .filter(Boolean)
                            .join('; ') || '—'
                        const isSelected = selectedSaleDetail?.id === s.id
                        return (
                          <React.Fragment key={s.id}>
                            <tr
                              className={`border-t border-slate-200 cursor-pointer hover:bg-slate-50 ${
                                isSelected ? 'bg-blue-50/40' : ''
                              }`}
                              onClick={() =>
                                setSelectedSaleDetail((prev) => (prev?.id === s.id ? null : s))
                              }
                            >
                              <td className="p-3 font-mono text-xs">{s.invoiceNumber ?? '—'}</td>
                              <td className="p-3">{dateStr}</td>
                              <td className="p-3">{name}</td>
                              <td className="p-3">{phone}</td>
                              <td className="p-3">{type}</td>
                              <td className="p-3">{payment}</td>
                              <td className="p-3 max-w-xs truncate" title={meds}>{meds}</td>
                              <td className="p-3 text-right">₹{s.netAmount ?? s.totalAmount ?? 0}</td>
                            </tr>
                            <tr
                              className={`border-t border-slate-200 transition-all duration-200 ease-out ${
                                isSelected ? 'bg-blue-50/50' : 'bg-[#EEF3FF]'
                              } ${isSelected ? 'animate-[fadeExpand_0.2s_ease-out] opacity-100' : 'hidden opacity-0'}`}
                            >
                              <td colSpan={8} className="p-0 align-top">
                                <div
                                  ref={isSelected ? saleDetailRef : undefined}
                                  className="mx-3 mb-3 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-md"
                                  style={{ borderRadius: 12 }}
                                >
                                  {/* Header */}
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-slate-100">
                                    <div>
                                      <h4 className="text-base font-semibold text-slate-900">Sale Details</h4>
                                      <p className="mt-1 text-sm text-slate-600 font-mono">{s.invoiceNumber ?? s.id}</p>
                                      <p className="mt-0.5 text-sm text-slate-700">{s.patientName || 'Walk-in'}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 text-[11px] text-slate-600">
                                      <div className="flex flex-wrap justify-end gap-2">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.saleType === 'walk_in' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
                                          {s.saleType === 'walk_in' ? 'Walk-in' : 'Prescription'}
                                        </span>
                                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700">
                                          {s.paymentMode ? String(s.paymentMode).charAt(0).toUpperCase() + String(s.paymentMode).slice(1) : '—'}
                                        </span>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                          <span>Payment:&nbsp;<span className="font-medium text-slate-800">{s.paymentMode ? String(s.paymentMode).charAt(0).toUpperCase() + String(s.paymentMode).slice(1) : '—'}</span></span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                          <span>Type:&nbsp;<span className="font-medium text-slate-800">{s.saleType === 'walk_in' ? 'Walk-in' : 'Prescription'}</span></span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                          <span>Phone:&nbsp;<span className="font-medium text-slate-800">{s.customerPhone || '—'}</span></span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 2-column: Medicine table (70%) | Summary (30%) */}
                                  <div className="mt-5 flex flex-col lg:flex-row gap-6">
                                    {/* Left: Medicine table */}
                                    <div className="flex-1 min-w-0 lg:max-w-[70%]">
                                      <div className="rounded-lg border border-slate-100 overflow-hidden">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="bg-slate-50/80 border-b border-slate-200">
                                              <th className="text-left py-3 px-4 font-medium text-slate-600">Medicine</th>
                                              <th className="text-left py-3 px-3 font-medium text-slate-600">Batch</th>
                                              <th className="text-left py-3 px-3 font-medium text-slate-600">Expiry</th>
                                              <th className="text-right py-3 px-3 font-medium text-slate-600">Qty</th>
                                              <th className="text-right py-3 px-3 font-medium text-slate-600">Unit Price</th>
                                              <th className="text-right py-3 px-4 font-medium text-slate-600">Line Total</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {s.lines?.map((l, idx) => {
                                              const unit = Number(l.unitPrice) || 0
                                              const sold = Number(l.quantity) || 0
                                              const returned = Number(returnedMap[l.medicineId] || 0)
                                              const remaining = Math.max(0, sold - returned)
                                              const lineTotal = unit * remaining
                                              return (
                                                <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors">
                                                  <td className="py-3 px-4 font-medium text-slate-900">{l.medicineName}</td>
                                                  <td className="py-3 px-3 text-slate-600">{l.batchNumber || '—'}</td>
                                                  <td className="py-3 px-3 text-slate-500 text-xs">{l.expiryDate || '—'}</td>
                                                  <td className="py-3 px-3 text-right">
                                                    {returned > 0 && (
                                                      <span className="text-[10px] text-slate-400 mr-1">(sold {sold}, returned {returned})</span>
                                                    )}
                                                    <span className="font-medium text-slate-800">{remaining}</span>
                                                  </td>
                                                  <td className="py-3 px-3 text-right text-slate-700 tabular-nums">₹{unit.toFixed(2)}</td>
                                                  <td className="py-3 px-4 text-right font-medium text-slate-900 tabular-nums">₹{lineTotal.toFixed(2)}</td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    {/* Right: Sale summary + metadata */}
                                    <div className="lg:w-[30%] min-w-[240px] flex flex-col gap-4">
                                      <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                                        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sale Summary</h5>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between items-center">
                                            <span className="text-slate-600">Subtotal</span>
                                            <span className="font-medium text-slate-900 tabular-nums">₹{s.totalAmount ?? 0}</span>
                                          </div>
                                          {s.refundedAmount != null && s.refundedAmount > 0 && (
                                            <div className="flex justify-between items-center">
                                              <span className="text-slate-600">Refunded</span>
                                              <span className="font-medium text-rose-600 tabular-nums">₹{s.refundedAmount}</span>
                                            </div>
                                          )}
                                          <div className="border-t border-slate-200 pt-2 mt-2">
                                            <div className="flex justify-between items-center">
                                              <span className="font-semibold text-slate-700">Net Amount</span>
                                              <span className="text-lg font-bold text-emerald-600 tabular-nums">
                                                ₹{s.netAmount ?? Math.max(0, (s.totalAmount || 0) - (s.refundedAmount || 0))}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!loading && filteredSales.length === 0 && (
                <p className="text-slate-500 py-6 text-center">No sales yet. Dispense from the Dispense & Billing tab or sell to walk-in customers above.</p>
              )}
            </div>

            {filteredSales.length > 0 && (
              <Pagination
                currentPage={salesPage}
                totalPages={salesTotalPages}
                pageSize={salesPageSize}
                totalItems={filteredSales.length}
                onPageChange={goToSalesPage}
                onPageSizeChange={setSalesPageSize}
                itemLabel="sales"
              />
            )}
          </div>
        )}

        {subTab === 'cash_and_expenses' && (
          <div className="space-y-6">
            {/* Daily income & expense summary */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Today&apos;s summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg border border-slate-200 bg-emerald-50/60 p-4">
                  <p className="text-xs font-medium text-slate-600 mb-0.5">Daily income (sales)</p>
                  <p className="text-lg font-semibold text-emerald-800">₹{dailySummary.todaySalesTotal.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-rose-50/60 p-4">
                  <p className="text-xs font-medium text-slate-600 mb-0.5">Daily expenses</p>
                  <p className="text-lg font-semibold text-rose-800">₹{dailySummary.todayExpenseTotal.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-600 mb-0.5">Net (income − expense)</p>
                  <p className={`text-lg font-semibold ${dailySummary.net >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                    ₹{dailySummary.net.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center">
                  <span className="text-xs text-slate-500">{dailySummary.todayStr}</span>
                </div>
              </div>
            </div>

            {/* Billing counter */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Billing counter</h3>
                  <p className="text-sm text-slate-500">
                    Open and close your cash register for this branch. Tracks opening cash, cash sales, refunds and expected vs actual cash.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {!cashSessionsLoading && activeCashSession && (
                    <button
                      type="button"
                      onClick={() => {
                        closeCounterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setHighlightCloseCounter(true)
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 transition-colors"
                    >
                      <span>Close shift</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                  {!cashSessionsLoading && !activeCashSession && (
                    <button
                      type="button"
                      onClick={() => {
                        openCounterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setHighlightOpenCounter(true)
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                      <span>Start shift</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </button>
                  )}
                  <div className="flex flex-col items-end gap-1 text-xs text-slate-600">
                    <span>
                      Branch:&nbsp;
                      <span className="font-medium text-slate-900">
                        {branches.find((b) => b.id === branchFilter)?.name || (branchFilter === 'all' ? 'All branches' : '—')}
                      </span>
                    </span>
                    <span>Today: {new Date().toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {cashSessionsLoading ? (
                <div className="flex justify-center py-6">
                  <LoadingSpinner inline />
                </div>
              ) : activeCashSession ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">Opening cash</span>
                      <span className="text-sm font-semibold text-slate-900">₹{activeCashSession.openingCashTotal.toFixed(2)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Opened at{' '}
                      {typeof activeCashSession.openedAt === 'string'
                        ? new Date(activeCashSession.openedAt).toLocaleTimeString('en-IN')
                        : ''}
                    </p>
                    <span className="inline-flex w-fit items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                      Session status: Open
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cash sales (today)</span>
                      <span className="font-semibold text-slate-900">
                        ₹
                        {filteredSales
                          .filter((s) => s.paymentMode === 'cash')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">UPI sales (today)</span>
                      <span className="font-semibold text-slate-900">
                        ₹
                        {filteredSales
                          .filter((s) => s.paymentMode === 'upi')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Card sales (today)</span>
                      <span className="font-semibold text-slate-900">
                        ₹
                        {filteredSales
                          .filter((s) => s.paymentMode === 'card')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Refunds (total)</span>
                      <span className="font-semibold text-rose-600">
                        ₹
                        {sales.reduce((sum, s) => sum + Number(s.refundedAmount || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div
                    ref={closeCounterSectionRef}
                    className={`rounded-lg border transition-all duration-300 ${
                      highlightCloseCounter ? 'border-rose-400 ring-2 ring-rose-300 ring-offset-2 bg-rose-50/50' : 'border-slate-200 bg-slate-50/60'
                    } p-4 space-y-3`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">Close counter</span>
                      <span className="text-[11px] text-slate-500">Enter physical cash to reconcile</span>
                    </div>
                    {/* Other payment amounts (UPI, Card, etc.) shown on close */}
                    <div className="rounded border border-slate-200 bg-white p-2 space-y-1 text-[11px]">
                      <div className="font-medium text-slate-600 mb-1">Other payments (this session)</div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">UPI</span>
                        <span className="font-semibold tabular-nums">
                          ₹{filteredSales.filter((s) => s.paymentMode === 'upi').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Card</span>
                        <span className="font-semibold tabular-nums">
                          ₹{filteredSales.filter((s) => s.paymentMode === 'card').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Other</span>
                        <span className="font-semibold tabular-nums">
                          ₹{filteredSales.filter((s) => s.paymentMode !== 'cash' && s.paymentMode !== 'upi' && s.paymentMode !== 'card').reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {/* Change given (notes/coins given back to customers) */}
                    {(Number(activeCashSession?.changeGiven) || 0) > 0 && (
                      <div className="rounded border border-amber-200 bg-amber-50/80 p-2 space-y-1 text-[11px]">
                        <div className="font-medium text-amber-800 mb-1">Change given (notes/coins given back)</div>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-700">Total</span>
                          <span className="font-semibold tabular-nums text-amber-900">₹{Number(activeCashSession?.changeGiven ?? 0).toFixed(2)}</span>
                        </div>
                        {activeCashSession?.changeNotesTotal && Object.keys(activeCashSession.changeNotesTotal).some((d) => (activeCashSession!.changeNotesTotal![d] || 0) > 0) && (
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 pt-1 border-t border-amber-200/60">
                            {['500', '200', '100', '50', '20', '10', '5', '2', '1'].map((d) => {
                              const n = Number(activeCashSession?.changeNotesTotal?.[d]) || 0
                              if (n === 0) return null
                              return (
                                <span key={d} className="text-amber-800 tabular-nums">₹{d} × {n}</span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Combined note breakdown: Opening + Added from sales − Given as change = Total */}
                    {activeCashSession?.openingNotes && (
                      <div className="rounded border border-slate-200 bg-white overflow-hidden">
                        <div className="text-[11px] font-medium text-slate-600 bg-slate-50 px-2 py-1.5 border-b border-slate-200">Combined record (Opening + Sales − Change)</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-200">
                                <th className="text-left py-1.5 px-2 font-medium text-slate-600">₹</th>
                                <th className="text-right py-1.5 px-1 font-medium text-slate-600">Opening</th>
                                <th className="text-right py-1.5 px-1 font-medium text-emerald-600">+ Added (sales)</th>
                                <th className="text-right py-1.5 px-1 font-medium text-amber-600">− Given (change)</th>
                                <th className="text-right py-1.5 px-2 font-medium text-slate-700">= Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {['500', '200', '100', '50', '20', '10', '5', '2', '1'].map((d) => {
                                const open = Number(activeCashSession?.openingNotes?.[d]) || 0
                                const run = Number(activeCashSession?.runningNotes?.[d]) || 0
                                const change = Number(activeCashSession?.changeNotesTotal?.[d]) || 0
                                const added = Math.max(0, run - open + change)
                                return (
                                  <tr key={d} className="border-b border-slate-100">
                                    <td className="py-1 px-2 text-slate-700 font-medium">₹{d}</td>
                                    <td className="text-right tabular-nums">{open}</td>
                                    <td className="text-right tabular-nums text-emerald-700">+{added}</td>
                                    <td className="text-right tabular-nums text-amber-700">−{change}</td>
                                    <td className="text-right tabular-nums font-semibold text-slate-900">{run}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {/* Expected cash (auto from dispense/billing) */}
                    {(() => {
                      const denoms = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
                      const expectedTotal = denoms.reduce((sum, d) => sum + (Number(activeCashSession?.runningNotes?.[d]) || 0) * Number(d), 0)
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-600">Expected cash in drawer (auto from sales)</span>
                          <span className="text-xs font-semibold text-slate-900 tabular-nums">₹{expectedTotal.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              const session = await fetchCashSessions()
                              const run = session?.runningNotes
                              if (run) {
                                const next: Record<string, string> = {}
                                denoms.forEach((d) => { next[d] = run[d] != null && run[d] > 0 ? String(run[d]) : '' })
                                setCashClosingNotes(next)
                              }
                            }}
                            className="text-[10px] font-medium text-blue-600 hover:text-blue-800 underline"
                          >
                            Refresh expected
                          </button>
                        </div>
                      )
                    })()}
                    <p className="text-[11px] text-slate-500">Actual count — edit to match physical cash in drawer</p>
                    <div className="grid grid-cols-3 gap-1 text-[11px]">
                      {['500', '200', '100', '50', '20', '10', '5', '2', '1'].map((den) => (
                        <label key={den} className="flex items-center gap-1">
                          <span className="text-slate-600">₹{den}</span>
                          <input
                            type="number"
                            min={0}
                            value={cashClosingNotes[den] ?? ''}
                            onChange={(e) =>
                              setCashClosingNotes((prev) => ({ ...prev, [den]: e.target.value }))
                            }
                            className="w-14 rounded border border-slate-300 px-1 py-0.5 text-right text-[11px]"
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-700"
                      onClick={() => setShowCloseShiftConfirm(true)}
                    >
                      Close counter & save report
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  {lastClosedSummary && (
                    <div className="md:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-emerald-900">Shift closed</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-emerald-700 block text-xs">Opening amount</span>
                          <span className="font-semibold text-emerald-900 tabular-nums">₹{lastClosedSummary.openingCashTotal.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-emerald-700 block text-xs">Closing amount</span>
                          <span className="font-semibold text-emerald-900 tabular-nums">₹{lastClosedSummary.closingCashTotal.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-emerald-700 block text-xs">Profit (shift)</span>
                          <span className="font-semibold text-emerald-900 tabular-nums">₹{lastClosedSummary.profit.toFixed(2)}</span>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => { setLastClosedSummary(null); openCounterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlightOpenCounter(true) }}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                          >
                            Start new shift
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-emerald-700">Enter opening cash below and open counter to start the next shift.</p>
                    </div>
                  )}
                  <div
                    ref={openCounterSectionRef}
                    className={`rounded-xl border transition-all duration-300 ${
                      highlightOpenCounter ? 'border-emerald-400 ring-2 ring-emerald-300 ring-offset-2 bg-emerald-50/30' : 'border-slate-200'
                    } p-4`}
                  >
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Open counter (Start shift)</h4>
                    <p className="text-xs text-slate-500 mb-3">
                      Enter opening cash breakdown at the start of the day. System will use this for reconciliation at close.
                    </p>
                    {recentCashSessions.filter((s) => s.status !== 'open').length > 0 && (() => {
                      const lastClosed = recentCashSessions.find((s) => s.status !== 'open')
                      const amt = lastClosed ? Number(lastClosed.closingCashTotal ?? 0) : 0
                      return (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (!lastClosed?.closingNotes) return
                              const denoms = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
                              const next: Record<string, string> = {}
                              denoms.forEach((d) => {
                                const n = lastClosed.closingNotes?.[d]
                                next[d] = n != null && n > 0 ? String(n) : ''
                              })
                              setCashOpeningNotes(next)
                            }}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-1"
                          >
                            Load previous counter
                          </button>
                          <span className="text-[11px] text-slate-500 ml-2">
                            (Use last closed shift’s cash as opening — ₹{amt.toFixed(2)})
                          </span>
                        </div>
                      )
                    })()}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 max-w-xl">
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 block mb-1">Cashier</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedCashierId}
                            onChange={(e) => setSelectedCashierId(e.target.value)}
                            className="w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                          >
                            <option value="">Select cashier</option>
                            {cashiers.map((c) => {
                              const inUse = recentCashSessions.some(
                                (s) => s.status === 'open' && s.cashierProfileId === c.id,
                              )
                              return (
                                <option key={c.id} value={c.id} disabled={inUse}>
                                  {c.name}
                                  {c.phone ? ` (${c.phone})` : ''}
                                  {inUse ? ' — in shift' : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600 block mb-1">Counter</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedCounterId}
                            onChange={(e) => setSelectedCounterId(e.target.value)}
                            className="w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                          >
                            <option value="">Select counter</option>
                            {counters.map((c) => {
                              const inUse = recentCashSessions.some(
                                (s) => s.status === 'open' && s.counterId === c.id,
                              )
                              return (
                                <option key={c.id} value={c.id} disabled={inUse}>
                                  {c.name}
                                  {inUse ? ' — in use' : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                        {['500', '200', '100', '50', '20', '10', '5', '2', '1'].map((den) => (
                          <label key={den} className="flex flex-col gap-1">
                            <span className="text-slate-600">₹{den}</span>
                            <input
                              type="number"
                              min={0}
                              value={cashOpeningNotes[den] ?? ''}
                              onChange={(e) =>
                                setCashOpeningNotes((prev) => ({ ...prev, [den]: e.target.value }))
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1 text-right text-[11px]"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-700">
                        <span>Opening cash total</span>
                        <span className="font-semibold text-slate-900">
                          ₹
                          {['500', '200', '100', '50', '20', '10', '5', '2', '1'].reduce((sum, den) => {
                            const count = Math.max(0, Number(cashOpeningNotes[den] || 0))
                            return sum + count * Number(den)
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-emerald-700"
                        onClick={async () => {
                          const token = await getToken()
                          if (!token || !activeHospitalId) return
                          if (!selectedCashierId || !selectedCounterId) {
                            setError('Select both cashier and counter to open a shift.')
                            return
                          }
                          const cashier = cashiers.find((c) => c.id === selectedCashierId)
                          const counter = counters.find((c) => c.id === selectedCounterId)
                          const notesNum: Record<string, number> = {}
                          let openingTotal = 0
                          ;['500', '200', '100', '50', '20', '10', '5', '2', '1'].forEach((den) => {
                            const count = Math.max(0, Number(cashOpeningNotes[den] || 0))
                            notesNum[den] = count
                            openingTotal += count * Number(den)
                          })
                          try {
                            const res = await fetch('/api/pharmacy/cash-session', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                action: 'open',
                                hospitalId: activeHospitalId,
                                branchId: branchFilter === 'all' ? undefined : branchFilter,
                                openingNotes: notesNum,
                                openingCashTotal: openingTotal,
                        openedByName: openedByName || cashier?.name || undefined,
                                cashierProfileId: cashier?.id,
                                cashierName: cashier?.name,
                                counterId: counter?.id,
                                counterName: counter?.name,
                              }),
                            })
                            const data = await res.json().catch(() => ({}))
                            if (!res.ok || !data.success) {
                              setError(data.error || 'Failed to open counter')
                              return
                            }
                            setSuccess('Billing counter opened.')
                            setActiveCashSession(data.session)
                            setLastClosedSummary(null)
                          } catch (e: any) {
                            setError(e?.message || 'Failed to open counter')
                          }
                        }}
                      >
                        Open counter
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600 space-y-2">
                    <h4 className="text-sm font-semibold text-slate-800 mb-1">How this works</h4>
                    <p>1. At the start of your shift, enter the physical cash in the drawer and open the counter.</p>
                    <p>2. During the day, the system tracks cash sales and refunds.</p>
                    <p>3. At the end, count cash again, enter the breakdown and close the counter to see any short / extra.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Shift reports – closed sessions with name, times, amounts */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Shift reports</h3>
              <p className="text-sm text-slate-500 mb-4">Closed shifts with who opened/closed, times, opening/closing amount and profit.</p>
              {recentCashSessions.filter((s) => s.status !== 'open').length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No closed shifts yet. Close a shift to see it here.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2">Opened by</th>
                        <th className="text-left px-3 py-2">Opened at</th>
                        <th className="text-left px-3 py-2">Closed by</th>
                        <th className="text-left px-3 py-2">Closed at</th>
                        <th className="text-right px-3 py-2">Opening</th>
                        <th className="text-right px-3 py-2">Closing</th>
                        <th className="text-right px-3 py-2">Profit</th>
                        <th className="w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {recentCashSessions
                        .filter((s) => s.status !== 'open')
                        .slice(0, 20)
                        .map((s) => {
                          const opened = typeof s.openedAt === 'string' ? s.openedAt : (s.openedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.()
                          const closed = s.closedAt && (typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.())
                          const cash = Number(s.cashSales ?? 0)
                          const upi = Number(s.upiSales ?? 0)
                          const card = Number(s.cardSales ?? 0)
                          const refunds = Number(s.refunds ?? 0)
                          const cashExp = Number(s.cashExpenses ?? 0)
                          const totalCollection = cash + upi + card - refunds
                          const profit = totalCollection - cashExp
                          return (
                            <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-medium text-slate-800">{s.openedByName ?? '—'}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {opened ? new Date(opened).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                              </td>
                              <td className="px-3 py-2 font-medium text-slate-800">{s.closedByName ?? '—'}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {closed ? new Date(closed).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums">₹{Number(s.openingCashTotal ?? 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums">₹{Number(s.closingCashTotal ?? 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">₹{profit.toFixed(2)}</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => setViewShiftReportSession(s)}
                                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                >
                                  View report
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Expenses */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Expenses</h3>
                <p className="text-sm text-slate-500">
                  Record operational expenses for this branch and review expense history.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <label className="flex items-center gap-1">
                  <span>From</span>
                  <input
                    type="date"
                    value={expenseFilters.dateFrom}
                    onChange={(e) => setExpenseFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span>To</span>
                  <input
                    type="date"
                    value={expenseFilters.dateTo}
                    onChange={(e) => setExpenseFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                  />
                </label>
                <select
                  value={expenseFilters.categoryId}
                  onChange={(e) => setExpenseFilters((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <option value="all">All categories</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={expenseFilters.paymentMethod}
                  onChange={(e) => setExpenseFilters((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  className="rounded-full border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <option value="all">All payments</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank</option>
                </select>
                <button
                  type="button"
                  className="text-[11px] text-blue-600 hover:text-blue-800 underline"
                  onClick={fetchExpensesAndCategories}
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Manage Cashier and Counter */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Manage Cashier and Counter</h3>
              <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
                <button
                  type="button"
                  onClick={() => setManageCashierCounterTab('cashier')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                    manageCashierCounterTab === 'cashier'
                      ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cashier
                </button>
                <button
                  type="button"
                  onClick={() => setManageCashierCounterTab('counter')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                    manageCashierCounterTab === 'counter'
                      ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Counter
                </button>
              </div>
              {manageCashierCounterTab === 'cashier' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-slate-500">Add and manage cashiers for billing.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCashierId(null)
                        setNewCashier({ name: '', phone: '' })
                        setShowCreateCashierModal(true)
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Create
                    </button>
                  </div>
                  {cashiers.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">No cashiers yet. Click Create to add one.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-slate-700">Name</th>
                            <th className="text-left px-3 py-2 font-medium text-slate-700">Phone</th>
                            <th className="w-28 text-right px-3 py-2 font-medium text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cashiers.map((c) => (
                            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-slate-900">{c.name}</td>
                              <td className="px-3 py-2 text-slate-600">{c.phone || '—'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCashierId(c.id)
                                    setNewCashier({ name: c.name, phone: c.phone || '' })
                                    setShowCreateCashierModal(true)
                                  }}
                                  className="text-emerald-600 hover:text-emerald-800 font-medium text-xs mr-2"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!window.confirm(`Delete cashier "${c.name}"? They will be removed from the list.`)) return
                                    const token = await getToken()
                                    if (!token) return
                                    try {
                                      const res = await fetch(`/api/pharmacy/cashiers/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
                                      const data = await res.json().catch(() => ({}))
                                      if (!res.ok || !data.success) {
                                        setError(data.error || 'Failed to delete cashier')
                                        return
                                      }
                                      setCashiers((prev) => prev.filter((x) => x.id !== c.id))
                                      setSuccess('Cashier removed.')
                                    } catch (e: any) {
                                      setError(e?.message || 'Failed to delete cashier')
                                    }
                                  }}
                                  className="text-rose-600 hover:text-rose-800 font-medium text-xs"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {manageCashierCounterTab === 'counter' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-slate-500">Add and manage billing counters.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCounterId(null)
                        setNewCounterName('')
                        setShowCreateCounterModal(true)
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Create
                    </button>
                  </div>
                  {counters.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4">No counters yet. Click Create to add one.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-slate-700">Counter name</th>
                            <th className="w-28 text-right px-3 py-2 font-medium text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {counters.map((c) => (
                            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="px-3 py-2 text-slate-900">{c.name}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCounterId(c.id)
                                    setNewCounterName(c.name)
                                    setShowCreateCounterModal(true)
                                  }}
                                  className="text-emerald-600 hover:text-emerald-800 font-medium text-xs mr-2"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!window.confirm(`Delete counter "${c.name}"? It will be removed from the list.`)) return
                                    const token = await getToken()
                                    if (!token) return
                                    try {
                                      const res = await fetch(`/api/pharmacy/counters/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
                                      const data = await res.json().catch(() => ({}))
                                      if (!res.ok || !data.success) {
                                        setError(data.error || 'Failed to delete counter')
                                        return
                                      }
                                      setCounters((prev) => prev.filter((x) => x.id !== c.id))
                                      setSuccess('Counter removed.')
                                    } catch (e: any) {
                                      setError(e?.message || 'Failed to delete counter')
                                    }
                                  }}
                                  className="text-rose-600 hover:text-rose-800 font-medium text-xs"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              {/* Add expense form */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-800">Add expense</h4>
                <div className="grid grid-cols-1 gap-3 text-xs text-slate-700">
                  <label className="flex flex-col gap-1">
                    <span>Date</span>
                    <input
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Note <span className="text-rose-500">*</span></span>
                    <textarea
                      rows={2}
                      value={expenseForm.note}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, note: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs resize-none"
                      placeholder="e.g. Buying new stand"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Amount (₹)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>Payment method</span>
                    <select
                      value={expenseForm.paymentMethod}
                      onChange={(e) => setExpenseForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank">Bank</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-blue-700"
                  onClick={async () => {
                    if (!activeHospitalId) {
                      setError('Active hospital is not set.')
                      return
                    }
                    const note = expenseForm.note.trim()
                    const amount = Number(expenseForm.amount)
                    if (!expenseForm.date || !note) {
                      setError('Please fill date and note (required).')
                      return
                    }
                    if (!amount || amount <= 0) {
                      setError('Please enter a valid amount.')
                      return
                    }
                    if (branchFilter === 'all') {
                      setError('Select a branch to add expense.')
                      return
                    }
                    if (expenseForm.paymentMethod === 'cash') {
                      if (!activeCashSession) {
                        setError('Start a cash session first to record cash expense.')
                        return
                      }
                      setPendingExpensePayload({
                        amount,
                        date: expenseForm.date,
                        note,
                        paymentMethod: expenseForm.paymentMethod,
                      })
                      setShowExpenseCashModal(true)
                      return
                    }
                    try {
                      setError(null)
                      const token = await getToken()
                      if (!token) throw new Error('Not authenticated')
                      const res = await fetch('/api/pharmacy/expenses', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          hospitalId: activeHospitalId,
                          branchId: branchFilter,
                          date: expenseForm.date,
                          note,
                          amount,
                          paymentMethod: expenseForm.paymentMethod,
                        }),
                      })
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add expense')
                      setSuccess('Expense recorded.')
                      setExpenseForm((prev) => ({ ...prev, amount: '', note: '' }))
                      fetchExpensesAndCategories()
                      fetchCashSessions()
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : 'Failed to add expense')
                    }
                  }}
                >
                  Save expense
                </button>
                {pendingExpensePayload && (
                  <RefundCashModal
                    isOpen={showExpenseCashModal}
                    onClose={() => { setShowExpenseCashModal(false); setPendingExpensePayload(null) }}
                    refundAmount={pendingExpensePayload.amount}
                    onConfirm={async (expenseNotes) => {
                      if (!pendingExpensePayload) return
                      try {
                        setError(null)
                        const token = await getToken()
                        if (!token) throw new Error('Not authenticated')
                        const res = await fetch('/api/pharmacy/expenses', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            hospitalId: activeHospitalId,
                            branchId: branchFilter,
                            date: pendingExpensePayload.date,
                            note: pendingExpensePayload.note,
                            amount: pendingExpensePayload.amount,
                            paymentMethod: 'cash',
                            expenseNotes,
                          }),
                        })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add expense')
                        setSuccess('Expense recorded. Counter updated.')
                        setExpenseForm((prev) => ({ ...prev, amount: '', note: '' }))
                        setShowExpenseCashModal(false)
                        setPendingExpensePayload(null)
                        fetchExpensesAndCategories()
                        fetchCashSessions()
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : 'Failed to add expense')
                      }
                    }}
                  />
                )}
              </div>

              {/* Expense list */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <h4 className="text-sm font-semibold text-slate-800">Expense history</h4>
                    <span className="text-[11px] text-slate-500">
                      {expenses.length} record(s), total ₹
                      {expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2">Date</th>
                        <th className="text-left px-3 py-2">Note</th>
                        <th className="text-right px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Payment</th>
                        <th className="text-left px-3 py-2">Branch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-xs">
                            No expenses in the selected range.
                          </td>
                        </tr>
                      ) : (
                        expenses.map((e) => (
                          <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                            <td className="px-3 py-2">
                              {typeof e.date === 'string'
                                ? e.date.slice(0, 10)
                                : (e.date as any)?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? ''}
                            </td>
                            <td className="px-3 py-2 max-w-xs truncate" title={e.description ?? e.categoryName ?? ''}>
                              {e.description || e.categoryName || '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              ₹{Number(e.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 capitalize">
                              {e.paymentMethod}
                            </td>
                            <td className="px-3 py-2">
                              {branches.find((b) => b.id === e.branchId)?.name || e.branchId}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === 'returns' && (
          <div className="space-y-6">
            {!cashSessionsLoading && !activeCashSession && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                <span className="font-medium">Start a cash session to process returns.</span>
                <span>Go to{' '}
                  <button
                    type="button"
                    onClick={() => setSubTab('cash_and_expenses')}
                    className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded"
                  >
                    Cash & expenses
                  </button>
                  {' '}and click <strong>Start shift</strong>.</span>
              </div>
            )}
            {/* Selling data – same as Overview */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] p-4 sm:p-5">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Selling data</h3>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {(['today', '7d', '30d', '6m', 'year', 'all'] as OverviewDateRange[]).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setOverviewDateRange(range)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition ${overviewDateRange === range ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                  >
                    {range === 'today' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : range === '6m' ? '6m' : range === 'year' ? 'Year' : 'All'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Sales</p>
                  <p className="text-xl font-bold text-slate-900">₹{periodSalesTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-emerald-600">Revenue</p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Sales returns</p>
                  <p className="text-xl font-bold text-rose-600">₹{periodRefundTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-rose-500">Refunded</p>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Bills</p>
                  <p className="text-xl font-bold text-slate-900">{periodSalesCount}</p>
                  <p className="text-[10px] text-slate-500">In period</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Payments by mode</h4>
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-1.5 font-medium text-slate-700">Mode</th>
                        <th className="text-right py-1.5 font-medium text-slate-700">Bills</th>
                        <th className="text-right py-1.5 font-medium text-slate-700">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['cash', 'upi', 'card', 'credit', 'other', 'unknown'].map((mode) => {
                        const row = paymentModeSummary[mode]
                        if (!row) return null
                        const label = mode === 'cash' ? 'Cash' : mode === 'upi' ? 'UPI' : mode === 'card' ? 'Card' : mode === 'credit' ? 'Credit' : mode === 'other' ? 'Other' : 'Not set'
                        return (
                          <tr key={mode} className="border-b border-slate-100 last:border-0">
                            <td className="py-1.5 text-slate-800">{label}</td>
                            <td className="py-1.5 text-right text-slate-700">{row.count}</td>
                            <td className="py-1.5 text-right font-medium text-slate-900">₹{row.amount.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Sales trend</h4>
                  <div className="h-32 w-full">
                    {salesTrendData.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 text-slate-500 text-xs">No data</div>
                    ) : (
                      <svg viewBox="0 0 400 120" className="h-full w-full overflow-visible" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="salesTrendGradReturnsTab" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        {(() => {
                          const maxVal = Math.max(...salesTrendData.map((d) => d.value), 1)
                          const pts = salesTrendData.map((d, i) => {
                            const x = (i / (salesTrendData.length - 1 || 1)) * 380 + 10
                            const y = 100 - (d.value / maxVal) * 80
                            return `${x},${y}`
                          }).join(' ')
                          const areaPoints = `${pts} 390,100 10,100`
                          return (
                            <>
                              <polyline fill="url(#salesTrendGradReturnsTab)" points={areaPoints} />
                              <polyline fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                            </>
                          )
                        })()}
                      </svg>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                    {salesTrendData.filter((_, i) => (overviewDateRange === '30d' ? i % 5 === 0 : true)).slice(0, 8).map((d, i) => (
                      <span key={i}>{d.date}</span>
                    ))}
                  </div>
                </div>
              </div>
              {topSellingMedicines.length > 0 && (
                <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Top selling medicines</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {topSellingMedicines.map((m, i) => (
                      <span key={i} className="text-slate-700"><span className="font-medium text-slate-900">{m.name}</span> <span className="text-slate-500">×{m.count}</span></span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-2">Sales returns</h3>
              <p className="text-sm text-slate-500 mb-4">
                Click a sale to expand return details below that row, enter quantities to return, and the system will update stock and net sale amount automatically.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-semibold text-slate-800">Sales returns</h4>
                      {returnsInnerTab === 'by_return' && (
                        <div className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 border border-rose-100">
                          Total refunded: ₹{totalRefundForFilteredSales.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {filteredReturnSales.length} sale(s) with returns in current filters
                    </span>
                    <div className="mt-1 inline-flex rounded-full bg-slate-50 p-1 text-[11px] font-medium text-slate-600">
                      <button
                        type="button"
                        onClick={() => setReturnsInnerTab('by_sale')}
                        className={`px-3 py-1.5 rounded-full transition ${returnsInnerTab === 'by_sale' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                      >
                        By sale
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnsInnerTab('by_return')}
                        className={`px-3 py-1.5 rounded-full transition ${returnsInnerTab === 'by_return' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                      >
                        Return events
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={returnsDate}
                      onChange={(e) => setReturnsDate(e.target.value)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select
                      value={returnsPaymentFilter}
                      onChange={(e) => setReturnsPaymentFilter(e.target.value)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All payments</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="credit">Credit</option>
                      <option value="other">Other / Insurance</option>
                    </select>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={returnsMinAmount}
                      onChange={(e) => setReturnsMinAmount(e.target.value)}
                      placeholder="Min amount"
                      className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={returnsMaxAmount}
                      onChange={(e) => setReturnsMaxAmount(e.target.value)}
                      placeholder="Max amount"
                      className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={returnsSearch}
                      onChange={(e) => setReturnsSearch(e.target.value)}
                      placeholder="Search by invoice, name, phone, medicine…"
                      className="w-full sm:w-56 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {(returnsDate || returnsSearch || returnsPaymentFilter !== 'all' || returnsMinAmount || returnsMaxAmount) && (
                      <button
                        type="button"
                        onClick={() => {
                          setReturnsDate('')
                          setReturnsSearch('')
                          setReturnsPaymentFilter('all')
                          setReturnsMinAmount('')
                          setReturnsMaxAmount('')
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                {loading ? (
                  <div className="flex justify-center py-8"><LoadingSpinner inline /></div>
                ) : returnsInnerTab === 'by_sale' ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left p-3">Invoice #</th>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Patient / Customer</th>
                          <th className="text-right p-3">Amount</th>
                          <th className="text-right p-3">Net after returns</th>
                          <th className="text-right p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedReturnSales.map((s) => {
                          const dateRaw = s.dispensedAt
                          const dateStr = !dateRaw
                            ? '—'
                            : typeof dateRaw === 'string'
                            ? dateRaw.slice(0, 10)
                            : (dateRaw as { toDate?: () => Date })?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? '—'
                          const name = s.patientName || '—'
                          const total = s.totalAmount ?? 0
                          const refunded = s.refundedAmount ?? 0
                          const net = s.netAmount ?? Math.max(0, total - refunded)
                          const isSelected = selectedReturnSale?.id === s.id
                          const returnedMap = getSaleReturnedMap(s)
                          const saleLines = s.lines || []
                          const estimatedRefund = isSelected
                            ? saleLines.reduce((sum, l) => {
                                const raw = returnQuantities[l.medicineId] || ''
                                const qty = Math.floor(Number(raw) || 0)
                                const unit = Number(l.unitPrice) || 0
                                return sum + (qty > 0 ? qty * unit : 0)
                              }, 0)
                            : 0
                          return (
                            <React.Fragment key={s.id}>
                              <tr
                                className={`border-t border-slate-200 cursor-pointer hover:bg-slate-50 ${
                                  isSelected ? 'bg-blue-50/40' : ''
                                }`}
                                onClick={() => {
                                  if (selectedReturnSale?.id === s.id) {
                                    setSelectedReturnSale(null)
                                    setReturnQuantities({})
                                  } else {
                                    setSelectedReturnSale(s)
                                    setReturnQuantities({})
                                  }
                                }}
                              >
                                <td className="p-3 font-mono text-xs">{s.invoiceNumber ?? '—'}</td>
                                <td className="p-3">{dateStr}</td>
                                <td className="p-3">{name}</td>
                                <td className="p-3 text-right">₹{total}</td>
                                <td className="p-3 text-right">₹{net}</td>
                                <td className="p-3 text-right text-[11px] text-slate-500">
                                  Click row to enter return
                                </td>
                              </tr>
                              <tr
                                className={`border-t border-slate-200 bg-[#EEF3FF] transition-all duration-200 ease-out ${
                                  isSelected ? 'animate-[fadeExpand_0.18s_ease-out] opacity-100' : 'hidden opacity-0'
                                }`}
                              >
                                <td colSpan={6} className="p-3">
                                  <div className="rounded-xl bg-white shadow-sm border border-slate-200 p-3 sm:p-4">
                                    <form
                                      onSubmit={async (e) => {
                                        e.preventDefault()
                                        if (!activeCashSession) {
                                          setError('Please start a cash session first to process returns (Cash & expenses → Start shift).')
                                          return
                                        }
                                        const lines = saleLines
                                        const retMap = getSaleReturnedMap(s)
                                        const payloadLines = lines
                                          .map((l) => {
                                            const raw = returnQuantities[l.medicineId] || ''
                                            const qty = Math.floor(Number(raw) || 0)
                                            if (qty <= 0) return null
                                            const sold = Number(l.quantity) || 0
                                            const alreadyReturned = Number(retMap[l.medicineId] || 0)
                                            const maxReturn = Math.max(0, sold - alreadyReturned)
                                            const clampedQty = Math.min(qty, maxReturn)
                                            return clampedQty > 0 ? { medicineId: l.medicineId, quantity: clampedQty } : null
                                          })
                                          .filter(Boolean) as { medicineId: string; quantity: number }[]
                                        if (payloadLines.length === 0) {
                                          setError('Enter at least one quantity to return.')
                                          return
                                        }
                                        const refundAmount = payloadLines.reduce((sum, pl) => {
                                          const line = saleLines.find((l) => l.medicineId === pl.medicineId)
                                          return sum + (line ? pl.quantity * (Number(line.unitPrice) || 0) : 0)
                                        }, 0)
                                        setError(null)
                                        setPendingReturnPayload({ saleId: s.id, lines: payloadLines, refundAmount })
                                        setRefundPaymentMode('cash')
                                        setShowRefundPaymentModal(true)
                                      }}
                                      className="space-y-3"
                                    >
                                      <div className="text-xs text-slate-600">
                                        Invoice&nbsp;
                                        <span className="font-mono">{s.invoiceNumber ?? s.id}</span>
                                      </div>
                                      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                                        <table className="w-full text-[11px]">
                                          <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                              <th className="text-left px-2 py-1.5">Medicine</th>
                                              <th className="text-right px-2 py-1.5">Sold</th>
                                              <th className="text-right px-2 py-1.5">Unit price</th>
                                              <th className="text-right px-2 py-1.5">Return qty</th>
                                              <th className="text-right px-2 py-1.5">Line refund</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {saleLines.map((l) => {
                                              const key = l.medicineId
                                              const raw = returnQuantities[key] || ''
                                              const qty = Math.floor(Number(raw) || 0)
                                              const unit = Number(l.unitPrice) || 0
                                              const sold = Number(l.quantity) || 0
                                              const alreadyReturned = Number(returnedMap[l.medicineId] || 0)
                                              const remaining = Math.max(0, sold - alreadyReturned)
                                              const lineRefund = qty > 0 ? qty * unit : 0
                                              return (
                                                <tr key={key} className="border-t border-slate-200">
                                                  <td className="px-2 py-1.5 font-medium text-slate-900">
                                                    {l.medicineName}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-right text-slate-700">
                                                    {alreadyReturned > 0 && (
                                                      <span className="text-[10px] text-slate-400 mr-1">
                                                        (sold {sold}, returned {alreadyReturned})
                                                      </span>
                                                    )}
                                                    {remaining}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-right text-slate-700">
                                                    ₹{unit.toFixed(2)}
                                                  </td>
                                                  <td className="px-2 py-1.5 text-right">
                                                    <input
                                                      type="number"
                                                      min={0}
                                                      max={remaining}
                                                      value={returnQuantities[key] ?? ''}
                                                      onChange={(e) => {
                                                        const v = e.target.value
                                                        if (v === '') {
                                                          setReturnQuantities((prev) => ({ ...prev, [key]: '' }))
                                                          return
                                                        }
                                                        const num = Math.floor(Number(v)) || 0
                                                        const clamped = Math.min(Math.max(0, num), remaining)
                                                        setReturnQuantities((prev) => ({ ...prev, [key]: String(clamped) }))
                                                      }}
                                                      onBlur={(e) => {
                                                        const v = e.target.value
                                                        if (v === '') return
                                                        const num = Math.floor(Number(v)) || 0
                                                        const clamped = Math.min(Math.max(0, num), remaining)
                                                        setReturnQuantities((prev) => ({ ...prev, [key]: clamped > 0 ? String(clamped) : '' }))
                                                      }}
                                                      className="w-16 rounded-full border border-slate-300 px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                  </td>
                                                  <td className="px-2 py-1.5 text-right text-slate-700">
                                                    ₹{lineRefund.toFixed(2)}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      <div className="flex items-center justify-between text-xs text-slate-700">
                                        <span>
                                          Refund amount:&nbsp;
                                          <span className="font-semibold text-rose-600">
                                            ₹{estimatedRefund.toFixed(2)}
                                          </span>
                                        </span>
                                        <button
                                          type="submit"
                                          disabled={returnSubmitting || !activeCashSession}
                                          title={!activeCashSession ? 'Start a cash session first (Cash & expenses → Start shift)' : ''}
                                          className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          {returnSubmitting ? 'Processing…' : 'Process return & update stock'}
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                  </td>
                                </tr>
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left p-3">Date</th>
                          <th className="text-left p-3">Patient / Customer</th>
                          <th className="text-left p-3">Invoice #</th>
                          <th className="text-left p-3">Phone</th>
                          <th className="text-left p-3">Payment</th>
                          <th className="text-right p-3">Refund amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnEvents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-500">No returns recorded yet.</td>
                          </tr>
                        ) : (
                          returnEvents.map((r) => (
                            <tr key={r.id} className="border-t border-slate-200 align-top">
                              <td className="p-3">
                                {r.createdAt ? r.createdAt.toISOString().slice(0, 10) : '—'}
                              </td>
                              <td className="p-3">
                                <div className="text-slate-900 font-medium">{r.patientName}</div>
                              </td>
                              <td className="p-3 font-mono text-xs">{r.invoice}</td>
                              <td className="p-3 text-slate-700">{r.phone || '—'}</td>
                              <td className="p-3 text-slate-700">
                                {r.paymentMode
                                  ? r.paymentMode.charAt(0).toUpperCase() + r.paymentMode.slice(1)
                                  : '—'}
                              </td>
                              <td className="p-3 text-right text-rose-600 font-semibold">
                                ₹{r.amount.toFixed(2)}
                                <div className="mt-1 text-[10px] text-slate-500">
                                  {r.lines.map((l) => (
                                    <div key={l.medicineId}>
                                      {l.medicineName} × {l.quantity} @ ₹{l.unitPrice.toFixed(2)}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredReturnSales.length > 0 && (
                  <Pagination
                    currentPage={returnsPage}
                    totalPages={returnsTotalPages}
                    pageSize={returnsPageSize}
                    totalItems={filteredReturnSales.length}
                    onPageChange={goToReturnsPage}
                    onPageSizeChange={setReturnsPageSize}
                    itemLabel="sales"
                    className="border-t border-slate-200"
                  />
                )}

                {showRefundPaymentModal && pendingReturnPayload && (
                  <RevealModal
                    isOpen
                    onClose={() => {
                      setShowRefundPaymentModal(false)
                      setPendingReturnPayload(null)
                    }}
                  >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
                      <div className="border-b border-slate-200 px-6 pt-6 pb-4">
                        <h2 className="text-xl font-bold text-slate-800">Refund payment</h2>
                        <p className="text-sm text-slate-500 mt-1">How are you giving the refund to the customer?</p>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
                          <p className="text-sm font-medium text-rose-700">Refund amount</p>
                          <p className="text-2xl font-bold text-rose-900">₹{pendingReturnPayload.refundAmount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 mb-2">Payment method</p>
                          <div className="flex flex-wrap gap-2">
                            {(['cash', 'upi', 'card', 'other'] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setRefundPaymentMode(m)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize ${
                                  refundPaymentMode === m
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowRefundPaymentModal(false)
                              setPendingReturnPayload(null)
                            }}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (refundPaymentMode === 'cash') {
                                setShowRefundCashModal(true)
                              } else {
                                submitReturn(refundPaymentMode)
                              }
                            }}
                            disabled={returnSubmitting}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                          >
                            {refundPaymentMode === 'cash' ? 'Enter notes…' : 'Confirm refund'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </RevealModal>
                )}

                {pendingReturnPayload && (
                  <RefundCashModal
                    isOpen={showRefundCashModal}
                    onClose={() => setShowRefundCashModal(false)}
                    refundAmount={pendingReturnPayload.refundAmount}
                    onConfirm={(notes) => {
                      submitReturn('cash', notes)
                    }}
                  />
                )}
              </div>
          </div>
        )}

        {subTab === 'suppliers' && (
          <div className="space-y-6">
            {/* Page header: title + subtitle */}
            <div>
              <h2 className="text-2xl font-semibold text-[#263238]">Suppliers</h2>
              <p className="text-sm text-[#607D8B] mt-1">Manage suppliers and contact information.</p>
            </div>

            {/* Summary cards - hospital-style colors */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-sm flex items-start gap-4 transition-shadow hover:shadow">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E3F2FD] text-[#1565C0]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#607D8B]">Total Suppliers</p>
                  <p className="mt-1 text-2xl font-semibold text-[#263238]">{suppliers.length}</p>
                </div>
              </div>
              <div className="rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-sm flex items-start gap-4 transition-shadow hover:shadow">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#2E7D32]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#607D8B]">Active Suppliers</p>
                  <p className="mt-1 text-2xl font-semibold text-[#263238]">{suppliers.length}</p>
                </div>
              </div>
              <div className="rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-sm flex items-start gap-4 transition-shadow hover:shadow">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FFF3E0] text-[#E65100]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#607D8B]">Pending Orders</p>
                  <p className="mt-1 text-2xl font-semibold text-[#263238]">{purchaseOrders.filter(o => o.status === 'pending' || o.status === 'draft').length}</p>
                </div>
              </div>
              <div className="rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-sm flex items-start gap-4 transition-shadow hover:shadow">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#E0F2F1] text-[#00796B]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-[#607D8B]">Top Supplier</p>
                  <p className="mt-1 text-xl font-semibold text-[#263238] truncate" title={suppliers[0]?.name ?? '—'}>{suppliers[0]?.name ?? '—'}</p>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <button
                  type="button"
                  onClick={() => setAddSupplierModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1565C0] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#0D47A1] transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Supplier
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#607D8B]">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </span>
                  <input
                    type="search"
                    placeholder="Search suppliers"
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                    className="w-48 rounded-lg border border-[#E0E0E0] bg-white py-2 pl-8 pr-3 text-sm text-[#263238] placeholder-[#607D8B] focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0]"
                  />
                </div>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-sm font-medium text-[#607D8B] hover:bg-[#FAFAFA] transition-colors">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  Filter
                </button>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-sm font-medium text-[#607D8B] hover:bg-[#FAFAFA] transition-colors">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export
                </button>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-sm font-medium text-[#607D8B] hover:bg-[#FAFAFA] transition-colors">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Import CSV
                </button>
              </div>
            </div>

            {/* Table card */}
            <div className="rounded-[12px] border border-[#E0E0E0] bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex justify-center py-12"><LoadingSpinner inline /></div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-[#FAFAFA] border-b border-[#E0E0E0]">
                      <tr>
                        <th className="text-left p-4 font-medium text-[#263238]">Supplier Name</th>
                        <th className="text-left p-4 font-medium text-[#263238]">Company</th>
                        <th className="text-left p-4 font-medium text-[#263238]">Phone</th>
                        <th className="text-left p-4 font-medium text-[#263238]">Email</th>
                        <th className="text-left p-4 font-medium text-[#263238]">City</th>
                        <th className="text-left p-4 font-medium text-[#263238]">GST Number</th>
                        <th className="text-left p-4 font-medium text-[#263238]">Status</th>
                        <th className="text-right p-4 font-medium text-[#263238]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSuppliers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-sm text-[#607D8B]">
                            {suppliers.length === 0
                              ? 'No suppliers. Add one using the button above.'
                              : 'No suppliers match your search.'}
                          </td>
                        </tr>
                      ) : (
                        <>
                          {paginatedSuppliers.map((s, i) => (
                            <tr
                              key={s.id}
                              className={`border-b border-[#E0E0E0] transition-colors ${
                                i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                              } hover:bg-[#E3F2FD]`}
                            >
                              <td className="p-4 font-medium text-[#263238]">{s.name}</td>
                              <td className="p-4 text-sm text-[#607D8B]">{s.contactPerson ?? '—'}</td>
                              <td className="p-4 text-sm text-[#607D8B]">{s.phone ?? '—'}</td>
                              <td className="p-4 text-sm text-[#607D8B]">{s.email ?? '—'}</td>
                              <td className="p-4 text-sm text-[#607D8B]">—</td>
                              <td className="p-4 text-sm text-[#607D8B]">—</td>
                              <td className="p-4">
                                <span className="inline-flex rounded-full bg-[#E8F5E9] px-2.5 py-0.5 text-xs font-medium text-[#2E7D32]">
                                  Active
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setViewSupplier(s)}
                                    className="p-1.5 rounded-lg text-[#607D8B] hover:bg-[#E0E0E0] hover:text-[#263238]"
                                    title="View"
                                  >
                                    <svg
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                      />
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditSupplier(s)}
                                    className="p-1.5 rounded-lg text-[#607D8B] hover:bg-[#E0E0E0] hover:text-[#263238]"
                                    title="Edit"
                                  >
                                    <svg
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828L8.464 13.464"
                                      />
                                    </svg>
                                  </button>
                                  <a
                                    href={s.email ? `mailto:${s.email}` : '#'}
                                    onClick={(e) => !s.email && e.preventDefault()}
                                    className="p-1.5 rounded-lg text-[#607D8B] hover:bg-[#E0E0E0] hover:text-[#263238]"
                                    title="Contact (email)"
                                  >
                                    <svg
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                      />
                                    </svg>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm(`Delete supplier "${s.name}"?`)) return
                                      const token = await getToken()
                                      if (!token) {
                                        setError('Not authenticated')
                                        return
                                      }
                                      const res = await fetch(`/api/pharmacy/suppliers/${s.id}`, {
                                        method: 'DELETE',
                                        headers: { Authorization: `Bearer ${token}` },
                                      })
                                      const data = await res.json()
                                      if (res.ok && data.success) {
                                        setSuccess('Supplier deleted')
                                        fetchPharmacy()
                                      } else setError(data.error || 'Failed to delete')
                                    }}
                                    className="p-1.5 rounded-lg text-[#607D8B] hover:bg-[#FFEBEE] hover:text-[#C62828]"
                                    title="Delete"
                                  >
                                    <svg
                                      className="h-4 w-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={8} className="p-0">
                              <Pagination
                                currentPage={supplierPage}
                                totalPages={supplierTotalPages}
                                pageSize={supplierPageSize}
                                totalItems={filteredSuppliers.length}
                                onPageChange={goToSupplierPage}
                                onPageSizeChange={setSupplierPageSize}
                                itemLabel="suppliers"
                                className="border-t border-[#E0E0E0]"
                              />
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Supplier modal */}
        {addSupplierModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setAddSupplierModalOpen(false)} aria-hidden />
            <div className="relative w-full max-w-md rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-[#263238] mb-4">Add Supplier</h3>
              <AddSupplierForm
                onSuccess={() => { setSuccess('Supplier added'); fetchPharmacy(); setAddSupplierModalOpen(false); }}
                onError={setError}
                getToken={getToken}
                hospitalId={activeHospitalId!}
              />
              <button type="button" onClick={() => setAddSupplierModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg text-[#607D8B] hover:bg-[#F5F5F5]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* View Supplier modal */}
        {viewSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setViewSupplier(null)} aria-hidden />
            <div className="relative w-full max-w-lg rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-[#263238] mb-4">Supplier details</h3>
              <dl className="space-y-2 text-sm">
                <div><dt className="font-medium text-[#607D8B]">Name</dt><dd className="text-[#263238]">{viewSupplier.name}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Company / Contact</dt><dd className="text-[#263238]">{viewSupplier.contactPerson ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Phone</dt><dd className="text-[#263238]">{viewSupplier.phone ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Email</dt><dd className="text-[#263238]">{viewSupplier.email ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Address</dt><dd className="text-[#263238]">{viewSupplier.address ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Payment terms</dt><dd className="text-[#263238]">{viewSupplier.paymentTerms ?? '—'}</dd></div>
                <div><dt className="font-medium text-[#607D8B]">Lead time (days)</dt><dd className="text-[#263238]">{viewSupplier.leadTimeDays != null ? viewSupplier.leadTimeDays : '—'}</dd></div>
              </dl>
              <button type="button" onClick={() => setViewSupplier(null)} className="mt-4 rounded-lg bg-[#1565C0] px-4 py-2 text-sm font-medium text-white hover:bg-[#0D47A1]">Close</button>
              <button type="button" onClick={() => setViewSupplier(null)} className="absolute top-4 right-4 p-1 rounded-lg text-[#607D8B] hover:bg-[#F5F5F5]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* Edit Supplier modal */}
        {editSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEditSupplier(null)} aria-hidden />
            <div className="relative w-full max-w-md rounded-xl border border-[#E0E0E0] bg-white p-6 shadow-xl">
              <h3 className="text-lg font-semibold text-[#263238] mb-4">Edit Supplier</h3>
              <EditSupplierForm
                supplier={editSupplier}
                onSuccess={() => { setSuccess('Supplier updated'); fetchPharmacy(); setEditSupplier(null); }}
                onError={setError}
                onCancel={() => setEditSupplier(null)}
                getToken={getToken}
              />
              <button type="button" onClick={() => setEditSupplier(null)} className="absolute top-4 right-4 p-1 rounded-lg text-[#607D8B] hover:bg-[#F5F5F5]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        )}

        {subTab === 'orders' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 w-full max-w-none">
              <h3 className="font-semibold text-slate-800 mb-3">Place order</h3>
              <p className="text-sm text-slate-600 mb-4">Select branch and supplier, then either upload a file to fill order lines or add lines manually. You can upload first, review and edit the filled lines, add any missing items, then click Place order. When stock arrives, use &quot;Mark received&quot; in the table below.</p>
              <PlaceOrderForm
                branches={branches}
                suppliers={suppliers}
                medicines={medicines}
                lowStock={lowStock}
                selectedBranchId={!isViewOnly ? branchFilter : undefined}
                selectedBranchName={!isViewOnly ? selectedBranchName : undefined}
                pendingAddToOrder={pendingAddToOrder}
                onConsumePendingAddToOrder={() => setPendingAddToOrder(null)}
                onSuccess={() => { setSuccess('Order placed'); fetchPharmacy(); }}
                onError={setError}
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
                      const supplierName = suppliers.find(s => s.id === o.supplierId)?.name ?? o.supplierId
                      const branchName = branches.find(b => b.id === o.branchId)?.name ?? o.branchId
                      const created = typeof o.createdAt === 'string' ? o.createdAt : (o.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
                      const dateStr = created ? new Date(created).toLocaleDateString() : '—'
                      const receivedAt = typeof o.receivedAt === 'string' ? o.receivedAt : (o.receivedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
                      const receivedStr = o.status === 'received' && receivedAt ? new Date(receivedAt).toLocaleDateString() : '—'
                      const expectedStr = o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : '—'
                      const statusLabel = o.status === 'draft' ? 'Draft' : o.status === 'pending' ? 'Sent' : o.status === 'partial' ? 'Partial' : o.status === 'received' ? 'Delivered' : 'Cancelled'
                      const statusBadgeClass = o.status === 'received' ? 'bg-emerald-100 text-emerald-800' : o.status === 'partial' ? 'bg-blue-100 text-blue-800' : o.status === 'cancelled' ? 'bg-slate-100 text-slate-700' : o.status === 'draft' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                      return (
                        <tr key={o.id} className="border-t border-slate-200 hover:bg-slate-50/50">
                          <td className="p-3 font-mono text-xs">{o.orderNumber ?? o.id.slice(0, 8)}</td>
                          <td className="p-3">{dateStr}</td>
                          <td className="p-3">{branchName}</td>
                          <td className="p-3">{supplierName}</td>
                          <td className="p-3">{expectedStr}</td>
                          <td className="p-3 max-w-xs truncate">{o.items?.map((i: PurchaseOrderLine) => `${i.medicineName} (${i.quantity})`).join(', ') ?? '—'}</td>
                          <td className="p-3 text-right font-medium">₹{Number(o.totalCost ?? 0).toFixed(2)}</td>
                          <td className="p-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
                              {statusLabel}
                            </span>
                          </td>
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
              {!loading && purchaseOrders.length === 0 && <p className="text-slate-500 py-6 text-center">No purchase orders yet. Place an order above.</p>}

              {ordersForTable.length > 0 && (
                <Pagination
                  currentPage={ordersPage}
                  totalPages={ordersTotalPages}
                  pageSize={ordersPageSize}
                  totalItems={ordersForTable.length}
                  onPageChange={goToOrdersPage}
                  onPageSizeChange={setOrdersPageSize}
                  itemLabel="orders"
                />
              )}
            </div>

            {/* Receive order modal: enter batch/expiry/mfg from received goods */}
            {receiveOrder && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !receiveSubmitting && setReceiveOrder(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-800">Confirm receive – enter batch details</h3>
                    <p className="text-sm text-slate-500 mt-1">Enter batch number, expiry and manufacturing date from the received goods (recommended for FIFO and expiry alerts). Price is already from the order.</p>
                    <div className="mt-3">
                      <label className="block text-xs text-slate-500 mb-1">Supplier invoice # (optional)</label>
                      <input type="text" value={receiveSupplierInvoice} onChange={e => setReceiveSupplierInvoice(e.target.value)} placeholder="e.g. INV-2024-001" className="w-full max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div className="overflow-auto flex-1 p-4">
                    <table className="w-full text-sm border border-slate-200 rounded-lg">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left p-2">Medicine</th>
                          <th className="text-right p-2 w-16">Qty</th>
                          <th className="text-right p-2 w-20">Unit cost</th>
                          <th className="text-left p-2">Batch number</th>
                          <th className="text-left p-2">Expiry date</th>
                          <th className="text-left p-2">Mfg date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(receiveOrder.items ?? []).map((line: PurchaseOrderLine, idx: number) => (
                          <tr key={`${line.medicineId}-${idx}`} className="border-t border-slate-200">
                            <td className="p-2">{line.medicineName}</td>
                            <td className="p-2 text-right">{line.quantity}</td>
                            <td className="p-2 text-right">₹{Number(line.unitCost ?? 0).toFixed(2)}</td>
                            <td className="p-2">
                              <input type="text" value={receiveDetailsForm[idx]?.batchNumber ?? ''} onChange={e => setReceiveDetailsForm(prev => prev.map((d, i) => i === idx ? { ...d, batchNumber: e.target.value } : d))} placeholder="From package" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                            </td>
                            <td className="p-2">
                              <input type="date" value={receiveDetailsForm[idx]?.expiryDate ?? ''} onChange={e => setReceiveDetailsForm(prev => prev.map((d, i) => i === idx ? { ...d, expiryDate: e.target.value } : d))} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                            </td>
                            <td className="p-2">
                              <input type="date" value={receiveDetailsForm[idx]?.manufacturingDate ?? ''} onChange={e => setReceiveDetailsForm(prev => prev.map((d, i) => i === idx ? { ...d, manufacturingDate: e.target.value } : d))} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                            </td>
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
                          if (!token) { setError('Not signed in'); setReceiveSubmitting(false); return }
                          const res = await fetch(`/api/pharmacy/purchase-orders?orderId=${encodeURIComponent(receiveOrder.id)}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({
                              supplierInvoiceNumber: receiveSupplierInvoice.trim() || undefined,
                              receiveDetails: receiveDetailsForm.map(d => ({
                                batchNumber: d.batchNumber.trim() || undefined,
                                expiryDate: d.expiryDate.trim() || undefined,
                                manufacturingDate: d.manufacturingDate.trim() || undefined,
                              })),
                            }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok || !data.success) throw new Error(data.error || 'Failed to receive order')
                          setSuccess('Order received; stock updated with batch details.')
                          setReceiveOrder(null)
                          fetchPharmacy()
                        } catch (err: unknown) {
                          setError(err instanceof Error ? err.message : 'Failed to receive order')
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

            {/* PO detail modal: supplier, branch, dates, items, total, status, actions */}
            {selectedOrderDetail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedOrderDetail(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} id="po-detail-print">
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-slate-800">Purchase order – {selectedOrderDetail.orderNumber ?? selectedOrderDetail.id.slice(0, 8)}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {selectedOrderDetail.notes ? `Notes: ${selectedOrderDetail.notes}` : 'No notes'}
                        </p>
                      </div>
                      <button type="button" onClick={() => setSelectedOrderDetail(null)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
                      <span className="text-slate-500">Supplier</span>
                      <span className="font-medium">{suppliers.find(s => s.id === selectedOrderDetail.supplierId)?.name ?? selectedOrderDetail.supplierId}</span>
                      <span className="text-slate-500">Branch</span>
                      <span className="font-medium">{branches.find(b => b.id === selectedOrderDetail.branchId)?.name ?? selectedOrderDetail.branchId}</span>
                      <span className="text-slate-500">Order date</span>
                      <span className="font-medium">
                        {typeof selectedOrderDetail.createdAt === 'string' ? new Date(selectedOrderDetail.createdAt).toLocaleDateString() : (selectedOrderDetail.createdAt as { toDate?: () => Date })?.toDate?.()?.toLocaleDateString?.() ?? '—'}
                      </span>
                      <span className="text-slate-500">Expected delivery</span>
                      <span className="font-medium">{selectedOrderDetail.expectedDeliveryDate ? new Date(selectedOrderDetail.expectedDeliveryDate).toLocaleDateString() : '—'}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500">Status:</span>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        selectedOrderDetail.status === 'received' ? 'bg-emerald-100 text-emerald-800' :
                        selectedOrderDetail.status === 'partial' ? 'bg-blue-100 text-blue-800' :
                        selectedOrderDetail.status === 'cancelled' ? 'bg-slate-100 text-slate-700' :
                        selectedOrderDetail.status === 'draft' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedOrderDetail.status === 'draft' ? 'Draft' : selectedOrderDetail.status === 'pending' ? 'Sent' : selectedOrderDetail.status === 'partial' ? 'Partial' : selectedOrderDetail.status === 'received' ? 'Delivered' : 'Cancelled'}
                      </span>
                      <span className="text-xs text-slate-400">Draft → Sent → Delivered</span>
                    </div>
                  </div>
                  <div className="overflow-auto flex-1 p-4">
                    <table className="w-full text-sm border border-slate-200 rounded-lg">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left p-2">Medicine</th>
                          <th className="text-left p-2">Manufacturer</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Unit price</th>
                          <th className="text-right p-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrderDetail.items ?? []).map((line: PurchaseOrderLine, idx: number) => (
                          <tr key={`${line.medicineId}-${idx}`} className="border-t border-slate-200">
                            <td className="p-2">{line.medicineName}</td>
                            <td className="p-2 text-slate-600">{line.manufacturer ?? '—'}</td>
                            <td className="p-2 text-right">{line.quantity}</td>
                            <td className="p-2 text-right">₹{Number(line.unitCost ?? 0).toFixed(2)}</td>
                            <td className="p-2 text-right font-medium">₹{((line.quantity ?? 0) * Number(line.unitCost ?? 0)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-right font-semibold text-slate-800 mt-2">Order total: ₹{Number(selectedOrderDetail.totalCost ?? 0).toFixed(2)}</p>
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
                              if (!token) { setError('Not signed in'); return }
                              const res = await fetch(`/api/pharmacy/purchase-orders?orderId=${encodeURIComponent(selectedOrderDetail.id)}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ cancel: true }),
                              })
                              const data = await res.json().catch(() => ({}))
                              if (!res.ok || !data.success) throw new Error(data.error || 'Failed to cancel')
                              setSuccess('Order cancelled.')
                              setSelectedOrderDetail(null)
                              fetchPharmacy()
                            } catch (err: unknown) {
                              setError(err instanceof Error ? err.message : 'Failed to cancel order')
                            } finally {
                              setCancelOrderSubmitting(false)
                            }
                          }}
                          className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {cancelOrderSubmitting ? 'Cancelling…' : 'Cancel order'}
                        </button>
                      )}
                      {selectedOrderDetail.status === 'pending' && !isViewOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            setReceiveOrder(selectedOrderDetail)
                            setReceiveDetailsForm((selectedOrderDetail.items ?? []).map(() => ({ batchNumber: '', expiryDate: '', manufacturingDate: '' })))
                            setReceiveSupplierInvoice('')
                            setSelectedOrderDetail(null)
                          }}
                          className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Receive stock
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => downloadPurchaseOrderPDF(selectedOrderDetail, suppliers.find(s => s.id === selectedOrderDetail.supplierId)?.name ?? selectedOrderDetail.supplierId, branches.find(b => b.id === selectedOrderDetail.branchId)?.name ?? selectedOrderDetail.branchId, activeHospital?.name, activeHospital?.address)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                      >
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => printPurchaseOrderPDF(selectedOrderDetail, suppliers.find(s => s.id === selectedOrderDetail.supplierId)?.name ?? selectedOrderDetail.supplierId, branches.find(b => b.id === selectedOrderDetail.branchId)?.name ?? selectedOrderDetail.branchId, activeHospital?.name, activeHospital?.address)}
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
        )}

        {subTab === 'reports' && (
          <div className="space-y-6">
            {/* Inner tabs for different report types */}
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
                <div ref={reportPrintRef} className="overflow-x-auto">
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
        )}

        {subTab === 'transfers' && isSuperAdmin && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 w-full">
              <h3 className="font-semibold text-slate-800 mb-3">Transfer stock between branches</h3>
              <TransferStockForm
                branches={branches}
                medicines={medicines}
                onSuccess={() => { setSuccess('Transfer completed'); fetchPharmacy(); }}
                onError={setError}
                getToken={getToken}
                hospitalId={activeHospitalId!}
              />
            </div>
            <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-8"><LoadingSpinner inline /></div>
            ) : (
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left p-3">Medicine</th>
                    <th className="text-left p-3">From → To</th>
                    <th className="text-right p-3">Qty</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id} className="border-t border-slate-200">
                      <td className="p-3">{t.medicineName}</td>
                      <td className="p-3">{branches.find(b => b.id === t.fromBranchId)?.name ?? t.fromBranchId} → {branches.find(b => b.id === t.toBranchId)?.name ?? t.toBranchId}</td>
                      <td className="p-3 text-right">{t.quantity}</td>
                      <td className="p-3">{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && transfers.length === 0 && <p className="text-slate-500 py-6 text-center">No transfers yet.</p>}
            </div>
          </div>
        )}

        {subTab === 'users' && isAdmin && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Pharmacist accounts</h3>
                <p className="text-sm text-slate-600">Create login IDs for pharmacists and assign them to branches.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPharmacistForm({ firstName: '', lastName: '', email: '', password: '', branchId: '' })
                  setShowAddPharmacistModal(true)
                }}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                + Create Pharmacist
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <h3 className="font-semibold text-slate-800 p-3 border-b border-slate-200">Pharmacy users (login credentials)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-3">Email (Login ID)</th>
                      <th className="text-left p-3">Name</th>
                      <th className="text-left p-3">Branch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pharmacists.map((p) => (
                      <tr key={p.id} className="border-t border-slate-200">
                        <td className="p-3 font-medium">{p.email}</td>
                        <td className="p-3">{[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}</td>
                        <td className="p-3">{p.branchName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="p-3 text-xs text-slate-500 border-t border-slate-200">Use the password you set when creating the user. Login at: <a href="/auth/login?role=pharmacy" className="text-emerald-600 underline">/auth/login?role=pharmacy</a></p>
              {pharmacists.length === 0 && !loading && <p className="p-4 text-slate-500 text-center">No pharmacy users yet. Create one above.</p>}
            </div>
          </div>
        )}
        </div>
      </div>

        {editMinLevelMedicine && (
          <EditMinLevelModal
            medicine={editMinLevelMedicine}
            onSave={() => { setSuccess('Minimum stock level updated.'); fetchPharmacy(); setEditMinLevelMedicine(null); }}
            onError={setError}
            onClose={() => setEditMinLevelMedicine(null)}
            getToken={getToken}
          />
        )}

        {addMedicineModalBarcode !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setAddMedicineModalBarcode(null)}>
            <div
              role="dialog"
              aria-modal="true"
              className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-slate-800 text-lg mb-2">Add medicine</h3>
              <p className="text-sm text-slate-600 mb-4">Barcode <strong>{addMedicineModalBarcode}</strong> is pre-filled. Enter name and other details, then save.</p>
              <AddMedicineForm
                hospitalId={activeHospitalId ?? ''}
                supplierOptions={suppliers}
                initialBarcode={addMedicineModalBarcode}
                getToken={getToken}
                onSuccess={() => {
                  setSuccess('Medicine added. You can now use it in sales or orders.')
                  fetchPharmacy()
                  setAddMedicineModalBarcode(null)
                }}
                onError={setError}
              />
              <div className="mt-4 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setAddMedicineModalBarcode(null)} className="btn-modern btn-modern-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {viewShiftReportSession && (
          <RevealModal isOpen onClose={() => setViewShiftReportSession(null)} zIndex={100} contentClassName="w-full max-w-2xl max-h-[90vh] flex flex-col min-h-0 mx-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-200/80 flex flex-col min-h-0 flex-1">
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 sm:px-8 pt-6 pb-5 rounded-t-2xl shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">Shift report</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {viewShiftReportSession.closedAt
                        ? new Date(typeof viewShiftReportSession.closedAt === 'string' ? viewShiftReportSession.closedAt : (viewShiftReportSession.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? '').toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
                        : 'Closed session'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewShiftReportSession(null)}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                    aria-label="Close"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6 sm:p-8 space-y-4 overflow-y-auto min-h-0 flex-1">
                {(() => {
                  const s = viewShiftReportSession
                  const cash = Number(s.cashSales ?? 0)
                  const upi = Number(s.upiSales ?? 0)
                  const card = Number(s.cardSales ?? 0)
                  const refunds = Number(s.refunds ?? 0)
                  const changeGiven = Number(s.changeGiven ?? 0)
                  const cashExp = Number(s.cashExpenses ?? 0)
                  const opening = Number(s.openingCashTotal ?? 0)
                  const expected = Number(s.expectedCash ?? 0)
                  const closing = Number(s.closingCashTotal ?? 0)
                  const diff = Number(s.difference ?? 0)
                  const totalCollection = cash + upi + card - refunds
                  const totalIncome = cash + upi + card
                  const totalExpense = cashExp
                  const DENOMS = ['500', '200', '100', '50', '20', '10', '5', '2', '1']
                  const runningNotes = s.runningNotes || {}
                  const closingNotes = s.closingNotes || {}
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500 block text-xs">Opened by</span>
                          <span className="font-medium text-slate-800">{s.openedByName ?? '—'}</span>
                          <span className="text-slate-500 block text-xs mt-0.5">
                            {s.openedAt ? new Date(typeof s.openedAt === 'string' ? s.openedAt : (s.openedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? '').toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-xs">Closed by</span>
                          <span className="font-medium text-slate-800">{s.closedByName ?? '—'}</span>
                          <span className="text-slate-500 block text-xs mt-0.5">
                            {s.closedAt ? new Date(typeof s.closedAt === 'string' ? s.closedAt : (s.closedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? '').toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                        <p className="text-xs font-medium text-emerald-700 mb-1">Total income</p>
                        <p className="text-xl font-bold text-emerald-900 tabular-nums">₹{totalIncome.toFixed(2)}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Cash + UPI + Card sales</p>
                      </div>
                      {totalExpense > 0 && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                          <p className="text-xs font-medium text-amber-700 mb-1">Total expense</p>
                          <p className="text-xl font-bold text-amber-900 tabular-nums">₹{totalExpense.toFixed(2)}</p>
                          <p className="text-xs text-amber-600 mt-0.5">Cash expenses from counter</p>
                        </div>
                      )}
                      {shiftReportExpenses.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                          <h3 className="text-sm font-semibold text-slate-800 mb-2">Expenses in this shift</h3>
                          <ul className="space-y-1.5 text-sm">
                            {shiftReportExpenses.map((ex) => (
                              <li key={ex.id} className="flex justify-between items-start gap-2">
                                <span className="text-slate-700 truncate flex-1" title={ex.description ?? ex.categoryName ?? ''}>
                                  {ex.description || ex.categoryName || 'Expense'}
                                </span>
                                <span className="font-medium tabular-nums text-slate-900 shrink-0">₹{Number(ex.amount || 0).toFixed(2)}</span>
                                <span className="text-xs capitalize text-slate-500 shrink-0">({ex.paymentMethod})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Opening cash</span>
                          <span className="font-semibold tabular-nums">₹{opening.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Cash sales</span>
                          <span className="font-medium tabular-nums">₹{cash.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">UPI sales</span>
                          <span className="font-medium tabular-nums">₹{upi.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Card sales</span>
                          <span className="font-medium tabular-nums">₹{card.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-rose-600">
                          <span>Refunds</span>
                          <span className="font-medium tabular-nums">−₹{refunds.toFixed(2)}</span>
                        </div>
                        {changeGiven > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Change given</span>
                            <span className="tabular-nums">−₹{changeGiven.toFixed(2)}</span>
                          </div>
                        )}
                        {changeGiven > 0 && s.changeNotesTotal && (() => {
                          const cnt = s.changeNotesTotal
                          const hasBreakdown = DENOMS.some((d) => (Number(cnt[d]) || 0) > 0)
                          if (!hasBreakdown) return null
                          return (
                            <div className="pl-2 text-xs text-slate-500 border-l-2 border-slate-200">
                              <span className="font-medium text-slate-600">Change given (notes/coins): </span>
                              {DENOMS.map((d) => {
                                const n = Number(cnt[d]) || 0
                                if (n === 0) return null
                                return <span key={d} className="tabular-nums mr-2">₹{d}×{n}</span>
                              })}
                            </div>
                          )
                        })()}
                        {cashExp > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Cash expenses</span>
                            <span className="tabular-nums">−₹{cashExp.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-200 pt-2 flex justify-between">
                          <span className="text-slate-600">Expected cash in drawer</span>
                          <span className="font-semibold tabular-nums">₹{expected.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Actual closing cash</span>
                          <span className="font-semibold tabular-nums">₹{closing.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-700 font-medium">Difference</span>
                          <span className={`font-semibold tabular-nums ${diff === 0 ? 'text-slate-700' : diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {diff === 0 ? 'Balanced' : diff < 0 ? `Short ₹${Math.abs(diff).toFixed(2)}` : `Extra ₹${diff.toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-semibold text-slate-800 mb-2">Notes in counter</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-2 font-medium text-slate-600">Denomination</th>
                                <th className="text-right py-2 font-medium text-slate-600">Expected</th>
                                <th className="text-right py-2 font-medium text-slate-600">Actual</th>
                                <th className="text-right py-2 font-medium text-slate-600">Diff</th>
                              </tr>
                            </thead>
                            <tbody>
                              {DENOMS.map((d) => {
                                const exp = Number(runningNotes[d]) || 0
                                const act = Number(closingNotes[d]) || 0
                                const rowDiff = act - exp
                                return (
                                  <tr key={d} className="border-b border-slate-100">
                                    <td className="py-1.5 text-slate-700">₹{d}</td>
                                    <td className="text-right tabular-nums">{exp}</td>
                                    <td className="text-right tabular-nums">{act}</td>
                                    <td className={`text-right tabular-nums ${rowDiff === 0 ? 'text-slate-600' : rowDiff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {rowDiff === 0 ? '—' : rowDiff > 0 ? `+${rowDiff}` : rowDiff}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Expected = notes in drawer at close (from sales). Actual = count entered when closing.</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                        <p className="text-xs font-medium text-slate-500 mb-1">Total collection (net sales)</p>
                        <p className="text-xl font-bold text-slate-900 tabular-nums">₹{totalCollection.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Cash + UPI + Card − Refunds</p>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </RevealModal>
        )}

        {showCloseShiftConfirm && activeCashSession && (
          <RevealModal isOpen onClose={() => setShowCloseShiftConfirm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 sm:px-8 pt-6 pb-5 rounded-t-2xl shrink-0">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Close shift</h2>
                <p className="text-sm text-slate-500 mt-1">Confirm closing this shift. Start and close times are recorded.</p>
              </div>
              <div className="p-6 sm:p-8 space-y-5">
                <p className="text-slate-700 font-medium">Are you sure you want to close this shift?</p>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1.5">Closed by (person name)</span>
                  <input
                    type="text"
                    value={closedByName}
                    onChange={(e) => setClosedByName(e.target.value)}
                    placeholder="e.g. Counter 1 – Raj"
                    className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900"
                  />
                </label>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCloseShiftConfirm(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const token = await getToken()
                      if (!token || !activeCashSession) return
                      setShowCloseShiftConfirm(false)
                      const closingNotesNum: Record<string, number> = {}
                      let closingTotal = 0
                      ;['500', '200', '100', '50', '20', '10', '5', '2', '1'].forEach((den) => {
                        const count = Math.max(0, Number(cashClosingNotes[den] || 0))
                        closingNotesNum[den] = count
                        closingTotal += count * Number(den)
                      })
                      // Calculate sales/refunds only for this cash session (between open and close)
                      let sessionSales = sales
                      if (activeCashSession?.openedAt) {
                        const openedAtMs =
                          typeof activeCashSession.openedAt === 'string'
                            ? new Date(activeCashSession.openedAt).getTime()
                            : (activeCashSession.openedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
                        const nowMs = Date.now()
                        sessionSales = sales.filter((s) => {
                          const t =
                            typeof s.dispensedAt === 'string'
                              ? new Date(s.dispensedAt).getTime()
                              : (s.dispensedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0
                          if (!t || t < openedAtMs || t > nowMs) return false
                          if (branchFilter !== 'all' && s.branchId && s.branchId !== branchFilter) return false
                          return true
                        })
                      }
                      const body = {
                        action: 'close',
                        sessionId: activeCashSession.id,
                        closingNotes: closingNotesNum,
                        closingCashTotal: closingTotal,
                        closedByName: closedByName || undefined,
                        cashSales: sessionSales
                          .filter((s) => s.paymentMode === 'cash')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0),
                        upiSales: sessionSales
                          .filter((s) => s.paymentMode === 'upi')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0),
                        cardSales: sessionSales
                          .filter((s) => s.paymentMode === 'card')
                          .reduce((sum, s) => sum + Number(s.netAmount ?? s.totalAmount ?? 0), 0),
                        refunds: sessionSales.reduce((sum, s) => sum + Number(s.refundedAmount || 0), 0),
                        cashRefunds: sessionSales
                          .filter((s) => s.paymentMode === 'cash')
                          .reduce((sum, s) => sum + Number(s.refundedAmount || 0), 0),
                        changeGiven: 0,
                        hospitalId: activeHospitalId,
                        branchId: branchFilter === 'all' ? undefined : branchFilter,
                      }
                      try {
                        const res = await fetch('/api/pharmacy/cash-session', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify(body),
                        })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok || !data.success) {
                          setError(data.error || 'Failed to close cash session')
                          return
                        }
                        setSuccess('Counter closed and report saved.')
                        setActiveCashSession(null)
                        setCashClosingNotes({ '500': '', '200': '', '100': '', '50': '', '20': '', '10': '', '5': '', '2': '', '1': '' })
                        const closed = data.session
                        if (closed) {
                          const cash = Number(closed.cashSales ?? 0)
                          const upi = Number(closed.upiSales ?? 0)
                          const card = Number(closed.cardSales ?? 0)
                          const refunds = Number(closed.refunds ?? 0)
                          const cashExp = Number(closed.cashExpenses ?? 0)
                          const totalCollection = cash + upi + card - refunds
                          setLastClosedSummary({
                            openingCashTotal: Number(closed.openingCashTotal ?? 0),
                            closingCashTotal: Number(closed.closingCashTotal ?? 0),
                            cashSales: cash,
                            upiSales: upi,
                            cardSales: card,
                            refunds,
                            cashExpenses: cashExp,
                            profit: totalCollection - cashExp,
                          })
                        }
                        fetchCashSessions()
                        openCounterSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      } catch (e: any) {
                        setError(e?.message || 'Failed to close cash session')
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
                  >
                    Yes, close shift
                  </button>
                </div>
              </div>
            </div>
          </RevealModal>
        )}

        {showCreateCashierModal && (
          <RevealModal isOpen onClose={() => setShowCreateCashierModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
              <div className="px-6 pt-6 pb-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingCashierId ? 'Edit cashier' : 'Create cashier'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Add or update a cashier for assigning shifts.</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newCashier.name}
                    onChange={(e) => setNewCashier((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Raj"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone / ID (optional)</label>
                  <input
                    type="text"
                    value={newCashier.phone}
                    onChange={(e) => setNewCashier((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCashierModal(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newCashier.name.trim()) {
                        setError('Cashier name is required.')
                        return
                      }
                      const token = await getToken()
                      if (!token || !activeHospitalId) return
                      try {
                        if (editingCashierId) {
                          const res = await fetch(`/api/pharmacy/cashiers/${editingCashierId}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              name: newCashier.name,
                              phone: newCashier.phone,
                            }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok || !data.success) {
                            setError(data.error || 'Failed to update cashier')
                            return
                          }
                          setCashiers((prev) =>
                            prev.map((c) => (c.id === editingCashierId ? data.cashier : c)),
                          )
                        } else {
                          const res = await fetch('/api/pharmacy/cashiers', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              name: newCashier.name,
                              phone: newCashier.phone,
                              branchId: branchFilter === 'all' ? undefined : branchFilter,
                            }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok || !data.success) {
                            setError(data.error || 'Failed to create cashier')
                            return
                          }
                          setCashiers((prev) => [...prev, data.cashier])
                        }
                        setNewCashier({ name: '', phone: '' })
                        setEditingCashierId(null)
                        setShowCreateCashierModal(false)
                      } catch (e: any) {
                        setError(e?.message || 'Failed to save cashier')
                      }
                    }}
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </RevealModal>
        )}

        {showCreateCounterModal && (
          <RevealModal isOpen onClose={() => setShowCreateCounterModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80">
              <div className="px-6 pt-6 pb-4 border-b border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingCounterId ? 'Edit counter' : 'Create counter'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Add or update a billing counter for assigning shifts.</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Counter name</label>
                  <input
                    type="text"
                    value={newCounterName}
                    onChange={(e) => setNewCounterName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g. Counter 1, Night counter"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateCounterModal(false)}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newCounterName.trim()) {
                        setError('Counter name is required.')
                        return
                      }
                      const token = await getToken()
                      if (!token || !activeHospitalId) return
                      try {
                        if (editingCounterId) {
                          const res = await fetch(`/api/pharmacy/counters/${editingCounterId}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              name: newCounterName,
                            }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok || !data.success) {
                            setError(data.error || 'Failed to update counter')
                            return
                          }
                          setCounters((prev) =>
                            prev.map((c) => (c.id === editingCounterId ? data.counter : c)),
                          )
                        } else {
                          const res = await fetch('/api/pharmacy/counters', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              name: newCounterName,
                              branchId: branchFilter === 'all' ? undefined : branchFilter,
                            }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (!res.ok || !data.success) {
                            setError(data.error || 'Failed to create counter')
                            return
                          }
                          setCounters((prev) => [...prev, data.counter])
                        }
                        setNewCounterName('')
                        setEditingCounterId(null)
                        setShowCreateCounterModal(false)
                      } catch (e: any) {
                        setError(e?.message || 'Failed to save counter')
                      }
                    }}
                    className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </RevealModal>
        )}

        {showAddPharmacistModal && (
          <RevealModal isOpen onClose={() => setShowAddPharmacistModal(false)}>
            <AddPharmacistModalContent
              form={pharmacistForm}
              setForm={setPharmacistForm}
              branches={branches}
              saving={false}
              onSubmit={async (e) => {
                e.preventDefault()
                if (!pharmacistForm.email.trim() || !pharmacistForm.password) {
                  setError('Email and password are required')
                  return
                }
                if (pharmacistForm.password.length < 6) {
                  setError('Password must be at least 6 characters')
                  return
                }
                try {
                  const token = await getToken()
                  if (!token) { setError('Not authenticated'); return }
                  const res = await fetch('/api/admin/create-pharmacist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                      email: pharmacistForm.email.trim().toLowerCase(),
                      password: pharmacistForm.password,
                      firstName: pharmacistForm.firstName.trim(),
                      lastName: pharmacistForm.lastName.trim(),
                      branchId: pharmacistForm.branchId || undefined,
                    }),
                  })
                  const data = await res.json()
                  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create pharmacist')
                  setShowAddPharmacistModal(false)
                  setSuccess(`Pharmacist created. They can login at /auth/login?role=pharmacy with email: ${pharmacistForm.email.trim()} and the password you set.`)
                  fetchPharmacy()
                } catch (err: any) {
                  setError(err?.message || 'Failed to create pharmacist')
                }
              }}
            />
          </RevealModal>
        )}

        <ConfirmDialog
          isOpen={!!inventoryDeleteTarget}
          title="Remove from branch inventory?"
          message={
            inventoryDeleteTarget
              ? `This will remove "${inventoryDeleteTarget.medicineName}" from this branch's inventory. Existing sales history will remain.`
              : ''
          }
          confirmText="Delete"
          cancelText="Cancel"
          confirmLoading={inventoryDeleteLoading}
          onCancel={() => {
            if (inventoryDeleteLoading) return
            setInventoryDeleteTarget(null)
          }}
          onConfirm={async () => {
            if (!inventoryDeleteTarget) return
            try {
              setInventoryDeleteLoading(true)
              const token = await getToken()
              if (!token) {
                setError('Not signed in')
                return
              }
              const res = await fetch('/api/pharmacy/stock', {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ stockId: inventoryDeleteTarget.id }),
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to delete stock')
              }
              setSuccess('Medicine removed from this branch inventory.')
              fetchPharmacy()
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Failed to delete stock')
            } finally {
              setInventoryDeleteLoading(false)
              setInventoryDeleteTarget(null)
            }
          }}
        />
    </>
  )
}
