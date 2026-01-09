/**
 * PDF Generation Utilities
 * Shared helpers and PDF generators for appointments and prescriptions
 */

import jsPDF from "jspdf"
import { Appointment } from "@/types/patient"
import { calculateAge } from "@/utils/date"
import { formatDateForPDF } from "@/utils/timezone"

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
  // Use en-IN locale and default timezone for consistent formatting
  return formatDateForPDF(date, options ?? {
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
  const pageHeight = pdf.internal.pageSize.getHeight()
  const docMargin = 15

  // Light blue background
  pdf.setFillColor(173, 216, 230)
  pdf.rect(0, 0, pageWidth, pageHeight, 'F')

  // White document area
  const docWidth = pageWidth - docMargin * 2
  const docHeight = pageHeight - docMargin * 2
  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(200, 200, 200)
  pdf.rect(docMargin, docMargin, docWidth, docHeight, 'FD')

  // Teal/mint green bands
  pdf.setFillColor(72, 209, 204)
  pdf.rect(docMargin, docMargin, docWidth, 8, 'F')
  pdf.rect(docMargin, pageHeight - docMargin - 8, docWidth, 8, 'F')

  let yPos = docMargin + 15
  const leftX = docMargin + 10
  const rightX = docMargin + docWidth - 10

  // Logo and Hospital Name
  pdf.setFillColor(147, 51, 234)
  pdf.circle(leftX + 8, yPos + 5, 4, 'F')
  pdf.setFillColor(72, 209, 204)
  pdf.circle(leftX + 12, yPos + 5, 4, 'F')

  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(75, 85, 99)
  pdf.text('HOSPITAL', leftX, yPos + 8)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(100, 116, 139)
  pdf.text('SLOGAN HERE', leftX, yPos + 12)

  // Appointment Confirmation Title
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(75, 85, 99)
  pdf.text('APPOINTMENT CONFIRMATION', leftX, yPos + 20)

  // Booking ID and Date
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(71, 85, 105)
  pdf.text(`Booking ID: ${safeText(appointment.transactionId, "N/A")}`, rightX, yPos + 8, { align: 'right' })
  pdf.text(`Date: ${formatDate(appointment.createdAt, { year: 'numeric', month: '2-digit', day: '2-digit' })}`, rightX, yPos + 13, { align: 'right' })

  yPos += 35

  // Appointment To Section
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(71, 85, 105)
  pdf.text('Appointment for:', leftX, yPos)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(30, 41, 59)
  pdf.text(safeText(appointment.patientName), leftX, yPos + 6)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(71, 85, 105)
  const address = safeText((appointment as any).patientAddress, 'Address not provided')
  const addressLines = pdf.splitTextToSize(address, docWidth / 2 - 20)
  addressLines.forEach((line: string, idx: number) => {
    pdf.text(line, leftX, yPos + 12 + idx * 5)
  })

  yPos += 30

  // Service Description Table
  const colWidths = [15, 80, 30, 25, 30]
  const tableWidth = docWidth - 20
  const headerHeight = 10

  // Dark purple/blue header
  pdf.setFillColor(75, 85, 99)
  pdf.rect(leftX, yPos, tableWidth, headerHeight, 'F')
  
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(255, 255, 255)
  let currentX = leftX + 2
  pdf.text('NO.', currentX, yPos + 7)
  currentX += colWidths[0]
  pdf.text('SERVICE DESCRIPTION', currentX, yPos + 7)
  currentX += colWidths[1]
  pdf.text('PRICE', currentX, yPos + 7)
  currentX += colWidths[2]
  pdf.text('QTY.', currentX, yPos + 7)
  currentX += colWidths[3]
  pdf.text('TOTAL', currentX, yPos + 7)

  yPos += headerHeight + 2

  // Service Items
  const currencySymbol = '₹'
  const services = [{
    desc: `Consultation - Dr. ${safeText(appointment.doctorName)} (${safeText(appointment.doctorSpecialization)})`,
    price: appointment.totalConsultationFee || 0,
    qty: 1,
    total: appointment.totalConsultationFee || 0
  }]

  let subtotal = 0
  services.forEach((service, idx) => {
    if (idx % 2 === 0) {
      pdf.setFillColor(255, 255, 255)
    } else {
      pdf.setFillColor(249, 250, 251)
    }
    pdf.rect(leftX, yPos - 4, tableWidth, 8, 'F')
    pdf.setDrawColor(226, 232, 240)
    pdf.rect(leftX, yPos - 4, tableWidth, 8)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(30, 41, 59)

    currentX = leftX + 2
    pdf.text('1', currentX, yPos)
    currentX += colWidths[0]
    
    const descLines = pdf.splitTextToSize(service.desc, colWidths[1] - 4)
    pdf.text(descLines[0] || service.desc.substring(0, 30), currentX, yPos)
    currentX += colWidths[1]
    
    pdf.text(`${currencySymbol}${service.price.toFixed(2)}`, currentX, yPos)
    currentX += colWidths[2]
    
    pdf.text('1', currentX, yPos)
    currentX += colWidths[3]
    
    pdf.text(`${currencySymbol}${service.total.toFixed(2)}`, currentX, yPos)

    subtotal += service.total
    yPos += 8
  })

  yPos += 10

  // Summary Section
  const summaryWidth = (docWidth - 30) / 2
  const summaryRightX = leftX + summaryWidth + 10
  const shipping = 0
  const taxRate = 0
  const total = subtotal + shipping + taxRate

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(71, 85, 105)
  pdf.text('Subtotal', summaryRightX, yPos)
  pdf.text(`${currencySymbol}${subtotal.toFixed(2)}`, summaryRightX + summaryWidth - 30, yPos, { align: 'right' })
  yPos += 6

  // Total bar
  pdf.setFillColor(72, 209, 204)
  pdf.rect(summaryRightX, yPos - 2, summaryWidth - 10, 8, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(255, 255, 255)
  pdf.text('TOTAL', summaryRightX + 2, yPos + 5)
  pdf.text(`${currencySymbol}${total.toFixed(2)}`, summaryRightX + summaryWidth - 30, yPos + 5, { align: 'right' })

  yPos += 20

  // Contact Information
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(30, 41, 59)
  pdf.text('Questions:', leftX, yPos)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(71, 85, 105)
  pdf.text(`Email us: mail@yourcompany.com`, leftX, yPos + 6)
  pdf.text(`Call us: +12 345 6789 0`, leftX, yPos + 11)

  // Notes
  yPos += 20
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(30, 41, 59)
  pdf.text('Important Notes:', leftX, yPos)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(71, 85, 105)
  const notes = [
    "Please arrive 15 minutes before your appointment.",
    "Carry a valid ID and any prior medical records.",
    `Appointment Date: ${formatDate(appointment.appointmentDate)}`,
    `Appointment Time: ${safeText(appointment.appointmentTime, "Not set")}`
  ]
  notes.forEach((note, idx) => {
    pdf.text(`• ${note}`, leftX, yPos + 6 + idx * 5)
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
  const docMargin = 15 // Margin for the white document area

  const createdDate = appointment.updatedAt || appointment.createdAt
  const consultationDate = `${formatDate(appointment.appointmentDate)} at ${safeText(appointment.appointmentTime, 'Not set')}`
  const patientAge = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null

  // Light blue background (entire page)
  doc.setFillColor(173, 216, 230) // Light blue
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // White document area
  const docWidth = pageWidth - docMargin * 2
  const docHeight = pageHeight - docMargin * 2
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(200, 200, 200)
  doc.rect(docMargin, docMargin, docWidth, docHeight, 'FD')

  // Teal/mint green band at top
  doc.setFillColor(72, 209, 204) // Teal/mint green
  doc.rect(docMargin, docMargin, docWidth, 8, 'F')

  // Teal/mint green band at bottom
  doc.rect(docMargin, pageHeight - docMargin - 8, docWidth, 8, 'F')

  let yPos = docMargin + 15

  // Logo and Hospital Name Section
  const leftX = docMargin + 10
  const rightX = docMargin + docWidth - 10

  // Logo placeholder (you can add an actual logo image here)
  doc.setFillColor(147, 51, 234) // Purple
  doc.circle(leftX + 8, yPos + 5, 4, 'F')
  doc.setFillColor(72, 209, 204) // Teal
  doc.circle(leftX + 12, yPos + 5, 4, 'F')

  // Hospital Name
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(75, 85, 99) // Dark gray/purple
  doc.text('HOSPITAL', leftX, yPos + 8)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('SLOGAN HERE', leftX, yPos + 12)

  // Invoice Title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(75, 85, 99)
  doc.text('INVOICE', leftX, yPos + 20)

  // Prescription Date, ID, and Patient ID (right side)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  const prescriptionDate = formatDate(createdDate)
  doc.text(`Prescription Date: ${prescriptionDate}`, rightX, yPos + 8, { align: 'right' })
  doc.text(`Prescription ID: ${safeText(appointment.id?.substring(0, 12)?.toUpperCase(), 'N/A')}`, rightX, yPos + 13, { align: 'right' })
  doc.text(`Patient ID: ${safeText(appointment.patientId, 'N/A')}`, rightX, yPos + 18, { align: 'right' })

  yPos += 25

  // Horizontal line after logo and patient ID section
  doc.setDrawColor(200, 200, 200)
  doc.line(leftX, yPos, rightX, yPos)

  yPos += 10

  // Patient Information Section (Two Columns)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text('Patient Information', leftX, yPos)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  let infoY = yPos + 7
  const infoColumnWidth = (docWidth - 20) / 2
  const infoRightX = leftX + infoColumnWidth + 10
  
  // Left Column
  doc.text(`Name: ${safeText(appointment.patientName)}`, leftX, infoY)
  infoY += 5
  doc.text(`Age: ${patientAge ?? 'Not available'}`, leftX, infoY)
  infoY += 5
  doc.text(`Gender: ${safeText(appointment.patientGender, 'Not specified')}`, leftX, infoY)
  infoY += 5
  doc.text(`Blood Group: ${safeText(appointment.patientBloodGroup, 'Not specified')}`, leftX, infoY)
  
  // Right Column
  let infoRightY = yPos + 7
  doc.text(`Email: ${safeText(appointment.patientEmail)}`, infoRightX, infoRightY)
  infoRightY += 5
  doc.text(`Phone: ${safeText(appointment.patientPhone)}`, infoRightX, infoRightY)
  infoRightY += 5
  const address = safeText((appointment as any).patientAddress, 'Not provided')
  const addressLines = doc.splitTextToSize(`Address: ${address}`, infoColumnWidth - 10)
  addressLines.forEach((line: string, idx: number) => {
    doc.text(line, infoRightX, infoRightY + (idx * 5))
  })
  infoRightY += addressLines.length * 5
  doc.text(`Occupation: ${safeText(appointment.patientOccupation, 'Not provided')}`, infoRightX, infoRightY)

  // Use the maximum Y position from both columns
  yPos = Math.max(infoY, infoRightY) + 10

  // Doctor Information Section (Two Columns)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text('Doctor Information', leftX, yPos)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  infoY = yPos + 7
  
  // Left Column
  doc.text(`Doctor Name: Dr. ${safeText(appointment.doctorName)}`, leftX, infoY)
  infoY += 5
  doc.text(`Specialization: ${safeText(appointment.doctorSpecialization)}`, leftX, infoY)
  
  // Right Column
  infoRightY = yPos + 7
  const consultationDateLines = doc.splitTextToSize(`Consultation Date: ${consultationDate}`, infoColumnWidth - 10)
  consultationDateLines.forEach((line: string, idx: number) => {
    doc.text(line, infoRightX, infoRightY + (idx * 5))
  })

  yPos = Math.max(infoY, infoRightY + consultationDateLines.length * 5) + 15

  // Prescription Table Header (only NO. and SERVICE DESCRIPTION)
  const colWidths = [15, 150] // NO., SERVICE DESCRIPTION only
  const tableWidth = docWidth - 20
  const headerHeight = 10

  // Dark purple/blue header
  doc.setFillColor(75, 85, 99) // Dark purple/blue
  doc.rect(leftX, yPos, tableWidth, headerHeight, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  let currentX = leftX + 2
  doc.text('NO.', currentX, yPos + 7)
  currentX += colWidths[0]
  doc.text('SERVICE DESCRIPTION', currentX, yPos + 7)

  yPos += headerHeight + 2

  // Prescription Items (medicines only, no consultation, no prices)
  const structuredPrescription = parsePrescriptionText(appointment.medicine)
  let itemNumber = 1
  const medicines: Array<{ desc: string }> = []

  // Add medicines as prescription items
  if (structuredPrescription && structuredPrescription.medicines.length > 0) {
    structuredPrescription.medicines.forEach((med) => {
      let medDesc = sanitizeForPdf(med.name)
      // Format: "MedicineName a day (dosage) - Frequency"
      medDesc += ' a day'
      if (med.dosage) {
        medDesc += ` (${sanitizeForPdf(med.dosage)})`
      }
      if (med.frequency) {
        // Format frequency nicely
        const freq = sanitizeForPdf(med.frequency)
        if (freq.toLowerCase().includes('once')) {
          medDesc += ' - Once'
        } else if (freq.toLowerCase().includes('twice')) {
          medDesc += ' - Twice'
        } else if (freq.toLowerCase().includes('three times') || freq.toLowerCase().includes('3 times')) {
          medDesc += ' - Three times'
        } else if (freq.toLowerCase().includes('four times') || freq.toLowerCase().includes('4 times')) {
          medDesc += ' - Four times'
        } else {
          medDesc += ` - ${freq}`
        }
      }
      // Duration is typically not shown in the main description, but can be added if needed
      medicines.push({
        desc: medDesc
      })
    })
  } else if (appointment.medicine) {
    // If medicine is not structured, add as a single item
    medicines.push({
      desc: sanitizeForPdf(appointment.medicine)
    })
  }

  medicines.forEach((medicine, idx) => {
    if (yPos > pageHeight - docMargin - 100) {
      doc.addPage()
      // Redraw background and bands on new page
      doc.setFillColor(173, 216, 230)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')
      doc.setFillColor(255, 255, 255)
      doc.rect(docMargin, docMargin, docWidth, docHeight, 'FD')
      doc.setFillColor(72, 209, 204)
      doc.rect(docMargin, docMargin, docWidth, 8, 'F')
      doc.rect(docMargin, pageHeight - docMargin - 8, docWidth, 8, 'F')
      yPos = docMargin + 15
    }

    // Row background (alternate)
    if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255)
    } else {
      doc.setFillColor(249, 250, 251)
    }
    doc.rect(leftX, yPos - 4, tableWidth, 8, 'F')
    doc.setDrawColor(226, 232, 240)
    doc.rect(leftX, yPos - 4, tableWidth, 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(30, 41, 59)

    currentX = leftX + 2
    doc.text(String(itemNumber), currentX, yPos)
    currentX += colWidths[0]
    
    const descLines = doc.splitTextToSize(medicine.desc, colWidths[1] - 4)
    // Use first line, but allow wrapping if needed
    if (descLines.length > 0) {
      doc.text(descLines[0], currentX, yPos)
      // If text wraps, add more lines
      if (descLines.length > 1 && yPos + 6 < pageHeight - docMargin - 20) {
        descLines.slice(1).forEach((line: string, lineIdx: number) => {
          doc.text(line, currentX, yPos + 5 + (lineIdx * 5))
        })
        yPos += (descLines.length - 1) * 5
      }
    }

    itemNumber++
    yPos += 10 // Increased spacing between rows
  })

  yPos += 10

  // Invoice Summary (Right side only, no Terms and Conditions here)
  const summaryWidth = (docWidth - 30) / 2
  const summaryRightX = leftX + summaryWidth + 10
  const consultationFee = appointment.totalConsultationFee || 0
  const total = consultationFee

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text('Subtotal', summaryRightX, yPos)
  // Use INR instead of ₹ symbol to avoid rendering issues
  doc.text(`INR ${consultationFee.toFixed(2)}`, summaryRightX + summaryWidth - 10, yPos, { align: 'right' })
  yPos += 8

  // Total bar (teal/mint green)
  doc.setFillColor(72, 209, 204) // Teal/mint green
  doc.rect(summaryRightX, yPos - 2, summaryWidth - 10, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text('TOTAL', summaryRightX + 2, yPos + 5)
  doc.text(`INR ${total.toFixed(2)}`, summaryRightX + summaryWidth - 10, yPos + 5, { align: 'right' })

  yPos += 15

  // Contact and Payment Information
  const contactY = yPos
  const contactWidth = (docWidth - 30) / 2

  // Questions Section (Left)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text('Questions:', leftX, contactY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(`Email us: mail@yourcompany.com`, leftX, contactY + 6)
  doc.text(`Call us: +12 345 6789 0`, leftX, contactY + 11)

  // Payment Info Section (Right)
  const paymentRightX = leftX + contactWidth + 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text('Payment Info:', paymentRightX, contactY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text(`Account #: ${safeText(appointment.transactionId?.substring(0, 15), '1234 5677 5432')}`, paymentRightX, contactY + 6)
  doc.text(`A/C Name: ${safeText(appointment.patientName)}`, paymentRightX, contactY + 11)
  doc.text(`Bank Details: Add your bank details`, paymentRightX, contactY + 16)

  // Terms and Conditions at the bottom (on the same page)
  // Calculate available space and position terms to fit on current page
  const termsText = 'The origins of the first constellations date back to prehistoric times. Their purpose was to tell stories of their beliefs, experiences, creation, or mythology. The recognition of constellations has changed over time. They varied in size or shape, others became popular and then were forgotten.'
  const termsLines = doc.splitTextToSize(termsText, docWidth - 20)
  const termsHeight = 6 + (termsLines.length * 4) + 5 // Header + text + spacing
  
  // Position terms at the bottom, but ensure it fits on current page
  let termsY = pageHeight - docMargin - 8 - termsHeight - 5 // Above bottom band with some spacing
  
  // If terms would overlap with other content, position it right after Payment Info
  if (termsY < contactY + 25) {
    termsY = contactY + 25
  }
  
  // If still doesn't fit, reduce spacing but keep on same page
  if (termsY + termsHeight > pageHeight - docMargin - 8) {
    termsY = pageHeight - docMargin - 8 - termsHeight - 2 // Minimal spacing above bottom band
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.text('Terms and Conditions', leftX, termsY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  termsLines.forEach((line: string, idx: number) => {
    doc.text(line, leftX, termsY + 6 + idx * 4)
  })

  // Signature Area (above Terms and Conditions)
  const signatureY = termsY - 15
  doc.setDrawColor(200, 200, 200)
  doc.line(paymentRightX, signatureY, paymentRightX + contactWidth - 10, signatureY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  doc.text('Authorised Sign', paymentRightX, signatureY + 6)

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

// ============================================================================
// Patient Reports PDF
// ============================================================================

interface AppointmentData {
  id: string
  appointmentDate: string
  appointmentTime: string
  doctorName: string
  doctorSpecialization: string
  status: string
  chiefComplaint?: string
  totalConsultationFee?: number
  paymentStatus?: string
  paymentAmount?: number
}

interface PatientReportData {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  gender: string
  bloodGroup: string
  address: string
  dateOfBirth: string
  createdAt: string
  status: string
  defaultBranchName?: string
  appointments?: AppointmentData[]
  totalAppointments?: number
}

interface PatientReportOptions {
  title: string
  dateRange: string
  totalPatients: number
}

export function generatePatientReportPDF(
  patients: PatientReportData[],
  options: PatientReportOptions
): string {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  let yPos = margin

  // Header
  pdf.setFillColor(45, 55, 72)
  pdf.rect(0, 0, pageWidth, 50, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Patient Report', pageWidth / 2, 20, { align: 'center' })

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(options.title, pageWidth / 2, 32, { align: 'center' })
  pdf.text(`Date Range: ${options.dateRange}`, pageWidth / 2, 38, { align: 'center' })
  pdf.text(`Total Patients: ${options.totalPatients}`, pageWidth / 2, 44, { align: 'center' })

  yPos = 60

  // Table headers
  const colWidths = [25, 40, 50, 35, 30, 25, 35, 45, 30]
  const headers = ['S.No', 'Name', 'Email', 'Phone', 'Gender', 'DOB', 'Blood Group', 'Address', 'Status']
  const startX = margin

  pdf.setFillColor(241, 245, 249)
  pdf.rect(startX, yPos, pageWidth - 2 * margin, 12, 'F')
  pdf.setDrawColor(203, 213, 225)
  pdf.rect(startX, yPos, pageWidth - 2 * margin, 12)

  pdf.setTextColor(30, 41, 59)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')

  let currentX = startX + 2
  headers.forEach((header, index) => {
    pdf.text(header, currentX, yPos + 8)
    currentX += colWidths[index]
  })

  yPos += 15

  // Table rows
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(71, 85, 105)

  patients.forEach((patient, index) => {
    // Check if we need a new page
    if (yPos > pageHeight - 30) {
      pdf.addPage()
      yPos = margin

      // Redraw headers on new page
      pdf.setFillColor(241, 245, 249)
      pdf.rect(startX, yPos, pageWidth - 2 * margin, 12, 'F')
      pdf.setDrawColor(203, 213, 225)
      pdf.rect(startX, yPos, pageWidth - 2 * margin, 12)

      pdf.setTextColor(30, 41, 59)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      currentX = startX + 2
      headers.forEach((header) => {
        pdf.text(header, currentX, yPos + 8)
        currentX += colWidths[headers.indexOf(header)]
      })
      yPos += 15
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(71, 85, 105)
    }

    const rowData = [
      String(index + 1),
      `${patient.firstName} ${patient.lastName}`.substring(0, 18),
      patient.email?.substring(0, 22) || 'N/A',
      patient.phone?.substring(0, 12) || 'N/A',
      patient.gender || 'N/A',
      patient.dateOfBirth ? formatDate(patient.dateOfBirth, { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A',
      patient.bloodGroup || 'N/A',
      patient.address?.substring(0, 25) || 'N/A',
      String(patient.totalAppointments || patient.appointments?.length || 0),
      patient.status || 'active'
    ]

    // Draw row background (alternate colors)
    if (index % 2 === 0) {
      pdf.setFillColor(255, 255, 255)
    } else {
      pdf.setFillColor(249, 250, 251)
    }
    pdf.rect(startX, yPos - 5, pageWidth - 2 * margin, 10, 'F')
    pdf.setDrawColor(226, 232, 240)
    pdf.rect(startX, yPos - 5, pageWidth - 2 * margin, 10)

    currentX = startX + 2
    rowData.forEach((cell, cellIndex) => {
      const lines = pdf.splitTextToSize(cell, colWidths[cellIndex] - 2)
      pdf.text(lines[0] || '', currentX, yPos)
      currentX += colWidths[cellIndex]
    })

    yPos += 10
  })

  // Add appointment details section if any patient has appointments
  const patientsWithAppointments = patients.filter(p => p.appointments && p.appointments.length > 0)
  if (patientsWithAppointments.length > 0) {
    // Check if we need a new page
    if (yPos > pageHeight - 100) {
      pdf.addPage()
      yPos = margin
    }

    yPos += 15
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(30, 41, 59)
    pdf.text('Appointment Details', startX, yPos)
    yPos += 10

    patientsWithAppointments.forEach((patient) => {
      if (!patient.appointments || patient.appointments.length === 0) return

      // Check if we need a new page
      if (yPos > pageHeight - 60) {
        pdf.addPage()
        yPos = margin
      }

      // Patient name header
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(30, 41, 59)
      pdf.text(`${patient.firstName} ${patient.lastName} (${patient.totalAppointments || patient.appointments.length} appointment${(patient.totalAppointments || patient.appointments.length) > 1 ? 's' : ''})`, startX, yPos)
      yPos += 8

      // Appointment table headers
      const aptColWidths = [30, 25, 45, 40, 25, 30, 35]
      const aptHeaders = ['Date', 'Time', 'Doctor', 'Specialization', 'Status', 'Fee', 'Payment']
      
      pdf.setFillColor(241, 245, 249)
      pdf.rect(startX, yPos, pageWidth - 2 * margin, 10, 'F')
      pdf.setDrawColor(203, 213, 225)
      pdf.rect(startX, yPos, pageWidth - 2 * margin, 10)

      pdf.setTextColor(30, 41, 59)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')

      let currentX = startX + 2
      aptHeaders.forEach((header, idx) => {
        pdf.text(header, currentX, yPos + 7)
        currentX += aptColWidths[idx]
      })

      yPos += 12

      // Appointment rows (show first 5, or all if fewer)
      const appointmentsToShow = patient.appointments.slice(0, 5)
      appointmentsToShow.forEach((apt, aptIndex) => {
        if (yPos > pageHeight - 30) {
          pdf.addPage()
          yPos = margin + 10
          
          // Redraw headers
          pdf.setFillColor(241, 245, 249)
          pdf.rect(startX, yPos, pageWidth - 2 * margin, 10, 'F')
          pdf.setDrawColor(203, 213, 225)
          pdf.rect(startX, yPos, pageWidth - 2 * margin, 10)
          
          currentX = startX + 2
          aptHeaders.forEach((header) => {
            pdf.text(header, currentX, yPos + 7)
            currentX += aptColWidths[aptHeaders.indexOf(header)]
          })
          yPos += 12
        }

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(71, 85, 105)

        // Row background
        if (aptIndex % 2 === 0) {
          pdf.setFillColor(255, 255, 255)
        } else {
          pdf.setFillColor(249, 250, 251)
        }
        pdf.rect(startX, yPos - 4, pageWidth - 2 * margin, 8, 'F')
        pdf.setDrawColor(226, 232, 240)
        pdf.rect(startX, yPos - 4, pageWidth - 2 * margin, 8)

        const aptRowData = [
          formatDate(apt.appointmentDate, { year: 'numeric', month: '2-digit', day: '2-digit' }),
          apt.appointmentTime?.substring(0, 5) || 'N/A',
          apt.doctorName?.substring(0, 20) || 'N/A',
          apt.doctorSpecialization?.substring(0, 18) || 'N/A',
          apt.status || 'pending',
          apt.totalConsultationFee ? `₹${apt.totalConsultationFee}` : 'N/A',
          apt.paymentStatus || 'pending'
        ]

        currentX = startX + 2
        aptRowData.forEach((cell, cellIndex) => {
          const lines = pdf.splitTextToSize(cell, aptColWidths[cellIndex] - 2)
          pdf.text(lines[0] || '', currentX, yPos)
          currentX += aptColWidths[cellIndex]
        })

        yPos += 9
      })

      if (patient.appointments.length > 5) {
        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(7)
        pdf.setTextColor(148, 163, 184)
        pdf.text(`... and ${patient.appointments.length - 5} more appointment(s)`, startX + 2, yPos)
        yPos += 6
      }

      yPos += 5
    })
  }

  // Footer
  const footerY = pageHeight - 15
  pdf.setDrawColor(203, 213, 225)
  pdf.line(margin, footerY, pageWidth - margin, footerY)

  pdf.setFontSize(8)
  pdf.setTextColor(148, 163, 184)
  pdf.setFont('helvetica', 'italic')
  pdf.text(
    `Generated on: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`,
    pageWidth / 2,
    footerY + 8,
    { align: 'center' }
  )

  return pdf.output('datauristring')
}

