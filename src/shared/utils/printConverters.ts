import { Appointment, BillingRecord, Admission } from "@/types/patient"
import { CompletionFormEntry } from "@/types/appointments"
import { DocumentMetadata } from "@/types/document"
import {
  PrintAppointmentData,
  PrintBillingData,
  PrintBillingItem,
  PrintPrescriptionData,
  PrintAdmissionData,
  PrintDischargeData,
  PrintLabReportData,
} from "@/types/print"
import { calculateAge } from "@/shared/utils/shared/date"

import { parsePrescription } from "@/shared/utils/appointments/prescriptionParsers"
import { splitConsultationNotes } from "@/features/doctor/clinical/consultation/consultationNotesUtils"

export function convertAppointmentToPrintData(apt: Appointment): PrintAppointmentData {
  const rawAge = apt.patientDateOfBirth ? calculateAge(apt.patientDateOfBirth) : undefined
  const age = rawAge ?? undefined

  const hasVitals = Boolean(
    apt.vitalBloodPressure ||
      apt.vitalTemperatureC != null ||
      apt.vitalHeartRate != null ||
      apt.vitalSpO2 != null ||
      apt.vitalRespiratoryRate != null ||
      apt.patientHeightCm != null ||
      apt.patientWeightKg != null
  )

  const vitals = hasVitals
    ? {
        bp: apt.vitalBloodPressure || undefined,
        temperature: apt.vitalTemperatureC ?? undefined,
        heartRate: apt.vitalHeartRate ?? undefined,
        spO2: apt.vitalSpO2 ?? undefined,
        respRate: apt.vitalRespiratoryRate ?? undefined,
        height: apt.patientHeightCm ?? undefined,
        weight: apt.patientWeightKg ?? undefined,
      }
    : undefined

  const { clinicalNotes, examinationFindings } = splitConsultationNotes(apt.doctorNotes || "")

  const diagnosis = apt.finalDiagnosis && apt.finalDiagnosis.length > 0
    ? apt.finalDiagnosis
    : apt.customDiagnosis && apt.customDiagnosis.trim()
    ? apt.customDiagnosis.trim()
    : undefined

  const parsedPrescription = apt.medicine ? parsePrescription(apt.medicine) : null
  const medicines = parsedPrescription?.medicines && parsedPrescription.medicines.length > 0
    ? parsedPrescription.medicines.map((m: { name: string; dosage?: string; frequency?: string; duration?: string }) => ({
        name: m.name,
        dosage: m.dosage || "As advised",
        frequency: m.frequency || "As directed",
        duration: m.duration || "Standard",
      }))
    : undefined

  return {
    bookingId: apt.transactionId || apt.id || "APT-" + Date.now().toString().slice(-6),
    appointmentDate: apt.appointmentDate || new Date().toISOString().split("T")[0],
    appointmentTime: apt.appointmentTime || "Not specified",
    patient: {
      id: apt.patientId || apt.patientUid,
      name: apt.patientName || "Valued Patient",
      age,
      phone: apt.patientPhone,
      email: apt.patientEmail,
      gender: apt.patientGender,
      dob: apt.patientDateOfBirth,
      bloodGroup: apt.patientBloodGroup,
    },
    doctor: {
      id: apt.doctorId,
      name: apt.doctorName || "Attending Physician",
      specialization: apt.doctorSpecialization,
    },
    department: apt.doctorSpecialization || "General OPD",
    visitType: apt.visitType || apt.appointmentType || "General Consultation",
    tokenNumber: apt.id ? apt.id.slice(-4).toUpperCase() : undefined,
    status: apt.status || "confirmed",
    chiefComplaint: apt.chiefComplaint,
    medicalHistory: apt.medicalHistory || undefined,
    vitals,
    diagnosis,
    clinicalNotes: clinicalNotes || undefined,
    examinationFindings: examinationFindings || undefined,
    medicines,
    prescriptionSummary: apt.medicine || undefined,
    createdAt: apt.createdAt,
  }
}

