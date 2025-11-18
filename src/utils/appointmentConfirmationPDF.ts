import jsPDF from "jspdf"
import { Appointment } from "@/types/patient"

const safeText = (value?: string | number | null, fallback = "Not provided") => {
  if (value === null || value === undefined) return fallback
  const str = typeof value === "string" ? value.trim() : String(value)
  return str.length ? str : fallback
}

const formatDate = (value?: string, options?: Intl.DateTimeFormatOptions) => {
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

const formatCurrency = (amount?: number | null) => {
  const safeAmount = typeof amount === "number" ? amount : 0
  return `INR ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0 }).format(safeAmount)}`
}

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
    const startY = yPos
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