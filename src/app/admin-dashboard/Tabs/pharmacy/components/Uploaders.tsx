'use client'

import React, { useRef, useState } from 'react'

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
