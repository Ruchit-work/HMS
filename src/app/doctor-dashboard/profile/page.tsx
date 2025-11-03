"use client"

import { useEffect, useState } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import ChangePasswordSection from "@/components/ChangePasswordSection"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/LoadingSpinner"
import Notification from "@/components/Notification"
import PageHeader from "@/components/ui/PageHeader"
import { NotificationData } from "@/types/patient"

interface DoctorData {
  firstName: string
  lastName: string
  email: string
  role: string
  gender?: string
  phoneNumber: string
  dateOfBirth?: string
  bloodGroup?: string
  address?: string
  specialization: string
  qualification?: string
  experience: string
  consultationFee?: number
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
const GENDERS = ["Male", "Female", "Other"]

export default function DoctorProfilePage() {
  const { user, loading: authLoading } = useAuth("doctor")
  const router = useRouter()
  const [userData, setUserData] = useState<DoctorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<NotificationData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Fetch doctor data
        const doctorDoc = await getDoc(doc(db, "doctors", user.uid))
        if (doctorDoc.exists()) {
          const data = doctorDoc.data() as DoctorData
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
      await updateDoc(doc(db, "doctors", user.uid), {
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
      router.replace("/auth/login?role=doctor")
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
          title="Doctor Profile"
          subtitle="View and manage your professional information"
          icon="👨‍⚕️"
          gradient="from-teal-600 to-cyan-700"
        />

        {/* Profile Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">
                  {userData.firstName?.[0]}{userData.lastName?.[0]}
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-1">
                  Dr. {userData.firstName} {userData.lastName}
                </h2>
                <p className="text-slate-600 mb-2">{userData.specialization}</p>
                <p className="text-sm text-slate-500 mb-4">Doctor</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-6 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors"
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

            {/* Government Leaves Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md mt-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>🏖️</span>
                <span>Government Leaves</span>
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-slate-800">12</p>
                  <p className="text-sm text-slate-500 mt-1">Days per year</p>
                </div>
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-3xl">
                  📅
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Available</span>
                  <span className="font-semibold text-green-600">12 days</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-600">Used</span>
                  <span className="font-semibold text-red-600">0 days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
              <h3 className="text-xl font-bold text-slate-800 mb-6">Professional Information</h3>
              
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
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Specialization</label>
                    <p className="text-slate-900">{userData.specialization || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Qualification</label>
                    <p className="text-slate-900">{userData.qualification || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Experience</label>
                    <p className="text-slate-900">{userData.experience || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Consultation Fee</label>
                    <p className="text-green-600 font-bold text-lg">₹{userData.consultationFee || "Not set"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
                    <p className="text-slate-900">{userData.gender || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Date of Birth</label>
                    <p className="text-slate-900">{userData.dateOfBirth || "Not provided"}</p>
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
            </div>

            {/* Security - Change Password */}
            <ChangePasswordSection 
              userEmail={user.email!}
              accent="teal"
              notify={(type, message) => setNotification({ type, message })}
            />
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
  userData: DoctorData
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
    specialization: userData.specialization || "",
    qualification: userData.qualification || "",
    experience: userData.experience || "",
    consultationFee: userData.consultationFee || 0
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const updateField = (field: string, value: unknown) => {
    setFormData({ ...formData, [field]: value })
  }

  const inputClass = "w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
  const labelClass = "block text-sm font-semibold text-slate-700 mb-2"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Phone Number</label>
          <input
            type="tel"
            value={formData.phoneNumber}
            onChange={(e) => updateField("phoneNumber", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Date of Birth</label>
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => updateField("dateOfBirth", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Gender</label>
          <select
            value={formData.gender}
            onChange={(e) => updateField("gender", e.target.value)}
            className={inputClass}
          >
            <option value="">Select Gender</option>
            {GENDERS.map(gender => (
              <option key={gender} value={gender}>{gender}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Blood Group</label>
          <select
            value={formData.bloodGroup}
            onChange={(e) => updateField("bloodGroup", e.target.value)}
            className={inputClass}
          >
            <option value="">Select Blood Group</option>
            {BLOOD_GROUPS.map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Specialization</label>
          <input
            type="text"
            value={formData.specialization}
            onChange={(e) => updateField("specialization", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Qualification</label>
          <input
            type="text"
            value={formData.qualification}
            onChange={(e) => updateField("qualification", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Experience</label>
          <input
            type="text"
            value={formData.experience}
            onChange={(e) => updateField("experience", e.target.value)}
            className={inputClass}
            placeholder="e.g., 10+ years"
          />
        </div>
        <div>
          <label className={labelClass}>Consultation Fee (₹)</label>
          <input
            type="number"
            value={formData.consultationFee}
            onChange={(e) => updateField("consultationFee", parseInt(e.target.value) || 0)}
            className={inputClass}
            min="0"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Address</label>
        <textarea
          value={formData.address}
          onChange={(e) => updateField("address", e.target.value)}
          className={inputClass}
          rows={3}
        />
      </div>

      <div className="flex gap-4 pt-6">
        <button
          type="submit"
          disabled={updating}
          className="px-6 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
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


