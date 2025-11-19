"use client"

import { useEffect, useState } from "react"
import { db, auth } from "@/firebase/config"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import ChangePasswordSection from "@/components/forms/ChangePasswordSection"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import LoadingSpinner from "@/components/ui/LoadingSpinner"
import Notification from "@/components/ui/Notification"
import PageHeader from "@/components/ui/PageHeader"
import { NotificationData } from "@/types/patient"
import ConfirmDialog from "@/components/ui/ConfirmDialog"

interface DoctorData {
  firstName: string
  lastName: string
  email: string
  role: string
  gender?: string
  phoneNumber?: string
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
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

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
      const updates: Record<string, unknown> = {
        ...formData,
        updatedAt: new Date().toISOString(),
      }
      if (typeof formData.phoneNumber === "string" && formData.phoneNumber.trim()) {
        updates.mfaPhone = formData.phoneNumber.trim()
      }

      await updateDoc(doc(db, "doctors", user.uid), updates)

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
      setLogoutLoading(true)
      await signOut(auth)
      router.replace("/auth/login?role=doctor")
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
          title="Doctor Profile"
          subtitle="View and manage your professional information"
          icon="👨‍⚕️"
          gradient="from-teal-600 to-cyan-700"
        />

        {/* Profile Header - full width to avoid empty side */}
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
            <div className="flex items-center gap-5 flex-wrap">
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg">
                  {userData.firstName?.[0]}{userData.lastName?.[0]}
                </div>
              <div className="flex-1 min-w-[220px]">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Dr. {userData.firstName} {userData.lastName}
                </h2>
                <p className="text-slate-600">{userData.specialization}</p>
              </div>
              <div className="flex gap-3 ml-auto">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                  className="px-5 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    {isEditing ? "Cancel" : "Edit Profile"}
                  </button>
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

          {/* Government Leaves - optional small card under header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span>🏖️</span>
                <span>Government Leaves</span>
              </h3>
              <div className="flex items-center justify-between">
                <div>
                <p className="text-3xl font-bold text-slate-800">12</p>
                  <p className="text-sm text-slate-500 mt-1">Days per year</p>
              </div>
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
                📅
              </div>
            </div>
          </div>

          {/* Profile Details */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🧾</span> First Name</p>
                    <p className="text-slate-900 font-medium">{userData.firstName}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🧾</span> Last Name</p>
                    <p className="text-slate-900 font-medium">{userData.lastName}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>📧</span> Email</p>
                    <p className="text-slate-900 font-medium break-all">{userData.email}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>📱</span> Phone</p>
                    <p className="text-slate-900 font-medium">{userData.phoneNumber || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🩺</span> Specialization</p>
                    <p className="text-slate-900 font-medium">{userData.specialization || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🎓</span> Qualification</p>
                    <p className="text-slate-900 font-medium">{userData.qualification || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>⏱️</span> Experience</p>
                    <p className="text-slate-900 font-medium">{userData.experience || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-2"><span>💰</span> Consultation Fee</p>
                    <p className="text-green-700 font-bold text-lg">{userData.consultationFee ? `₹${userData.consultationFee}` : <span className="text-slate-500 font-medium">Not set</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>⚧️</span> Gender</p>
                    <p className="text-slate-900 font-medium">{userData.gender || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🎂</span> Date of Birth</p>
                    <p className="text-slate-900 font-medium">{userData.dateOfBirth || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-2"><span>🩸</span> Blood Group</p>
                    {userData.bloodGroup ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">{userData.bloodGroup}</span>
                    ) : (
                      <span className="text-slate-500">Not provided</span>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:col-span-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2"><span>🏠</span> Address</p>
                    <p className="text-slate-900 font-medium">{userData.address || <span className="text-slate-500">Not provided</span>}</p>
                  </div>
                </div>
              )}
            </div>

          {/* Security - full width below */}
            <ChangePasswordSection 
              userEmail={user.email!}
              accent="teal"
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
        message="You'll be signed out of the doctor dashboard."
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


