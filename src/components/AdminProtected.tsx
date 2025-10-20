'use client'

import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface AdminProtectedProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function AdminProtected({ children, fallback }: AdminProtectedProps) {
  const { user, loading } = useAuth("admin")
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login if not authenticated
      router.replace('/auth/login?role=admin')
    }
  }, [user, loading, router])

  if (loading) {
    return <LoadingSpinner message="Verifying admin access..." />
  }

  if (!user) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need admin privileges to access this page.</p>
          <button
            onClick={() => router.push('/auth/login?role=admin')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
