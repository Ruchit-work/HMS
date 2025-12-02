'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import LoadingSpinner from '@/components/ui/StatusComponents'
import Notification from '@/components/ui/Notification'
import { auth, db } from '@/firebase/config'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'

interface Receptionist {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  hospitalId: string
  hospitalName?: string
  createdAt?: any
}

interface ReceptionistFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

export default function ReceptionistManagement() {
  const { user, loading: authLoading } = useAuth()
  const { activeHospitalId, isSuperAdmin, loading: hospitalLoading } = useMultiHospital()
  const [receptionists, setReceptionists] = useState<Receptionist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<ReceptionistFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: ''
  })

  // Block super admins
  if (isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">Super admins cannot manage receptionists. Please use a regular admin account.</p>
      </div>
    )
  }

  useEffect(() => {
    if (user && activeHospitalId && !isSuperAdmin) {
      loadData()
    }
  }, [user, activeHospitalId, isSuperAdmin])

  const loadData = async () => {
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

      // Sort by createdAt descending (client-side to avoid index requirement)
      receptionistsList.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
        const bDate = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
        return bDate.getTime() - aDate.getTime()
      })

      setReceptionists(receptionistsList)
    } catch (err: any) {
      console.error('Error loading receptionists:', err)
      setError('Failed to load receptionists. Please try again.')
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
        throw new Error('You must be logged in')
      }

      const token = await currentUser.getIdToken()
      if (!token) {
        throw new Error('Authentication token not found')
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
            phone: formData.phone
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
        password: ''
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
      password: ''
    })
    setError(null)
    setSuccess(null)
  }

  if (authLoading || loading || hospitalLoading) {
    return <LoadingSpinner message="Loading receptionists..." />
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
              password: ''
            })
            setShowAddModal(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hospital</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {receptionists.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
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
                      <div className="text-sm text-slate-600">{receptionist.hospitalName || 'Unknown'}</div>
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
    </div>
  )
}

