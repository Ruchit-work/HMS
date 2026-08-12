/**
 * Centralized Printing System Types
 */


export type PaperSize = "A4" | "Thermal"

export type PrintDocumentType =
  | "appointment-slip"
  | "billing-invoice"
  | "prescription"
  | "admission-form"
  | "discharge-summary"
  | "lab-report"

export interface HospitalPrintSettings {
  logoUrl?: string
  headerTitle?: string
  headerSubtitle?: string
  footerText?: string
  phone?: string
  email?: string
  address?: string
  paperSize?: PaperSize
  autoPrintBooking?: boolean
  autoPrintPayment?: boolean
  taxRatePercent?: number
  taxRegistrationNo?: string
}

export interface PrintPatientInfo {
  id?: string
  name: string
  age?: number | string
  gender?: string
  dob?: string
  phone?: string
  email?: string
  address?: string
  bloodGroup?: string
  emergencyContact?: string
}

export interface PrintDoctorInfo {
  id?: string
  name: string
  specialization?: string
  qualification?: string
  licenseNo?: string
  department?: string
}

// 1. Appointment Slip Data
export interface PrintAppointmentData {
  bookingId: string
  appointmentDate: string
  appointmentTime: string
  patient: PrintPatientInfo
  doctor: PrintDoctorInfo
  department?: string
  visitType?: string
  tokenNumber?: string | number
  status?: string
  chiefComplaint?: string
  medicalHistory?: string
  vitals?: {
    bp?: string
    temperature?: number
    heartRate?: number
    spO2?: number
    respRate?: number
    height?: number
    weight?: number
  }
  diagnosis?: string | string[]
  clinicalNotes?: string
  examinationFindings?: string
  medicines?: Array<{ name: string; dosage: string; frequency: string; duration: string }>
  prescriptionSummary?: string
  investigationAdvice?: string
  followUpAdvice?: string
  additionalInstructions?: string
  createdAt?: string
}

// 2. Billing Invoice Data
export interface PrintBillingItem {
  id?: string
  description: string
  category?: string
  qty?: number
  unitPrice?: number
  amount: number
}

export interface PrintBillingData {
  invoiceNumber: string
  invoiceDate: string
  patient: PrintPatientInfo
  doctor?: PrintDoctorInfo
  type?: "appointment" | "admission" | "pharmacy" | "general"
  items: PrintBillingItem[]
  subtotal: number
  discountAmount?: number
  taxAmount?: number
  taxRatePercent?: number
  grandTotal: number
  paidAmount?: number
  remainingAmount?: number
  paymentMethod?: string
  paymentStatus: "paid" | "pending" | "partial" | "void"
  transactionId?: string
  handledBy?: string
}

// 3. Prescription Data
export interface PrintPrescriptionItem {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
}

export interface PrintPrescriptionData {
  prescriptionId?: string
  date: string
  hospitalName?: string
  hospitalId?: string
  patient: PrintPatientInfo
  doctor: PrintDoctorInfo
  vitals?: {
    temperature?: number | string
    bp?: string
    heartRate?: number | string
    respRate?: number | string
    spO2?: number | string
    weight?: number | string
    height?: number | string
  }
  chiefComplaints?: string
  medicalHistory?: string
  assessment?: string
  examinationFindings?: string
  diagnosis?: string[] | string
  investigations?: string
  medicines: PrintPrescriptionItem[]
  notes?: string
  advice?: string
  recheckupDate?: string
  recheckupNote?: string
}

// 4. Admission Form Data
export interface PrintAdmissionData {
  admissionId: string
  ipdNo?: string
  admitDate: string
  admitTime?: string
  admitType?: "emergency" | "planned" | "doctor_request"
  patient: PrintPatientInfo
  doctor: PrintDoctorInfo
  roomNumber: string
  roomType: string
  ratePerDay: number
  expectedDischargeDate?: string
  operationPackage?: {
    packageName: string
    fixedRate: number
  }
  initialDeposit?: number
  notes?: string
}

// 5. Discharge Summary Data
export interface PrintDischargeData {
  admissionId: string
  ipdNo?: string
  admitDate: string
  dischargeDate: string
  stayDurationDays?: number
  patient: PrintPatientInfo
  doctor: PrintDoctorInfo
  roomNumber?: string
  roomType?: string
  chiefComplaints?: string
  finalDiagnosis: string[] | string
  treatmentSummary?: string
  doctorRoundNotes?: Array<{
    date: string
    doctorName?: string
    notes?: string
    medicines?: string
  }>
  dischargeMedicines?: PrintPrescriptionItem[]
  followUpAdvice?: string
  emergencyInstructions?: string
}

// 6. Lab Report Data
export interface PrintLabTestItem {
  testName: string
  result: string
  unit?: string
  referenceRange?: string
  flag?: "normal" | "abnormal" | "critical" | "high" | "low"
}

export interface PrintLabReportData {
  reportId: string
  reportName: string
  category?: string
  testDate: string
  patient: PrintPatientInfo
  doctor?: PrintDoctorInfo
  sampleId?: string
  items: PrintLabTestItem[]
  impression?: string
  notes?: string
  isCritical?: boolean
  labTechnician?: string
  pathologist?: string
}

export type PrintDocumentData =
  | { type: "appointment-slip"; data: PrintAppointmentData }
  | { type: "billing-invoice"; data: PrintBillingData }
  | { type: "prescription"; data: PrintPrescriptionData }
  | { type: "admission-form"; data: PrintAdmissionData }
  | { type: "discharge-summary"; data: PrintDischargeData }
  | { type: "lab-report"; data: PrintLabReportData }

export interface PrintOptions {
  paperSize?: PaperSize
  autoPrint?: boolean
  hospitalSettings?: HospitalPrintSettings
}
