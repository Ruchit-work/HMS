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
  defaultBranchId?: string
  defaultBranchName?: string
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
  phoneNumber?: string
  role?: string
  qualification?: string
  experience?: string
  visitingHours?: VisitingHours
  blockedDates?: BlockedDate[]
  branchIds?: string[] // Array of branch IDs where doctor works
  branchTimings?: { [branchId: string]: VisitingHours } // Branch-specific visiting hours
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
  branchId?: string // Branch where appointment is booked
  branchName?: string // Branch name for display
  chiefComplaint: string
  medicalHistory: string
  paymentStatus: string
  paymentMethod: string
  paymentType: "full" | "partial"
  consultationFee?: number // Legacy field - kept for backward compatibility with existing Firestore data
  totalConsultationFee: number
  paymentAmount: number
  remainingAmount: number
  transactionId: string
  paidAt: string
  status: "pending" | "confirmed" | "completed" | "cancelled" | "whatsapp_pending" | "not_attended" | "no_show"
  whatsappPending?: boolean
  createdAt: string
  updatedAt: string
  medicine?: string
  doctorNotes?: string
  // Final Diagnosis (doctor-confirmed)
  finalDiagnosis?: string[] // Array of diagnosis codes/names
  customDiagnosis?: string // Custom diagnosis text if "Other" is selected
  diagnosisHistory?: Array<{
    diagnoses: string[]
    customDiagnosis?: string
    updatedBy: string // doctorId or adminId
    updatedAt: string
    updatedByRole: "doctor" | "admin"
  }> // Audit trail for diagnosis changes
  cancelledAt?: string
  cancelledBy?: string
  notAttendedAt?: string
  markedNotAttendedBy?: string
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
  branchId?: string // Branch where appointment is booked
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

export type RoomType = "general" | "semi_private" | "private" | "deluxe" | "vip" | "custom"

export interface Room {
  id: string
  roomNumber: string
  roomType: RoomType
  customRoomTypeName?: string | null
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
  patientAddress?: string | null
  doctorId: string
  doctorName?: string
  roomId: string
  roomNumber: string
  roomType: RoomType
  customRoomTypeName?: string | null
  roomRatePerDay: number
  admitType?: "emergency" | "planned" | "doctor_request"
  expectedDischargeAt?: string | null
  plannedAdmitAt?: string | null
  roomStays?: Array<{
    roomId: string
    roomNumber: string
    roomType: RoomType
    customRoomTypeName?: string | null
    ratePerDay: number
    fromAt: string
    toAt?: string | null
  }>
  charges?: {
    doctorRoundFee?: number
    nurseRoundFee?: number
    medicineCharges?: number
    injectionCharges?: number
    bottleCharges?: number
    facilityCharges?: number
    otherCharges?: number
    otherDescription?: string | null
  }
  paymentTerms?: "standard" | "pay_later_after_discharge"
  operationPackage?: {
    packageId: string
    packageName: string
    fixedRate: number
    paymentTiming: "advance" | "after_operation"
    advancePaidAmount?: number
    notes?: string | null
  } | null
  doctorRounds?: Array<{
    roundAt: string
    doctorId: string
    doctorName?: string | null
    notes?: string | null
    fee?: number
    markedBy?: string
    prescriptionNote?: string | null
    medicineName?: string | null
    injectionName?: string | null
    additionalNote?: string | null
    medicineCharge?: number
    injectionCharge?: number
    bottleCharge?: number
    otherCharge?: number
    medicineEntries?: Array<{
      medicineId?: string | null
      name: string
      category: "medicine" | "injection" | "bottle" | "other"
      qty: number
      unitPrice: number
      totalPrice: number
      source: "hospital" | "pharmacy_billed" | "outside"
    }>
  }>
  clinicalUpdates?: Array<{
    updatedAt: string
    doctorId: string
    doctorName?: string | null
    roundNote?: string | null
    prescriptionNote?: string | null
    medicineName?: string | null
    injectionName?: string | null
    additionalNote?: string | null
  }>
  chargeLineItems?: Array<{
    id: string
    addedAt: string
    addedByRole: "doctor" | "receptionist" | "nurse"
    category: "medicine" | "injection" | "bottle" | "other"
    name: string
    amount: number
  }>
  depositSummary?: {
    totalDeposited: number
    totalAdjusted: number
    balance: number
  }
  depositTransactions?: Array<{
    id: string
    type: "initial" | "topup" | "refund" | "adjustment"
    amount: number
    note?: string | null
    paymentMode?: "cash" | "upi" | "card" | "other" | null
    createdAt: string
    createdBy?: string | null
  }>
  dischargeRequest?: {
    requestedByDoctor?: boolean
    requestedByDoctorAt?: string | null
    requestedByDoctorId?: string | null
    requestedByDoctorName?: string | null
    notes?: string | null
    status?: "pending" | "processed" | "cancelled"
  } | null
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
  type?: "admission" | "appointment" // Type of billing record
  admissionId?: string
  appointmentId?: string
  patientId: string
  patientUid?: string | null
  patientName?: string | null
  doctorId: string
  doctorName?: string | null
  roomCharges?: number // For admission billing
  doctorFee?: number // For admission billing
  consultationFee?: number // For appointment billing
  otherServices?: Array<{ description: string; amount: number }>
  chargeLineItems?: Array<{
    id: string
    addedAt: string
    addedByRole: "doctor" | "receptionist" | "nurse"
    category: "medicine" | "injection" | "bottle" | "other"
    name: string
    amount: number
  }>
  paymentTerms?: "standard" | "pay_later_after_discharge"
  packageSummary?: {
    packageId: string
    packageName: string
    fixedRate: number
    paymentTiming: "advance" | "after_operation"
    advancePaidAmount: number
    dueAmount: number
  } | null
  depositSummary?: {
    totalDeposited: number
    totalAdjusted: number
    balance: number
  } | null
  depositTransactions?: Array<{
    id: string
    type: "initial" | "topup" | "refund" | "adjustment"
    amount: number
    note?: string | null
    paymentMode?: "cash" | "upi" | "card" | "other" | null
    createdAt: string
    createdBy?: string | null
  }>
  grossTotal?: number
  netPayable?: number
  refundAmount?: number
  totalAmount: number
  generatedAt: string
  status: "pending" | "paid" | "void" | "cancelled"
  paymentMethod?: "card" | "upi" | "cash"
  paidAt?: string | null
  paymentReference?: string | null
  transactionId?: string | null
  paidAtFrontDesk?: boolean
  handledBy?: string | null
  settlementMode?: string | null
  paymentType?: "full" | "partial" // For appointment billing
  remainingAmount?: number // For appointment billing (partial payments)
  hospitalId?: string | null // For hospital-scoped appointment billing
}

