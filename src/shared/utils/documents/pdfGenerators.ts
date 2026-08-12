/**
 * PDF Generation Utilities & Central Print Service
 * Built on top of Pharmacy Billing PDF Design Architecture (Standard Document Template Engine)
 * Single Source of Truth for Printable Documents across HMS powered by html2pdf.js
 */

import { Appointment } from "@/types/patient"
import { formatDateForPDF } from "@/shared/utils/shared/timezone"
import type {
  HospitalPrintSettings,
  PrintAppointmentData,
  PrintBillingData,
  PrintPrescriptionData,
  PrintAdmissionData,
  PrintDischargeData,
  PrintLabReportData,
} from "@/types/print"

import { extractStructuredMedicines } from "@/shared/utils/appointments/prescriptionParsers"
import { convertPrescriptionToPrintData } from "@/shared/utils/printConverters"

import { renderHTMLToPdfOpen } from "./html2pdfEngine"
import {
  renderDocumentToPDFAndOpen,
  renderPrescriptionDocumentHTML,
  buildStandardDocumentHTML,
  type StandardDocumentConfig,
  type DocumentTotalsRow,
} from "./documentTemplateEngine"

export function extractMedicinesFromAppointment(appointment: Appointment): Array<{
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
}> {
  return extractStructuredMedicines(appointment)
}

// ============================================================================
// Shared Helper Functions & Formatting
// ============================================================================

export const safeText = (value?: string | number | null, fallback = "Not provided") => {
  if (value === null || value === undefined) return fallback
  const str = typeof value === "string" ? value.trim() : String(value)
  return str.length ? str : fallback
}

export const formatDate = (value?: string, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return "Not provided"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return formatDateForPDF(
    date,
    options ?? {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  )
}

export const formatCurrency = (amount?: number | null, includePrefix = true) => {
  const safeAmount = typeof amount === "number" ? amount : 0
  const formatted = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeAmount)
  return includePrefix ? `₹${formatted}` : formatted
}

// ============================================================================
// 1. APPOINTMENT SLIP PDF GENERATOR
// ============================================================================

export function generateAppointmentSlipPDF(
  data: PrintAppointmentData,
  hospitalSettings?: HospitalPrintSettings
): void {
  const diagStr = Array.isArray(data.diagnosis) ? data.diagnosis.join(", ") : data.diagnosis

  const vitalsParts: string[] = []
  if (data.vitals?.bp) vitalsParts.push(`BP: ${data.vitals.bp}`)
  if (data.vitals?.temperature) vitalsParts.push(`Temp: ${data.vitals.temperature}°C`)
  if (data.vitals?.heartRate) vitalsParts.push(`Pulse: ${data.vitals.heartRate} bpm`)
  if (data.vitals?.spO2) vitalsParts.push(`SpO2: ${data.vitals.spO2}%`)
  if (data.vitals?.height) vitalsParts.push(`Height: ${data.vitals.height} cm`)
  if (data.vitals?.weight) vitalsParts.push(`Weight: ${data.vitals.weight} kg`)

  const infoCards: any[] = [
    {
      title: "Patient Information",
      lines: [
        { label: "Patient Name", value: data.patient.name, isBold: true },
        { label: "Phone", value: data.patient.phone },
        { label: "Emergency Contact", value: data.patient.emergencyContact },
      ],
    },
    {
      title: "Doctor & Visit Details",
      lines: [
        { label: "Doctor Name", value: `Dr. ${data.doctor.name}`, isBold: true },
        { label: "Specialization", value: data.doctor.specialization },
        { label: "Department", value: data.department },
        { label: "Visit Type", value: data.visitType },
      ],
    },
  ]

  // Row 2: Full-width Clinical Consultation Summary Card (omitted if empty)
  const clinicalLines: any[] = []
  if (data.chiefComplaint) clinicalLines.push({ label: "Chief Complaint", value: data.chiefComplaint, isBold: true })
  if (diagStr) clinicalLines.push({ label: "Diagnosis", value: diagStr, isBold: true })
  if (data.clinicalNotes) clinicalLines.push({ label: "Clinical Notes", value: data.clinicalNotes })
  if (data.examinationFindings) clinicalLines.push({ label: "Examination Findings", value: data.examinationFindings })
  if (data.investigationAdvice) clinicalLines.push({ label: "Investigation Advice", value: data.investigationAdvice })
  if (data.prescriptionSummary) clinicalLines.push({ label: "Prescription Summary", value: data.prescriptionSummary })
  if (data.followUpAdvice) clinicalLines.push({ label: "Follow-up Advice", value: data.followUpAdvice })
  if (data.additionalInstructions) clinicalLines.push({ label: "Additional Instructions", value: data.additionalInstructions })

  if (clinicalLines.length > 0) {
    infoCards.push({
      title: "Clinical Consultation Summary",
      fullWidth: true,
      lines: clinicalLines,
    })
  }

  // Prescription Medicines Table (omitted if no medicines)
  let tableConfig: any = undefined
  if (data.medicines && data.medicines.length > 0) {
    tableConfig = {
      columns: [
        { header: "#", key: "idx", width: "8%", align: "center" },
        { header: "Medicine Name", key: "name", width: "37%" },
        { header: "Dosage", key: "dosage", width: "18%" },
        { header: "Frequency", key: "frequency", width: "22%" },
        { header: "Duration", key: "duration", width: "15%" },
      ],
      rows: data.medicines.map((med, idx) => ({
        idx: idx + 1,
        name: med.name,
        dosage: med.dosage || "As advised",
        frequency: med.frequency || "As directed",
        duration: med.duration || "Standard",
      })),
    }
  }

  const adviceParts: string[] = []
  if (data.followUpAdvice) adviceParts.push(`Follow-up: ${data.followUpAdvice}`)
  if (data.additionalInstructions) adviceParts.push(data.additionalInstructions)
  if (adviceParts.length === 0) {
    adviceParts.push("Please report to reception 15 minutes prior to your allocated slot. Carry valid photo identification and medical records.")
  }

  const config: StandardDocumentConfig = {
    docTitle: "Appointment Confirmation & Clinical Summary",
    docId: data.bookingId,
    docDate: data.appointmentDate,
    docTime: data.appointmentTime,
    statusBadge: {
      label: (data.status || "Confirmed").toUpperCase(),
      tone: "confirmed",
    },
    hospitalSettings,
    infoCards,
    bannerStrip: data.tokenNumber || vitalsParts.length > 0
      ? {
          title: data.tokenNumber ? `Token #${data.tokenNumber}` : "Vitals Summary",
          text: data.tokenNumber && vitalsParts.length > 0
            ? `Token #${data.tokenNumber}  |  Vitals: ${vitalsParts.join("  |  ")}`
            : data.tokenNumber
            ? `Token #${data.tokenNumber} (Please present this at reception desk)`
            : vitalsParts.join("  |  "),
          tone: "info",
        }
      : undefined,
    table: tableConfig,
    adviceBox: {
      title: "Patient Instructions & Follow-up Advice",
      text: adviceParts.join(" | "),
    },
    signatureBox: {
      title: "Doctor / Authorized Sign",
      name: data.doctor.name,
    },
  }

  void renderDocumentToPDFAndOpen(config, `Appointment_Slip_${data.bookingId}.pdf`)
}

