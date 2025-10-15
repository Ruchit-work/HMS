/**
 * Prescription PDF Generator
 * Creates professional medical prescription PDFs
 * Design: Clean, official, medical-grade format
 */

import jsPDF from 'jspdf'
import { Appointment } from '@/types/patient'

export function generatePrescriptionPDF(appointment: Appointment) {
  // Create new PDF document (A4 size)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20

  // Colors
  const primaryColor = '#14b8a6' // Teal
  const darkGray = '#1e293b'
  const mediumGray = '#64748b'
  const lightGray = '#f1f5f9'

  // Header - HMS Logo and Title
  doc.setFillColor(20, 184, 166) // Teal
  doc.rect(0, 0, pageWidth, 40, 'F')
  
  // HMS Logo Box
  doc.setFillColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setTextColor(255, 255, 255)
  doc.text('HMS', margin, 15)
  
  doc.setFontSize(10)
  doc.text('Hospital Management System', margin, 22)
  doc.text('Medical Prescription', margin, 28)
  
  // Right side - Date
  doc.setFontSize(9)
  doc.text(
    `Date: ${new Date(appointment.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`,
    pageWidth - margin - 50,
    15,
    { align: 'right' }
  )
  
  doc.text(`Prescription ID: ${appointment.id.substring(0, 12).toUpperCase()}`, pageWidth - margin - 50, 21, { align: 'right' })

  let yPos = 50

  // Doctor Information Section
  doc.setFillColor(241, 245, 249) // Light gray
  doc.rect(margin, yPos, pageWidth - 2 * margin, 30, 'F')
  
  doc.setFontSize(12)
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.text('Doctor Information', margin + 5, yPos + 7)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Dr. ${appointment.doctorName}`, margin + 5, yPos + 14)
  doc.text(`Specialization: ${appointment.doctorSpecialization}`, margin + 5, yPos + 20)
  doc.text(`Consultation Date: ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}`, margin + 5, yPos + 26)

  yPos += 40

  // Patient Information Section
  doc.setFillColor(241, 245, 249)
  doc.rect(margin, yPos, pageWidth - 2 * margin, 25, 'F')
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Patient Information', margin + 5, yPos + 7)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Name: ${appointment.patientName}`, margin + 5, yPos + 14)
  doc.text(`Email: ${appointment.patientEmail}`, margin + 5, yPos + 20)

  yPos += 35

  // Chief Complaint Section
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 41, 59)
  doc.text('Chief Complaint', margin, yPos)
  
  yPos += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  
  const complaintLines = doc.splitTextToSize(appointment.chiefComplaint, pageWidth - 2 * margin)
  doc.text(complaintLines, margin, yPos)
  yPos += complaintLines.length * 5 + 5

  // Medical History (if available)
  if (appointment.medicalHistory) {
    yPos += 5
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('Medical History', margin, yPos)
    
    yPos += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    
    const historyLines = doc.splitTextToSize(appointment.medicalHistory, pageWidth - 2 * margin)
    doc.text(historyLines, margin, yPos)
    yPos += historyLines.length * 5 + 5
  }

  yPos += 10

  // Prescription Section - Highlighted
  doc.setFillColor(16, 185, 129) // Green
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('💊 PRESCRIBED MEDICINES', margin + 5, yPos + 6)
  
  yPos += 15
  
  if (appointment.medicine) {
    doc.setFillColor(240, 253, 244) // Light green
    doc.rect(margin, yPos, pageWidth - 2 * margin, 5, 'F')
    yPos += 7
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    
    const medicineLines = doc.splitTextToSize(appointment.medicine, pageWidth - 2 * margin - 10)
    doc.text(medicineLines, margin + 5, yPos)
    yPos += medicineLines.length * 5 + 10
  } else {
    doc.setFontSize(10)
    doc.setTextColor(148, 163, 184)
    doc.text('No medicines prescribed', margin + 5, yPos + 5)
    yPos += 15
  }

  // Doctor's Notes Section
  if (appointment.doctorNotes) {
    doc.setFillColor(59, 130, 246) // Blue
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('📝 DOCTOR\'S NOTES', margin + 5, yPos + 6)
    
    yPos += 15
    
    doc.setFillColor(239, 246, 255) // Light blue
    doc.rect(margin, yPos, pageWidth - 2 * margin, 5, 'F')
    yPos += 7
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    
    const notesLines = doc.splitTextToSize(appointment.doctorNotes, pageWidth - 2 * margin - 10)
    doc.text(notesLines, margin + 5, yPos)
    yPos += notesLines.length * 5 + 10
  }

  // Footer - Important Notes
  yPos = doc.internal.pageSize.getHeight() - 40
  
  doc.setDrawColor(203, 213, 225)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 7
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('Important Instructions:', margin, yPos)
  yPos += 5
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('• Follow the prescribed dosage and duration strictly', margin + 5, yPos)
  yPos += 4
  doc.text('• Complete the full course of antibiotics (if prescribed)', margin + 5, yPos)
  yPos += 4
  doc.text('• Contact doctor immediately if you experience any adverse reactions', margin + 5, yPos)
  yPos += 4
  doc.text('• Follow-up as advised by your doctor', margin + 5, yPos)

  // Bottom Footer
  yPos += 10
  doc.setDrawColor(203, 213, 225)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 5
  
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('HMS - Hospital Management System | Professional Healthcare Solutions', pageWidth / 2, yPos, { align: 'center' })
  yPos += 4
  doc.text('This is an official medical prescription. Keep it safe for your records.', pageWidth / 2, yPos, { align: 'center' })

  // Doctor Signature Section
  yPos -= 15
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'italic')
  doc.text('_____________________', pageWidth - margin - 40, yPos - 5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Dr. ${appointment.doctorName}`, pageWidth - margin - 40, yPos + 1)
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(appointment.doctorSpecialization, pageWidth - margin - 40, yPos + 5)

  // Generate filename
  const fileName = `Prescription_${appointment.patientName.replace(/\s+/g, '_')}_${new Date(appointment.appointmentDate).toISOString().split('T')[0]}.pdf`

  // Save the PDF
  doc.save(fileName)
}

// Preview prescription (opens in new tab instead of downloading)
export function previewPrescriptionPDF(appointment: Appointment) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Use same generation logic as above
  generatePrescriptionPDF(appointment)
  
  // Open in new window instead of downloading
  const pdfBlob = doc.output('blob')
  const url = URL.createObjectURL(pdfBlob)
  window.open(url, '_blank')
}

