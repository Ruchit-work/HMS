/**
 * Excel Generation Utilities
 * For generating Excel reports (patient reports, etc.)
 */

import ExcelJS from 'exceljs'

interface AppointmentData {
  id: string
  appointmentDate: string
  appointmentTime: string
  doctorName: string
  doctorSpecialization: string
  status: string
  chiefComplaint?: string
  medicine?: string
  doctorNotes?: string
  finalDiagnosis?: string[]
  customDiagnosis?: string
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

export async function generatePatientReportExcel(
  patients: PatientReportData[],
  options: PatientReportOptions
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Patient Report')

  // Set worksheet properties
  worksheet.properties.defaultRowHeight = 20

  // Add title and metadata rows
  worksheet.mergeCells('A1:M1')
  const titleRow = worksheet.getRow(1)
  titleRow.getCell(1).value = options.title
  titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleRow.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2D3748' }
  }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
  titleRow.height = 30

  worksheet.mergeCells('A2:N2')
  const dateRangeRow = worksheet.getRow(2)
  dateRangeRow.getCell(1).value = `Date Range: ${options.dateRange}`
  dateRangeRow.getCell(1).font = { size: 11, bold: true }
  dateRangeRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
  dateRangeRow.height = 25

  worksheet.mergeCells('A3:N3')
  const totalRow = worksheet.getRow(3)
  totalRow.getCell(1).value = `Total Patients: ${options.totalPatients}`
  totalRow.getCell(1).font = { size: 11, bold: true }
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
  totalRow.height = 25

  // Empty row
  worksheet.getRow(4).height = 10

  // Headers
  const headers = [
    'S.No',
    'Patient ID',
    'Name',
    'Email',
    'Phone',
    'Gender',
    'Date of Birth',
    'Age',
    'Blood Group',
    'Address',
    'Branch',
    'Total Appointments',
    'Status',
    'Registration Date'
  ]

  const headerRow = worksheet.getRow(5)
  headerRow.values = headers
  headerRow.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4299E1' }
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  headerRow.height = 30