// ============================================================================
// 2. BILLING INVOICE PDF GENERATOR
// ============================================================================

export function generateBillingInvoicePDF(
  data: PrintBillingData,
  hospitalSettings?: HospitalPrintSettings
): void {
  const tableRows = data.items.map((item, idx) => {
    const qty = item.qty || 1
    const unitPrice = item.unitPrice ?? item.amount / qty
    return {
      idx: idx + 1,
      desc: item.description,
      qty,
      unitPrice: formatCurrency(unitPrice),
      amount: formatCurrency(item.amount),
    }
  })

  const totalsBox: DocumentTotalsRow[] = [
    { label: "Subtotal", value: formatCurrency(data.subtotal) },
  ]

  if (data.discountAmount && data.discountAmount > 0) {
    totalsBox.push({ label: "Discount", value: `- ${formatCurrency(data.discountAmount)}`, isDiscount: true })
  }
  if (data.taxAmount && data.taxAmount > 0) {
    totalsBox.push({ label: "Taxes", value: formatCurrency(data.taxAmount) })
  }

  totalsBox.push({
    label: "Grand Total Payable",
    value: formatCurrency(data.grandTotal),
    isGrandTotal: true,
  })

  const config: StandardDocumentConfig = {
    docTitle: "Tax Invoice / Payment Receipt",
    docId: data.invoiceNumber,
    docDate: data.invoiceDate,
    docTime: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    statusBadge: {
      label: data.paymentStatus.toUpperCase(),
      tone: data.paymentStatus.toLowerCase() === "paid" ? "paid" : "pending",
    },
    hospitalSettings,
    infoCards: [
      {
        title: "Billed To (Patient)",
        lines: [
          { label: "Patient Name", value: data.patient.name, isBold: true },
          { label: "Phone", value: data.patient.phone },
          { label: "Address", value: data.patient.address },
        ],
      },
      {
        title: "Invoice & Payment Info",
        lines: [
          { label: "Invoice Number", value: data.invoiceNumber, isBold: true },
          { label: "Payment Method", value: (data.paymentMethod || "CASH").toUpperCase() },
          { label: "Payment Status", value: data.paymentStatus.toUpperCase() },
          { label: "Attending Doctor", value: data.doctor?.name ? `Dr. ${data.doctor.name}` : undefined },
        ],
      },
    ],
    table: {
      columns: [
        { header: "#", key: "idx", width: "8%", align: "center" },
        { header: "Service Description / Item", key: "desc", width: "52%" },
        { header: "Qty", key: "qty", width: "10%", align: "right" },
        { header: "Unit Rate", key: "unitPrice", width: "15%", align: "right" },
        { header: "Amount", key: "amount", width: "15%", align: "right" },
      ],
      rows: tableRows,
    },
    totalsBox,
    signatureBox: {
      title: "Cashier / Account Sign",
    },
  }

  void renderDocumentToPDFAndOpen(config, `Invoice_${data.invoiceNumber}.pdf`)
}

