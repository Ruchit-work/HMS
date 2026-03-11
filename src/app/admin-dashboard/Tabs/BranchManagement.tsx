'use client'

import { useEffect, useState } from 'react'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import { auth } from '@/firebase/config'
import type { Branch, BranchTimings } from '@/types/branch'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Notification from '@/components/ui/feedback/Notification'

const DEFAULT_TIMINGS: BranchTimings = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: null,
  sunday: null
}

export default function BranchManagement() {
  const { activeHospitalId } = useMultiHospital()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [timings] = useState<BranchTimings>(DEFAULT_TIMINGS)

  const loadBranches = async () => {
    if (!activeHospitalId) return
    setLoading(true)
    setError(null)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be logged in')
      }

      const token = await currentUser.getIdToken()
      const res = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load branches')
      }

      setBranches(data.branches as Branch[])
    } catch (err: any) {
      setError(err.message || 'Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBranches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHospitalId])

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!activeHospitalId) {
      setError('No hospital selected')
      return
    }

    try {
      setSaving(true)

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be logged in')
      }

      const token = await currentUser.getIdToken()

      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          location,
          hospitalId: activeHospitalId,
          timings
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create branch')
      }

      setSuccess('Branch created successfully')
      setName('')
      setLocation('')
      await loadBranches()
    } catch (err: any) {
      setError(err.message || 'Failed to create branch')
    } finally {
      setSaving(false)
    }
  }

  if (!activeHospitalId) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/70 p-6 sm:p-8">
        <p className="text-sm sm:text-base text-red-600 font-medium">
          No hospital selected. Please select a hospital first from the top dropdown.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Notification
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}
      {success && (
        <Notification
          type="success"
          message={success}
          onClose={() => setSuccess(null)}
        />
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/70 p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Branch Management</h2>
            <p className="text-sm text-slate-500">
              Create and manage branches for this hospital. Branches are used across pharmacy, reception, and reporting.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.5fr)]">
          {/* Create Branch */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-800">Create new branch</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Add a branch with name and city/location. Default timings are Mon–Fri, 09:00–17:00; you can fine-tune later if needed.
              </p>
            </div>
            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wide">
                    Branch name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Main Branch, City Light"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wide">
                    Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. Surat, Navsari"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Default timings are set to Monday–Friday, 09:00–17:00. You can customize advanced timings later if needed.
              </p>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-modern btn-modern-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating…' : 'Create branch'}
                </button>
              </div>
            </form>
          </div>

          {/* Branch List */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-800">Existing branches</h3>
                <p className="text-xs text-slate-500">
                  {branches.length} branch{branches.length === 1 ? '' : 'es'} configured for this hospital.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner inline message="Loading branches..." />
              </div>
            ) : branches.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No branches found for this hospital. Use the form on the left to create your first branch.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-4 py-2 text-left text[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {branches.map((branch) => (
                      <tr key={branch.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2 text-slate-800">
                          {branch.name}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {branch.location}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              branch.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {branch.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


