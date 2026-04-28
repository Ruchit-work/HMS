import React from 'react'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Pagination from '@/components/ui/navigation/Pagination'
import type { PharmacyPurchaseOrder, PharmacySupplier } from '@/types/pharmacy'
import { ActionEmptyState } from './RealWorldUiBlocks'

export function SuppliersTabContent(props: {
  suppliers: PharmacySupplier[]
  purchaseOrders: PharmacyPurchaseOrder[]
  supplierSearchQuery: string
  setSupplierSearchQuery: React.Dispatch<React.SetStateAction<string>>
  onOpenAddSupplier: () => void
  filteredSuppliers: PharmacySupplier[]
  paginatedSuppliers: PharmacySupplier[]
  loading: boolean
  onViewSupplier: (supplier: PharmacySupplier) => void
  onEditSupplier: (supplier: PharmacySupplier) => void
  onDeleteSupplier: (supplier: PharmacySupplier) => Promise<void>
  supplierPage: number
  supplierTotalPages: number
  supplierPageSize: number
  goToSupplierPage: (page: number) => void
  setSupplierPageSize: (size: number) => void
}) {
  const {
    suppliers,
    purchaseOrders,
    supplierSearchQuery,
    setSupplierSearchQuery,
    onOpenAddSupplier,
    filteredSuppliers,
    paginatedSuppliers,
    loading,
    onViewSupplier,
    onEditSupplier,
    onDeleteSupplier,
    supplierPage,
    supplierTotalPages,
    supplierPageSize,
    goToSupplierPage,
    setSupplierPageSize,
  } = props

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#263238]">Suppliers</h2>
        <p className="text-sm text-[#607D8B] mt-1">Manage suppliers and contact information.</p>
      </div>

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
            <p className="mt-1 text-2xl font-semibold text-[#263238]">{purchaseOrders.filter((o) => o.status === 'pending' || o.status === 'draft').length}</p>
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onOpenAddSupplier}
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
          {supplierSearchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSupplierSearchQuery('')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white px-3 py-2 text-sm font-medium text-[#607D8B] hover:bg-[#FAFAFA] transition-colors"
            >
              Clear search
            </button>
          )}
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
                    <td colSpan={8} className="p-6">
                      <ActionEmptyState
                        title={suppliers.length === 0 ? 'No suppliers yet.' : 'No suppliers match your search.'}
                        hint={
                          suppliers.length === 0
                            ? 'Create supplier master data to place purchase orders faster.'
                            : 'Try broadening your search keywords.'
                        }
                        actions={
                          suppliers.length === 0
                            ? [{ label: 'Add Supplier', onClick: onOpenAddSupplier, variant: 'primary' }]
                            : [{ label: 'Clear search', onClick: () => setSupplierSearchQuery(''), variant: 'secondary' }]
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  <>
                    {paginatedSuppliers.map((s, i) => (
                      <tr
                        key={s.id}
                        className={`border-b border-[#E0E0E0] transition-colors ${i % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'} hover:bg-[#E3F2FD]`}
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
                            <button type="button" onClick={() => onViewSupplier(s)} className="p-1.5 rounded-lg text-[#607D8B] hover:bg-[#E0E0E0] hover:text-[#263238]" title="View">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button type="button" onClick={() => onEditSupplier(s)} className="p-1.5 rounded-lg text-[#607D8B] hover:bg-[#E0E0E0] hover:text-[#263238]" title="Edit">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828L8.464 13.464" />
                              </svg>
                            </button>
                            <a
                              href={s.email ? `mailto:${s.email}` : '#'}
                              onClick={(e) => !s.email && e.preventDefault()}
                              className="p-1.5 rounded-lg text-[#607D8B] hover:bg-[#E0E0E0] hover:text-[#263238]"
                              title="Contact (email)"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </a>
                            <button type="button" onClick={() => onDeleteSupplier(s)} className="p-1.5 rounded-lg text-[#607D8B] hover:bg-[#FFEBEE] hover:text-[#C62828]" title="Delete">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
  )
}
