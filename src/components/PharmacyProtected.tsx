'use client'

import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/feedback/StatusComponents'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface PharmacyProtectedProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

const PHARMACY_ALLOWED_ROLES = ['admin', 'pharmacy'] as const

/** Allows access for both admin and pharmacy roles (pharmacy portal). */
export default function PharmacyProtected({ children, fallback }: PharmacyProtectedProps) {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/auth/login?role=pharmacy')
      return
    }
    if (!PHARMACY_ALLOWED_ROLES.includes(user.role as typeof PHARMACY_ALLOWED_ROLES[number])) {
      router.replace('/auth/login?role=pharmacy')
    }
  }, [user, loading, router])

  if (loading) {
    return <LoadingSpinner message="Verifying access..." />
  }

  if (!user) {
    return fallback ?? (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need pharmacy or admin access to open this portal.</p>
          <button
            onClick={() => router.push('/auth/login?role=pharmacy')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Pharmacy Login
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
