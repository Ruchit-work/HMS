/**
 * Multi-Hospital Context Provider
 * Manages selected hospital state and provides hospital-aware utilities
 */

'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { doc, getDoc, updateDoc, getDocs, collection } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Hospital } from '@/types/hospital'

interface MultiHospitalContextType {
  // Current active hospital
  activeHospital: Hospital | null
  activeHospitalId: string | null
  
  // All hospitals user belongs to
  userHospitals: Hospital[]
  
  // Loading states
  loading: boolean
  error: string | null
  
  // Actions
  setActiveHospital: (hospitalId: string) => Promise<void>
  refreshHospitals: () => Promise<void>
  
  // Helper flags
  isSuperAdmin: boolean
  hasMultipleHospitals: boolean
  needsHospitalSelection: boolean
}

const MultiHospitalContext = createContext<MultiHospitalContextType | undefined>(undefined)

export function MultiHospitalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [activeHospital, setActiveHospitalState] = useState<Hospital | null>(null)
  const [activeHospitalId, setActiveHospitalId] = useState<string | null>(null)
  const [userHospitals, setUserHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  /**
   * Load user's hospitals and active hospital
   */
  const loadUserHospitals = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Get user document from users collection
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      
      let hospitals: string[] = []
      let currentActiveHospitalId: string | null = null
      let userIsSuperAdmin = false

      if (userDoc.exists()) {
        const userData = userDoc.data()
        hospitals = userData?.hospitals || []
        currentActiveHospitalId = userData?.activeHospital || null
        userIsSuperAdmin = userData?.role === 'super_admin'
        setIsSuperAdmin(userIsSuperAdmin)
      } else {
        // Fallback: Check role-specific collections for backward compatibility
        const roleCollections = ['admins', 'doctors', 'receptionists', 'patients']
        for (const roleColl of roleCollections) {
          const roleDoc = await getDoc(doc(db, roleColl, user.uid))
          if (roleDoc.exists()) {
            const data = roleDoc.data()
            // Extract hospitalId or hospitals array
            if (data?.hospitalId) {
              hospitals = [data.hospitalId]
              currentActiveHospitalId = data.hospitalId
            } else if (data?.hospitals) {
              hospitals = data.hospitals
              currentActiveHospitalId = data.activeHospital || hospitals[0] || null
            }
            userIsSuperAdmin = data?.role === 'super_admin' || data?.isSuperAdmin === true
            setIsSuperAdmin(userIsSuperAdmin)
            break
          }
        }
      }

      // For super admin, fetch all active hospitals
      if (userIsSuperAdmin) {
        const hospitalsSnapshot = await getDocs(collection(db, 'hospitals'))
        const allHospitals = hospitalsSnapshot.docs
          .filter(doc => doc.data().status === 'active')
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Hospital))
        setUserHospitals(allHospitals)
        
        // If no active hospital set, use first one or null
        if (!currentActiveHospitalId && allHospitals.length > 0) {
          currentActiveHospitalId = allHospitals[0].id
        }
      } else {
        // Regular user: fetch only their hospitals
        if (hospitals.length === 0) {
          setUserHospitals([])
          setActiveHospitalState(null)
          setActiveHospitalId(null)
          setLoading(false)
          return
        }

        // Fetch hospital documents
        const hospitalPromises = hospitals.map(async (hospitalId) => {
          const hospitalDoc = await getDoc(doc(db, 'hospitals', hospitalId))
          if (hospitalDoc.exists()) {
            return {
              id: hospitalDoc.id,
              ...hospitalDoc.data()
            } as Hospital
          }
          return null
        })

        const hospitalsData = (await Promise.all(hospitalPromises)).filter(
          (h): h is Hospital => h !== null
        )
        setUserHospitals(hospitalsData)

        // Set active hospital
        if (currentActiveHospitalId) {
          const activeHosp = hospitalsData.find(h => h.id === currentActiveHospitalId)
          if (activeHosp) {
            setActiveHospitalState(activeHosp)
            setActiveHospitalId(currentActiveHospitalId)
          } else if (hospitalsData.length > 0) {
            // Fallback to first hospital if active hospital not found
            setActiveHospitalState(hospitalsData[0])
            setActiveHospitalId(hospitalsData[0].id)
          }
        } else if (hospitalsData.length === 1) {
          // Auto-select if only one hospital
          setActiveHospitalState(hospitalsData[0])
          setActiveHospitalId(hospitalsData[0].id)
        }
      }

      // Store in sessionStorage for persistence
      if (currentActiveHospitalId) {
        sessionStorage.setItem('activeHospitalId', currentActiveHospitalId)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load hospitals')
    } finally {
      setLoading(false)
    }
  }, [user])

  /**
   * Set active hospital (updates user document and context)
   */
  const setActiveHospital = useCallback(async (hospitalId: string) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verify user has access to this hospital
    const hasAccess = userHospitals.some(h => h.id === hospitalId) || isSuperAdmin
    if (!hasAccess) {
      throw new Error('You do not have access to this hospital')
    }

    try {
      // Update user document
      const userDocRef = doc(db, 'users', user.uid)
      await updateDoc(userDocRef, {
        activeHospital: hospitalId,
        updatedAt: new Date().toISOString()
      })

      // Update local state
      const selectedHospital = userHospitals.find(h => h.id === hospitalId) || 
                              (isSuperAdmin ? await getDoc(doc(db, 'hospitals', hospitalId)).then(d => d.exists() ? { id: d.id, ...d.data() } as Hospital : null) : null)
      
      if (selectedHospital) {
        setActiveHospitalState(selectedHospital)
        setActiveHospitalId(hospitalId)
        
        // Store in sessionStorage
        sessionStorage.setItem('activeHospitalId', hospitalId)
      }
    } catch (err: any) {
      throw err
    }
  }, [user, userHospitals, isSuperAdmin])

  /**
   * Refresh hospitals list
   */
  const refreshHospitals = useCallback(async () => {
    await loadUserHospitals()
  }, [loadUserHospitals])

  // Load hospitals on mount and when user changes
  useEffect(() => {
    loadUserHospitals()
  }, [loadUserHospitals])

  // Try to restore from sessionStorage on mount
  useEffect(() => {
    if (!user || loading) return
    
    const storedHospitalId = sessionStorage.getItem('activeHospitalId')
    if (storedHospitalId && !activeHospitalId && userHospitals.length > 0) {
      const storedHospital = userHospitals.find(h => h.id === storedHospitalId)
      if (storedHospital) {
        setActiveHospitalState(storedHospital)
        setActiveHospitalId(storedHospitalId)
      }
    }
  }, [user, loading, userHospitals, activeHospitalId])

  const value: MultiHospitalContextType = {
    activeHospital,
    activeHospitalId,
    userHospitals,
    loading,
    error,
    setActiveHospital,
    refreshHospitals,
    isSuperAdmin,
    hasMultipleHospitals: userHospitals.length > 1,
    needsHospitalSelection: userHospitals.length === 0 || (userHospitals.length > 1 && !activeHospitalId)
  }

  return (
    <MultiHospitalContext.Provider value={value}>
      {children}
    </MultiHospitalContext.Provider>
  )
}

/**
 * Hook to use multi-hospital context
 */
export function useMultiHospital() {
  const context = useContext(MultiHospitalContext)
  if (context === undefined) {
    throw new Error('useMultiHospital must be used within MultiHospitalProvider')
  }
  return context
}