  // Calculate age helper
  const calculateAge = (dateOfBirth?: string): number | null => {
    if (!dateOfBirth) return null
    const dob = new Date(dateOfBirth)
    if (isNaN(dob.getTime())) return null
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }
    return age
  }

  // Format date helper
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  // Add data rows
  patients.forEach((patient, index) => {
    const row = worksheet.addRow([
      index + 1,
      patient.id,
      `${patient.firstName} ${patient.lastName}`,
      patient.email || 'N/A',
      patient.phone || 'N/A',
      patient.gender || 'N/A',
      formatDate(patient.dateOfBirth),
      calculateAge(patient.dateOfBirth) || 'N/A',
      patient.bloodGroup || 'N/A',
      patient.address || 'N/A',
      patient.defaultBranchName || 'N/A',
      patient.totalAppointments || patient.appointments?.length || 0,
      patient.status || 'active',
      formatDate(patient.createdAt)
    ])

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF7FAFC' }
      }
    }

    row.alignment = { vertical: 'middle', wrapText: true }
    row.height = 25

    // Set specific column alignments
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' } // S.No
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' } // Gender
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' } // DOB
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' } // Age
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' } // Blood Group
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' } // Branch
    row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' } // Total Appointments
    row.getCell(13).alignment = { vertical: 'middle', horizontal: 'center' } // Status
    row.getCell(14).alignment = { vertical: 'middle', horizontal: 'center' } // Registration Date
  })

  // Set column widths
  worksheet.columns = [
    { width: 8 },  // S.No
    { width: 15 }, // Patient ID
    { width: 25 }, // Name
    { width: 30 }, // Email
    { width: 15 }, // Phone
    { width: 12 }, // Gender
    { width: 15 }, // DOB
    { width: 8 },  // Age
    { width: 12 }, // Blood Group
    { width: 40 }, // Address
    { width: 20 }, // Branch
    { width: 18 }, // Total Appointments
    { width: 12 }, // Status
    { width: 18 }  // Registration Date
  ]

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 5 }]

  // Add borders to all cells with data
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 5) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
      })
    }
  })

  // Footer row
  const footerRow = worksheet.addRow([])
  footerRow.height = 20

  // Add appointment details sheet if any patient has appointments
  const patientsWithAppointments = patients.filter(p => p.appointments && p.appointments.length > 0)
  if (patientsWithAppointments.length > 0) {
    const appointmentSheet = workbook.addWorksheet('Appointments')
    appointmentSheet.properties.defaultRowHeight = 20

    // Title
    appointmentSheet.mergeCells('A1:H1')
    const titleRow = appointmentSheet.getRow(1)
    titleRow.getCell(1).value = 'Patient Appointments'
    titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleRow.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4299E1' }
    }
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
    titleRow.height = 30

    // Headers
    const aptHeaders = [
      'Patient Name',
      'Appointment Date',
      'Time',
      'Doctor',
      'Specialization',
      'Status',
      'Chief Complaint',
      'Prescription',
      'Diagnosis',
      'Doctor Notes',
      'Consultation Fee',
      'Payment Status'
    ]

    const aptHeaderRow = appointmentSheet.getRow(3)
    aptHeaderRow.values = aptHeaders
    aptHeaderRow.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    aptHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4299E1' }
    }
    aptHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    aptHeaderRow.height = 30

    // Add appointment rows
    let rowIndex = 4
    patientsWithAppointments.forEach((patient) => {
      if (!patient.appointments || patient.appointments.length === 0) return

      patient.appointments.forEach((apt) => {
        // Format diagnosis
        let diagnosisText = 'N/A'
        if (apt.finalDiagnosis && apt.finalDiagnosis.length > 0) {
          diagnosisText = apt.finalDiagnosis.join(', ')
          if (apt.customDiagnosis) {
            diagnosisText += ` (${apt.customDiagnosis})`
          }
        } else if (apt.customDiagnosis) {
          diagnosisText = apt.customDiagnosis
        }

        // Clean prescription text (remove emojis and format)
        let prescriptionText = apt.medicine || 'N/A'
        if (prescriptionText !== 'N/A' && prescriptionText.length > 0) {
          // Remove common emojis and clean up
          prescriptionText = prescriptionText
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
            .replace(/🧾/g, '')
            .replace(/\*\*/g, '')
            .trim()
          if (prescriptionText.length === 0) prescriptionText = 'N/A'
        }

        // Clean chief complaint
        let chiefComplaintText = apt.chiefComplaint || 'N/A'
        if (chiefComplaintText !== 'N/A' && chiefComplaintText.length > 0) {
          chiefComplaintText = chiefComplaintText.trim()
        } else {
          chiefComplaintText = 'N/A'
        }

        // Clean doctor notes
        let doctorNotesText = apt.doctorNotes || 'N/A'
        if (doctorNotesText !== 'N/A' && doctorNotesText.length > 0) {
          doctorNotesText = doctorNotesText.trim()
        } else {
          doctorNotesText = 'N/A'
        }

        const row = appointmentSheet.addRow([
          `${patient.firstName} ${patient.lastName}`,
          formatDate(apt.appointmentDate),
          apt.appointmentTime || 'N/A',
          apt.doctorName || 'N/A',
          apt.doctorSpecialization || 'N/A',
          apt.status || 'pending',
          chiefComplaintText,
          prescriptionText,
          diagnosisText,
          doctorNotesText,
          apt.totalConsultationFee || 0,
          apt.paymentStatus || 'pending'
        ])

        // Alternate row colors
        if (rowIndex % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7FAFC' }
          }
        }

        row.alignment = { vertical: 'middle', wrapText: true }
        row.height = 25

        // Set alignments
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' } // Date
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' } // Time
        row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' } // Status
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true } // Chief Complaint
        row.getCell(8).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true } // Prescription
        row.getCell(9).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true } // Diagnosis
        row.getCell(10).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true } // Doctor Notes
        row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' } // Fee
        row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' } // Payment Status

        rowIndex++
      })
    })

    // Set column widths
    appointmentSheet.columns = [
      { width: 25 }, // Patient Name
      { width: 15 }, // Appointment Date
      { width: 12 }, // Time
      { width: 25 }, // Doctor
      { width: 25 }, // Specialization
      { width: 15 }, // Status
      { width: 40 }, // Chief Complaint
      { width: 50 }, // Prescription
      { width: 35 }, // Diagnosis
      { width: 40 }, // Doctor Notes
      { width: 15 }, // Consultation Fee
      { width: 15 }  // Payment Status
    ]

    // Freeze header row
    appointmentSheet.views = [{ state: 'frozen', ySplit: 3 }]

    // Add borders
    appointmentSheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 3) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          }
        })
      }
    })
  }

  const generatedDate = worksheet.addRow([
    `Generated on: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
  ])
  generatedDate.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF94A3B8' } }
  generatedDate.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
  worksheet.mergeCells(`A${generatedDate.number}:N${generatedDate.number}`)

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  // Convert to Buffer for Node.js
  return buffer instanceof Buffer ? buffer : Buffer.from(buffer as ArrayBuffer)
}