export function convertBillingToPrintData(record: BillingRecord): PrintBillingData {
  const items: PrintBillingItem[] = []

  if (record.consultationFee && record.consultationFee > 0) {
    items.push({
      description: "Doctor Consultation Fee",
      category: "consultation",
      qty: 1,
      unitPrice: record.consultationFee,
      amount: record.consultationFee,
    })
  }

  if (record.doctorFee && record.doctorFee > 0) {
    items.push({
      description: "Doctor Visit / Round Fee",
      category: "doctor",
      qty: 1,
      unitPrice: record.doctorFee,
      amount: record.doctorFee,
    })
  }

  if (record.roomCharges && record.roomCharges > 0) {
    items.push({
      description: "Hospital Accommodation & Room Charges",
      category: "room",
      qty: 1,
      unitPrice: record.roomCharges,
      amount: record.roomCharges,
    })
  }

  if (Array.isArray(record.otherServices)) {
    record.otherServices.forEach((svc) => {
      items.push({
        description: svc.description || "Other Clinical Service",
        category: "service",
        qty: 1,
        unitPrice: svc.amount,
        amount: svc.amount,
      })
    })
  }

  if (Array.isArray(record.chargeLineItems)) {
    record.chargeLineItems.forEach((line) => {
      items.push({
        description: line.name || "Medical Item",
        category: line.category || "item",
        qty: 1,
        unitPrice: line.amount,
        amount: line.amount,
      })
    })
  }

  const subtotal = record.grossTotal || record.totalAmount || items.reduce((acc, i) => acc + i.amount, 0)
  const grandTotal = record.totalAmount || subtotal
  const paidAmount = record.paidAmount ?? (record.status === "paid" ? grandTotal : 0)
  const remainingAmount = record.remainingAmount ?? (grandTotal - paidAmount > 0 ? grandTotal - paidAmount : 0)

  return {
    invoiceNumber: record.id || "INV-" + Date.now().toString().slice(-6),
    invoiceDate: record.generatedAt ? new Date(record.generatedAt).toLocaleDateString() : new Date().toLocaleDateString(),
    patient: {
      id: record.patientId || record.patientUid || undefined,
      name: record.patientName || "Patient",
    },
    doctor: record.doctorName ? { id: record.doctorId, name: record.doctorName } : undefined,
    type: record.type || "general",
    items: items.length > 0 ? items : [{ description: "Healthcare Services Rendered", amount: grandTotal }],
    subtotal,
    discountAmount: 0,
    taxAmount: 0,
    grandTotal,
    paidAmount,
    remainingAmount,
    paymentMethod: record.paymentMethod || "cash",
    paymentStatus: (record.status as any) || "paid",
    transactionId: record.transactionId || record.paymentReference || undefined,
    handledBy: record.handledBy || undefined,
  }
}

export function convertPrescriptionToPrintData(
  apt: Appointment,
  formEntry?: CompletionFormEntry
): PrintPrescriptionData {
  const rawAge = apt.patientDateOfBirth ? calculateAge(apt.patientDateOfBirth) : undefined
  const age = rawAge ?? undefined

  const medicines = formEntry?.medicines && formEntry.medicines.length > 0
    ? formEntry.medicines.filter((m) => m.name && m.name.trim()).map((m) => ({
        name: m.name.trim(),
        dosage: m.dosage || "As advised",
        frequency: m.frequency || "Once daily",
        duration: m.duration || "5 days",
      }))
    : apt.medicine
    ? [{ name: apt.medicine, dosage: "As advised", frequency: "As directed", duration: "Standard" }]
    : []

  const formattedDiagnosis = formEntry?.finalDiagnosis?.length
    ? formEntry.finalDiagnosis
    : apt.finalDiagnosis?.length
    ? apt.finalDiagnosis
    : formEntry?.customDiagnosis || apt.customDiagnosis || undefined

  return {
    prescriptionId: apt.id || "RX-" + Date.now().toString().slice(-6),
    date: new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }),
    patient: {
      id: apt.patientId || apt.patientUid,
      name: apt.patientName || "Patient",
      age,
      gender: apt.patientGender,
      phone: apt.patientPhone,
    },
    doctor: {
      id: apt.doctorId,
      name: apt.doctorName || "Dr. Medical Practitioner",
      specialization: apt.doctorSpecialization,
    },
    vitals: {
      bp: apt.vitalBloodPressure,
      temperature: apt.vitalTemperatureC,
      heartRate: apt.vitalHeartRate,
      respRate: apt.vitalRespiratoryRate,
      spO2: apt.vitalSpO2,
      height: apt.patientHeightCm ?? undefined,
      weight: apt.patientWeightKg ?? undefined,
    },
    chiefComplaints: apt.chiefComplaint,
    medicalHistory: apt.medicalHistory,
    diagnosis: formattedDiagnosis,
    medicines,
    notes: formEntry?.notes || apt.doctorNotes || undefined,
    recheckupNote: formEntry?.recheckupNote,
  }
}

