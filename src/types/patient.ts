export interface UserData {
  firstName: string
  lastName: string
  email: string
  role: string
  patientId?: string
  gender?: string
  phoneNumber?: string
  dateOfBirth?: string
  bloodGroup?: string
  address?: string
  drinkingHabits?: string
  smokingHabits?: string
  vegetarian?: boolean
  allergies?: string
  currentMedications?: string
  pregnancyStatus?: string
  familyHistory?: string
  occupation?: string
  heightCm?: number
  weightKg?: number
  specialization?: string
  consultationFee?: number
}

export interface TimeSlot {
  start: string  // "HH:MM" format (24-hour)
  end: string    // "HH:MM" format (24-hour)
}

export interface DaySchedule {
  isAvailable: boolean
  slots: TimeSlot[]
}

export interface VisitingHours {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}

export interface BlockedDate {
  date: string  // YYYY-MM-DD format
  reason: string
  createdAt?: string
}

export interface Doctor {
  id: string
  firstName: string
  lastName: string
  specialization: string
  consultationFee: number
  email?: string
  role?: string
  qualification?: string
  experience?: string
  visitingHours?: VisitingHours
  blockedDates?: BlockedDate[]
}

export interface Appointment {
  id: string
  patientId: string
  patientUid?: string
  patientName: string
  patientEmail: string
  patientPhone?: string
  patientGender?: string
  patientBloodGroup?: string
  patientDateOfBirth?: string
  patientDrinkingHabits?: string
  patientSmokingHabits?: string
  patientVegetarian?: boolean
  patientOccupation?: string
  patientFamilyHistory?: string
  patientPregnancyStatus?: string
  patientHeightCm?: number | null
  patientWeightKg?: number | null
  // Patient Medical Info (visible to doctor)
  patientAllergies?: string
  patientCurrentMedications?: string
  // Structured symptom fields
  symptomOnset?: string
  symptomDuration?: string
  symptomSeverity?: number
  symptomProgression?: string
  symptomTriggers?: string
  associatedSymptoms?: string
  // Free-text from "Tell us more" section
  patientAdditionalConcern?: string
  // Vitals
  vitalTemperatureC?: number
  vitalBloodPressure?: string
  vitalHeartRate?: number
  vitalRespiratoryRate?: number
  vitalSpO2?: number
  doctorId: string
  doctorName: string
  doctorSpecialization: string
  appointmentDate: string
  appointmentTime: string
  chiefComplaint: string
  medicalHistory: string
  paymentStatus: string
  paymentMethod: string
  paymentType: "full" | "partial"
  totalConsultationFee: number
  paymentAmount: number
  remainingAmount: number
  transactionId: string
  paidAt: string
  status: "confirmed" | "completed" | "cancelled"
  createdAt: string
  updatedAt: string
  medicine?: string
  doctorNotes?: string
  cancelledAt?: string
  cancelledBy?: string
  cancellationPolicy?: string
  hoursBeforeCancellation?: number
  refundStatus?: string
  refundAmount?: number
  cancellationFee?: number
  refundTransactionId?: string
  refundProcessedAt?: string
  admissionId?: string
  admissionRequestId?: string
  billingRecord?: BillingRecord
}

export interface AppointmentFormData {
  date: string
  time: string
  problem: string
  medicalHistory: string
  // optional structured symptoms and vitals
  symptomOnset?: string
  symptomDuration?: string
  symptomSeverity?: number
  symptomProgression?: string
  symptomTriggers?: string
  associatedSymptoms?: string
  additionalConcern?: string
  vitalTemperatureC?: number
  vitalBloodPressure?: string
  vitalHeartRate?: number
  vitalRespiratoryRate?: number
  vitalSpO2?: number
}

export interface PaymentData {
  cardNumber: string
  cardName: string
  expiryDate: string
  cvv: string
  upiId: string
}

export interface NotificationData {
  type: "success" | "error"
  message: string
}

export type RoomType = "general" | "simple" | "deluxe" | "vip"

export interface Room {
  id: string
  roomNumber: string
  roomType: RoomType
  ratePerDay: number
  status: "available" | "occupied" | "maintenance"
  attributes?: Record<string, unknown>
  updatedAt?: string
}

export interface AdmissionRequest {
  id: string
  appointmentId: string
  patientUid: string
  patientId?: string
  patientName?: string | null
  doctorId: string
  doctorName?: string
  notes?: string | null
  status: "pending" | "accepted" | "cancelled"
  createdAt: string
  updatedAt?: string
  cancelledAt?: string
  cancelledBy?: string
  appointmentDetails?: {
    appointmentDate?: string | null
    appointmentTime?: string | null
    patientPhone?: string | null
    doctorSpecialization?: string | null
  } | null
}

export interface Admission {
  id: string
  appointmentId: string
  patientUid: string
  patientId?: string
  doctorId: string
  doctorName?: string
  roomId: string
  roomNumber: string
  roomType: RoomType
  roomRatePerDay: number
  status: "admitted" | "discharged" | "completed"
  checkInAt: string
  checkOutAt?: string | null
  notes?: string | null
  createdBy: string
  createdAt: string
  updatedAt?: string
  billingId?: string | null
  patientName?: string | null
}

export interface BillingRecord {
  id: string
  admissionId: string
  appointmentId?: string
  patientId: string
  patientUid?: string | null
  patientName?: string | null
  doctorId: string
  doctorName?: string | null
  roomCharges: number
  doctorFee?: number
  otherServices?: Array<{ description: string; amount: number }>
  totalAmount: number
  generatedAt: string
  status: "pending" | "paid" | "void"
  paymentMethod?: "card" | "upi" | "cash" | "wallet" | "demo"
  paidAt?: string | null
  paymentReference?: string | null
  paidAtFrontDesk?: boolean
  handledBy?: string | null
  settlementMode?: string | null
}

