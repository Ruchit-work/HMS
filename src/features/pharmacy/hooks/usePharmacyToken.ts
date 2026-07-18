'use client'

import { useCallback } from 'react'
import { auth } from '@/firebase/config'

/** Shared auth token helper for pharmacy API calls. */
export function usePharmacyToken() {
  const getToken = useCallback(async () => {
    const user = auth.currentUser
    if (!user) return null
    return user.getIdToken()
  }, [])

  return { getToken }
}
