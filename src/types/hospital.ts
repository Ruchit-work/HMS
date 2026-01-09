/**
 * Hospital Management Types
 * Multi-tenancy support for multiple hospitals in one system
 */

import { Timestamp } from 'firebase/firestore'

export interface Hospital {
  id: string
  name: string
  code: string // Unique short code (e.g., "HMS001", "HMS002")
  address: string
  phone: string
  email: string
  status: "active" | "inactive" | "suspended"
  createdAt: Timestamp | string
  updatedAt: Timestamp | string
}

/**
 * User document structure for multi-hospital support
 * Stores which hospitals a user belongs to and active hospital
 */
export interface MultiHospitalUser {
  uid: string
  email: string
  phone?: string
  firstName?: string
  lastName?: string
  role: "super_admin" | "admin" | "receptionist" | "doctor" | "patient"
  hospitals: string[] // Array of hospitalIds user belongs to
  activeHospital: string | null // Currently selected hospitalId
  createdAt?: Timestamp | string
  updatedAt?: Timestamp | string
}

