/**
 * Branch Management Types
 * Support for multiple branches within a hospital
 */

import { Timestamp } from 'firebase/firestore'

export interface DayTiming {
  start: string
  end: string
  breakStart?: string | null
  breakEnd?: string | null
  isOpen?: boolean
}

export interface HolidaySchedule {
  date: string // YYYY-MM-DD
  reason?: string
}

export interface BranchTimings {
  monday: DayTiming | null
  tuesday: DayTiming | null
  wednesday: DayTiming | null
  thursday: DayTiming | null
  friday: DayTiming | null
  saturday: DayTiming | null
  sunday: DayTiming | null
  useHospitalSchedule?: boolean
  holidays?: HolidaySchedule[]
}

export interface Branch {
  id: string
  name: string // "Surat City Light", "Navsari", "Bardoli"
  location: string
  hospitalId: string
  timings: BranchTimings
  status: "active" | "inactive"
  createdAt: Timestamp | string
  updatedAt: Timestamp | string
}


