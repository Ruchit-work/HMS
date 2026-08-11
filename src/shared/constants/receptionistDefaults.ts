import type { HospitalReceptionistSettings } from "@/types/hospital"

export const DEFAULT_RECEPTIONIST_MODULES = [
  { id: "dashboard", label: "Dashboard", description: "Quick metrics and overview cards" },
  { id: "patients", label: "Patients History", description: "Search, view and manage patient records" },
  { id: "add-patient", label: "Add Patient", description: "Register new patient profiles" },
  { id: "appointments", label: "Appointments", description: "View and filter scheduled appointments" },
  { id: "book-appointment", label: "Book Appointment", description: "Create appointments for existing or new patients" },
  { id: "admit-requests", label: "IPD Admissions", description: "Manage pending IPD bed requests" },
  { id: "billing", label: "Billing", description: "Handle invoices, payments, and receipts" },
  { id: "whatsapp-bookings", label: "WhatsApp Bookings", description: "Review and approve online WhatsApp booking requests" },
  { id: "doctors", label: "Doctors List", description: "Check doctor schedules and consultation fees" },
  { id: "documents", label: "Documents", description: "Upload and view patient documents" },
  { id: "profile", label: "My Profile", description: "Receptionist account settings" },
] as const

export const DEFAULT_RECEPTIONIST_SETTINGS: HospitalReceptionistSettings = {
  interfaceMode: "professional",
  enabledModules: {
    dashboard: true,
    patients: true,
    "add-patient": true,
    appointments: true,
    "book-appointment": true,
    "admit-requests": true,
    billing: true,
    "whatsapp-bookings": true,
    doctors: true,
    documents: true,
    profile: true,
  },
  formFields: {
    addPatient: {
      email: true,
      gender: true,
      dateOfBirth: true,
      bloodGroup: true,
      address: true,
      cityStatePincode: true,
      alternatePhone: true,
      emergencyContact: true,
      maritalStatus: true,
      occupation: true,
      heightWeight: true,
      insurance: true,
      documents: true,
      passwordFields: true,
      status: true,
    },
    bookAppointment: {
      visitType: true,
      symptoms: true,
      appointmentDate: true,
      appointmentTime: true,
      additionalFees: true,
      paymentMethod: true,
      patientConsent: true,
      documents: true,
    },
  },
}

export function mergeReceptionistSettings(
  raw?: Partial<HospitalReceptionistSettings> | null
): HospitalReceptionistSettings {
  if (!raw) return DEFAULT_RECEPTIONIST_SETTINGS

  return {
    interfaceMode: raw.interfaceMode === "simple" ? "simple" : "professional",
    enabledModules: {
      ...DEFAULT_RECEPTIONIST_SETTINGS.enabledModules,
      ...(raw.enabledModules || {}),
    },
    formFields: {
      addPatient: {
        ...DEFAULT_RECEPTIONIST_SETTINGS.formFields.addPatient,
        ...(raw.formFields?.addPatient || {}),
      },
      bookAppointment: {
        ...DEFAULT_RECEPTIONIST_SETTINGS.formFields.bookAppointment,
        ...(raw.formFields?.bookAppointment || {}),
      },
    },
  }
}
