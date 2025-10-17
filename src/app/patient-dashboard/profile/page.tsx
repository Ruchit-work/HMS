"use client"

import { useEffect, useState } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import Notification from "@/components/Notification"
import PageHeader from "@/components/ui/PageHeader"
import { UserData, NotificationData } from "@/types/patient"

export default function PatientProfilePage() {
  const { user, loading: authLoading } = useAuth("patient")
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<NotificationData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [updating, setUpdating] = useState(false)

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

  const handleEditProfile = async (formData: Record<string, unknown>) => {
    if (!user) return

    setUpdating(true)
    try {
      await updateDoc(doc(db, "patients", user.uid), {
        ...formData,
        updatedAt: new Date().toISOString()
      })

      setUserData({ ...userData, ...formData })
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
      await signOut(auth)
      router.replace("/auth/login?role=patient")
    } catch (error) {
      console.error("Logout error:", error)
      setNotification({ 
        type: "error", 
        message: "Failed to logout. Please try again." 
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50/30">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="My Profile"
          subtitle="View and manage your personal information and appointment statistics"
          icon="👤"
          gradient="from-purple-600 to-pink-600"
        />


        {/* Profile Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">
                  {userData.firstName?.[0]}{userData.lastName?.[0]}
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1">
                  {userData.firstName} {userData.lastName}
                </h2>
                <p className="text-slate-600 mb-4">Patient</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {isEditing ? "Cancel" : "Edit Profile"}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Personal Information</h3>
              
              {isEditing ? (
                <ProfileEditForm 
                  userData={userData}
                  onSubmit={handleEditProfile}
                  onCancel={() => setIsEditing(false)}
                  updating={updating}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                    <p className="text-slate-900">{userData.firstName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                    <p className="text-slate-900">{userData.lastName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                    <p className="text-slate-900">{userData.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                    <p className="text-slate-900">{userData.phoneNumber || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
                    <p className="text-slate-900">{userData.dateOfBirth || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
                    <p className="text-slate-900">{userData.gender || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Blood Group</label>
                    <p className="text-slate-900">{userData.bloodGroup || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Address</label>
                    <p className="text-slate-900">{userData.address || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Occupation</label>
                    <p className="text-slate-900">{userData.occupation || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Family History</label>
                    {userData.familyHistory ? (
                      <div className="flex flex-wrap gap-2">
                        {userData.familyHistory.split(',').map((item) => (
                          <span key={item.trim()} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {item.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-900">Not provided</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Pregnancy Status</label>
                    <p className="text-slate-900">{userData.pregnancyStatus || "Not applicable"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Height (cm)</label>
                    <p className="text-slate-900">{userData.heightCm ?? "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Weight (kg)</label>
                    <p className="text-slate-900">{userData.weightKg ?? "Not provided"}</p>
                  </div>
                </div>
              )}

              {/* Medical Information */}
              <div className="mt-8 pt-6 border-t border-slate-200">
                <h4 className="text-lg font-bold text-slate-800 mb-4">Medical Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Allergies</label>
                    <p className="text-slate-900">{userData.allergies || "None reported"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Current Medications</label>
                    <p className="text-slate-900">{userData.currentMedications || "None reported"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Drinking Habits</label>
                    <p className="text-slate-900">{userData.drinkingHabits || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Smoking Habits</label>
                    <p className="text-slate-900">{userData.smokingHabits || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Dietary Preference</label>
                    <p className="text-slate-900">{userData.vegetarian ? "Vegetarian" : "Non-Vegetarian"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {notification && (
        <Notification 
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
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
