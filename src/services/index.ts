/**
 * Domain services for HMS Firestore / API access.
 * Prefer these over inlined collection queries in pages and routes.
 */

export { BranchService, fetchBranches } from "./BranchService"
export { DoctorService, listDoctors, listActiveDoctors, subscribeActiveDoctors } from "./DoctorService"
export {
  PatientService,
  listPatients,
  listBookablePatients,
  subscribePatients,
  getPatient,
  createPatientDualWrite,
} from "./PatientService"
export {
  AppointmentService,
  listAppointments,
  listAppointmentsByDoctor,
  listAppointmentsByPatient,
  subscribeDoctorAppointments,
} from "./AppointmentService"
export { StaffService, listReceptionists, listPharmacists, listStaff } from "./StaffService"
export { BillingService, listRootBillingRecords, listScopedBillingRecords } from "./BillingService"
export { PharmacyService } from "./PharmacyService"
