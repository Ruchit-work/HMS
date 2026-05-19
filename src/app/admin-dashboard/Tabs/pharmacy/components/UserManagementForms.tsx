'use client'
import { Button } from '@/components/ui/Button'

import React from 'react'
import { useRevealModalClose } from '@/components/ui/overlays/RevealModal'

export function AddPharmacistModalContent({
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
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
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
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
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
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
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
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]"
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
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] bg-white"
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
          <Button type="button" variant="outline" size="lg" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={saving} loadingText="Creating...">
            Create Pharmacist
          </Button>
        </div>
      </form>
    </div>
  )
}
