"use client"

import { ChangePasswordSection } from "@/components/forms/PasswordComponents"

interface AdminAccountPanelProps {
  userEmail: string
  displayName: string
  isSuperAdmin?: boolean
  onNotify: (type: "success" | "error", message: string) => void
}

export default function AdminAccountPanel({
  userEmail,
  displayName,
  isSuperAdmin = false,
  onNotify,
}: AdminAccountPanelProps) {
  return (
    <div className="space-y-6">
      <div className="hms-content-card rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {isSuperAdmin ? "Headquarters profile" : "Profile"}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">Name</p>
            <p className="text-slate-900 font-medium">{displayName || "—"}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">Email</p>
            <p className="text-slate-900 font-medium break-all">{userEmail}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 mb-1">Role</p>
            <p className="text-slate-900 font-medium">
              {isSuperAdmin ? "Platform Super Admin" : "Hospital Administrator"}
            </p>
          </div>
        </div>
      </div>

      <ChangePasswordSection userEmail={userEmail} accent="teal" notify={onNotify} />
    </div>
  )
}
