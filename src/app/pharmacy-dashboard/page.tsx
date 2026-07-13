'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Legacy route: pharmacy portal lives at /pharmacy.
 * Redirect /pharmacy-dashboard -> /pharmacy.
 */
export default function PharmacyDashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/pharmacy')
  }, [router])
  return <div className="min-h-screen bg-slate-50" aria-busy="true" />
}
