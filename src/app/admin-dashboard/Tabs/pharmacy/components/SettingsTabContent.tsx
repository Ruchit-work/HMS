import React from 'react'
import type { PharmacyCashierProfile, PharmacyCounter } from '@/types/pharmacy'

export function SettingsTabContent(props: {
  manageCashierCounterTab: 'cashier' | 'counter'
  setManageCashierCounterTab: React.Dispatch<React.SetStateAction<'cashier' | 'counter'>>
  cashierSearchQuery: string
  setCashierSearchQuery: React.Dispatch<React.SetStateAction<string>>
  counterSearchQuery: string
  setCounterSearchQuery: React.Dispatch<React.SetStateAction<string>>
  cashiers: PharmacyCashierProfile[]
  counters: PharmacyCounter[]
  filteredCashiers: PharmacyCashierProfile[]
  filteredCounters: PharmacyCounter[]
  onOpenCreateCashier: () => void
  onOpenEditCashier: (cashier: PharmacyCashierProfile) => void
  onDeleteCashier: (cashier: PharmacyCashierProfile) => void
  onOpenCreateCounter: () => void
  onOpenEditCounter: (counter: PharmacyCounter) => void
  onDeleteCounter: (counter: PharmacyCounter) => void
}) {
  const {
    manageCashierCounterTab,
    setManageCashierCounterTab,
    cashierSearchQuery,
    setCashierSearchQuery,
    counterSearchQuery,
    setCounterSearchQuery,
    cashiers,
    counters,
    filteredCashiers,
    filteredCounters,
    onOpenCreateCashier,
    onOpenEditCashier,
    onDeleteCashier,
    onOpenCreateCounter,
    onOpenEditCounter,
    onDeleteCounter,
  } = props

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">Manage Cashier & Counter</h3>
        <p className="text-sm text-slate-500 mt-0.5">Add and manage cashiers and billing counters. Used when starting a shift in Cash & Expenses.</p>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
          <button
            type="button"
            onClick={() => setManageCashierCounterTab('cashier')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              manageCashierCounterTab === 'cashier' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Cashier
          </button>
          <button
            type="button"
            onClick={() => setManageCashierCounterTab('counter')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              manageCashierCounterTab === 'counter' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Counter
          </button>
        </div>
        {manageCashierCounterTab === 'cashier' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-500">Add and manage cashiers for billing.</p>
              <button type="button" onClick={onOpenCreateCashier} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Create
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="search"
                value={cashierSearchQuery}
                onChange={(e) => setCashierSearchQuery(e.target.value)}
                placeholder="Search cashier by name or phone"
                className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {cashierSearchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setCashierSearchQuery('')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>
            {filteredCashiers.length === 0 ? (
              <div className="py-6 text-sm text-slate-500">
                <p>{cashiers.length === 0 ? 'No cashiers yet.' : 'No cashiers match your search.'}</p>
                <div className="mt-2 flex items-center gap-2">
                  {cashiers.length === 0 ? (
                    <button
                      type="button"
                      onClick={onOpenCreateCashier}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Create Cashier
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCashierSearchQuery('')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="text-left px-4 py-3 font-medium text-slate-600">Name</th><th className="text-left px-4 py-3 font-medium text-slate-600">Phone</th><th className="w-28 text-right px-4 py-3 font-medium text-slate-600">Actions</th></tr></thead>
                  <tbody>
                    {filteredCashiers.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-900">{c.name}</td>
                        <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => onOpenEditCashier(c)} className="text-emerald-600 hover:text-emerald-800 font-medium text-xs mr-2">Edit</button>
                          <button type="button" onClick={() => onDeleteCashier(c)} className="text-rose-600 hover:text-rose-800 font-medium text-xs">Delete</button>
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
              <button type="button" onClick={onOpenCreateCounter} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Create
              </button>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <input
                type="search"
                value={counterSearchQuery}
                onChange={(e) => setCounterSearchQuery(e.target.value)}
                placeholder="Search counter by name"
                className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {counterSearchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setCounterSearchQuery('')}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>
            {filteredCounters.length === 0 ? (
              <div className="py-6 text-sm text-slate-500">
                <p>{counters.length === 0 ? 'No counters yet.' : 'No counters match your search.'}</p>
                <div className="mt-2 flex items-center gap-2">
                  {counters.length === 0 ? (
                    <button
                      type="button"
                      onClick={onOpenCreateCounter}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Create Counter
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCounterSearchQuery('')}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200"><tr><th className="text-left px-4 py-3 font-medium text-slate-600">Counter name</th><th className="w-28 text-right px-4 py-3 font-medium text-slate-600">Actions</th></tr></thead>
                  <tbody>
                    {filteredCounters.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-900">{c.name}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => onOpenEditCounter(c)} className="text-emerald-600 hover:text-emerald-800 font-medium text-xs mr-2">Edit</button>
                          <button type="button" onClick={() => onDeleteCounter(c)} className="text-rose-600 hover:text-rose-800 font-medium text-xs">Delete</button>
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
    </div>
  )
}