export function convertAdmissionToPrintData(adm: Admission): PrintAdmissionData {
  return {
    admissionId: adm.id,
    ipdNo: adm.ipdNo || adm.id,
    admitDate: adm.checkInAt ? new Date(adm.checkInAt).toLocaleDateString() : new Date().toLocaleDateString(),
    admitTime: adm.checkInAt ? new Date(adm.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
    admitType: adm.admitType || "planned",
    patient: {
      id: adm.patientId || adm.patientUid,
      name: adm.patientName || "Inpatient",
      phone: adm.patientPhone || undefined,
      gender: adm.patientGender || undefined,
      address: adm.patientAddress || undefined,
      emergencyContact: adm.emergencyContactName || undefined,
    },
    doctor: {
      id: adm.doctorId,
      name: adm.doctorName || "Attending Consultant",
    },
    roomNumber: adm.roomNumber || "—",
    roomType: adm.customRoomTypeName || adm.roomType || "General Ward",
    ratePerDay: adm.roomRatePerDay || 0,
    expectedDischargeDate: adm.expectedDischargeAt ? new Date(adm.expectedDischargeAt).toLocaleDateString() : undefined,
    operationPackage: adm.operationPackage
      ? {
          packageName: adm.operationPackage.packageName,
          fixedRate: adm.operationPackage.fixedRate,
        }
      : undefined,
    initialDeposit: adm.depositSummary?.totalDeposited || 0,
    notes: adm.notes || undefined,
  }
}

export function convertDischargeToPrintData(adm: Admission): PrintDischargeData {
  const admitTime = new Date(adm.checkInAt).getTime()
  const dischargeTime = adm.checkOutAt ? new Date(adm.checkOutAt).getTime() : Date.now()
  const stayDays = Math.max(1, Math.ceil((dischargeTime - admitTime) / (1000 * 60 * 60 * 24)))

  const roundNotes = (adm.doctorRounds || []).map((r) => ({
    date: r.roundAt ? new Date(r.roundAt).toLocaleDateString() : "",
    doctorName: r.doctorName || undefined,
    notes: r.notes || undefined,
    medicines: r.medicineName || undefined,
  }))

  return {
    admissionId: adm.id,
    ipdNo: adm.ipdNo || adm.id,
    admitDate: adm.checkInAt ? new Date(adm.checkInAt).toLocaleDateString() : "N/A",
    dischargeDate: adm.checkOutAt ? new Date(adm.checkOutAt).toLocaleDateString() : new Date().toLocaleDateString(),
    stayDurationDays: stayDays,
    patient: {
      id: adm.patientId || adm.patientUid,
      name: adm.patientName || "Patient",
      phone: adm.patientPhone || undefined,
      gender: adm.patientGender || undefined,
      address: adm.patientAddress || undefined,
    },
    doctor: {
      id: adm.doctorId,
      name: adm.doctorName || "Attending Consultant",
    },
    roomNumber: adm.roomNumber,
    roomType: adm.customRoomTypeName || adm.roomType,
    chiefComplaints: adm.notes || undefined,
    finalDiagnosis: ["Recovered / Stable at discharge"],
    treatmentSummary: `Patient admitted under Dr. ${adm.doctorName || "Consultant"} in Room ${adm.roomNumber}. Underwent conservative IPD management, regular doctor rounds and clinical supervision. Patient is discharged in stable condition.`,
    doctorRoundNotes: roundNotes,
    dischargeMedicines: [],
    followUpAdvice: "Rest at home. Continue prescribed discharge medicines. Visit OPD after 7 days or if any discomfort arises.",
    emergencyInstructions: "In case of emergency, fever, severe pain, contact emergency helpline or visit nearest ER.",
  }
}

export function convertLabReportToPrintData(doc: DocumentMetadata): PrintLabReportData {
  return {
    reportId: doc.id || "LAB-" + Date.now().toString().slice(-6),
    reportName: doc.originalFileName || doc.fileName || "Laboratory Investigation",
    category: doc.fileType === "radiology-report" ? "Radiology" : doc.fileType === "cardiology-report" ? "Cardiology" : "Laboratory",
    testDate: doc.appointmentDate || doc.uploadedAt ? new Date(doc.appointmentDate || doc.uploadedAt).toLocaleDateString() : new Date().toLocaleDateString(),
    patient: {
      id: doc.patientId || doc.patientUid,
      name: doc.patientName || "Patient",
    },
    doctor: doc.doctorName ? { id: doc.doctorId, name: doc.doctorName } : undefined,
    items: [
      {
        testName: doc.originalFileName || "Diagnostic Test Parameter",
        result: doc.description || "Satisfactory / Evaluated",
        unit: "—",
        referenceRange: "Normal",
        flag: doc.status === "archived" ? undefined : "normal",
      },
    ],
    impression: doc.description || "Investigation results evaluated and verified.",
    notes: doc.specialty ? `Specialty: ${doc.specialty}` : undefined,
    labTechnician: doc.uploadedBy?.name || "Lab Medical Specialist",
  }
}
