'use client'

import RouteGuard from '@/features/auth/RouteGuard'
import type { UserRole } from '@/utils/auth/roleRouting'

interface AdminProtectedProps {
  children: React.ReactNode
  /** When set, allows these roles. Defaults to admin only. */
  allowedRoles?: Exclude<UserRole, null>[]
}

export default function AdminProtected({
  children,
  allowedRoles = ['admin'],
}: AdminProtectedProps) {
  return (
    <RouteGuard
      allowedRoles={allowedRoles}
      loginRole="admin"
      skeletonVariant="dashboard"
      unauthorizedMessage="You need administrator privileges to access this page."
    >
      {children}
    </RouteGuard>
  )
}
