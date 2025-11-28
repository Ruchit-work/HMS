"use client"

import { useEffect, useState } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { ChangePasswordSection } from "@/components/forms/PasswordComponents"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/StatusComponents"
import Notification from "@/components/ui/Notification"
import PageHeader from "@/components/ui/PageHeader"
import { UserData, NotificationData } from "@/types/patient"
import { calculateAge } from "@/utils/date"
import { ConfirmDialog } from "@/components/ui/Modals"

export default function PatientProfilePage() {
  const { user, loading: authLoading } = useAuth("patient")
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<NotificationData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Fetch patient data
        const patientDoc = await getDoc(doc(db, "patients", user.uid))
        if (patientDoc.exists()) {
          const data = patientDoc.data() as UserData
          setUserData(data)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  if (authLoading || loading) {
    return <LoadingSpinner message="Loading Profile..." />
  }

  if (!user || !userData) {
    return null
  }

  const patientAge = calculateAge(userData.dateOfBirth)

  const handleEditProfile = async (formData: Record<string, unknown>) => {
    if (!user) return

    setUpdating(true)
    try {
      // Filter out undefined values and convert to null for numeric fields
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString()
      }
      
      for (const [key, value] of Object.entries(formData)) {
        // For numeric fields (heightCm, weightKg), convert undefined/empty to null
        if (key === 'heightCm' || key === 'weightKg') {
          if (value === undefined || value === null || value === '') {
            updateData[key] = null
          } else {
            updateData[key] = value
          }
        } else {
          // Skip undefined values for other fields - Firestore doesn't accept undefined
          if (value !== undefined) {
            updateData[key] = value
          }
        }
      }

      await updateDoc(doc(db, "patients", user.uid), updateData)

      setUserData({ ...userData, ...updateData } as UserData)
      setIsEditing(false)
      setNotification({ 
        type: "success", 
        message: "Profile updated successfully!" 
      })
    } catch (error: unknown) {
      console.error("Error updating profile:", error)
      setNotification({ 
        type: "error", 
        message: (error as Error).message || "Failed to update profile" 
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleLogout = async () => {
    try {
      setLogoutLoading(true)
      await signOut(auth)
      router.replace("/auth/login?role=patient")
    } catch (error) {
      console.error("Logout error:", error)
      setNotification({ 
        type: "error", 
        message: "Failed to logout. Please try again." 
      })
    } finally {
      setLogoutLoading(false)
      setLogoutConfirmOpen(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Patient Profile"
          subtitle="View and manage your personal information and appointment statistics"
          icon="👤"
          gradient="from-purple-600 to-pink-600"
        />


        {/* Profile Card - full width for balanced layout */}
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
            <div className="flex items-center gap-5 flex-wrap">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg">
                  {userData.firstName?.[0]}{userData.lastName?.[0]}
                </div>
              <div className="flex-1 min-w-[220px]">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                  {userData.firstName} {userData.lastName}
                </h2>
                {userData.patientId && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-700">
                      Patient ID
                      <span className="font-mono text-sm text-teal-900">{userData.patientId}</span>
                    </span>
                  </div>
                )}
                {patientAge !== null && (
                  <p className="text-sm text-slate-500 font-semibold mt-1">
                    Age: <span className="text-slate-800">{patientAge} years</span>
                  </p>
                )}
              </div>
              <div className="flex gap-3 ml-auto">
                  <button
                    onClick={() => setLogoutConfirmOpen(true)}
                  className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Personal Information</h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  {isEditing ? "Cancel" : "Edit Profile"}
                </button>
              </div>
              
              {isEditing ? (
                <ProfileEditForm 
                  userData={userData}
                  onSubmit={handleEditProfile}
                  onCancel={() => setIsEditing(false)}
                  updating={updating}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-[11px] font-semibold text-slate-500 mb-0.5 flex items-center gap-1.5"><span>🧾</span> First Name</p>
                    <p className="text-slate-900 text-sm font-medium">{userData.firstName}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🧾</span> Last Name</p>
                    <p className="text-slate-900 font-medium">{userData.lastName}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>📧</span> Email</p>
                    <p className="text-slate-900 font-medium break-all">{userData.email}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>📱</span> Phone</p>
                    <p className="text-slate-900 font-medium">{userData.phoneNumber || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🎂</span> Date of Birth</p>
                    {userData.dateOfBirth ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-900 font-medium">{userData.dateOfBirth}</span>
                        {patientAge !== null && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                            {patientAge} years
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">Not provided</span>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>⚧️</span> Gender</p>
                    <p className="text-slate-900 font-medium">{userData.gender || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-2"><span>🩸</span> Blood Group</p>
                    {userData.bloodGroup ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">{userData.bloodGroup}</span>
                    ) : (
                      <span className="text-slate-500">Not provided</span>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🏠</span> Address</p>
                    <p className="text-slate-900 font-medium">{userData.address || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>💼</span> Occupation</p>
                    <p className="text-slate-900 font-medium">{userData.occupation || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-2"><span>🏥</span> Family History</p>
                    {userData.familyHistory ? (
                      <div className="flex flex-wrap gap-1.5">
                        {userData.familyHistory.split(',').map((item) => (
                          <span key={item.trim()} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {item.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">Not provided</span>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🤰</span> Pregnancy Status</p>
                    <p className="text-slate-900 font-medium">{userData.pregnancyStatus || <span className="text-slate-500">Not applicable</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>📏</span> Height (cm)</p>
                    <p className="text-slate-900 font-medium">{userData.heightCm ?? <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>⚖️</span> Weight (kg)</p>
                    <p className="text-slate-900 font-medium">{userData.weightKg ?? <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                </div>
              )}

              {/* Medical Information */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-base font-bold text-slate-800 mb-3">Medical Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>⚠️</span> Allergies</p>
                    <p className="text-slate-900 font-medium">{userData.allergies || <span className="text-slate-500">None reported</span>}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>💊</span> Current Medications</p>
                    <p className="text-slate-900 font-medium">{userData.currentMedications || <span className="text-slate-500">None reported</span>}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🍷</span> Drinking Habits</p>
                    <p className="text-slate-900 font-medium">{userData.drinkingHabits || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🚬</span> Smoking Habits</p>
                    <p className="text-slate-900 font-medium">{userData.smokingHabits || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-3 md:col-span-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🥗</span> Dietary Preference</p>
                    <p className="text-slate-900 font-medium">{userData.vegetarian ? "Vegetarian" : "Non-Vegetarian"}</p>
                  </div>
                </div>
              </div>
            </div>

          {/* Security - stays full width below content */}
            <ChangePasswordSection 
              userEmail={user.email!}
              accent="purple"
              notify={(type, message) => setNotification({ type, message })}
            />
        </div>
      </main>

      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        title="Sign out?"
        message="You will need to log in again to access your patient dashboard."
        confirmText="Logout"
        cancelText="Stay signed in"
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
        confirmLoading={logoutLoading}
      />
    </div>
  )
}

// Profile Edit Form Component
function ProfileEditForm({ 
  userData, 
  onSubmit, 
  onCancel, 
  updating 
}: { 
  userData: UserData
  onSubmit: (data: Record<string, unknown>) => void
  onCancel: () => void
  updating: boolean
}) {
  const [formData, setFormData] = useState({
    firstName: userData.firstName || "",
    lastName: userData.lastName || "",
    phoneNumber: userData.phoneNumber || "",
    dateOfBirth: userData.dateOfBirth || "",
    gender: userData.gender || "",
    bloodGroup: userData.bloodGroup || "",
    address: userData.address || "",
    allergies: userData.allergies || "",
    currentMedications: userData.currentMedications || "",
    drinkingHabits: userData.drinkingHabits || "",
    smokingHabits: userData.smokingHabits || "",
    vegetarian: userData.vegetarian || false,
    occupation: userData.occupation || "",
    familyHistory: userData.familyHistory || "",
    pregnancyStatus: userData.pregnancyStatus || "",
    heightCm: userData.heightCm || (undefined as unknown as number),
    weightKg: userData.weightKg || (undefined as unknown as number)
  })

  // Ensure pregnancy status is only applicable for Female
  useEffect(() => {
    if (formData.gender !== "Female" && formData.pregnancyStatus) {
      setFormData({ ...formData, pregnancyStatus: "" })
    }
  }, [formData.gender])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData({...formData, gender: e.target.value})}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Blood Group</label>
          <select
            value={formData.bloodGroup}
            onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Select Blood Group</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
        <textarea
          value={formData.address}
          onChange={(e) => setFormData({...formData, address: e.target.value})}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Occupation</label>
        <input
          type="text"
          value={formData.occupation}
          onChange={(e) => setFormData({...formData, occupation: e.target.value})}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="e.g., Teacher, Software Engineer"
        />
      </div>

      <div className="pt-6 border-t border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>🩺</span>
            <span>Medical Information</span>
          </h4>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Private</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span>⚠️</span>
              <span>Allergies</span>
            </label>
            <input
              type="text"
              value={formData.allergies}
              onChange={(e) => setFormData({...formData, allergies: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="List any allergies"
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span>💊</span>
              <span>Current Medications</span>
            </label>
            <input
              type="text"
              value={formData.currentMedications}
              onChange={(e) => setFormData({...formData, currentMedications: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="List current medications"
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span>🏥</span>
              <span>Family History</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'Diabetes',
                'Hypertension',
                'Heart Disease',
                'Stroke',
                'Asthma',
                'Cancer',
                'Thyroid Disorder',
                'Kidney Disease',
                'Liver Disease',
                'Tuberculosis'
              ].map((cond) => {
                const selected = (formData.familyHistory || '').split(',').map(s => s.trim()).filter(Boolean)
                const isChecked = selected.includes(cond)
                return (
                  <button
                    type="button"
                    key={cond}
                    onClick={() => {
                      const current = new Set(selected)
                      if (isChecked) current.delete(cond); else current.add(cond)
                      const next = Array.from(current).join(', ')
                      setFormData({...formData, familyHistory: next})
                    }}
                    className={`px-3 py-2 rounded-full border transition-all text-sm ${isChecked ? 'bg-purple-50 border-purple-300 text-purple-800' : 'bg-white border-slate-300 hover:border-slate-400'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-3.5 w-3.5 rounded-full border ${isChecked ? 'bg-purple-600 border-purple-600' : 'border-slate-300'}`}></span>
                      <span>{cond}</span>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-3">
              <input
                type="text"
                value={formData.familyHistory}
                onChange={(e) => setFormData({...formData, familyHistory: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Other (optional). You can type or edit selections"
              />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span>🍷</span>
              <span>Drinking Habits</span>
            </label>
            <select
              value={formData.drinkingHabits}
              onChange={(e) => setFormData({...formData, drinkingHabits: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Select</option>
              <option value="Never">Never</option>
              <option value="Occasionally">Occasionally</option>
              <option value="Regularly">Regularly</option>
            </select>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span>🚬</span>
              <span>Smoking Habits</span>
            </label>
            <select
              value={formData.smokingHabits}
              onChange={(e) => setFormData({...formData, smokingHabits: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Select</option>
              <option value="Never">Never</option>
              <option value="Occasionally">Occasionally</option>
              <option value="Regularly">Regularly</option>
            </select>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Dietary Preference</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({...formData, vegetarian: true})}
                className={`px-4 py-2 rounded-lg border text-sm transition-all ${formData.vegetarian === true ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-slate-300 hover:border-slate-400'}`}
              >
                Vegetarian
              </button>
              <button
                type="button"
                onClick={() => setFormData({...formData, vegetarian: false})}
                className={`px-4 py-2 rounded-lg border text-sm transition-all ${formData.vegetarian === false ? 'bg-red-50 border-red-300 text-red-800' : 'bg-white border-slate-300 hover:border-slate-400'}`}
              >
                Non-Vegetarian
              </button>
            </div>
          </div>
          {formData.gender === "Female" && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <span>🤰</span>
                <span>Pregnancy</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, pregnancyStatus: 'Yes'})}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${formData.pregnancyStatus === 'Yes' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-slate-300 hover:border-slate-400'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, pregnancyStatus: 'No'})}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${formData.pregnancyStatus === 'No' ? 'bg-red-50 border-red-300 text-red-800' : 'bg-white border-slate-300 hover:border-slate-400'}`}
                >
                  No
                </button>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span>📏</span>
              <span>Height (cm)</span>
            </label>
            <input
              type="number"
              value={formData.heightCm ?? ''}
              onChange={(e) => setFormData({...formData, heightCm: e.target.value ? Number(e.target.value) : (undefined as unknown as number)})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              min={0}
            />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <span>⚖️</span>
              <span>Weight (kg)</span>
            </label>
            <input
              type="number"
              value={formData.weightKg ?? ''}
              onChange={(e) => setFormData({...formData, weightKg: e.target.value ? Number(e.target.value) : (undefined as unknown as number)})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              min={0}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-6">
        <button
          type="submit"
          disabled={updating}
          className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {updating ? "Updating..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