// ============================================================================
// 3. PRESCRIPTION PDF GENERATOR
// ============================================================================

export function generatePrescriptionPDFNew(
  data: PrintPrescriptionData,
  hospitalSettings?: HospitalPrintSettings
): void {
  const html = renderPrescriptionDocumentHTML(data, hospitalSettings)
  const safeName = (data.patient.name || "Patient").replace(/\s+/g, "_")
  const safeDate = (data.date || "").replace(/[\s,/]+/g, "_")
  void renderHTMLToPdfOpen(html, `Prescription_${safeName}_${safeDate}.pdf`)
}

// ============================================================================
// 4. ADMISSION FORM (IPD) PDF GENERATOR
// ============================================================================

export function generateAdmissionFormPDF(
  data: PrintAdmissionData,
  hospitalSettings?: HospitalPrintSettings
): void {
  const config: StandardDocumentConfig = {
    docTitle: "Inpatient Admission Form (IPD)",
    docId: data.ipdNo || data.admissionId,
    docDate: data.admitDate,
    statusBadge: {
      label: (data.admitType || "PLANNED").toUpperCase(),
      tone: "confirmed",
    },
    hospitalSettings,
    infoCards: [
      {
        title: "Patient Information",
        lines: [
          { label: "Patient Name", value: data.patient.name, isBold: true },
          { label: "Phone", value: data.patient.phone },
          { label: "Emergency Contact", value: data.patient.emergencyContact },
        ],
      },
      {
        title: "Accommodation & Attending Doctor",
        lines: [
          { label: "Room / Bed", value: `Room ${data.roomNumber} (${data.roomType})`, isBold: true },
          { label: "Daily Tariff Rate", value: `${formatCurrency(data.ratePerDay)} / day` },
          { label: "Attending Doctor", value: `Dr. ${data.doctor.name}` },
          { label: "Admit Type", value: (data.admitType || "planned").toUpperCase() },
          {
            label: "Initial Deposit",
            value: data.initialDeposit ? formatCurrency(data.initialDeposit) : undefined,
          },
        ],
      },
    ],
    adviceBox: {
      title: "Patient Admission Declaration",
      text: "I authorize the hospital medical staff to perform diagnostic procedures and medical treatment as required. I agree to pay all charges incurred as per hospital tariff policies.",
    },
    signatureBox: {
      title: "Patient / Guardian Signature",
    },
  }

  void renderDocumentToPDFAndOpen(config, `Admission_${data.ipdNo || data.admissionId}.pdf`)
}

// ============================================================================
// 5. DISCHARGE SUMMARY PDF GENERATOR
// ============================================================================

export function generateDischargeSummaryPDF(
  data: PrintDischargeData,
  hospitalSettings?: HospitalPrintSettings
): void {
  const diagStr = Array.isArray(data.finalDiagnosis) ? data.finalDiagnosis.join(", ") : data.finalDiagnosis

  const config: StandardDocumentConfig = {
    docTitle: "Hospital Discharge Summary",
    docId: data.ipdNo || data.admissionId,
    docDate: data.dischargeDate,
    statusBadge: {
      label: "DISCHARGED",
      tone: "completed",
    },
    hospitalSettings,
    infoCards: [
      {
        title: "Patient Details",
        lines: [
          { label: "Patient Name", value: data.patient.name, isBold: true },
          { label: "Phone", value: data.patient.phone },
        ],
      },
      {
        title: "Inpatient Stay Details",
        lines: [
          { label: "Admit Date", value: data.admitDate },
          { label: "Discharge Date", value: data.dischargeDate, isBold: true },
          { label: "Consultant Doctor", value: `Dr. ${data.doctor.name}` },
        ],
      },
    ],
    bannerStrip: diagStr
      ? {
          title: "Final Clinical Diagnosis",
          text: diagStr,
          tone: "info",
        }
      : undefined,
    adviceBox: {
      title: "Summary of Treatment & Follow-Up Advice",
      text:
        data.treatmentSummary ||
        data.followUpAdvice ||
        `Patient admitted under Dr. ${data.doctor.name}. Underwent IPD medical care and regular clinical monitoring. Discharged in stable condition.`,
    },
    signatureBox: {
      title: "Consultant Signature",
      name: data.doctor.name,
    },
  }

  void renderDocumentToPDFAndOpen(config, `Discharge_${data.ipdNo || data.admissionId}.pdf`)
}

