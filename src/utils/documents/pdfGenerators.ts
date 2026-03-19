/**
 * PDF Generation Utilities
 * Shared helpers and PDF generators for appointments and prescriptions
 */

import jsPDF from "jspdf"
import { Appointment } from "@/types/patient"
import { calculateAge } from "@/utils/shared/date"
import { formatDateForPDF } from "@/utils/shared/timezone"

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

/** Convert legacy frequency (Once, Twice) to Morning/Afternoon/Evening with Before/After meal */
function formatFrequencyForPdf(freq: string): string {
  const f = (freq || "").trim()
  if (!f) return ""
  // Already in Morning/Afternoon/Evening with meal format - use as-is
  if (/morning|afternoon|evening|night/i.test(f) && /meal/i.test(f)) {
    return f
  }
  // Convert legacy format to new format
  const lower = f.toLowerCase()
  if (lower.includes("once")) return "Morning - After meal"
  if (lower.includes("twice")) return "Morning - After meal, Evening - After meal"
  if (lower.includes("three times") || lower.includes("3 times"))
    return "Morning - After meal, Afternoon - After meal, Evening - After meal"
  if (lower.includes("four times") || lower.includes("4 times"))
    return "Morning - Before meal, Afternoon - After meal, Evening - After meal, Night - After meal"
  if (lower.includes("daily")) return "Morning - After meal"
  return f
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
      // Avoid "a day a day" if name already contains it
      if (!/\b a day\b$/i.test(medDesc)) {
        medDesc += " a day"
      }
      if (med.dosage) {
        medDesc += ` (${sanitizeForPdf(med.dosage)})`
      }
      if (med.frequency) {
        const freq = formatFrequencyForPdf(sanitizeForPdf(med.frequency))
        if (freq) {
          medDesc += ` - ${freq}`
        }
      }
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
  if (typeof window === "undefined") return
  void generatePrescriptionPDFWithHtml(appointment)
}

