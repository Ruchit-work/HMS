/**
 * Hospital Selection Page
 * Shown when patient has multiple hospitals or no hospital assigned
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/firebase/config'
import LoadingSpinner from '@/components/ui/StatusComponents'
import { Hospital } from '@/types/hospital'

export default function HospitalSelectionPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/patient-dashboard'
  const [rememberHospital, setRememberHospital] = useState(false)

  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user || user.role !== 'patient') {
      router.push('/auth/login')
      return
    }

    loadHospitals()
  }, [user, authLoading])

  const loadHospitals = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all active hospitals
      const response = await fetch('/api/hospitals')
      const data = await response.json()

      if (data.success) {
        setHospitals(data.hospitals || [])
      } else {
        setError(data.error || 'Failed to load hospitals')
      }
    } catch (err: any) {
      console.error('[HospitalSelection] Error loading hospitals:', err)
      setError(err.message || 'Failed to load hospitals')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectHospital = async (hospitalId: string) => {
    if (!user) return

    try {
      setSelecting(true)
      setError(null)

      // Get Firebase Auth token
      const currentUser = auth.currentUser
      if (!currentUser) {
        setError('You must be logged in to select a hospital')
        return
      }

      const token = await currentUser.getIdToken()

      // Update user's active hospital
      const response = await fetch('/api/user/select-hospital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          hospitalId,
          remember: rememberHospital,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Store in sessionStorage
        sessionStorage.setItem('activeHospitalId', hospitalId)
        
        // If remember is checked, store in localStorage (encrypted)
        if (rememberHospital) {
          localStorage.setItem('rememberedHospitalId', hospitalId)
        }

        // Redirect to dashboard
        router.push(redirectTo)
      } else {
        setError(data.error || 'Failed to select hospital')
      }
    } catch (err: any) {
      console.error('[HospitalSelection] Error selecting hospital:', err)
      setError(err.message || 'Failed to select hospital')
    } finally {
      setSelecting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Loading hospitals..." />
      </div>
    )
  }

  if (!user) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Select Hospital to Continue
          </h1>
          <p className="text-slate-600">
            Choose the hospital where you want to continue
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {hospitals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-slate-600 mb-4">
              No hospitals available at the moment.
            </p>
            <button
              onClick={loadHospitals}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {hospitals.map((hospital) => (
              <div
                key={hospital.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => !selecting && handleSelectHospital(hospital.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">
                      {hospital.name}
                    </h3>
                    {hospital.code && (
                      <p className="text-sm text-slate-500">Code: {hospital.code}</p>
                    )}
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🏥</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  {hospital.address && (
                    <p className="flex items-start gap-2">
                      <span>📍</span>
                      <span>{hospital.address}</span>
                    </p>
                  )}
                  {hospital.phone && (
                    <p className="flex items-start gap-2">
                      <span>📞</span>
                      <span>{hospital.phone}</span>
                    </p>
                  )}
                  {hospital.email && (
                    <p className="flex items-start gap-2">
                      <span>✉️</span>
                      <span>{hospital.email}</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelectHospital(hospital.id)
                  }}
                  disabled={selecting}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {selecting ? 'Selecting...' : 'Select This Hospital'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberHospital}
              onChange={(e) => setRememberHospital(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">
              Remember this hospital on this device (not recommended on public/shared devices)
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}

