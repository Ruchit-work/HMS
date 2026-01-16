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
      <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
        <p className="text-red-600 font-medium">
          No hospital selected. Please select a hospital first.
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

      {/* Create Branch */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Create New Branch</h2>
        <form onSubmit={handleCreateBranch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Branch Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Main Branch, City Light"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Location *
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {saving ? 'Creating...' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>

      {/* Branch List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Existing Branches</h2>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading branches..." />
        ) : branches.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No branches found for this hospital. Use the form above to create your first branch.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {branches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-800">
                      {branch.name}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">
                      {branch.location}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          branch.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-700'
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
  )
}


