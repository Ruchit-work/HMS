'use client'

import RouteGuard from '@/features/auth/RouteGuard'

interface PharmacyProtectedProps {
  children: React.ReactNode
}

/** Pharmacy portal is for pharmacist logins only. */
export default function PharmacyProtected({ children }: PharmacyProtectedProps) {
  return (
    <RouteGuard
      allowedRoles={['pharmacy']}
      loginRole="pharmacy"
      skeletonVariant="table"
      unauthorizedMessage="You need a pharmacist account to access the pharmacy portal."
    >
      {children}
    </RouteGuard>
  )
}
