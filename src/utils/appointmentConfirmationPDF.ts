import jsPDF from "jspdf"

export function generateAppointmentConfirmationPDF(appointment: any) {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  
  // Header
  pdf.setFillColor(45, 55, 72) // slate-800
  pdf.rect(0, 0, pageWidth, 40, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Appointment Confirmation', pageWidth / 2, 25, { align: 'center' })
  
  // Success Icon
  pdf.setFontSize(40)
  pdf.text('✓', pageWidth / 2, 60, { align: 'center' })
  
  // Appointment Details
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('APPOINTMENT DETAILS', 20, 80)
  
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  let yPos = 95
  
  pdf.text(`Patient Name: ${appointment.patientName}`, 20, yPos)
  yPos += 10
  pdf.text(`Doctor: Dr. ${appointment.doctorName}`, 20, yPos)
  yPos += 10
  pdf.text(`Specialization: ${appointment.doctorSpecialization}`, 20, yPos)
  yPos += 10
  pdf.text(`Date: ${new Date(appointment.appointmentDate).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}`, 20, yPos)
  yPos += 10
  pdf.text(`Time: ${appointment.appointmentTime}`, 20, yPos)
  
  // Payment Details
  yPos += 20
  pdf.setFont('helvetica', 'bold')
  pdf.text('PAYMENT DETAILS', 20, yPos)
  
  pdf.setFont('helvetica', 'normal')
  yPos += 15
  pdf.text(`Transaction ID: ${appointment.transactionId}`, 20, yPos)
  yPos += 10
  pdf.text(`Amount Paid: ₹${appointment.paymentAmount}`, 20, yPos)
  
  if (appointment.paymentType === 'partial' && appointment.remainingAmount) {
    yPos += 10
    pdf.setTextColor(255, 100, 0)
    pdf.text(`Remaining to Pay at Hospital: ₹${appointment.remainingAmount}`, 20, yPos)
    pdf.setTextColor(0, 0, 0)
  }
  
  // Footer
  yPos += 25
  pdf.setFontSize(10)
  pdf.setTextColor(100, 100, 100)
  pdf.text('Please arrive 15 minutes before your appointment time.', 20, yPos)
  yPos += 7
  pdf.text('Bring this confirmation and a valid ID.', 20, yPos)
  
  yPos += 15
  pdf.text(`Booking Date: ${new Date(appointment.createdAt).toLocaleString()}`, 20, yPos)
  
  // Download
  pdf.save(`Appointment-Confirmation-${appointment.transactionId}.pdf`)
}

