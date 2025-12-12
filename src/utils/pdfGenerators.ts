/**
 * PDF Generation Utilities
 * Shared helpers and PDF generators for appointments and prescriptions
 */

import jsPDF from "jspdf"
import { Appointment } from "@/types/patient"
import { calculateAge } from "@/utils/date"

// ============================================================================
// Shared Helper Functions
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
  return date.toLocaleDateString("en-US", options ?? {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  })
}

export const formatCurrency = (amount?: number | null, includePrefix = true) => {
  const safeAmount = typeof amount === "number" ? amount : 0
  const formatted = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0 }).format(safeAmount)
  return includePrefix ? `INR ${formatted}` : formatted
}

// ============================================================================
// Appointment Confirmation PDF
// ============================================================================

export function generateAppointmentConfirmationPDF(appointment: Appointment) {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 20

  // Header
  pdf.setFillColor(45, 55, 72)
  pdf.rect(0, 0, pageWidth, 45, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(22)
  pdf.setFont("helvetica", "bold")
  pdf.text("Appointment Confirmation", pageWidth / 2, 20, { align: "center" })

  pdf.setFontSize(12)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Booking ID: ${safeText(appointment.transactionId, "N/A")}`, pageWidth / 2, 32, { align: "center" })

  // Success icon
  pdf.setFontSize(36)
  pdf.text("✔", pageWidth / 2, 60, { align: "center" })

  let yPos = 70

  const drawCard = (title: string, body: () => void) => {
    const cardStart = yPos
    const cardWidth = pageWidth - margin * 2
    const padding = 8

    pdf.setFillColor(248, 250, 252)
    pdf.setDrawColor(226, 232, 240)
    pdf.rect(margin, cardStart, cardWidth, 10, "F")

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.setTextColor(30, 41, 59)
    pdf.text(title, margin + padding, cardStart + 7)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    pdf.setTextColor(71, 85, 105)

    yPos += 14
    body()
    const endY = yPos + padding

    pdf.setDrawColor(226, 232, 240)
    pdf.rect(margin, cardStart, cardWidth, Math.max(endY - cardStart, 24))

    yPos = endY + 6
  }

  drawCard("Appointment Details", () => {
    const details = [
      `Patient: ${safeText(appointment.patientName)}`,
      `Doctor: Dr. ${safeText(appointment.doctorName)}`,
      `Specialization: ${safeText(appointment.doctorSpecialization)}`,
      `Date: ${formatDate(appointment.appointmentDate)}`,
      `Time: ${safeText(appointment.appointmentTime, "Not set")}`
    ]

    details.forEach(line => {
      pdf.text(line, margin + 8, yPos)
      yPos += 7
    })

    if (appointment.chiefComplaint) {
      yPos += 3
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(15, 118, 110)
      pdf.text("Symptoms / Chief Complaint", margin + 8, yPos)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(71, 85, 105)
      yPos += 6
      const symptoms = Array.isArray(appointment.chiefComplaint)
        ? appointment.chiefComplaint
        : appointment.chiefComplaint.split(/[,•-]/).map((s) => s.trim()).filter(Boolean)
      if (symptoms.length === 0) symptoms.push(appointment.chiefComplaint)

      symptoms.forEach((symptom) => {
        pdf.text(`• ${symptom}`, margin + 10, yPos)
        yPos += 6
      })
    }
  })

  drawCard("Payment Summary", () => {
    pdf.text(`Payment Method: ${safeText(appointment.paymentMethod, "Not provided")}`, margin + 8, yPos)
    yPos += 7
    pdf.text(`Payment Status: ${safeText(appointment.paymentStatus, "Pending")}`, margin + 8, yPos)
    yPos += 7
    pdf.text(`Amount Paid: ${formatCurrency(appointment.paymentAmount)}`, margin + 8, yPos)
    yPos += 7

    if (appointment.paymentType === "partial" && appointment.remainingAmount) {
      pdf.setTextColor(220, 38, 38)
      pdf.text(`Remaining at Hospital: ${formatCurrency(appointment.remainingAmount)}`, margin + 8, yPos)
      pdf.setTextColor(71, 85, 105)
      yPos += 7
    }
  })

  drawCard("Hospital Notes", () => {
    const notes = [
      "Please arrive 15 minutes before your appointment.",
      "Carry a valid ID and any prior medical records.",
      `Booking Date: ${formatDate(appointment.createdAt, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric"
      })}`
    ]

    notes.forEach(line => {
      pdf.text(line, margin + 8, yPos)
      yPos += 6
    })
  })

  pdf.save(`Appointment-Confirmation-${safeText(appointment.transactionId, "N/A")}.pdf`)
}

/**
 * Generate appointment confirmation PDF and return as base64 string
 */
export function generateAppointmentConfirmationPDFBase64(appointment: Appointment): string {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 20

  // Header
  pdf.setFillColor(45, 55, 72)
  pdf.rect(0, 0, pageWidth, 45, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(22)
  pdf.setFont("helvetica", "bold")
  pdf.text("Appointment Confirmation", pageWidth / 2, 20, { align: "center" })

  pdf.setFontSize(12)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Booking ID: ${safeText(appointment.transactionId || appointment.id, "N/A")}`, pageWidth / 2, 32, { align: "center" })

  // Success icon
  pdf.setFontSize(36)
  pdf.text("✔", pageWidth / 2, 60, { align: "center" })

  let yPos = 70

  const drawCard = (title: string, body: () => void) => {
    const cardStart = yPos
    const cardWidth = pageWidth - margin * 2
    const padding = 8

    pdf.setFillColor(248, 250, 252)
    pdf.setDrawColor(226, 232, 240)
    pdf.rect(margin, cardStart, cardWidth, 10, "F")

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(12)
    pdf.setTextColor(30, 41, 59)
    pdf.text(title, margin + padding, cardStart + 7)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(11)
    pdf.setTextColor(71, 85, 105)

    yPos += 14
    body()
    const endY = yPos + padding

    pdf.setDrawColor(226, 232, 240)
    pdf.rect(margin, cardStart, cardWidth, Math.max(endY - cardStart, 24))

    yPos = endY + 6
  }

  drawCard("Appointment Details", () => {
    const details = [
      `Patient: ${safeText(appointment.patientName)}`,
      `Doctor: Dr. ${safeText(appointment.doctorName)}`,
      `Specialization: ${safeText(appointment.doctorSpecialization)}`,
      `Date: ${formatDate(appointment.appointmentDate)}`,
      `Time: ${safeText(appointment.appointmentTime, "Not set")}`
    ]

    details.forEach(line => {
      pdf.text(line, margin + 8, yPos)
      yPos += 7
    })

    if (appointment.chiefComplaint) {
      yPos += 3
      pdf.setFont("helvetica", "bold")
      pdf.setTextColor(15, 118, 110)
      pdf.text("Symptoms / Chief Complaint", margin + 8, yPos)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(71, 85, 105)
      yPos += 6
      const symptoms = Array.isArray(appointment.chiefComplaint)
        ? appointment.chiefComplaint
        : appointment.chiefComplaint.split(/[,•-]/).map((s) => s.trim()).filter(Boolean)
      if (symptoms.length === 0) symptoms.push(appointment.chiefComplaint)

      symptoms.forEach((symptom) => {
        pdf.text(`• ${symptom}`, margin + 10, yPos)
        yPos += 6
      })
    }
  })

  drawCard("Payment Summary", () => {
    pdf.text(`Payment Method: ${safeText(appointment.paymentMethod, "Not provided")}`, margin + 8, yPos)
    yPos += 7
    pdf.text(`Payment Status: ${safeText(appointment.paymentStatus, "Pending")}`, margin + 8, yPos)
    yPos += 7
    pdf.text(`Amount Paid: ${formatCurrency(appointment.paymentAmount)}`, margin + 8, yPos)
    yPos += 7

    if (appointment.paymentType === "partial" && appointment.remainingAmount) {
      pdf.setTextColor(220, 38, 38)
      pdf.text(`Remaining at Hospital: ${formatCurrency(appointment.remainingAmount)}`, margin + 8, yPos)
      pdf.setTextColor(71, 85, 105)
      yPos += 7
    }
  })

  drawCard("Hospital Notes", () => {
    const notes = [
      "Please arrive 15 minutes before your appointment.",
      "Carry a valid ID and any prior medical records.",
      `Booking Date: ${formatDate(appointment.createdAt, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "numeric"
      })}`
    ]

    notes.forEach(line => {
      pdf.text(line, margin + 8, yPos)
      yPos += 6
    })
  })

  // Return as base64 string
  return pdf.output("datauristring")
}

