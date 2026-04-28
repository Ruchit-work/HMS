import React from 'react'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import type { PharmacyMedicine, StockTransfer } from '@/types/pharmacy'
import { ActionEmptyState, getTransferStatusMeta } from './RealWorldUiBlocks'
import { TransferStockForm } from './StockTransferAndImportForms'

type BranchOption = { id: string; name: string }

export function TransfersTabContent(props: {
  branches: BranchOption[]
  medicines: PharmacyMedicine[]
  transfers: StockTransfer[]
  loading: boolean
  getToken: () => Promise<string | null>
  hospitalId: string
  onSuccess: (message: string) => void
  onError: (message: string) => void
  fetchPharmacy: () => Promise<void>
}) {
  const {
    branches,
    medicines,
    transfers,
    loading,
    getToken,
    hospitalId,
    onSuccess,
    onError,
    fetchPharmacy,
  } = props

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 w-full">
        <h3 className="font-semibold text-slate-800 mb-3">Transfer stock between branches</h3>
        <TransferStockForm
          branches={branches}
          medicines={medicines}
          onSuccess={() => { onSuccess('Transfer completed'); fetchPharmacy() }}
          onError={onError}
          getToken={getToken}
          hospitalId={hospitalId}
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
                  <td className="p-3">{branches.find((b) => b.id === t.fromBranchId)?.name ?? t.fromBranchId} → {branches.find((b) => b.id === t.toBranchId)?.name ?? t.toBranchId}</td>
                  <td className="p-3 text-right">{t.quantity}</td>
                  <td className="p-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getTransferStatusMeta(t.status).badgeClass}`}>
                      {getTransferStatusMeta(t.status).label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && transfers.length === 0 && (
          <ActionEmptyState
            title="No transfers yet."
            hint="Create a transfer above to move stock between branches."
            actions={[{ label: 'Create transfer', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }), variant: 'secondary' }]}
          />
        )}
      </div>
    </div>
  )
}
