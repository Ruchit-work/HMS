'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { PharmacySupplier } from '@/types/pharmacy'

export function MedicineFileUploader({
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

export function OrderFileUploader({
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
