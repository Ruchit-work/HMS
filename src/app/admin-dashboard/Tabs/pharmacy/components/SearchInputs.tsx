'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BranchMedicineStock, PharmacyMedicine } from '@/types/pharmacy'
import { playScanBeep } from '@/utils/scanBeep'

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
export function MedicineSearchSelect({
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
export function POSMedicineSearch({
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
  const lasaPairWarning = useMemo(() => {
    if (q.length < 4 || filtered.length < 2) return null
    const normalized = filtered
      .map((m) => ({ name: m.name || '', prefix: (m.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) }))
      .filter((m) => m.prefix.length >= 4)
    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        if (normalized[i].prefix === normalized[j].prefix && normalized[i].name !== normalized[j].name) {
          return `${normalized[i].name} / ${normalized[j].name}`
        }
      }
    }
    return null
  }, [filtered, q])

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
      {lasaPairWarning && (
        <p className="mt-1 text-[11px] text-rose-700">
          LASA caution: verify selection between <span className="font-semibold">{lasaPairWarning}</span>.
        </p>
      )}
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
export function BarcodeScanInput({
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
