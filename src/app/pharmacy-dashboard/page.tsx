'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'

/**
 * Legacy route: pharmacy portal lives at /pharmacy.
 * Redirect /pharmacy-dashboard -> /pharmacy.
 */
export default function PharmacyDashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/pharmacy')
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <LoadingSpinner message="Redirecting to Pharmacy Portal..." />
    </div>
  )
}
