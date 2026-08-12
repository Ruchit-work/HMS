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

import { parsePrescription, extractStructuredMedicines } from "@/shared/utils/appointments/prescriptionParsers"
import { splitConsultationNotes } from "@/features/doctor/clinical/consultation/consultationNotesUtils"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/firebase/config"

export function parseAndCleanClinicalNotes(rawNotes?: string | null): {
  diagnosisFromNotes?: string
  examinationFromNotes?: string
  cleanAdvice?: string
} {
  if (!rawNotes || typeof rawNotes !== "string") return {}

  const text = rawNotes.trim()
  if (!text) return {}

  let diagnosisFromNotes: string | undefined = undefined
  let examinationFromNotes: string | undefined = undefined

  const diagMatch = text.match(/(?:^|\n)---\s*Diagnosis\s*---\n?([\s\S]*?)(?=(?:\n---\s*|$))/i)
  if (diagMatch && diagMatch[1]?.trim()) {
    diagnosisFromNotes = diagMatch[1].trim()
  }

  const examMatch = text.match(/(?:^|\n)---\s*Examination findings\s*---\n?([\s\S]*?)(?=(?:\n---\s*|$))/i)
  if (examMatch && examMatch[1]?.trim()) {
    examinationFromNotes = examMatch[1].trim()
  }

  const cleanAdvice = text
    .replace(/(?:^|\n)---\s*Diagnosis\s*---\n?[\s\S]*?(?=(?:\n---\s*|$))/gi, "")
    .replace(/(?:^|\n)---\s*Examination findings\s*---\n?[\s\S]*?(?=(?:\n---\s*|$))/gi, "")
    .replace(/🧾\s*\*?Prescription\*?/gi, "")
    .replace(/📌\s*\*?Advice:\*?/gi, "")
    .replace(/\*[1-9]️⃣\s+.*?\*/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim()

  return {
    diagnosisFromNotes,
    examinationFromNotes,
    cleanAdvice: cleanAdvice || undefined,
  }
}

/**
 * Checks if a given ID string or number is a valid 6-digit or short hospital Patient ID.
 * Rejects Firebase/Firestore Auth UIDs (which are 20-36 alphanumeric characters without spaces/dashes e.g. Duse8hYO50RAm51t0m5cAS6iPVh1).
 */
export function isValid6DigitPatientId(id?: string | number | null): boolean {
  if (id == null) return false
  const str = String(id).trim()
  if (!str) return false

  // Firebase Auth UIDs are 20+ alphanumeric characters without hyphens or spaces
  if (str.length >= 20 && !str.includes("-") && !str.includes(" ")) {
    return false
  }

  return true
}

/**
 * Resolves the 6-digit hospital Patient ID for PDF display.
 * NEVER returns Firebase/Firestore Auth UIDs.
 */
export function resolveDisplayPatientId(
  patientId?: string | number | null,
  patientUid?: string | number | null,
  patientSequentialId?: string | number | null,
  patientObj?: any
): string {
  const candidates = [
    patientId,
    patientSequentialId,
    patientObj?.patientId,
    patientObj?.patientSequentialId,
    patientObj?.patientDisplayId,
    patientObj?.customPatientId,
    patientObj?.hospitalPatientId,
    patientObj?.patientNumber,
    patientObj?.patientNo,
    patientObj?.patientCode,
    patientObj?.uhid,
    patientObj?.pid,
    patientObj?.patientData?.patientId,
    patientObj?.patientDetails?.patientId,
    patientUid,
  ]

  for (const cand of candidates) {
    if (cand != null && isValid6DigitPatientId(cand)) {
      return String(cand).trim()
    }
  }

  return "N/A"
}

/**
 * Client-side helper to fetch the 6-digit Patient ID from root patients, hospital subcollection, or users collection.
 */
export async function fetch6DigitPatientId(
  targetUid?: string | null,
  hospitalId?: string | null
): Promise<string | undefined> {
  if (!targetUid || typeof targetUid !== "string" || !targetUid.trim()) return undefined
  const uid = targetUid.trim()

  try {
    // 1. Root patients collection
    const snap = await getDoc(doc(db, "patients", uid))
    if (snap.exists()) {
      const data = snap.data() || {}
      const candidate = data.patientId || data.patientSequentialId || data.patientDisplayId || data.hospitalPatientId || data.customPatientId || data.patientNo || data.patientNumber || data.uhid || data.pid
      if (candidate != null && isValid6DigitPatientId(candidate)) {
        return String(candidate).trim()
      }
    }
  } catch {}

  if (hospitalId && typeof hospitalId === "string" && hospitalId.trim()) {
    try {
      // 2. Hospital-scoped patients subcollection
      const snapHosp = await getDoc(doc(db, "hospitals", hospitalId.trim(), "patients", uid))
      if (snapHosp.exists()) {
        const data = snapHosp.data() || {}
        const candidate = data.patientId || data.patientSequentialId || data.patientDisplayId || data.hospitalPatientId || data.customPatientId || data.patientNo || data.patientNumber || data.uhid || data.pid
        if (candidate != null && isValid6DigitPatientId(candidate)) {
          return String(candidate).trim()
        }
      }
    } catch {}
  }

  try {
    // 3. Users collection
    const snapUser = await getDoc(doc(db, "users", uid))
    if (snapUser.exists()) {
      const data = snapUser.data() || {}
      const candidate = data.patientId || data.patientSequentialId || data.patientDisplayId || data.hospitalPatientId || data.customPatientId || data.patientNo || data.patientNumber || data.uhid || data.pid
      if (candidate != null && isValid6DigitPatientId(candidate)) {
        return String(candidate).trim()
      }
    }
  } catch {}

  return undefined
}

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
      id: resolveDisplayPatientId(apt.patientId, apt.patientUid, (apt as any).patientSequentialId, apt),
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
      id: resolveDisplayPatientId(record.patientId, record.patientUid, (record as any).patientSequentialId, record),
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

  const medicines = extractStructuredMedicines(apt, formEntry?.medicines)

  const rawNotesStr = formEntry?.notes?.trim() || apt.doctorNotes?.trim() || undefined
  const parsedNotes = parseAndCleanClinicalNotes(rawNotesStr)

  let formattedDiagnosis: string | string[] | undefined = formEntry?.finalDiagnosis?.length
    ? formEntry.finalDiagnosis
    : apt.finalDiagnosis?.length
    ? apt.finalDiagnosis
    : formEntry?.customDiagnosis || apt.customDiagnosis || parsedNotes.diagnosisFromNotes || undefined

  if (typeof formattedDiagnosis === "string") {
    formattedDiagnosis = formattedDiagnosis.trim() || undefined
  }

  const examinationFindings = (formEntry as any)?.examinationFindings?.trim() || (apt as any)?.examinationFindings?.trim() || parsedNotes.examinationFromNotes || undefined
  const assessment = formEntry?.assessment?.trim() || apt.assessment?.trim() || (!examinationFindings ? parsedNotes.examinationFromNotes : undefined) || undefined
  const investigations = (formEntry as any)?.investigations?.trim() || (apt as any)?.investigations?.trim() || (apt as any)?.investigationAdvice?.trim() || undefined
  const cleanNotes = parsedNotes.cleanAdvice
  const recheckupNote = formEntry?.recheckupNote?.trim() || (apt as any)?.recheckupNote?.trim() || (apt as any)?.followUpAdvice?.trim() || undefined

  const dateStr = apt.appointmentDate
    ? new Date(apt.appointmentDate).toLocaleDateString("en-IN", { dateStyle: "medium" })
    : new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })

  const rawHosp = ((apt as any).hospitalName || (apt as any).branchName || "").trim()
  const cleanHospName = rawHosp ? rawHosp.replace(/\bHospital\s+Hospital\b/gi, "Hospital").trim() : undefined

  return {
    prescriptionId: apt.id || "RX-" + Date.now().toString().slice(-6),
    date: dateStr,
    hospitalName: cleanHospName,
    hospitalId: (apt as any).hospitalId,
    patient: {
      id: resolveDisplayPatientId(apt.patientId, apt.patientUid, (apt as any).patientSequentialId, apt),
      name: apt.patientName || "Patient",
      age,
      gender: apt.patientGender,
      phone: apt.patientPhone,
    },
    doctor: {
      id: apt.doctorId,
      name: apt.doctorName || "Attending Doctor",
      specialization: apt.doctorSpecialization,
      licenseNo: (apt as any).doctorLicenseNo || (apt as any).licenseNo || (apt as any).registrationNo,
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
    assessment,
    examinationFindings,
    diagnosis: formattedDiagnosis,
    investigations,
    medicines,
    notes: cleanNotes,
    advice: cleanNotes,
    recheckupNote,
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
      id: resolveDisplayPatientId(adm.patientId, adm.patientUid, (adm as any).patientSequentialId, adm),
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
      id: resolveDisplayPatientId(adm.patientId, adm.patientUid, (adm as any).patientSequentialId, adm),
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
      id: resolveDisplayPatientId(doc.patientId, doc.patientUid, (doc as any).patientSequentialId, doc),
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
