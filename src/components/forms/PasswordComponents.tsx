"use client"

import { useState } from "react"
import { auth } from "@/firebase/config"
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth"

// ============================================================================
// Password Requirements Component
// ============================================================================

interface PasswordRequirementsProps {
  password: string
}

interface Requirements {
  length: boolean
  uppercase: boolean
  lowercase: boolean
  digit: boolean
  special: boolean
}

export default function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const requirements = validatePassword(password)

  if (!password) return null

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className="text-xs text-gray-500">Requires:</span>
      <div className="flex gap-1.5">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.length ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          8+
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.uppercase ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          A
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.lowercase ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          a
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.digit ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          1
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${
          requirements.special ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-300'
        }`}>
          @ /
        </span>
      </div>
    </div>
  )
}

// Export the validation function for use in forms
export const validatePassword = (pass: string): Requirements => {
  return {
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    lowercase: /[a-z]/.test(pass),
    digit: /[0-9]/.test(pass),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pass)
  }
}

export const isPasswordValid = (pass: string): boolean => {
  const requirements = validatePassword(pass)
  return Object.values(requirements).every(Boolean)
}

// ============================================================================
// Change Password Section Component
// ============================================================================

type Accent = "purple" | "teal"

export function ChangePasswordSection({
  userEmail,
  accent = "teal",
  notify,
}: {
  userEmail: string
  accent?: Accent
  notify?: (type: "success" | "error", message: string) => void
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [changing, setChanging] = useState(false)

  const primary = accent === "purple" ? "purple" : "teal"

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userEmail) return

    if (!currentPassword || !newPassword) {
      notify?.("error", "Please fill all password fields")
      return
    }
    if (newPassword !== confirmNewPassword) {
      notify?.("error", "New passwords do not match")
      return
    }

    setChanging(true)
    try {
      const credential = EmailAuthProvider.credential(userEmail, currentPassword)
      await reauthenticateWithCredential(auth.currentUser!, credential)
      await updatePassword(auth.currentUser!, newPassword)

      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      notify?.("success", "Password updated successfully")
    } catch (error: unknown) {
      const firebaseError = error as { code?: string; message?: string }
      let errorMessage = "Failed to update password"

      // Map Firebase error codes to user-friendly messages
      switch (firebaseError.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
          errorMessage = "Current password is incorrect. Please check and try again."
          break
        case "auth/weak-password":
          errorMessage = "New password is too weak. Please use a stronger password (at least 8 characters with uppercase, lowercase, number, and special character)."
          break
        case "auth/requires-recent-login":
          errorMessage = "For security reasons, please sign out and sign in again before changing your password."
          break
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your internet connection and try again."
          break
        case "auth/too-many-requests":
          errorMessage = "Too many attempts. Please try again later."
          break
        default:
          errorMessage = firebaseError.message || "Failed to update password. Please try again."
      }

      notify?.("error", errorMessage)
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md mt-6">
      <h3 className="text-xl font-bold text-slate-800 mb-4">Security</h3>
      <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="••••••••"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm New Password</label>
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="Re-enter new password"
            minLength={8}
            required
          />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button
            type="submit"
            disabled={changing}
            className={`px-6 py-2 bg-${primary}-600 text-white font-semibold rounded-lg hover:bg-${primary}-700 transition-colors disabled:opacity-50`}
          >
            {changing ? "Updating..." : "Change Password"}
          </button>
        </div>
      </form>
    </div>
  )
}

