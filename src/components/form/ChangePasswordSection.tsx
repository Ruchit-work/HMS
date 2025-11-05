"use client"

import { useState } from "react"
import { auth } from "@/firebase/config"
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth"

type Accent = "purple" | "teal"

export default function ChangePasswordSection({
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
      notify?.("error", (error as Error).message || "Failed to update password")
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




