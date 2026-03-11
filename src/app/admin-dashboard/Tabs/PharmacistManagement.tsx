'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import type { Branch } from '@/types/branch'
import Notification from '@/components/ui/feedback/Notification'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import { RevealModal, useRevealModalClose } from '@/components/ui/overlays/RevealModal'

interface Pharmacist {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  hospitalId: string
  branchId?: string
  branchName?: string
  hospitalName?: string
  createdAt?: any
}

interface PharmacistFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  branchId: string
}

function AddPharmacistModalContent({
  formData,
  setFormData,
  onSubmit,
  branches,
  saving,
}: {
  formData: PharmacistFormData
  setFormData: React.Dispatch<React.SetStateAction<PharmacistFormData>>
  onSubmit: (e: React.FormEvent) => void
  branches: Branch[]
  saving: boolean
}) {
  const requestClose = useRevealModalClose()
  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl min-w-[360px] max-h-[95vh] overflow-hidden flex flex-col border border-slate-200/80">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 sm:px-10 pt-7 pb-5 rounded-t-2xl shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5h4.01M7 20h4c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2h-4c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2zM7 6V4c0-1.103.897-2 2-2h4c1.103 0 2 .897 2 2v2" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Create New Pharmacist</h3>
              <p className="text-base text-slate-500 mt-1">Add a new pharmacist login for a branch of this hospital</p>
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
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter first name"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">Last Name *</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter last name"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter email address"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">Phone (optional)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter phone number"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Min 6 characters"
            />
            <p className="text-sm text-slate-500 mt-1.5">Password must be at least 6 characters</p>
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-700 mb-2">
              Branch{branches.length > 1 ? ' *' : ''}
            </label>
            {branches.length <= 1 ? (
              <div className="px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-700">
                {branches.length === 1 ? branches[0].name : 'Main'}
                <p className="text-xs text-slate-500 mt-1">This hospital uses a single branch. The pharmacist will be assigned here automatically.</p>
              </div>
            ) : (
              <select
                required
                value={formData.branchId}
                onChange={(e) => setFormData(prev => ({ ...prev, branchId: e.target.value }))}
                className="w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">{branches.length === 0 ? 'No branches configured' : 'Select a branch'}</option>
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="px-6 py-3 text-base border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 text-base bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating...' : 'Create Pharmacist'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function PharmacistManagement({ selectedBranchId = "all" }: { selectedBranchId?: string } = {}) {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId } = useMultiHospital()
  const [pharmacists, setPharmacists] = useState<Pharmacist[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<PharmacistFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    branchId: ''
  })

  const loadData = useCallback(async () => {
    if (!activeHospitalId) return

    setLoading(true)
    setError(null)
    try {
      const pharmacistsRef = collection(db, 'pharmacists')
      const pharmacistsQuery = query(
        pharmacistsRef,
        where('hospitalId', '==', activeHospitalId)
      )
      const snapshot = await getDocs(pharmacistsQuery)

      const hospitalDoc = await getDoc(doc(db, 'hospitals', activeHospitalId))
      const hospitalName = hospitalDoc.exists() ? (hospitalDoc.data().name as string) : 'Unknown'

      let list: Pharmacist[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        hospitalName,
      } as Pharmacist))

      if (selectedBranchId !== "all") {
        list = list.filter(p => p.branchId === selectedBranchId)
      }

      setPharmacists(list)
    } catch {
      setError('Failed to load pharmacists. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId, selectedBranchId])

  // Load branches so admin can assign pharmacist to a branch
  useEffect(() => {
    const loadBranches = async () => {
      if (!activeHospitalId) return
      setBranchesLoading(true)
      try {
        const currentUser = auth.currentUser
        if (!currentUser) return
        const token = await currentUser.getIdToken()
        if (!token) return
        const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json()
        if (data.success && Array.isArray(data.branches)) {
          setBranches(data.branches as Branch[])
        }
      } finally {
        setBranchesLoading(false)
      }
    }
    loadBranches()
  }, [activeHospitalId])

  useEffect(() => {
    if (user && activeHospitalId) {
      loadData()
    }
  }, [user, activeHospitalId, loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) throw new Error('You must be logged in')
      const token = await currentUser.getIdToken()
      if (!token) throw new Error('Authentication token not found')
      if (branches.length > 0 && !formData.branchId) {
        throw new Error('Please select a branch for this pharmacist')
      }

      const res = await fetch('/api/admin/create-pharmacist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: formData.phone.trim() || undefined,
          branchId: formData.branchId || undefined,
        }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to create pharmacist')
      }

      setSuccess('Pharmacist created successfully!')
      setShowAddModal(false)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        branchId: '',
      })
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Failed to create pharmacist. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setShowAddModal(false)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      branchId: '',
    })
    setError(null)
    setSuccess(null)
  }

  if (authLoading) {
    return <LoadingSpinner message="Checking permissions..." />
  }
  if (!activeHospitalId) {
    return <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center"><p className="text-slate-600">Select a hospital to manage pharmacists.</p></div>
  }

  return (
    <div className="space-y-6">
      {error && <Notification type="error" message={error} onClose={() => setError(null)} />}
      {success && <Notification type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Pharmacist Management</h2>
            <p className="text-sm text-slate-600 mt-1">Create and manage pharmacists for your hospital</p>
          </div>
          <button
            type="button"
          onClick={() => {
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              password: '',
              branchId: branches.length === 1 ? branches[0].id : '',
            })
            setShowAddModal(true)
          }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <span className="text-lg leading-none">+</span>
            <span>Create Pharmacist</span>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner inline /></div>
          ) : pharmacists.length === 0 ? (
            <p className="text-slate-500 text-center py-8 text-sm">No pharmacists found. Click &quot;Create Pharmacist&quot; to add one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2 text-left font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-700">Email</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-700">Phone</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-700">Branch</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-700">Hospital</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacists.map((p) => (
                    <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50/60">
                      <td className="px-4 py-2">{[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}</td>
                      <td className="px-4 py-2">{p.email}</td>
                      <td className="px-4 py-2">{p.phone || '—'}</td>
                      <td className="px-4 py-2">{p.branchName || '—'}</td>
                      <td className="px-4 py-2">{p.hospitalName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <RevealModal
          isOpen={true}
          onClose={handleCancel}
          contentClassName="p-0"
          overlayClassName="mt-30 pt-20 sm:pt-24"
        >
          <AddPharmacistModalContent
            formData={formData}
            setFormData={setFormData}
            onSubmit={saving ? () => {} : handleSubmit}
            branches={branches}
            saving={saving || branchesLoading}
          />
        </RevealModal>
      )}
    </div>
  )
}

