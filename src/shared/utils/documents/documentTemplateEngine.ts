/**
 * Centralized Document Template Engine
 * Standardized HTML/PDF Layout Pipeline built on top of html2pdf.js
 * Supports Dynamic Multi-Tenant Branding, Conditional Section Hiding, A4 & Thermal Pagination
 */

import type { HospitalPrintSettings, PrintPrescriptionData } from "@/types/print"
import {
  escapeHtml,
  getSharedDocumentStyles,
  renderDocumentHeader,
  renderInfoCards,
  renderBannerStrip,
  renderDocumentTable,
  renderTotalsBox,
  renderAdviceBox,
  renderSignatureBox,
  renderDocumentFooter,
  type DocumentInfoLine,
  type DocumentInfoCard,
  type DocumentTableColumn,
  type DocumentTableRow,
  type DocumentTotalsRow,
} from "./templateComponents"

import {
  renderHTMLToPdfOpen,
  renderHTMLToPdfDownload,
  renderHTMLToPdfBlob,
  type Html2PdfOptions,
} from "./html2pdfEngine"

export type {
  DocumentInfoLine,
  DocumentInfoCard,
  DocumentTableColumn,
  DocumentTableRow,
  DocumentTotalsRow,
}

export interface StandardDocumentConfig {
  docTitle: string
  docId: string
  docDate: string
  docTime?: string
  statusBadge?: {
    label: string
    tone?: "confirmed" | "completed" | "cancelled" | "pending" | "paid" | "warning"
  }

  // Dynamic Hospital Branding
  hospitalSettings?: HospitalPrintSettings

  // Info Cards (2-column layout)
  infoCards?: DocumentInfoCard[]

  // Optional Banner / Vitals / Notice Strip
  bannerStrip?: {
    title?: string
    text: string
    tone?: "info" | "warning" | "success"
  }

  // Table Data
  table?: {
    columns: DocumentTableColumn[]
    rows: DocumentTableRow[]
  }

  // Totals Box (Right Side)
  totalsBox?: DocumentTotalsRow[]

  // Advice / Notes Box
  adviceBox?: {
    title: string
    text: string
  }

  // Signature Block
  signatureBox?: {
    title: string
    name?: string
  }

  // Footer Note
  footerNote?: string
}

/**
 * Builds standard HTML string using unified layout components and design tokens
 */
export function buildStandardDocumentHTML(config: StandardDocumentConfig): string {
  const paperSize = config.hospitalSettings?.paperSize || "A4"
  const styles = getSharedDocumentStyles(paperSize)

  const headerHTML = renderDocumentHeader({
    hospitalSettings: config.hospitalSettings,
    docTitle: config.docTitle,
    docId: config.docId,
    docDate: config.docDate,
    docTime: config.docTime,
    statusBadge: config.statusBadge,
  })

  const infoGridHTML = renderInfoCards(config.infoCards)
  const bannerHTML = renderBannerStrip(config.bannerStrip)
  const tableHTML = renderDocumentTable(config.table)

  let totalsBoxHTML = ""
  if (config.totalsBox && config.totalsBox.length > 0) {
    totalsBoxHTML = `
      <section class="bottom" style="justify-content: flex-end;">
        <div style="grid-column: ${config.table ? "2" : "1 / -1"}; flex-grow: 1;"></div>
        ${renderTotalsBox(config.totalsBox)}
      </section>
    `
  }

  const adviceHTML = renderAdviceBox(config.adviceBox)
  const signatureHTML = renderSignatureBox(config.signatureBox)
  const footerHTML = renderDocumentFooter(config.hospitalSettings, config.footerNote)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(config.docTitle)}</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <div class="document-container" id="doc-root">
    ${headerHTML}
    ${infoGridHTML}
    ${bannerHTML}
    ${tableHTML}
    ${totalsBoxHTML}
    ${adviceHTML}
    ${signatureHTML}
    ${footerHTML}
  </div>
