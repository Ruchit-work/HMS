/**
 * Prescription PDF Generator
 * Creates professional medical prescription PDFs
 * Design: Clean, official, medical-grade format
 */

import jsPDF from 'jspdf'
import { Appointment } from '@/types/patient'
import { calculateAge } from '@/utils/date'

type PrescriptionRenderOptions = {
  forPreview?: boolean
}

function safeText(value?: string | number | null, fallback = 'Not provided') {
  if (value === null || value === undefined) return fallback
  const str = typeof value === 'string' ? value.trim() : String(value)
  return str.length ? str : fallback
}

function formatDate(value?: string, locale: string = 'en-US') {
  if (!value) return 'Not provided'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
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

  if (appointment.medicine) {
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
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, pageHeight - 68, pageWidth - 2 * margin, 30, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text('Payment Summary', margin + 5, pageHeight - 62)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(9.5)

  doc.text(`Method: ${safeText(appointment.paymentMethod)}`, margin + 5, pageHeight - 56)
  doc.text(`Payment Status: ${safeText(appointment.paymentStatus)}`, margin + 5, pageHeight - 50)
  doc.text(`Total Fee: ₹${appointment.totalConsultationFee ?? 0}`, margin + 5, pageHeight - 44)
  doc.text(`Amount Paid: ₹${appointment.paymentAmount ?? 0}`, margin + (pageWidth - 2 * margin) / 2 + 5, pageHeight - 50)
  doc.text(`Transaction ID: ${safeText(appointment.transactionId)}`, margin + (pageWidth - 2 * margin) / 2 + 5, pageHeight - 44)

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

