"use client"

import { useRouter } from "next/navigation"
import { getDashboardPathForRole, getLoginPathForRole, type UserRole } from "@/utils/auth/roleRouting"

interface UnauthorizedAccessProps {
  title?: string
  message?: string
  userRole?: UserRole
  requiredRoles?: Exclude<UserRole, null>[]
}

export default function UnauthorizedAccess({
  title = "Access Denied",
  message = "You do not have permission to view this page.",
  userRole,
  requiredRoles,
}: UnauthorizedAccessProps) {
  const router = useRouter()
  const homePath = userRole ? getDashboardPathForRole(userRole) : getLoginPathForRole("admin")

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        {requiredRoles && requiredRoles.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Required: {requiredRoles.join(", ")}
            {userRole ? ` · Your role: ${userRole}` : ""}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {userRole && (
            <button
              type="button"
              onClick={() => router.replace(homePath)}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 transition-colors"
            >
              Go to My Dashboard
            </button>
          )}
          <button
            type="button"
            onClick={() => router.replace(getLoginPathForRole())}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </div>
  )
}