</body>
</html>`
}



/**
 * Builds professional A4 Prescription HTML document with distinct clinical sections
 */
export function renderPrescriptionDocumentHTML(
  data: PrintPrescriptionData,
  hospitalSettings?: HospitalPrintSettings
): string {
  const settings = hospitalSettings || {}
  const rawHospitalName =
    (settings.headerTitle && settings.headerTitle !== "HARMONY HEALTHCARE" && settings.headerTitle !== "Medical Center" && settings.headerTitle !== "Hospital Healthcare Center")
      ? settings.headerTitle
      : data.hospitalName || (data as any).branchName || settings.headerTitle || "Hospital"
  const hospitalName = rawHospitalName.replace(/\bHospital\s+Hospital\b/gi, "Hospital").trim()
  const hospitalSubtitle = settings.headerSubtitle || "Multi-Specialty Healthcare Services"
  const hospitalAddress = settings.address || ""
  const hospitalPhone = settings.phone || ""
  const hospitalEmail = settings.email || ""
  const logoUrl = settings.logoUrl || ""

  const doctorName = data.doctor.name?.startsWith("Dr.")
    ? data.doctor.name
    : `Dr. ${data.doctor.name || "Attending Physician"}`
  const doctorSpecialization = data.doctor.specialization || "General Medicine"
  const doctorReg = data.doctor.licenseNo || data.doctor.qualification || ""

  const patientName = data.patient.name || "Patient"
  const phone = data.patient.phone || "N/A"
  const visitDate = data.date || new Date().toLocaleDateString("en-IN")

  const diagStr = Array.isArray(data.diagnosis)
    ? data.diagnosis.filter(Boolean).join(", ")
    : data.diagnosis || ""

  const vitalsParts: string[] = []
  if (data.vitals?.bp) vitalsParts.push(`<strong>BP:</strong> ${escapeHtml(data.vitals.bp)}`)
  if (data.vitals?.temperature) vitalsParts.push(`<strong>Temp:</strong> ${escapeHtml(String(data.vitals.temperature))}°C`)
  if (data.vitals?.heartRate) vitalsParts.push(`<strong>Pulse:</strong> ${escapeHtml(String(data.vitals.heartRate))} bpm`)
  if (data.vitals?.spO2) vitalsParts.push(`<strong>SpO2:</strong> ${escapeHtml(String(data.vitals.spO2))}%`)
  if (data.vitals?.height) vitalsParts.push(`<strong>Height:</strong> ${escapeHtml(String(data.vitals.height))} cm`)
  if (data.vitals?.weight) vitalsParts.push(`<strong>Weight:</strong> ${escapeHtml(String(data.vitals.weight))} kg`)

  const contactParts: string[] = []
  if (hospitalPhone) contactParts.push(`Ph: ${escapeHtml(hospitalPhone)}`)
  if (hospitalEmail) contactParts.push(`Email: ${escapeHtml(hospitalEmail)}`)

  const medicines = data.medicines || []
  const hasMedicines = medicines.length > 0

  const medTableRows = medicines
    .map(
      (m, idx) => `
    <tr>
      <td style="width: 6%; text-align: center;">${idx + 1}</td>
      <td style="width: 34%; font-weight: 600; color: #0f172a;">${escapeHtml(m.name)}</td>
      <td style="width: 15%;">${escapeHtml(m.dosage || "As advised")}</td>
      <td style="width: 18%;">${escapeHtml(m.frequency || "As directed")}</td>
      <td style="width: 12%;">${escapeHtml(m.duration || "Standard")}</td>
      <td style="width: 15%;">${escapeHtml(m.instructions || "—")}</td>
    </tr>
  `
    )
    .join("")

  const rawAdviceList = [data.notes, data.advice]
    .filter(Boolean)
    .map((s) =>
      String(s)
        .replace(/(?:^|\n)---\s*Diagnosis\s*---\n?[\s\S]*?(?=(?:\n---\s*|$))/gi, "")
        .replace(/(?:^|\n)---\s*Examination findings\s*---\n?[\s\S]*?(?=(?:\n---\s*|$))/gi, "")
        .replace(/🧾\s*\*?Prescription\*?/gi, "")
        .replace(/📌\s*\*?Advice:\*?/gi, "")
        .replace(/\*[1-9]️⃣\s+.*?\*/g, "")
        .trim()
    )
    .filter(Boolean)

  const adviceText = Array.from(new Set(rawAdviceList)).join("\n")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prescription - ${escapeHtml(patientName)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 8mm 8mm;
    }
    .pdf-document-root {
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      width: 100%;
    }
    .pdf-document-root * {
      box-sizing: border-box;
    }
    .document-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 10px 14px;
    }

    /* Header Section */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
      border-bottom: 2px solid #0891b2;
      margin-bottom: 12px;
    }
    .brand-box {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .logo-img {
      max-height: 52px;
      max-width: 140px;
      object-fit: contain;
    }
    .hospital-details h1 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }
    .hospital-details p {
      font-size: 10px;
      color: #475569;
      margin-top: 2px;
    }
    .doc-type-box {
      text-align: right;
    }
    .doc-type-title {
      font-size: 14px;
      font-weight: 700;
      color: #0891b2;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .doc-type-meta {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    /* Patient & Doctor Info Grid */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .meta-box-header {
      font-size: 9.5px;
      font-weight: 700;
      color: #0891b2;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      padding-bottom: 3px;
      border-bottom: 1px solid #cbd5e1;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      margin-bottom: 2px;
    }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-label { color: #64748b; font-weight: 500; }
    .meta-val { color: #0f172a; font-weight: 600; text-align: right; }

    /* Vitals Strip */
    .vitals-strip {
      background: #ecfeff;
      border: 1px solid #a5f3fc;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 10.5px;
      color: #0e7490;
      margin-bottom: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    /* Clinical Sections */
    .section-block {
      margin-bottom: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-title {
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      background: #f1f5f9;
      border-left: 3.5px solid #0891b2;
      padding: 4px 8px;
      margin-bottom: 4px;
      border-radius: 0 4px 4px 0;
    }
    .section-body {
      font-size: 10.5px;
      color: #334155;
      padding: 3px 8px;
      line-height: 1.45;
      white-space: pre-wrap;
    }

    /* Medicine Table */
    .med-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 10px;
    }
    .med-table th {
      background: #0891b2;
      color: #ffffff;
      font-weight: 600;
      text-align: left;
      padding: 5px 6px;
      border: 1px solid #0891b2;
    }
    .med-table td {
      border: 1px solid #e2e8f0;
      padding: 5px 6px;
      vertical-align: top;
      background: #ffffff;
    }
    .med-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* Bottom Footer & Signature */
    .footer-block {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer-left {
      font-size: 9px;
      color: #94a3b8;
      max-width: 320px;
    }
    .signature-box {
      text-align: center;
      min-width: 180px;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
    }
    .sig-sub {
      font-size: 9px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="pdf-document-root">
    <div class="document-container" id="doc-root">
    <!-- Header -->
    <div class="header">
      <div class="brand-box">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo-img" />` : ""}
        <div class="hospital-details">
          <h1>${escapeHtml(hospitalName)}</h1>
          ${hospitalSubtitle ? `<p>${escapeHtml(hospitalSubtitle)}</p>` : ""}
          ${hospitalAddress ? `<p>${escapeHtml(hospitalAddress)}</p>` : ""}
          ${contactParts.length ? `<p>${contactParts.join(" | ")}</p>` : ""}
        </div>
      </div>
      <div class="doc-type-box">
        <div class="doc-type-title">CONSULTATION / PRESCRIPTION</div>
        <div class="doc-type-meta">Rx ID: ${escapeHtml(data.prescriptionId || "RX")}</div>
        <div class="doc-type-meta">Date: ${escapeHtml(visitDate)}</div>
      </div>
    </div>

    <!-- Patient & Doctor Info Grid -->
    <div class="meta-grid">
      <div class="meta-box">
        <div class="meta-box-header">Patient Details</div>
        <div class="meta-row"><span class="meta-label">Patient Name:</span><span class="meta-val">${escapeHtml(patientName)}</span></div>
        <div class="meta-row"><span class="meta-label">Phone:</span><span class="meta-val">${escapeHtml(phone)}</span></div>
        <div class="meta-row"><span class="meta-label">Visit Date:</span><span class="meta-val">${escapeHtml(visitDate)}</span></div>
      </div>

      <div class="meta-box">
        <div class="meta-box-header">Doctor Details</div>
        <div class="meta-row"><span class="meta-label">Doctor Name:</span><span class="meta-val">${escapeHtml(doctorName)}</span></div>
        <div class="meta-row"><span class="meta-label">Specialization:</span><span class="meta-val">${escapeHtml(doctorSpecialization)}</span></div>
        ${doctorReg ? `<div class="meta-row"><span class="meta-label">Reg / License No:</span><span class="meta-val">${escapeHtml(doctorReg)}</span></div>` : ""}
      </div>
    </div>

    <!-- Vitals Strip -->
    ${vitalsParts.length > 0 ? `<div class="vitals-strip">${vitalsParts.join(" &nbsp;|&nbsp; ")}</div>` : ""}

    <!-- Chief Complaint -->
    ${data.chiefComplaints && data.chiefComplaints.trim() ? `
      <div class="section-block">
        <div class="section-title">Chief Complaint & Symptoms</div>
        <div class="section-body">${escapeHtml(data.chiefComplaints.trim())}</div>
      </div>
    ` : ""}

    <!-- Examination Findings Section -->
    ${data.examinationFindings && data.examinationFindings.trim() ? `
      <div class="section-block">
        <div class="section-title">Examination Findings</div>
        <div class="section-body">${escapeHtml(data.examinationFindings.trim())}</div>
      </div>
    ` : ""}

    <!-- Assessment Section -->
    ${data.assessment && data.assessment.trim() ? `
      <div class="section-block">
        <div class="section-title">Assessment / Clinical Impression</div>
        <div class="section-body">${escapeHtml(data.assessment.trim())}</div>
      </div>
    ` : ""}

    <!-- Diagnosis Section -->
    ${diagStr && diagStr.trim() ? `
      <div class="section-block">
        <div class="section-title">Diagnosis</div>
        <div class="section-body" style="font-weight: 600; color: #0891b2;">${escapeHtml(diagStr.trim())}</div>
      </div>
    ` : ""}

    <!-- Investigations Section -->
    ${data.investigations && data.investigations.trim() ? `
      <div class="section-block">
        <div class="section-title">Investigations / Lab Advice</div>
        <div class="section-body">${escapeHtml(data.investigations.trim())}</div>
      </div>
    ` : ""}

    <!-- Prescription Table -->
    ${hasMedicines ? `
      <div class="section-block">
        <div class="section-title">Prescription (Rx)</div>
        <table class="med-table">
          <thead>
            <tr>
              <th style="width: 6%; text-align: center;">#</th>
              <th style="width: 34%;">Medicine Name</th>
              <th style="width: 15%;">Dose</th>
              <th style="width: 18%;">Frequency</th>
              <th style="width: 12%;">Duration</th>
              <th style="width: 15%;">Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${medTableRows}
          </tbody>
        </table>
      </div>
    ` : ""}

    <!-- Advice / Special Instructions -->
    ${adviceText && adviceText.trim() ? `
      <div class="section-block">
        <div class="section-title">Advice & Special Instructions</div>
        <div class="section-body">${escapeHtml(adviceText.trim())}</div>
      </div>
    ` : ""}

    <!-- Follow-up Section -->
    ${data.recheckupNote && data.recheckupNote.trim() ? `
      <div class="section-block">
        <div class="section-title">Follow-up</div>
        <div class="section-body">${escapeHtml(data.recheckupNote.trim())}</div>
      </div>
    ` : ""}

    <!-- Footer & Signature -->
    <div class="footer-block">
      <div class="footer-left">
        Computer-generated prescription document.<br />
        Issued by ${escapeHtml(hospitalName)}.
      </div>
      <div class="signature-box">
        <div style="height: 35px;"></div>
        <div class="sig-line">${escapeHtml(doctorName)}</div>
        ${doctorReg ? `<div class="sig-sub">Reg No: ${escapeHtml(doctorReg)}</div>` : ""}
        <div class="sig-sub">Doctor Signature & Stamp</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

/**
 * Renders document to PDF using html2pdf.js and opens PDF Blob in a new browser tab
 */
export async function renderDocumentToPDFAndOpen(
  config: StandardDocumentConfig,
  filename = "document.pdf",
  options?: Html2PdfOptions
): Promise<void> {
  const html = buildStandardDocumentHTML(config)
  await renderHTMLToPdfOpen(html, filename, options)
}

/**
 * Renders document to PDF using html2pdf.js and triggers download
 */
export async function renderDocumentToPDFDownload(
  config: StandardDocumentConfig,
  filename = "document.pdf",
  options?: Html2PdfOptions
): Promise<void> {
  const html = buildStandardDocumentHTML(config)
  await renderHTMLToPdfDownload(html, filename, options)
}

/**
 * Renders document to PDF Blob using html2pdf.js
 */
export async function renderDocumentToPDFBlob(
  config: StandardDocumentConfig,
  options?: Html2PdfOptions
): Promise<Blob> {
  const html = buildStandardDocumentHTML(config)
  return renderHTMLToPdfBlob(html, options)
}
