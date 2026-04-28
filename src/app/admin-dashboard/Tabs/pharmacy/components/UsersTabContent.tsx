import React from 'react'

export function UsersTabContent(props: {
  pharmacists: Array<{ id: string; email: string; firstName: string; lastName: string; branchName: string }>
  loading: boolean
  onOpenCreatePharmacist: () => void
}) {
  const { pharmacists, loading, onOpenCreatePharmacist } = props

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-800 mb-1">Pharmacist accounts</h3>
          <p className="text-sm text-slate-600">Create login IDs for pharmacists and assign them to branches.</p>
        </div>
        <button
          type="button"
          onClick={onOpenCreatePharmacist}
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
  )
}