function escapeHtmlText(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function sanitizeFileSegment(value: string, fallback: string): string {
  const cleaned = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
  return cleaned || fallback
}

function buildPrescriptionHTML(appointment: Appointment): string {
  const createdDate = appointment.updatedAt || appointment.createdAt
  const patientAge = appointment.patientDateOfBirth ? calculateAge(appointment.patientDateOfBirth) : null
  const consultationDate = formatDate(appointment.appointmentDate)
  const consultationTime = safeText(appointment.appointmentTime, "Not set")
  const parsed = parsePrescriptionText(appointment.medicine)
  const rows = (parsed?.medicines || []).map((med, idx) => {
    const freq = med.frequency ? formatFrequencyForPdf(sanitizeForPdf(med.frequency)) : "As advised"
    return `
      <tr>
        <td class="num">${idx + 1}</td>
        <td>${escapeHtmlText(sanitizeForPdf(med.name || "Medicine"))}</td>
        <td>${escapeHtmlText(sanitizeForPdf(med.dosage || "—"))}</td>
        <td>${escapeHtmlText(sanitizeForPdf(freq || "As advised"))}</td>
        <td>${escapeHtmlText(sanitizeForPdf(med.duration || "As advised"))}</td>
      </tr>
    `
  }).join("")

  const fallbackRow = `
    <tr>
      <td class="num">1</td>
      <td>${escapeHtmlText(sanitizeForPdf(appointment.medicine || "Not provided"))}</td>
      <td>—</td>
      <td>As advised</td>
      <td>As advised</td>
    </tr>
  `

  const advice = escapeHtmlText(
    sanitizeForPdf(parsed?.advice || appointment.doctorNotes || "Take medicines as directed by your doctor.")
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prescription</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px;
      background: #eef2f7;
      color: #0f172a;
      font-family: "Inter", "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 12.5px;
      line-height: 1.45;
    }
    .sheet {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #dbe4ef;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(2, 6, 23, 0.08);
      overflow: hidden;
    }
    .header {
      padding: 16px 20px;
      background: linear-gradient(110deg, #0f4c81 0%, #155e75 58%, #0f766e 100%);
      color: #fff;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: start;
    }
    .title { font-size: 24px; font-weight: 700; letter-spacing: 0.3px; margin: 0; }
    .subtitle { margin-top: 4px; color: rgba(255,255,255,.88); font-size: 12px; }
    .meta { text-align: right; font-size: 12px; }
    .meta .row { margin: 2px 0; color: rgba(255,255,255,.9); }
    .meta b { color: #fff; font-weight: 600; }
    .section {
      margin: 14px 20px 0;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      padding: 12px;
    }
    .section h3 {
      margin: 0 0 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .35px;
      color: #334155;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 18px;
    }
    .field b { color: #0f172a; font-weight: 600; }
    .field span { color: #334155; }
    .table-wrap { margin: 14px 20px 0; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 9px 8px; text-align: left; vertical-align: top; }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 600;
      border-top: 1px solid #e2e8f0;
    }
    th:first-child, td:first-child { border-left: 1px solid #e2e8f0; width: 8%; }
    th:last-child, td:last-child { border-right: 1px solid #e2e8f0; width: 17%; }
    td:nth-child(2) { width: 30%; word-break: break-word; overflow-wrap: anywhere; }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) { word-break: break-word; overflow-wrap: anywhere; }
    tr:nth-child(even) td { background: #fcfdff; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .advice {
      margin: 12px 20px 0;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #f8fafc;
      padding: 10px 12px;
      color: #334155;
    }
    .advice b { color: #0f172a; }
    .footer {
      margin: 14px 20px 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 10px;
    }
    .muted { color: #64748b; font-size: 11.5px; }
    .sign {
      min-width: 180px;
      text-align: center;
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      color: #475569;
      font-size: 11.5px;
      font-weight: 600;
    }
    @page { size: A4; margin: 10mm; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { max-width: none; box-shadow: none; border-radius: 0; border: 0; }
      tr, td, th { break-inside: avoid; page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="sheet" id="prescription-root">
    <section class="header">
      <div>
        <h1 class="title">Prescription</h1>
        <div class="subtitle">Clinical Medication Summary</div>
      </div>
      <div class="meta">
        <div class="row"><b>Prescription ID:</b> ${escapeHtmlText(safeText(appointment.id?.substring(0, 12)?.toUpperCase(), "N/A"))}</div>
        <div class="row"><b>Date:</b> ${escapeHtmlText(formatDate(createdDate))}</div>
      </div>
    </section>

    <section class="section">
      <h3>Patient Information</h3>
      <div class="grid">
        <div class="field"><b>Name:</b> <span>${escapeHtmlText(safeText(appointment.patientName))}</span></div>
        <div class="field"><b>Patient ID:</b> <span>${escapeHtmlText(safeText(appointment.patientId, "N/A"))}</span></div>
        <div class="field"><b>Age:</b> <span>${escapeHtmlText(patientAge != null ? String(patientAge) : "Not available")}</span></div>
        <div class="field"><b>Gender:</b> <span>${escapeHtmlText(safeText(appointment.patientGender, "Not specified"))}</span></div>
        <div class="field"><b>Phone:</b> <span>${escapeHtmlText(safeText(appointment.patientPhone))}</span></div>
        <div class="field"><b>Blood Group:</b> <span>${escapeHtmlText(safeText(appointment.patientBloodGroup, "Not specified"))}</span></div>
      </div>
    </section>

    <section class="section">
      <h3>Doctor Information</h3>
      <div class="grid">
        <div class="field"><b>Doctor:</b> <span>Dr. ${escapeHtmlText(safeText(appointment.doctorName))}</span></div>
        <div class="field"><b>Specialization:</b> <span>${escapeHtmlText(safeText(appointment.doctorSpecialization))}</span></div>
        <div class="field"><b>Consultation Date:</b> <span>${escapeHtmlText(consultationDate)}</span></div>
        <div class="field"><b>Consultation Time:</b> <span>${escapeHtmlText(consultationTime)}</span></div>
      </div>
    </section>

    <section class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">No.</th>
            <th>Medicine</th>
            <th>Dosage</th>
            <th>Frequency</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${rows || fallbackRow}
        </tbody>
      </table>
    </section>

    <section class="advice"><b>Advice:</b> ${advice}</section>

    <footer class="footer">
      <div class="muted">This is a computer-generated prescription.</div>
      <div class="sign">Authorised Sign</div>
    </footer>
  </div>
</body>
</html>`
}

async function ensureHtml2PdfLoadedForPrescription(): Promise<any> {
  if (typeof window === "undefined") return null
  const w = window as Window & { html2pdf?: any }
  if (w.html2pdf) return w.html2pdf
  try {
    const mod = await import("html2pdf.js")
    const html2pdf = (mod as any)?.default ?? (mod as any)
    if (typeof html2pdf === "function") {
      w.html2pdf = html2pdf
      return html2pdf
    }
  } catch {
    // ignore and throw below
  }
  throw new Error("Failed to load html2pdf.js")
}

async function generatePrescriptionPDFWithHtml(appointment: Appointment): Promise<void> {
  const html2pdf = await ensureHtml2PdfLoadedForPrescription()
  if (!html2pdf) throw new Error("html2pdf.js is not available")

  const wrapper = document.createElement("div")
  wrapper.style.position = "fixed"
  wrapper.style.left = "-100000px"
  wrapper.style.top = "0"
  wrapper.style.width = "210mm"
  wrapper.style.background = "#ffffff"
  wrapper.innerHTML = buildPrescriptionHTML(appointment)
  document.body.appendChild(wrapper)

  const element = wrapper.querySelector("#prescription-root") as HTMLElement | null
  if (!element) {
    document.body.removeChild(wrapper)
    throw new Error("Unable to build prescription template")
  }

  const patientPart = sanitizeFileSegment(safeText(appointment.patientName, "Patient"), "Patient")
  const datePart = sanitizeFileSegment(String(appointment.appointmentDate || ""), String(Date.now()))
  const filename = `Prescription_${patientPart}_${datePart}.pdf`

  const options = {
    margin: [6, 6, 6, 6],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      letterRendering: true,
      scrollX: 0,
      scrollY: 0,
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    },
    pagebreak: {
      mode: ["css", "legacy"],
      avoid: ["tr", "td", ".section", ".advice", ".footer"],
    },
  }

  try {
    await html2pdf().set(options).from(element).save()
  } finally {
    document.body.removeChild(wrapper)
  }
}

/**
 * Generate prescription PDF as Buffer for server-side use (e.g. WhatsApp document, API response)
 */
export function getPrescriptionPDFBuffer(appointment: Appointment): Buffer {
  const doc = createPrescriptionDocument(appointment, { forPreview: true })
  const output = doc.output("arraybuffer")
  return Buffer.from(output as ArrayBuffer)
}


