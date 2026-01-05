import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/apiAuth"
import { getHospitalCollectionPath, getUserActiveHospitalId } from "@/utils/serverHospitalQueries"
import { generatePatientReportPDF } from "@/utils/pdfGenerators"
import { generatePatientReportExcel } from "@/utils/excelGenerators"

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

/**
 * Calculate date range based on filter type
 */
function getDateRange(filterType: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  const now = new Date()
  now.setHours(23, 59, 59, 999) // End of today
  
  let start = new Date()
  start.setHours(0, 0, 0, 0)

  switch (filterType) {
    case 'daily':
      // Today only
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      break

    case 'weekly':
      // Last 7 days
      start = new Date(now)
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      break

    case 'monthly':
      // Current month
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      break

    case 'yearly':
      // Current year
      start = new Date(now.getFullYear(), 0, 1)
      start.setHours(0, 0, 0, 0)
      break

    case 'custom':
      if (startDate && endDate) {
        start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        return { start, end }
      }
      // Fallback to all time if custom dates not provided
      start = new Date(0)
      break

    default:
      // All time
      start = new Date(0)
      break
  }

  return { start, end: now }
}

/**
 * Format date range for display
 */
function formatDateRange(filterType: string, startDate?: string, endDate?: string): string {
  const { start, end } = getDateRange(filterType, startDate, endDate)
  
  if (filterType === 'custom' && startDate && endDate) {
    return `${start.toLocaleDateString('en-IN')} - ${end.toLocaleDateString('en-IN')}`
  }
  
  const startStr = start.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const endStr = end.toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  return `${startStr} - ${endStr}`
}

