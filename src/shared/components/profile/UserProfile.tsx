"use client"

import { useState, useEffect, useCallback, type FormEvent } from "react"
import {
  User as UserIcon,
  Mail,
  Phone,
  Building2,
  GitBranch,
  ShieldCheck,
  Calendar,
  Clock,
  Lock,
  Camera,
  Save,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/shared/components"
import { ChangePasswordSection } from "@/features/forms/PasswordComponents"
import { auth } from "@/firebase/config"

import { authedFetchJson } from "@/shared/utils/authedFetch"

interface UserProfileData {
  uid: string
  email: string
  firstName: string
  lastName: string
  displayName: string
  phone: string
  photoURL: string
  role: string
  hospitalId: string | null
  hospitalName: string
  branchId: string | null
  branchName: string
  createdAt: string | null
  lastLogin: string | null
  permissions: string[]
}

export default function UserProfile({
  onNotify,
}: {
  onNotify?: (type: "success" | "error", message: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserProfileData | null>(null)

  // Form edit state
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [photoURL, setPhotoURL] = useState("")

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      if (!auth.currentUser) {
        setLoading(false)
        return
      }

      const data = await authedFetchJson<UserProfileData>("/api/user/profile")

      setProfile(data)
      setFirstName(data.firstName || "")
      setLastName(data.lastName || "")
      setPhone(data.phone || "")
      setPhotoURL(data.photoURL || "")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load profile"
      onNotify?.("error", msg)
    } finally {
      setLoading(false)
    }
  }, [onNotify])

  useEffect(() => {
    if (auth.currentUser) {
      void loadProfile()
    }
    const unsubscribe = auth.onAuthStateChanged((currUser) => {
      if (currUser) {
        void loadProfile()
      }
    })
    return () => unsubscribe()
  }, [loadProfile])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await authedFetchJson("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          photoURL,
        }),
      })

      onNotify?.("success", "Profile updated successfully")
      await loadProfile()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save profile"
      onNotify?.("error", msg)
    } finally {
      setSaving(false)
    }
  }

  const formatRoleLabel = (role?: string) => {
    switch (role) {
      case "super_admin":
        return "Platform Super Admin"
      case "admin":
        return "Hospital Administrator"
      case "receptionist":
        return "Hospital Receptionist"
      case "doctor":
        return "Medical Doctor"
      case "pharmacy":
      case "pharmacist":
        return "Pharmacist"
      case "patient":
        return "Patient"
      default:
        return role ? role.toUpperCase() : "Authenticated User"
    }
  }

  const formatDateStr = (dateVal?: string | null) => {
    if (!dateVal) return "N/A"
    try {
      const d = new Date(dateVal)
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      }
    } catch {
      /* ignore */
    }
    return String(dateVal)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          Loading My Profile…
        </div>
      </div>
    )
  }

  const initialLetter = (firstName?.[0] || profile?.displayName?.[0] || profile?.email?.[0] || "U").toUpperCase()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              {photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoURL}
                  alt={profile?.displayName || "Profile avatar"}
                  className="h-20 w-20 rounded-2xl object-cover border-2 border-cyan-500/20 shadow-sm"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 to-teal-700 text-2xl font-bold text-white shadow-sm">
                  {initialLetter}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-white shadow-xs">
                <Camera className="h-3.5 w-3.5" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-slate-900">
                  {profile?.displayName || `${firstName} ${lastName}`.trim() || "My Profile"}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 border border-cyan-200 px-3 py-0.5 text-xs font-bold text-cyan-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-600" />
                  {formatRoleLabel(profile?.role)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {profile?.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <Building2 className="h-3.5 w-3.5 text-cyan-600" />
              <span>{profile?.hospitalName}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              <GitBranch className="h-3.5 w-3.5 text-cyan-600" />
              <span>{profile?.branchName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form & System Attributes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Editable Information */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-cyan-600" />
                Personal & Contact Details
              </h3>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Editable
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="First Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Last Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Profile Photo URL</label>
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-3.5 w-3.5" />
                </span>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={profile?.email || ""}
                  className="w-full pl-9 pr-3.5 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl text-xs cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Email address is used for authentication and cannot be directly modified here.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                loadingText="Saving Changes..."
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs px-5 py-2 rounded-xl"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Profile Details
              </Button>
            </div>
          </div>
        </form>

        {/* Right 1 Col: Read-Only System Metadata */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-400" />
                System Attributes
              </h3>
              <span className="text-xs text-slate-400 font-semibold">Read-Only</span>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">System Role</p>
                <p className="text-xs font-bold text-slate-800">{formatRoleLabel(profile?.role)}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Hospital</p>
                <p className="text-xs font-bold text-slate-800">{profile?.hospitalName || "N/A"}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Branch</p>
                <p className="text-xs font-bold text-slate-800">{profile?.branchName || "N/A"}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-slate-400" /> Account Created
                </p>
                <p className="text-xs font-semibold text-slate-700">{formatDateStr(profile?.createdAt)}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" /> Last Login
                </p>
                <p className="text-xs font-semibold text-slate-700">{formatDateStr(profile?.lastLogin)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Section */}
      <ChangePasswordSection userEmail={profile?.email || ""} notify={onNotify} />
    </div>
  )
}
