'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useMultiHospital } from '@/contexts/MultiHospitalContext'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import Notification from '@/components/ui/feedback/Notification'
import { ConfirmDialog } from '@/components/ui/overlays/Modals'
import { auth, db } from '@/firebase/config'
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc } from 'firebase/firestore'
import { Hospital } from '@/types/hospital'

interface Admin {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  hospitalId: string
  hospitalName?: string
  isSuperAdmin: boolean
  createdAt?: any
}

interface AdminFormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  hospitalId: string
}

export default function AdminAssignment() {
  const { user, loading: authLoading } = useAuth()
  const { isSuperAdmin } = useMultiHospital()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<AdminFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    hospitalId: ''
  })

  useEffect(() => {
    if (user && isSuperAdmin) {
      loadData()
    }
  }, [user, isSuperAdmin])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Load hospitals
      const hospitalsRef = collection(db, 'hospitals')
      const hospitalsQuery = query(hospitalsRef, orderBy('name', 'asc'))
      const hospitalsSnapshot = await getDocs(hospitalsQuery)
      const hospitalsList = hospitalsSnapshot.docs
        .filter(doc => doc.data().status === 'active')
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Hospital))
      setHospitals(hospitalsList)

      // Load admins
      const adminsRef = collection(db, 'admins')
      const adminsQuery = query(adminsRef, orderBy('createdAt', 'desc'))
      const adminsSnapshot = await getDocs(adminsQuery)
      
      // Enrich with hospital names
      const adminsList: Admin[] = []
      for (const adminDoc of adminsSnapshot.docs) {
        const adminData = adminDoc.data()
        let hospitalName = 'Unknown'
        
        if (adminData.hospitalId) {
          const hospitalDoc = await getDoc(doc(db, 'hospitals', adminData.hospitalId))
          if (hospitalDoc.exists()) {
            hospitalName = hospitalDoc.data().name
          }
        }

        adminsList.push({
          id: adminDoc.id,
          email: adminData.email,
          firstName: adminData.firstName || '',
          lastName: adminData.lastName || '',
          phone: adminData.phone,
          hospitalId: adminData.hospitalId || '',
          hospitalName,
          isSuperAdmin: adminData.isSuperAdmin || false,
          createdAt: adminData.createdAt
        })
      }

      setAdmins(adminsList)
    } catch {
      setError('Failed to load data. Please try again.')
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
        throw new Error('You must be logged in to create admins')
      }

      const token = await currentUser.getIdToken()
      if (!token) {
        throw new Error('Authentication token not found')
      }

      const response = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adminData: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone || null
          },
          password: formData.password,
          hospitalId: formData.hospitalId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create admin')
      }

      setSuccess('Admin created and assigned to hospital successfully!')
      setShowAddModal(false)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        hospitalId: ''
      })
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to create admin. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setShowAddModal(false)
    setEditingAdmin(null)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      hospitalId: ''
    })
    setError(null)
    setSuccess(null)
  }

  const handleEdit = (admin: Admin) => {
    setEditingAdmin(admin)
    setFormData({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phone: admin.phone || '',
      password: '', // Don't populate password for edit
      hospitalId: admin.hospitalId
    })
    setShowAddModal(true)
  }

  const handleDeleteClick = (admin: Admin) => {
    if (admin.isSuperAdmin) {
      setError('Cannot delete super admin account')
      return
    }
    setDeletingAdmin(admin)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingAdmin) return

    setDeleting(true)
    setError(null)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be logged in to delete admins')
      }

      const token = await currentUser.getIdToken()
      if (!token) {
        throw new Error('Authentication token not found')
      }

      // Delete from Firebase Auth
      const authDeleteResponse = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: deletingAdmin.id, userType: 'admin' })
      })

      if (!authDeleteResponse.ok) {
        await authDeleteResponse.json().catch(() => ({}))
        // Continue with Firestore deletion even if auth deletion fails
      }

      // Delete from Firestore admins collection
      const adminRef = doc(db, 'admins', deletingAdmin.id)
      await deleteDoc(adminRef)

      // Also delete from users collection
      const userRef = doc(db, 'users', deletingAdmin.id)
      await deleteDoc(userRef).catch(() => {
        // Ignore if doesn't exist
      })

      setSuccess('Admin deleted successfully!')
      setShowDeleteDialog(false)
      setDeletingAdmin(null)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to delete admin. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAdmin) return

    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('You must be logged in to update admins')
      }

      const token = await currentUser.getIdToken()
      if (!token) {
        throw new Error('Authentication token not found')
      }

      const response = await fetch('/api/admin/update-admin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          adminId: editingAdmin.id,
          adminData: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone || null
          },
          hospitalId: formData.hospitalId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update admin')
      }

      setSuccess('Admin updated successfully!')
      setShowAddModal(false)
      setEditingAdmin(null)
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        hospitalId: ''
      })
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to update admin. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading admins..." />
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
          <h2 className="text-2xl font-bold text-slate-800">Admin Assignment</h2>
          <p className="text-sm text-slate-600 mt-1">Create and assign admins to hospitals</p>
        </div>
        <button
          onClick={() => {
            setEditingAdmin(null)
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              password: '',
              hospitalId: ''
            })
            setError(null)
            setSuccess(null)
            setShowAddModal(true)
          }}
          className="btn-modern btn-modern-sm"
        > + Create Admin </button>
      </div>

      {/* Admins List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Hospital</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No admins found. Click "Create Admin" to create one.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {admin.firstName} {admin.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{admin.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{admin.phone || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600">{admin.hospitalName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        admin.isSuperAdmin 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {admin.isSuperAdmin ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {!admin.isSuperAdmin && (
                          <>
                            <button  onClick={() => handleEdit(admin)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                              title="Edit admin">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button onClick={() => handleDeleteClick(admin)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 transition-colors"
                              title="Delete admin">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </>
                        )}
                        {admin.isSuperAdmin && (
                          <span className="text-xs text-slate-400 italic">No actions available</span>
                        )}
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
              <h3 className="text-2xl font-bold text-slate-800 mb-4">
                {editingAdmin ? 'Edit Admin' : 'Create New Admin'}
              </h3>

              <form onSubmit={editingAdmin ? handleUpdate : handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">  First Name *  </label>
                    <input type="text"  required value={formData.firstName}  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter first name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">   Last Name * </label>
                    <input   type="text"required  value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">  Email * </label>
                  <input   type="email"  required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1"> Phone</label>
                  <input type="tel"  value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">  Hospital * </label>
                  <select required  value={formData.hospitalId}
                    onChange={(e) => setFormData({ ...formData, hospitalId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a hospital</option>
                    {hospitals.map((hospital) => (
                      <option key={hospital.id} value={hospital.id}>
                        {hospital.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!editingAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">  Password *</label>
                    <input  type="password" required minLength={6} value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter password (min 6 characters)"/>
                    <p className="text-xs text-slate-500 mt-1">Password must be at least 6 characters</p>
                  </div>
                )}
                {editingAdmin && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Password cannot be changed here. The admin can change their password from their profile settings.
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button  type="button"  onClick={handleCancel} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                    disabled={saving} >
                    Cancel
                  </button>
                  <button type="submit" className="btn-modern btn-modern-sm disabled:opacity-50 disabled:cursor-not-allowed"  disabled={saving}  >
                    {saving ? (editingAdmin ? 'Updating...' : 'Creating...') : (editingAdmin ? 'Update Admin' : 'Create Admin')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog  isOpen={showDeleteDialog} title="Delete Admin"
        message={deletingAdmin ? `Are you sure you want to delete ${deletingAdmin.firstName} ${deletingAdmin.lastName}? This action cannot be undone and will remove the admin from the system.` : ''}
        confirmText="Delete" cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setShowDeleteDialog(false) 
          setDeletingAdmin(null)
         }}
        confirmLoading={deleting}
      />
    </div>
  )
}