// ============================================================================
// Prescription PDF
// ============================================================================

type PrescriptionRenderOptions = {
  forPreview?: boolean
}

type ParsedPrescription = {
  medicines: Array<{
    emoji: string
    name: string
    dosage: string
    frequency: string
    duration: string
  }>
  advice?: string
}

const emojiRegex = /([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF][\uDC00-\uDFFF])/g

function sanitizeForPdf(text: string) {
  return text
    .replace(emojiRegex, '')
    .replace(/[^\x20-\x7EÀ-ÿ]/g, '')
    .trim()
}

function parsePrescriptionText(text: string | undefined | null): ParsedPrescription | null {
  if (!text) return null

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const medicines: ParsedPrescription['medicines'] = []
  let advice = ''
  let currentMedicine: ParsedPrescription['medicines'][number] | null = null

  const medicineLineRegex = /^\*(?:([1-9]️⃣|🔟)\s+)?(.+?)\*$/

  for (const line of lines) {
    if (line.includes('🧾') && line.toLowerCase().includes('prescription')) continue

    if (line.startsWith('📌')) {
      advice = line.replace(/📌\s*\*?Advice:\*?\s*/i, '').trim()
      continue
    }

    const medicineMatch = line.match(medicineLineRegex)
    if (medicineMatch) {
      if (currentMedicine) {
        medicines.push(currentMedicine)
      }

      const emoji = medicineMatch[1] || ''
      let nameWithDetails = medicineMatch[2].trim()

      let dosage = ''
      const dosageMatch = nameWithDetails.match(/(\d+(?:\.\d+)?\s*(?:mg|g|ml|capsule|tablet|tab|cap))/i)
      if (dosageMatch) {
        dosage = dosageMatch[1]
        nameWithDetails = nameWithDetails.replace(dosageMatch[0], '').trim()
      }

      let duration = ''
      const durationMatch = nameWithDetails.match(/(?:for|duration)\s+(\d+\s*(?:days?|weeks?|months?))/i)
      if (durationMatch) {
        duration = durationMatch[1]
        nameWithDetails = nameWithDetails.replace(durationMatch[0], '').trim()
      }

      let frequency = ''
      const frequencyMatch = nameWithDetails.match(/(daily|once|twice|three times|four times|\d+\s*times)/i)
      if (frequencyMatch) {
        frequency = frequencyMatch[1]
        nameWithDetails = nameWithDetails.replace(frequencyMatch[0], '').trim()
      }

      const name = nameWithDetails.replace(/\[.*?\]/g, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim()

      currentMedicine = {
        emoji,
        name: name || 'Medicine',
        dosage,
        frequency,
        duration
      }
      continue
    }

    if (currentMedicine && line.startsWith('•')) {
      const detail = line.replace(/^•\s*/, '')
      if (!detail) continue

      if (!currentMedicine.frequency && !detail.toLowerCase().includes('duration')) {
        currentMedicine.frequency = detail.trim()
      } else if (detail.toLowerCase().includes('duration')) {
        currentMedicine.duration = detail.replace(/duration:\s*/i, '').trim()
      }
    }
  }

  if (currentMedicine) {
    medicines.push(currentMedicine)
  }

  if (!medicines.length) return null

  return {
    medicines,
    advice
  }
}

function createPrescriptionDocument(appointment: Appointment, options: PrescriptionRenderOptions = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  const createdDate = appointment.updatedAt || appointment.createdAt
  const formattedCreatedDate = formatDate(createdDate)
  const consultationDate = `${formatDate(appointment.appointmentDate)} at ${safeText(appointment.appointmentTime, 'Not set')}`
  const patientAge = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null

  // Header banner
  doc.setFillColor(20, 184, 166)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setFontSize(24)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text('HMS', margin, 16)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Hospital Management System', margin, 23)
  doc.text('Medical Prescription', margin, 29)

  doc.setFontSize(9)
  doc.text(`Prescription Date: ${formattedCreatedDate}`, pageWidth - margin, 14, { align: 'right' })
  doc.text(`Prescription ID: ${safeText(appointment.id?.substring(0, 12)?.toUpperCase(), 'N/A')}`, pageWidth - margin, 20, { align: 'right' })
  doc.text(`Patient ID: ${safeText(appointment.patientId, 'N/A')}`, pageWidth - margin, 26, { align: 'right' })

  let yPos = 50

  // Doctor Details
  doc.setFillColor(241, 245, 249)
  doc.rect(margin, yPos, pageWidth - 2 * margin, 32, 'F')
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Doctor Information', margin + 5, yPos + 8)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.text(`Doctor Name: Dr. ${safeText(appointment.doctorName)}`, margin + 5, yPos + 16)
  doc.text(`Specialization: ${safeText(appointment.doctorSpecialization)}`, margin + 5, yPos + 22)
  doc.text(`Consultation Date: ${consultationDate}`, margin + 5, yPos + 28)

  yPos += 42

  // Patient details
  doc.setFillColor(241, 245, 249)
  doc.rect(margin, yPos, pageWidth - 2 * margin, 42, 'F')

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Patient Information', margin + 5, yPos + 8)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)

  const patientDetailsLeft = [
    `Name: ${safeText(appointment.patientName)}`,
    `Age: ${patientAge ?? 'Not available'}`,
    `Gender: ${safeText(appointment.patientGender, 'Not specified')}`,
    `Blood Group: ${safeText(appointment.patientBloodGroup, 'Not specified')}`
  ]
  const patientDetailsRight = [
    `Email: ${safeText(appointment.patientEmail)}`,
    `Phone: ${safeText(appointment.patientPhone)}`,
    `Address: ${safeText((appointment as any).patientAddress)}`,
    `Occupation: ${safeText(appointment.patientOccupation)}`
  ]

  patientDetailsLeft.forEach((line, index) => {
    doc.text(line, margin + 5, yPos + 16 + index * 6)
  })
  patientDetailsRight.forEach((line, index) => {
    doc.text(line, margin + (pageWidth - 2 * margin) / 2 + 5, yPos + 16 + index * 6)
  })

  yPos += 52

  // Vitals & Lifestyle info if available
  const vitals = [
    appointment.vitalTemperatureC !== undefined && appointment.vitalTemperatureC !== null ? `Temperature: ${appointment.vitalTemperatureC} °C` : null,
    appointment.vitalBloodPressure ? `Blood Pressure: ${appointment.vitalBloodPressure}` : null,
    appointment.vitalHeartRate !== undefined && appointment.vitalHeartRate !== null ? `Heart Rate: ${appointment.vitalHeartRate} bpm` : null,
    appointment.vitalRespiratoryRate !== undefined && appointment.vitalRespiratoryRate !== null ? `Respiratory Rate: ${appointment.vitalRespiratoryRate} breaths/min` : null,
    appointment.vitalSpO2 !== undefined && appointment.vitalSpO2 !== null ? `SpO₂: ${appointment.vitalSpO2}%` : null,
    appointment.patientWeightKg !== undefined && appointment.patientWeightKg !== null ? `Weight: ${appointment.patientWeightKg} kg` : null,
    appointment.patientHeightCm !== undefined && appointment.patientHeightCm !== null ? `Height: ${appointment.patientHeightCm} cm` : null
  ].filter(Boolean) as string[]

  const lifestyle = [
    appointment.patientSmokingHabits ? `Smoking: ${appointment.patientSmokingHabits}` : null,
    appointment.patientDrinkingHabits ? `Alcohol: ${appointment.patientDrinkingHabits}` : null,
    appointment.patientVegetarian !== undefined ? `Diet: ${appointment.patientVegetarian ? 'Vegetarian' : 'Non-Vegetarian'}` : null,
    appointment.patientPregnancyStatus ? `Pregnancy Status: ${appointment.patientPregnancyStatus}` : null,
    appointment.patientFamilyHistory ? `Family History: ${appointment.patientFamilyHistory}` : null
  ].filter(Boolean) as string[]

  if (vitals.length || lifestyle.length) {
    doc.setFillColor(236, 254, 255)
    doc.rect(margin, yPos, pageWidth - 2 * margin, 10 + (Math.max(vitals.length, lifestyle.length) || 1) * 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(14, 116, 144)
    doc.setFontSize(11)
    doc.text('Clinical Snapshot', margin + 5, yPos + 7)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(9.5)

    vitals.forEach((line, index) => {
      doc.text(line, margin + 5, yPos + 14 + index * 6)
    })
    lifestyle.forEach((line, index) => {
      doc.text(line, margin + (pageWidth - 2 * margin) / 2 + 5, yPos + 14 + index * 6)
    })

    yPos += 18 + Math.max(vitals.length, lifestyle.length) * 6
  }

  // Clinical summary
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text('Chief Complaint', margin, yPos + 6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  const complaint = safeText(appointment.chiefComplaint, 'No chief complaint recorded.')
  const complaintLines = doc.splitTextToSize(complaint, pageWidth - 2 * margin)
  doc.text(complaintLines, margin, yPos + 13)
  yPos += 13 + complaintLines.length * 5

  if (appointment.medicalHistory) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(11)
    doc.text('Relevant Medical History', margin, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(10)
    const historyLines = doc.splitTextToSize(appointment.medicalHistory, pageWidth - 2 * margin)
    doc.text(historyLines, margin, yPos + 13)
    yPos += 13 + historyLines.length * 5
  }

  if (appointment.patientAllergies || appointment.patientCurrentMedications) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(11)
    doc.text('Allergies & Current Medications', margin, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(10)

    const allergyText = safeText(appointment.patientAllergies, 'No allergies recorded.')
    const medicationText = safeText(appointment.patientCurrentMedications, 'No current medications recorded.')

    const allergyLines = doc.splitTextToSize(`Allergies: ${allergyText}`, pageWidth - 2 * margin)
    doc.text(allergyLines, margin, yPos + 13)
    yPos += allergyLines.length * 5 + 3

    const medicationLines = doc.splitTextToSize(`Current Medications: ${medicationText}`, pageWidth - 2 * margin)
    doc.text(medicationLines, margin, yPos + 13)
    yPos += medicationLines.length * 5 + 5
  }

  // Prescriptions
  doc.setFillColor(16, 185, 129)
  doc.rect(margin, yPos + 5, pageWidth - 2 * margin, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text('Prescription Plan', margin + 5, yPos + 11)

  yPos += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)

  const structuredPrescription = parsePrescriptionText(appointment.medicine)

  if (structuredPrescription && structuredPrescription.medicines.length > 0) {
    structuredPrescription.medicines.forEach((med, idx) => {
      const detailLines: string[] = []
      if (med.frequency) detailLines.push(`• ${sanitizeForPdf(med.frequency)}`)
      if (med.duration) detailLines.push(`• Duration: ${sanitizeForPdf(med.duration)}`)

      const boxHeight = 14 + detailLines.length * 5
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.rect(margin, yPos, pageWidth - 2 * margin, boxHeight, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      const title = `${idx + 1}. ${sanitizeForPdf(med.name)}${med.dosage ? ` (${sanitizeForPdf(med.dosage)})` : ''}`
      doc.text(title.trim(), margin + 5, yPos + 6)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(55, 65, 81)
      detailLines.forEach((line: string, idx: number) => {
        doc.text(line, margin + 7, yPos + 11 + idx * 5)
      })

      yPos += boxHeight + 6
    })

    if (structuredPrescription.advice) {
      const adviceLines = doc.splitTextToSize(sanitizeForPdf(structuredPrescription.advice), pageWidth - 2 * margin - 10)
      const adviceHeight = 12 + adviceLines.length * 5
      doc.setFillColor(254, 249, 195)
      doc.setDrawColor(250, 204, 21)
      doc.rect(margin, yPos, pageWidth - 2 * margin, adviceHeight, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(120, 53, 15)
      doc.text('📌 Advice', margin + 5, yPos + 6)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(146, 64, 14)
      adviceLines.forEach((line: string, idx: number) => {
        doc.text(line, margin + 5, yPos + 11 + idx * 5)
      })

      yPos += adviceHeight + 6
    }
  } else if (appointment.medicine) {
    const medicineLines = doc.splitTextToSize(appointment.medicine, pageWidth - 2 * margin)
    doc.text(medicineLines, margin, yPos)
    yPos += medicineLines.length * 5 + 5
  } else {
    doc.setTextColor(148, 163, 184)
    doc.text('No medicines prescribed in this consultation.', margin, yPos)
    yPos += 5
  }

  if (appointment.doctorNotes) {
    doc.setFillColor(59, 130, 246)
    doc.rect(margin, yPos + 5, pageWidth - 2 * margin, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(255, 255, 255)
    doc.text('Doctor Instructions', margin + 5, yPos + 11)

    yPos += 20
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(30, 41, 59)
    const notesLines = doc.splitTextToSize(appointment.doctorNotes, pageWidth - 2 * margin)
    doc.text(notesLines, margin, yPos)
    yPos += notesLines.length * 5 + 5
  }

  const followUp = safeText((appointment as any).followUpAdvice, '')
  if (followUp && followUp !== 'Not provided') {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(11)
    doc.text('Follow-up Advice', margin, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.setFontSize(10)
    const followUpLines = doc.splitTextToSize(followUp, pageWidth - 2 * margin)
    doc.text(followUpLines, margin, yPos + 13)
    yPos += 13 + followUpLines.length * 5
  }

  // Payment summary
  const paymentBlockHeight = 42
  if (yPos + paymentBlockHeight + 30 > pageHeight) {
    doc.addPage()
    yPos = margin
  }

  const cardWidth = pageWidth - 2 * margin
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(203, 213, 225)
  doc.rect(margin, yPos, cardWidth, paymentBlockHeight, 'FD')

  doc.setFillColor(15, 118, 110)
  doc.rect(margin, yPos, cardWidth, 9, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text('Payment Summary', margin + 5, yPos + 6.5)

  const leftX = margin + 5
  const rightX = margin + cardWidth / 2 + 5
  const innerY = yPos + 15

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(9.5)

  doc.text(`Method: ${safeText(appointment.paymentMethod)}`, leftX, innerY)
  doc.text(`Status: ${safeText(appointment.paymentStatus)}`, leftX, innerY + 6)
  doc.text(`Transaction: ${safeText(appointment.transactionId)}`, leftX, innerY + 12)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 118, 110)
  doc.setFontSize(11)
  doc.text(`Total Fee`, rightX, innerY)
  doc.setFontSize(13)
  doc.text(`INR ${formatCurrency(appointment.totalConsultationFee, false)}`, rightX, innerY + 5)

  doc.setFontSize(11)
  doc.setTextColor(107, 114, 128)
  doc.text(`Amount Paid`, rightX, innerY + 13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 101, 52)
  doc.setFontSize(13)
  doc.text(`INR ${formatCurrency(appointment.paymentAmount, false)}`, rightX, innerY + 18)

  yPos += paymentBlockHeight + 12

  // Footer & signature
  doc.setDrawColor(203, 213, 225)
  doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30)

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.text('___________________________', pageWidth - margin - 55, pageHeight - 24)
  doc.setFont('helvetica', 'normal')
  doc.text(`Dr. ${safeText(appointment.doctorName)}`, pageWidth - margin - 55, pageHeight - 18)
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(safeText(appointment.doctorSpecialization), pageWidth - margin - 55, pageHeight - 14)

  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text('HMS - Hospital Management System | Professional Healthcare Solutions', pageWidth / 2, pageHeight - 18, { align: 'center' })
  doc.text('This is a computer generated prescription. No signature is required.', pageWidth / 2, pageHeight - 12, { align: 'center' })

  if (!options.forPreview) {
    const fileName = `Prescription_${safeText(appointment.patientName, 'Patient')}_${new Date(appointment.appointmentDate).toISOString().split('T')[0]}.pdf`.replace(/\s+/g, '_')
    doc.save(fileName)
  }

  return doc
}

export function generatePrescriptionPDF(appointment: Appointment) {
  createPrescriptionDocument(appointment, { forPreview: false })
}

export function previewPrescriptionPDF(appointment: Appointment) {
  const doc = createPrescriptionDocument(appointment, { forPreview: true })
  const pdfBlob = doc.output('blob')
  const url = URL.createObjectURL(pdfBlob)
  window.open(url, '_blank')
}

