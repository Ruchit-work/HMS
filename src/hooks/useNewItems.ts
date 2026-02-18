"use client"

import { useState, useEffect } from "react"

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

interface ItemWithDate {
  id?: string
  createdAt?: string | Date | number
  appointmentDate?: string | Date
  created?: string | Date | number
  timestamp?: string | Date | number
  [key: string]: any
}

/**
 * Hook to check if items are "new" based on last viewed timestamp
 * Returns a function to check if an item should be highlighted
 */
export function useNewItems(badgeKey: BadgeKey) {
  const storageKey = `badge_viewed_${badgeKey}`
  
  // Get last viewed timestamp from localStorage (read once, don't update when localStorage changes)
  const [lastViewedAt, setLastViewedAt] = useState<number | null>(null)
  
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const timestamp = parseInt(stored, 10)
        if (!isNaN(timestamp)) {
          setLastViewedAt(timestamp)
          return
        }
      }
      setLastViewedAt(null)
    } catch {
      setLastViewedAt(null)
    }
  }, [storageKey])

  /**
   * Check if an item is "new" (created after last viewed time)
   */
  const isNew = (item: ItemWithDate): boolean => {
    if (!lastViewedAt) {
      // Never viewed - all items are "new" for first-time viewers
      return false
    }

    // Try different date fields that might exist
    const itemDate = item.createdAt || item.created || item.timestamp || item.appointmentDate
    
    if (!itemDate) {
      // No date field - assume not new
      return false
    }

    // Convert to timestamp
    let itemTimestamp: number
    if (typeof itemDate === 'string') {
      itemTimestamp = new Date(itemDate).getTime()
    } else if (itemDate instanceof Date) {
      itemTimestamp = itemDate.getTime()
    } else if (typeof itemDate === 'number') {
      itemTimestamp = itemDate
    } else {
      return false
    }

    // Check if item was created after last viewed
    return itemTimestamp > lastViewedAt
  }

  /**
   * Get all new items from an array
   */
  const getNewItems = <T extends ItemWithDate>(items: T[]): T[] => {
    return items.filter(isNew)
  }

  return {
    isNew,
    getNewItems,
    lastViewedAt
  }
}

