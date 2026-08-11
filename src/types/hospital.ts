/**
 * Hospital Management Types
 * Multi-tenancy support for multiple hospitals in one system
 */

import { Timestamp } from 'firebase/firestore'
import type { HospitalBillingSettings } from '@/shared/utils/billingSettings'
import type { HospitalPrintSettings } from '@/types/print'

import type { BranchTimings } from '@/types/branch'

export interface HospitalGeneralSettings {
  registrationNumber?: string
  gstNumber?: string
  website?: string
  city?: string
  state?: string
  country?: string
  pinCode?: string
  logo?: string
  favicon?: string
  primaryColor?: string
  secondaryColor?: string
  timeZone?: string
  dateFormat?: string
  timeFormat?: "12h" | "24h"
  currency?: string
  language?: string
  reviewLink?: string
}

export interface AddPatientFieldConfig {
  email?: boolean
  gender?: boolean
  dateOfBirth?: boolean
  bloodGroup?: boolean
  address?: boolean
  cityStatePincode?: boolean
  alternatePhone?: boolean
  emergencyContact?: boolean
  maritalStatus?: boolean
  occupation?: boolean
  heightWeight?: boolean
  insurance?: boolean
  documents?: boolean
  passwordFields?: boolean
  status?: boolean
}

export interface BookAppointmentFieldConfig {
  visitType?: boolean
  symptoms?: boolean
  appointmentDate?: boolean
  appointmentTime?: boolean
  additionalFees?: boolean
  paymentMethod?: boolean
  patientConsent?: boolean
  documents?: boolean
}

export interface HospitalReceptionistSettings {
  interfaceMode: "professional" | "simple"
  enabledModules: Record<string, boolean>
  formFields: {
    addPatient: AddPatientFieldConfig
    bookAppointment: BookAppointmentFieldConfig
  }
}

export interface Hospital {
  id: string
  name: string
  code: string // Unique short code (e.g., "HMS001", "HMS002")
  address: string
  phone: string
  email: string
  status: "active" | "inactive" | "suspended"
  /** When false, hospital has single location - no branch creation/filter. Super admin can enable later. */
  multipleBranchesEnabled?: boolean
  /** When false, hide advanced analytics (Analytics Hub, analytics sub-tabs). Super admin can enable later. */
  enableAnalytics?: boolean
  /** When true, pharmacy module (pharmacy tab + pharmacists) is enabled for this hospital. */
  enablePharmacy?: boolean
  settings?: {
    billing?: HospitalBillingSettings
    print?: HospitalPrintSettings
    schedule?: BranchTimings
    workingHours?: BranchTimings
    general?: HospitalGeneralSettings
    receptionist?: HospitalReceptionistSettings
    [key: string]: unknown
  }
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

