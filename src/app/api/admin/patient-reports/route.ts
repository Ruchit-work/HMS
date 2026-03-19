import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, type UserRole } from "@/utils/firebase/apiAuth"
import { getHospitalCollectionPath, getUserActiveHospitalId } from "@/utils/firebase/serverHospitalQueries"
import { generatePatientReportExcel } from "@/utils/documents/excelGenerators"

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

function escapeHtml(input: string): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatINR(value?: number): string {
  const amount = Number(value || 0)
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildPatientReportHTML(
  patients: PatientReportData[],
  options: { title: string; dateRange: string; totalPatients: number }
): string {
  const patientRows = patients.map((patient, index) => {
    const name = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "N/A"
    return `
      <tr>
        <td class="num">${index + 1}</td>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(patient.email || "N/A")}</td>
        <td>${escapeHtml(patient.phone || "N/A")}</td>
        <td>${escapeHtml(patient.gender || "N/A")}</td>
        <td>${escapeHtml(patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString("en-IN") : "N/A")}</td>
        <td>${escapeHtml(patient.bloodGroup || "N/A")}</td>
        <td>${escapeHtml(patient.address || "N/A")}</td>
        <td>${escapeHtml(String(patient.totalAppointments || patient.appointments?.length || 0))}</td>
        <td>${escapeHtml(patient.status || "active")}</td>
      </tr>
    `
  }).join("")

  const appointmentSections = patients
    .filter((p) => p.appointments && p.appointments.length > 0)
    .map((patient) => {
      const name = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Patient"
      const appointments = (patient.appointments || []).slice(0, 8)
      const rows = appointments.map((apt) => `
        <tr>
          <td>${escapeHtml(apt.appointmentDate ? new Date(apt.appointmentDate).toLocaleDateString("en-IN") : "N/A")}</td>
          <td>${escapeHtml(apt.appointmentTime || "N/A")}</td>
          <td>${escapeHtml(apt.doctorName || "N/A")}</td>
          <td>${escapeHtml(apt.doctorSpecialization || "N/A")}</td>
          <td>${escapeHtml(apt.status || "pending")}</td>
          <td class="num">${formatINR(apt.totalConsultationFee || apt.paymentAmount || 0)}</td>
          <td>${escapeHtml(apt.paymentStatus || "pending")}</td>
        </tr>
      `).join("")
      const remaining = Math.max(0, (patient.appointments?.length || 0) - appointments.length)

      return `
        <section class="detail-card">
          <h3>${escapeHtml(name)} (${patient.totalAppointments || patient.appointments?.length || 0} appointment${(patient.totalAppointments || patient.appointments?.length || 0) > 1 ? "s" : ""})</h3>
          <table class="detail-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Doctor</th>
                <th>Specialization</th>
                <th>Status</th>
                <th class="num">Fee</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${remaining > 0 ? `<p class="more">... and ${remaining} more appointment(s)</p>` : ""}
        </section>
      `
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Patient Report</title>
  <style>
    :root {
      --border: #dbe4ef;
      --text: #0f172a;
      --muted: #475569;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px;
      background: #eef2f7;
      color: var(--text);
      font-family: "Inter", "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    .sheet {
      max-width: 1120px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(2, 6, 23, 0.08);
    }
    .header {
      background: linear-gradient(110deg, #0f4c81 0%, #155e75 60%, #0f766e 100%);
      color: #fff;
      padding: 18px 22px;
    }
    .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
    .header p { margin: 5px 0 0; color: rgba(255,255,255,.9); font-size: 12px; }
    .summary {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin: 12px 22px 0;
    }
    .summary .item {
      border: 1px solid var(--border);
      background: #f8fafc;
      border-radius: 10px;
      padding: 9px 10px;
    }
    .summary .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
    .summary .value { margin-top: 3px; font-size: 13px; font-weight: 600; color: #0f172a; }
    .table-wrap { margin: 14px 22px 0; overflow: visible; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
    th, td {
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #e2e8f0;
      padding: 8px 6px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    th:last-child, td:last-child { border-right: 1px solid #e2e8f0; }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 11px;
      font-weight: 600;
      border-top: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    td { font-size: 11.5px; color: #334155; }
    tr:nth-child(even) td { background: #fcfdff; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .details { margin: 14px 22px 0; }
    .details h2 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
    }
    .detail-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
      background: #fff;
      margin-bottom: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .detail-card h3 { margin: 0 0 7px; font-size: 12px; color: #0f172a; }
    .detail-table th, .detail-table td { font-size: 11px; padding: 7px 6px; }
    .more { margin: 7px 0 0; color: #64748b; font-size: 11px; font-style: italic; }
    .footer {
      margin: 12px 22px 18px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      color: #64748b;
      font-size: 11px;
      text-align: center;
    }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { max-width: none; box-shadow: none; border-radius: 0; border: 0; }
      tr, td, th, .detail-card { break-inside: avoid; page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <section class="header">
      <h1>Patient Report</h1>
      <p>${escapeHtml(options.title)}</p>
    </section>
    <section class="summary">
      <div class="item"><div class="label">Date Range</div><div class="value">${escapeHtml(options.dateRange)}</div></div>
      <div class="item"><div class="label">Total Patients</div><div class="value">${escapeHtml(String(options.totalPatients))}</div></div>
      <div class="item"><div class="label">Generated On</div><div class="value">${escapeHtml(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }))}</div></div>
    </section>
    <section class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:5%" class="num">S.No</th>
            <th style="width:13%">Name</th>
            <th style="width:18%">Email</th>
            <th style="width:11%">Phone</th>
            <th style="width:8%">Gender</th>
            <th style="width:10%">DOB</th>
            <th style="width:8%">Blood Group</th>
            <th style="width:15%">Address</th>
            <th style="width:6%" class="num">Visits</th>
            <th style="width:6%">Status</th>
          </tr>
        </thead>
        <tbody>${patientRows}</tbody>
      </table>
    </section>
    ${appointmentSections ? `<section class="details"><h2>Appointment Details</h2>${appointmentSections}</section>` : ""}
    <footer class="footer">Generated by HMS Report Engine</footer>
  </div>
</body>
</html>`
}

async function generatePatientReportPdfBufferHtml(
  patients: PatientReportData[],
  options: { title: string; dateRange: string; totalPatients: number }
): Promise<Buffer> {
  const html = buildPatientReportHTML(patients, options)
  const puppeteer = await import("puppeteer")
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0" })
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
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
      } catch {
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
    } catch {
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
      const pdfBuffer = await generatePatientReportPdfBufferHtml(patients, reportOptions)

      const filename = `Patient_Report_${filterType}_${new Date().toISOString().split('T')[0]}.pdf`

      return new Response(pdfBuffer as unknown as BodyInit, {
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

