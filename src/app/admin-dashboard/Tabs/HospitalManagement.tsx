'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import LoadingSpinner from '@/components/ui/StatusComponents'
import Notification from '@/components/ui/Notification'
import { auth, db } from '@/firebase/config'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { Hospital } from '@/types/hospital'

interface HospitalFormData {
  name: string
  code: string
  address: string
  phone: string
  email: string
}

export default function HospitalManagement() {
  const { user, loading: authLoading } = useAuth()
  const { isSuperAdmin } = useMultiHospital()
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<HospitalFormData>({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: ''
  })

  useEffect(() => {
    if (user && isSuperAdmin) {
      loadHospitals()
    }
  }, [user, isSuperAdmin])

  const loadHospitals = async () => {
    setLoading(true)
    setError(null)
    try {
      const hospitalsRef = collection(db, 'hospitals')
      const q = query(hospitalsRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      const hospitalsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Hospital))
      setHospitals(hospitalsList)
    } catch (err: any) {
      setError('Failed to load hospitals. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be logged in to manage hospitals')
      }

      const token = await currentUser.getIdToken()

      const url = editingHospital
        ? `/api/hospitals/${editingHospital.id}`
        : '/api/hospitals'
      
      const method = editingHospital ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save hospital')
      }

      setSuccess(editingHospital ? 'Hospital updated successfully!' : 'Hospital created successfully!')
      setShowAddModal(false)
      setEditingHospital(null)
      setFormData({ name: '', code: '', address: '', phone: '', email: '' })
      await loadHospitals()
    } catch (err: any) {
      setError(err.message || 'Failed to save hospital. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (hospital: Hospital) => {
    setEditingHospital(hospital)
    setFormData({
      name: hospital.name,
      code: hospital.code,
      address: hospital.address,
      phone: hospital.phone,
      email: hospital.email || ''
    })
    setShowAddModal(true)
  }

  const handleDelete = async (hospitalId: string) => {
    if (!confirm('Are you sure you want to deactivate this hospital? This will set its status to inactive.')) {
      return
    }

    setError(null)
    setSuccess(null)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be logged in to manage hospitals')
      }

      const token = await currentUser.getIdToken()

      const response = await fetch(`/api/hospitals/${hospitalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete hospital')
      }

      setSuccess('Hospital deactivated successfully!')
      await loadHospitals()
    } catch (err: any) {
      setError(err.message || 'Failed to delete hospital. Please try again.')
    }
  }

  const handleCancel = () => {
    setShowAddModal(false)
    setEditingHospital(null)
    setFormData({ name: '', code: '', address: '', phone: '', email: '' })
    setError(null)
    setSuccess(null)
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading hospitals..." />
  }

  // Only super admins can access this
  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Access Denied: Super Admin privileges required</p>
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
          <h2 className="text-2xl font-bold text-slate-800">Hospital Management</h2>
          <p className="text-sm text-slate-600 mt-1">Create and manage hospitals in the system</p>
        </div>
        <button
          onClick={() => {
            setEditingHospital(null)
            setFormData({ name: '', code: '', address: '', phone: '', email: '' })
            setShowAddModal(true)
          }}
          className="btn-modern btn-modern-sm"
        >
          + Add Hospital
        </button>
      </div>

      {/* Hospitals List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {hospitals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No hospitals found. Click "Add Hospital" to create one.
                  </td>
                </tr>
              ) : (
                hospitals.map((hospital) => (
                  <tr key={hospital.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{hospital.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{hospital.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">{hospital.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{hospital.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        hospital.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {hospital.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEdit(hospital)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      {hospital.status === 'active' && (
                        <button
                          onClick={() => handleDelete(hospital.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-4">
                {editingHospital ? 'Edit Hospital' : 'Add New Hospital'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Hospital Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter hospital name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Hospital Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., HMS001"
                    disabled={!!editingHospital}
                  />
                  {editingHospital && (
                    <p className="text-xs text-slate-500 mt-1">Code cannot be changed</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Address *
                  </label>
                  <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter hospital address"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                    className="btn-modern btn-modern-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : editingHospital ? 'Update Hospital' : 'Create Hospital'}
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