export async function GET(request: Request) {
  // Authenticate request - supports admin, receptionist, and doctor roles
  // First authenticate without role restriction to get user role
  const auth = await authenticateRequest(request)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  // Check if user has one of the allowed roles
  const userRole = auth.user?.role
  const allowedRoles: UserRole[] = ["admin", "receptionist", "doctor"]
  if (!userRole || !allowedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: `Access denied. This endpoint requires one of: ${allowedRoles.join(", ")} role.` },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("admin patient-reports API")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const filterType = searchParams.get('filter') || 'all' // daily, weekly, monthly, yearly, custom, all
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const format = searchParams.get('format') || 'pdf' // pdf or excel
    const hospitalId = searchParams.get('hospitalId') || undefined

    // Get hospital ID
    let activeHospitalId: string | null = hospitalId || null
    if (!activeHospitalId && auth.user?.uid) {
      activeHospitalId = await getUserActiveHospitalId(auth.user.uid)
    }

    if (!activeHospitalId) {
      return NextResponse.json({ error: "Hospital ID not found" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const dateRange = getDateRange(filterType, startDate, endDate)

    // Get role-specific filters
    let receptionistBranchId: string | null = null
    let doctorId: string | null = null

    if (userRole === "receptionist") {
      // Get receptionist's branchId
      try {
        const receptionistDoc = await firestore.collection("receptionists").doc(auth.user!.uid).get()
        if (receptionistDoc.exists) {
          const receptionistData = receptionistDoc.data()
          receptionistBranchId = receptionistData?.branchId || null
        }
      } catch (err) {
      }
    } else if (userRole === "doctor") {
      // For doctors, use their own ID
      doctorId = auth.user!.uid
    }

    // Query patients from hospital-scoped collection
    // Note: We fetch all patients and filter client-side to avoid Firestore query limitations
    // For better performance, consider creating Firestore composite indexes if needed
    const patientsRef = firestore.collection(getHospitalCollectionPath(activeHospitalId, 'patients'))
    
    let patientsSnapshot
    try {
      // Try to order by createdAt if possible (requires index for status + createdAt)
      patientsSnapshot = await patientsRef
        .where('status', 'in', ['active', 'inactive'])
        .orderBy('createdAt', 'desc')
        .get()
    } catch (error: any) {
      // If orderBy fails (no index), fetch without ordering and sort client-side
      patientsSnapshot = await patientsRef
        .where('status', 'in', ['active', 'inactive'])
        .get()
    }
    
    // Filter patients by date range (client-side filtering for end date)
    const patients: PatientReportData[] = patientsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((patient: any) => {
        // Filter by branch for receptionists
        if (receptionistBranchId && patient.defaultBranchId !== receptionistBranchId) {
          return false
        }
        
        // Filter by date range
        if (filterType === 'all') return true
        const createdAt = patient.createdAt ? new Date(patient.createdAt) : null
        if (!createdAt || isNaN(createdAt.getTime())) return false
        // Filter by both start and end date on client side
        return createdAt >= dateRange.start && createdAt <= dateRange.end
      })
      .map((patient: any) => ({
        id: patient.id,
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        email: patient.email || '',
        phone: patient.phone || patient.phoneNumber || '',
        gender: patient.gender || '',
        bloodGroup: patient.bloodGroup || '',
        address: patient.address || '',
        dateOfBirth: patient.dateOfBirth || patient.dateOfBirth || '',
        createdAt: patient.createdAt || '',
        status: patient.status || 'active',
        defaultBranchName: patient.defaultBranchName || ''
      }))

    // Fetch appointments for all patients
    const appointmentsRef = firestore.collection(getHospitalCollectionPath(activeHospitalId, 'appointments'))
    const appointmentsSnapshot = await appointmentsRef.get()
    
    // Group appointments by patient ID
    const appointmentsByPatient = new Map<string, AppointmentData[]>()
    appointmentsSnapshot.docs.forEach((doc) => {
      const apt = doc.data()
      
      // Filter appointments by role
      if (receptionistBranchId && apt.branchId !== receptionistBranchId) {
        return // Skip appointments not in receptionist's branch
      }
      if (doctorId && apt.doctorId !== doctorId) {
        return // Skip appointments not for this doctor
      }
      
      const patientId = apt.patientId || apt.patientUid || ''
      if (patientId) {
        if (!appointmentsByPatient.has(patientId)) {
          appointmentsByPatient.set(patientId, [])
        }
        appointmentsByPatient.get(patientId)!.push({
          id: doc.id,
          appointmentDate: apt.appointmentDate || '',
          appointmentTime: apt.appointmentTime || '',
          doctorName: apt.doctorName || 'N/A',
          doctorSpecialization: apt.doctorSpecialization || '',
          status: apt.status || 'pending',
          chiefComplaint: apt.chiefComplaint || '',
          medicine: apt.medicine || '',
          doctorNotes: apt.doctorNotes || '',
          finalDiagnosis: apt.finalDiagnosis || [],
          customDiagnosis: apt.customDiagnosis || '',
          totalConsultationFee: apt.totalConsultationFee || apt.consultationFee || 0,
          paymentStatus: apt.paymentStatus || 'pending',
          paymentAmount: apt.paymentAmount || 0
        })
      }
    })

    // Attach appointments to patients
    patients.forEach((patient) => {
      // Get appointments for this patient (check both patient.id and patient.patientId if exists)
      const patientAppointments = appointmentsByPatient.get(patient.id) || []
      
      // Remove duplicates and sort
      const uniqueAppointments = Array.from(
        new Map(patientAppointments.map(apt => [apt.id, apt])).values()
      )
      // Sort appointments by date (newest first)
      uniqueAppointments.sort((a, b) => {
        const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime || '00:00'}`).getTime()
        const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime || '00:00'}`).getTime()
        return dateB - dateA
      })
      patient.appointments = uniqueAppointments
      patient.totalAppointments = uniqueAppointments.length
    })

    // Sort by creation date descending
    patients.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    })

    // Generate report title
    const filterTitles: Record<string, string> = {
      daily: 'Daily Patient Report',
      weekly: 'Weekly Patient Report',
      monthly: 'Monthly Patient Report',
      yearly: 'Yearly Patient Report',
      custom: 'Custom Date Range Patient Report',
      all: 'All Patients Report'
    }

    const title = filterTitles[filterType] || 'Patient Report'
    const dateRangeStr = formatDateRange(filterType, startDate, endDate)

    const reportOptions = {
      title,
      dateRange: dateRangeStr,
      totalPatients: patients.length
    }

    // Generate report based on format
    if (format === 'excel') {
      const excelBuffer = await generatePatientReportExcel(patients, reportOptions)
      
      const filename = `Patient_Report_${filterType}_${new Date().toISOString().split('T')[0]}.xlsx`
      
      return new Response(excelBuffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    } else {
      // PDF format (default)
      const pdfBase64 = generatePatientReportPDF(patients, reportOptions)
      
      // Extract base64 data (remove data URI prefix)
      const base64Data = pdfBase64.split(',')[1]
      const pdfBuffer = Buffer.from(base64Data, 'base64')

      const filename = `Patient_Report_${filterType}_${new Date().toISOString().split('T')[0]}.pdf`

      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate patient report" },
      { status: 500 }
    )
  }
}

