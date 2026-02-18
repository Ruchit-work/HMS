/**
 * Branch Management Types
 * Support for multiple branches within a hospital
 */

import { Timestamp } from 'firebase/firestore'

export interface BranchTimings {
  monday: { start: string; end: string } | null
  tuesday: { start: string; end: string } | null
  wednesday: { start: string; end: string } | null
  thursday: { start: string; end: string } | null
  friday: { start: string; end: string } | null
  saturday: { start: string; end: string } | null
  sunday: { start: string; end: string } | null
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

