'use client'

import React, { useState } from 'react'
import type { PharmacySupplier } from '@/types/pharmacy'

export function AddSupplierForm({
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

export function EditSupplierForm({
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
