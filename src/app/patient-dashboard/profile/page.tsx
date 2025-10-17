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
    vegetarian: userData.vegetarian || false
  })

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

      <div className="pt-6 border-t border-slate-200">
        <h4 className="text-lg font-bold text-slate-800 mb-4">Medical Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Allergies</label>
            <input
              type="text"
              value={formData.allergies}
              onChange={(e) => setFormData({...formData, allergies: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="List any allergies"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Current Medications</label>
            <input
              type="text"
              value={formData.currentMedications}
              onChange={(e) => setFormData({...formData, currentMedications: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="List current medications"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Drinking Habits</label>
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
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Smoking Habits</label>
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
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Dietary Preference</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="vegetarian"
                  checked={formData.vegetarian === true}
                  onChange={() => setFormData({...formData, vegetarian: true})}
                  className="mr-2"
                />
                Vegetarian
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="vegetarian"
                  checked={formData.vegetarian === false}
                  onChange={() => setFormData({...formData, vegetarian: false})}
                  className="mr-2"
                />
                Non-Vegetarian
              </label>
            </div>
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