// ============================================================================
// 6. LAB REPORT PDF GENERATOR
// ============================================================================

export function generateLabReportPDF(
  data: PrintLabReportData,
  hospitalSettings?: HospitalPrintSettings
): void {
  const tableRows = data.items.map((item) => ({
    testName: item.testName,
    result: item.result,
    unit: item.unit || "—",
    referenceRange: item.referenceRange || "Standard",
  }))

  const config: StandardDocumentConfig = {
    docTitle: `${data.category || "Lab"} Investigation Report`,
    docId: data.reportId,
    docDate: data.testDate,
    hospitalSettings,
    infoCards: [
      {
        title: "Patient Details",
        lines: [
          { label: "Patient Name", value: data.patient.name, isBold: true },
          { label: "Phone", value: data.patient.phone },
        ],
      },
      {
        title: "Investigation Details",
        lines: [
          { label: "Test Name", value: data.reportName, isBold: true },
          { label: "Referred By", value: data.doctor?.name ? `Dr. ${data.doctor.name}` : undefined },
        ],
      },
    ],
    table: {
      columns: [
        { header: "Parameter Name", key: "testName", width: "40%" },
        { header: "Observed Result", key: "result", width: "25%", align: "center" },
        { header: "Unit", key: "unit", width: "15%", align: "center" },
        { header: "Reference Range", key: "referenceRange", width: "20%", align: "center" },
      ],
      rows: tableRows,
    },
    adviceBox: data.impression
      ? {
          title: "Clinical Impression / Notes",
          text: data.impression,
        }
      : undefined,
    signatureBox: {
      title: "Pathologist Signature",
      name: data.pathologist,
    },
  }

  void renderDocumentToPDFAndOpen(config, `Lab_Report_${data.reportId}.pdf`)
}

// ============================================================================
// Legacy PDF Generators Retained for Backwards Compatibility
// ============================================================================

export function generateAppointmentConfirmationPDF(
  appointment: Appointment,
  hospitalSettings?: HospitalPrintSettings
) {
  generateAppointmentSlipPDF(
    {
      bookingId: appointment.transactionId || appointment.id || "APT",
      appointmentDate: appointment.appointmentDate || new Date().toISOString().split("T")[0],
      appointmentTime: appointment.appointmentTime || "Not specified",
      patient: {
        id: appointment.patientId || appointment.patientUid,
        name: appointment.patientName || "Valued Patient",
        phone: appointment.patientPhone,
        email: appointment.patientEmail,
        gender: appointment.patientGender,
      },
      doctor: {
        id: appointment.doctorId,
        name: appointment.doctorName || "Attending Physician",
        specialization: appointment.doctorSpecialization,
      },
      department: appointment.doctorSpecialization,
      visitType: appointment.visitType || appointment.appointmentType || "General Consultation",
      tokenNumber: appointment.id ? appointment.id.slice(-4).toUpperCase() : undefined,
      status: appointment.status,
      chiefComplaint: appointment.chiefComplaint,
    },
    hospitalSettings
  )
}

export function generateAppointmentConfirmationPDFBase64(
  appointment: Appointment,
  hospitalSettings?: HospitalPrintSettings
): string {
  const config: StandardDocumentConfig = {
    docTitle: "Appointment Confirmation Slip",
    docId: appointment.transactionId || appointment.id || "APT",
    docDate: appointment.appointmentDate || new Date().toISOString().split("T")[0],
    docTime: appointment.appointmentTime || "Not specified",
    hospitalSettings,
    infoCards: [
      {
        title: "Patient Details",
        lines: [
          { label: "Patient Name", value: appointment.patientName, isBold: true },
        ],
      },
      {
        title: "Doctor Details",
        lines: [
          { label: "Doctor Name", value: `Dr. ${appointment.doctorName}`, isBold: true },
          { label: "Specialization", value: appointment.doctorSpecialization },
        ],
      },
    ],
  }
  return buildStandardDocumentHTML(config)
}

export function generatePrescriptionPDF(
  appointment: Appointment,
  hospitalSettings?: HospitalPrintSettings
) {
  const printData = convertPrescriptionToPrintData(appointment)
  generatePrescriptionPDFNew(printData, hospitalSettings)
}

export function getPrescriptionPDFBuffer(
  appointment: Appointment,
  hospitalSettings?: HospitalPrintSettings
): Buffer {
  const printData = convertPrescriptionToPrintData(appointment)
  const html = renderPrescriptionDocumentHTML(printData, hospitalSettings)
  return Buffer.from(html)
}
