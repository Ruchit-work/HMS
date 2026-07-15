"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { TabSkeleton } from '@/shared/components'
import UnauthorizedAccess from "@/features/auth/UnauthorizedAccess"
import {
  getDashboardPathForRole,
  getLoginPathForRole,
  isRoleAllowed,
  logAuthDev,
  type UserRole,
} from "@/utils/auth/roleRouting"

interface RouteGuardProps {
  allowedRoles: Exclude<UserRole, null>[]
  children: React.ReactNode
  loginRole?: Exclude<UserRole, null>
  skeletonVariant?: "dashboard" | "table" | "generic"
  unauthorizedMessage?: string
}

export default function RouteGuard({
  allowedRoles,
  children,
  loginRole,
  skeletonVariant = "dashboard",
  unauthorizedMessage,
}: RouteGuardProps) {
  const router = useRouter()
  const redirectedRef = useRef(false)
  const { user, loading, error, timedOut } = useAuth()

  const allowed = user ? isRoleAllowed(user.role, allowedRoles) : false

  useEffect(() => {
    if (loading) return

    if (!user) {
      if (redirectedRef.current) return
      redirectedRef.current = true
      const loginPath = getLoginPathForRole(loginRole ?? allowedRoles[0])
      logAuthDev("RouteGuard: unauthenticated, redirecting to login", { loginPath })
      router.replace(loginPath)
      return
    }

    if (!allowed) {
      if (redirectedRef.current) return
      redirectedRef.current = true
      const dashboardPath = getDashboardPathForRole(user.role)
      logAuthDev("RouteGuard: wrong role, redirecting", {
        userRole: user.role,
        allowedRoles,
        dashboardPath,
      })
      router.replace(dashboardPath)
    }
  }, [loading, user, allowed, allowedRoles, loginRole, router])

  if (loading) {
    return <TabSkeleton variant={skeletonVariant} />
  }

  if (error || timedOut) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm font-semibold text-amber-800">
            {timedOut ? "Authentication is taking longer than expected." : "Authentication failed."}
          </p>
          <p className="mt-2 text-xs text-amber-700">
            {error || "Please check your connection and try again."}
          </p>
          <button
            type="button"
            onClick={() => router.replace(getLoginPathForRole(loginRole ?? allowedRoles[0]))}
            className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  if (!user) {
    return <TabSkeleton variant={skeletonVariant} />
  }

  if (!allowed) {
    return (
      <UnauthorizedAccess
        userRole={user.role}
        requiredRoles={allowedRoles}
        message={
          unauthorizedMessage ||
          `This area is restricted to ${allowedRoles.join(" and ")} users.`
        }
      />
    )
  }

  return <>{children}</>
}
