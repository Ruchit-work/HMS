import React from 'react'
import { Button } from '@/shared/components'
import { TableShell } from '@/shared/components'
import { TabSkeleton } from '@/shared/components'
import { Pagination } from '@/shared/components'
import type { PharmacyPurchaseOrder, PharmacySupplier } from '@/types/pharmacy'
import { ActionEmptyState } from './RealWorldUiBlocks'
import {
  PhOpsShell,
  PhOpsPageHeader,
  PhOpsMetricGrid,
  PhOpsMetricCard,
  PhOpsSearchToolbar,
} from '@/features/pharmacy/ui/PhOps'

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
    <PhOpsShell>
      <PhOpsPageHeader
        eyebrow="Supply network"
        title="Suppliers"
        description="Contacts, pending orders, and supplier-linked procurement."
        actions={
          <Button type="button" size="sm" variant="primary" onClick={onOpenAddSupplier}>
            Add supplier
          </Button>
        }
      />

      <PhOpsMetricGrid columns={4}>
        <PhOpsMetricCard label="Total suppliers" value={suppliers.length} />
        <PhOpsMetricCard label="Active suppliers" value={suppliers.length} tone="ok" />
        <PhOpsMetricCard
          label="Pending orders"
          value={purchaseOrders.filter((o) => o.status === 'pending' || o.status === 'draft').length}
          tone="warn"
        />
        <PhOpsMetricCard
          label="Matching search"
          value={filteredSuppliers.length}
          hint={supplierSearchQuery.trim() ? `Filter: ${supplierSearchQuery}` : 'All suppliers'}
        />
      </PhOpsMetricGrid>

      <PhOpsSearchToolbar
        leading={
          <input
            type="search"
            value={supplierSearchQuery}
            onChange={(e) => setSupplierSearchQuery(e.target.value)}
            placeholder="Search suppliers…"
            className="ph-ops-input min-w-[220px]"
            aria-label="Search suppliers"
          />
        }
        trailing={
          supplierSearchQuery.trim() ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSupplierSearchQuery('')}>
              Clear
            </Button>
          ) : null
        }
      />

      {loading ? (
        <TabSkeleton variant="table" />
      ) : (
        <TableShell>
            <table className="min-w-[800px] w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
                <tr>
                  <th className="text-left p-4 font-medium text-[var(--color-neutral-900)]">Supplier Name</th>
                  <th className="text-left p-4 font-medium text-[var(--color-neutral-900)]">Company</th>
                  <th className="text-left p-4 font-medium text-[var(--color-neutral-900)]">Phone</th>
                  <th className="text-left p-4 font-medium text-[var(--color-neutral-900)]">Email</th>
                  <th className="text-left p-4 font-medium text-[var(--color-neutral-900)]">City</th>
                  <th className="text-left p-4 font-medium text-[var(--color-neutral-900)]">GST Number</th>
                  <th className="text-left p-4 font-medium text-[var(--color-neutral-900)]">Status</th>
                  <th className="text-right p-4 font-medium text-[var(--color-neutral-900)]">Actions</th>
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
                        className={`border-b border-[var(--color-neutral-200)] transition-colors ${i % 2 === 1 ? 'bg-[var(--color-neutral-50)]' : 'bg-white'} hover:bg-cyan-50`}
                      >
                        <td className="p-4 font-medium text-[var(--color-neutral-900)]">{s.name}</td>
                        <td className="p-4 text-sm text-[var(--color-neutral-500)]">{s.contactPerson ?? '—'}</td>
                        <td className="p-4 text-sm text-[var(--color-neutral-500)]">{s.phone ?? '—'}</td>
                        <td className="p-4 text-sm text-[var(--color-neutral-500)]">{s.email ?? '—'}</td>
                        <td className="p-4 text-sm text-[var(--color-neutral-500)]">—</td>
                        <td className="p-4 text-sm text-[var(--color-neutral-500)]">—</td>
                        <td className="p-4">
                          <span className="inline-flex rounded-full bg-[#E8F5E9] px-2.5 py-0.5 text-xs font-medium text-[#2E7D32]">
                            Active
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => onViewSupplier(s)} className="p-1.5 rounded-lg text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-neutral-900)]" title="View">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button type="button" onClick={() => onEditSupplier(s)} className="p-1.5 rounded-lg text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-neutral-900)]" title="Edit">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828L8.464 13.464" />
                              </svg>
                            </button>
                            <a
                              href={s.email ? `mailto:${s.email}` : '#'}
                              onClick={(e) => !s.email && e.preventDefault()}
                              className="p-1.5 rounded-lg text-[var(--color-neutral-500)] hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-neutral-900)]"
                              title="Contact (email)"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </a>
                            <button type="button" onClick={() => onDeleteSupplier(s)} className="p-1.5 rounded-lg text-[var(--color-neutral-500)] hover:bg-[#FFEBEE] hover:text-[#C62828]" title="Delete">
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
                          className="border-t border-[var(--color-neutral-200)]"
                        />
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
        </TableShell>
      )}
    </PhOpsShell>
  )
}
