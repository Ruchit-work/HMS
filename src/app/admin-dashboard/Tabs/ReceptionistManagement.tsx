'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Notification from '@/components/ui/feedback/Notification'
import { auth, db } from '@/firebase/config'
import { collection, getDocs, query, where, doc, getDoc, updateDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore'
import type { Branch } from '@/types/branch'

interface Receptionist {
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

interface ReceptionistFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  branchId: string
}

interface ReceptionistEditFormData {
  firstName: string
  lastName: string
  phone: string
  branchId: string
}

export default function ReceptionistManagement({ selectedBranchId = "all" }: { selectedBranchId?: string } = {}) {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId, isSuperAdmin, loading: hospitalLoading } = useMultiHospital()
  const [receptionists, setReceptionists] = useState<Receptionist[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingReceptionist, setEditingReceptionist] = useState<Receptionist | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ReceptionistFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    branchId: ''
  })
  const [editFormData, setEditFormData] = useState<ReceptionistEditFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    branchId: ''
  })

  const loadData = useCallback(async () => {
    if (!activeHospitalId) return
    
    setLoading(true)
    setError(null)
    try {
      // Load receptionists from admin's hospital
      const receptionistsRef = collection(db, 'receptionists')
      const receptionistsQuery = query(
        receptionistsRef,
        where('hospitalId', '==', activeHospitalId)
      )
      const receptionistsSnapshot = await getDocs(receptionistsQuery)
      
      // Get hospital name
      const hospitalDoc = await getDoc(doc(db, 'hospitals', activeHospitalId))
      const hospitalName = hospitalDoc.exists() ? hospitalDoc.data().name : 'Unknown'
      
      let receptionistsList: Receptionist[] = receptionistsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        hospitalName
      } as Receptionist))

      // Helper to safely parse Firestore Timestamp, ISO string, or Date
      const parseDate = (value: any): Date => {
        if (!value) return new Date(0)
        if (value instanceof Date) return value
        if (typeof value?.toDate === 'function') return value.toDate()
        const d = new Date(value)
        return isNaN(d.getTime()) ? new Date(0) : d
      }

      // Filter by branch if selected
      if (selectedBranchId !== "all") {
        receptionistsList = receptionistsList.filter(r => r.branchId === selectedBranchId)
      }

      // Sort by createdAt descending (client-side to avoid index requirement)
      receptionistsList.sort((a, b) => {
        const aDate = parseDate(a.createdAt)
        const bDate = parseDate(b.createdAt)
        return bDate.getTime() - aDate.getTime()
      })

      setReceptionists(receptionistsList)
    } catch {

      setError('Failed to load receptionists. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [activeHospitalId, selectedBranchId])

  // Load branches for the active hospital so admin can assign receptionist to a branch
  useEffect(() => {
    const loadBranches = async () => {
      if (!activeHospitalId) return

      setBranchesLoading(true)
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {

          return
        }

        const token = await currentUser.getIdToken()
        if (!token) {

          return
        }

        const response = await fetch(`/api/branches?hospitalId=${activeHospitalId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()

        if (data.success && Array.isArray(data.branches)) {
          setBranches(data.branches as Branch[])
        } else {

        }
      } catch {

      } finally {
        setBranchesLoading(false)
      }
    }

    loadBranches()
  }, [activeHospitalId])

  useEffect(() => {
    if (user && activeHospitalId && !isSuperAdmin) {
      loadData()
    }
  }, [user, activeHospitalId, isSuperAdmin, loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be logged in')
      }

      const token = await currentUser.getIdToken()
      if (!token) {
        throw new Error('Authentication token not found')
      }

      if (!formData.branchId) {
        throw new Error('Please select a branch for this receptionist')
      }

      const response = await fetch('/api/admin/create-receptionist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receptionistData: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            branchId: formData.branchId
          },
          password: formData.password
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create receptionist')
      }

      setSuccess('Receptionist created successfully!')
      setShowAddModal(false)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        branchId: ''
      })
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to create receptionist. Please try again.')
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
      branchId: ''
    })
    setError(null)
    setSuccess(null)
  }

  const openEditModal = (receptionist: Receptionist) => {
    setEditingReceptionist(receptionist)
    setEditFormData({
      firstName: receptionist.firstName,
      lastName: receptionist.lastName,
      phone: receptionist.phone || '',
      branchId: receptionist.branchId || ''
    })
    setShowEditModal(true)
    setError(null)
    setSuccess(null)
  }

  const handleEditCancel = () => {
    setShowEditModal(false)
    setEditingReceptionist(null)
    setEditFormData({
      firstName: '',
      lastName: '',
      phone: '',
      branchId: ''
    })
  }

  const handleDeleteReceptionist = async (receptionist: Receptionist) => {
    if (!window.confirm(`Delete receptionist ${receptionist.firstName} ${receptionist.lastName}? This cannot be undone.`)) {
      return
    }

    setError(null)
    setSuccess(null)
    setDeletingId(receptionist.id)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be logged in as admin to delete a receptionist')
      }

      const token = await currentUser.getIdToken()

      // Best-effort: delete from Firebase Auth via admin API
      try {
        const authDeleteResponse = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: receptionist.id, userType: 'receptionist' }),
        })

        if (!authDeleteResponse.ok) {
          await authDeleteResponse.json().catch(() => ({}))

        }
      } catch {

      }

      // Delete Firestore receptionist doc
      try {
        await deleteDoc(doc(db, 'receptionists', receptionist.id))
      } catch (fsErr) {

        throw fsErr
      }

      setReceptionists(prev => prev.filter(r => r.id !== receptionist.id))
      setSuccess('Receptionist deleted successfully.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {

      setError(err?.message || 'Failed to delete receptionist. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReceptionist) return

    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      if (!editFormData.branchId) {
        throw new Error('Please select a branch for this receptionist')
      }

      const receptionistRef = doc(db, 'receptionists', editingReceptionist.id)
      const selectedBranch = branches.find(b => b.id === editFormData.branchId)

      await updateDoc(receptionistRef, {
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        phone: editFormData.phone,
        branchId: editFormData.branchId,
        branchName: selectedBranch?.name || '',
        updatedAt: serverTimestamp()
      })

      // Keep basic name info in users collection in sync
      const userRef = doc(db, 'users', editingReceptionist.id)
      await setDoc(userRef, {
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        updatedAt: new Date().toISOString()
      }, { merge: true })

      setSuccess('Receptionist updated successfully!')
      setShowEditModal(false)
      setEditingReceptionist(null)
      await loadData()
    } catch (err: any) {

      setError(err.message || 'Failed to update receptionist. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading || hospitalLoading) {
    return <LoadingSpinner message="Loading receptionists..." />
  }

  // Block super admins
  if (isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Super admins cannot manage receptionists. Please use a regular admin account.</p>
      </div>
    )
  }

  if (!activeHospitalId) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">No hospital selected. Please select a hospital first.</p>
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Receptionist Management</h2>
          <p className="text-sm text-slate-600 mt-1">Create and manage receptionists for your hospital</p>
        </div>
        <button
          onClick={() => {
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              password: '',
              branchId: ''
            })
            setShowAddModal(true)
          }}
          className="btn-modern btn-modern-sm"
        >
          + Create Receptionist
        </button>
      </div>

      {/* Receptionists List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Branch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hospital</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {receptionists.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No receptionists found. Click "Create Receptionist" to create one.
                  </td>
                </tr>
              ) : (
                receptionists.map((receptionist) => (
                  <tr key={receptionist.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {receptionist.firstName} {receptionist.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{receptionist.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{receptionist.phone || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{receptionist.branchName || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{receptionist.hospitalName || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(receptionist)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === receptionist.id}
                          onClick={() => handleDeleteReceptionist(receptionist)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === receptionist.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Create New Receptionist</h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter first name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password (min 6 characters)"
                  />
                  <p className="text-xs text-slate-500 mt-1">Password must be at least 6 characters</p>
                </div>

                {/* Branch selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Branch *
                  </label>
                  <select
                    required
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    disabled={branchesLoading || branches.length === 0}
                  >
                    <option value="">
                      {branchesLoading
                        ? 'Loading branches...'
                        : branches.length === 0
                          ? 'No active branches found'
                          : 'Select a branch'}
                    </option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  {!branchesLoading && branches.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      No active branches available for this hospital. Please create a branch first.
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saving}
                  >
                    {saving ? 'Creating...' : 'Create Receptionist'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingReceptionist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-4">Edit Receptionist</h3>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.firstName}
                      onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter first name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={editingReceptionist.email}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Email cannot be changed from here. Ask support to update login email if needed.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>

                {/* Branch selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Branch *
                  </label>
                  <select
                    required
                    value={editFormData.branchId}
                    onChange={(e) => setEditFormData({ ...editFormData, branchId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    disabled={branchesLoading || branches.length === 0}
                  >
                    <option value="">
                      {branchesLoading
                        ? 'Loading branches...'
                        : branches.length === 0
                          ? 'No active branches found'
                          : 'Select a branch'}
                    </option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  {!branchesLoading && branches.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      No active branches available for this hospital. Please create a branch first.
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleEditCancel}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

