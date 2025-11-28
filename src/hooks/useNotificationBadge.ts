"use client"

import { useEffect, useState, useCallback } from "react"

type BadgeKey = 
  | 'admin-overview'
  | 'admin-patients' 
  | 'admin-appointments'
  | 'admin-billing'
  | 'receptionist-appointments'
  | 'receptionist-admit-requests'
  | 'receptionist-billing'
  | 'receptionist-whatsapp-bookings'
  | 'doctor-appointments'

interface UseNotificationBadgeOptions {
  badgeKey: BadgeKey
  rawCount: number
  activeTab?: string
  pathname?: string
}

/**
 * Custom hook to manage notification badge visibility
 * Automatically clears/hides badge when the related panel/page is viewed
 */
export function useNotificationBadge({ 
  badgeKey, 
  rawCount, 
  activeTab,
  pathname 
}: UseNotificationBadgeOptions) {
  const [displayCount, setDisplayCount] = useState(0)
  const [lastViewedAt, setLastViewedAt] = useState<number | null>(null)

  // Get storage key for this badge
  const storageKey = `badge_viewed_${badgeKey}`

  // Check if panel is currently active based on activeTab or pathname
  const isPanelActive = useCallback(() => {
    if (activeTab) {
      const tabMap: Record<BadgeKey, string> = {
        'admin-overview': 'overview',
        'admin-patients': 'patients',
        'admin-appointments': 'appointments',
        'admin-billing': 'billing',
        'receptionist-appointments': 'appointments',
        'receptionist-admit-requests': 'admit-requests',
        'receptionist-billing': 'billing',
        'receptionist-whatsapp-bookings': 'whatsapp-bookings',
        'doctor-appointments': 'appointments'
      }
      return activeTab === tabMap[badgeKey]
    }
    
    if (pathname) {
      const pathMap: Record<BadgeKey, string> = {
        'admin-overview': '/admin-dashboard',
        'admin-patients': '/admin-dashboard',
        'admin-appointments': '/admin-dashboard',
        'admin-billing': '/admin-dashboard',
        'receptionist-appointments': '/receptionist-dashboard',
        'receptionist-admit-requests': '/receptionist-dashboard',
        'receptionist-billing': '/receptionist-dashboard',
        'receptionist-whatsapp-bookings': '/receptionist-dashboard',
        'doctor-appointments': '/doctor-dashboard/appointments'
      }
      const expectedPath = pathMap[badgeKey]
      // Remove query params and hash for comparison
      const cleanPathname = pathname.split('?')[0].split('#')[0]
      return cleanPathname === expectedPath || cleanPathname.startsWith(expectedPath + '/')
    }
    
    return false
  }, [badgeKey, activeTab, pathname])

  // Load last viewed timestamp from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const timestamp = parseInt(stored, 10)
        if (!isNaN(timestamp)) {
          setLastViewedAt(timestamp)
        }
      }
    } catch (error) {
      console.error('Error loading badge view state:', error)
    }
  }, [storageKey])

  // Mark panel as viewed and clear badge
  const markAsViewed = useCallback(() => {
    const now = Date.now()
    setLastViewedAt(now)
    
    try {
      localStorage.setItem(storageKey, now.toString())
    } catch (error) {
      console.error('Error saving badge view state:', error)
    }
    
    // Immediately clear the badge
    setDisplayCount(0)
  }, [storageKey])

  // Mark panel as viewed when it becomes active (every time it opens)
  useEffect(() => {
    if (isPanelActive()) {
      // Every time panel opens, mark it as viewed
      markAsViewed()
    }
  }, [isPanelActive, markAsViewed])

  // Update display count based on raw count and view state
  useEffect(() => {
    const panelIsActive = isPanelActive()
    
    // If panel is currently active, always hide the badge immediately
    if (panelIsActive) {
      setDisplayCount(0)
      return
    }

    // If panel has been viewed before (lastViewedAt exists), badge stays hidden permanently
    // This ensures badge doesn't reappear when switching between panels
    if (lastViewedAt) {
      // Panel was viewed before - badge stays hidden permanently
      setDisplayCount(0)
    } else {
      // Never viewed - show badge with current count
      setDisplayCount(rawCount)
    }
  }, [rawCount, lastViewedAt, isPanelActive])

  return {
    displayCount,
    markAsViewed,
    isViewed: displayCount === 0
  }
}
