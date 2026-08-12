/**
 * Shared Document Layout Components & Design Tokens
 * Centralized reusable HTML templates for Pharmacy Billing & HMS Printable Documents
 */

import type { HospitalPrintSettings, PaperSize } from "@/types/print"

export interface DocumentInfoLine {
  label: string
  value?: string | number | null
  isBold?: boolean
}

export interface DocumentInfoCard {
  title: string
  lines: DocumentInfoLine[]
  fullWidth?: boolean
}

export interface DocumentTableColumn {
  header: string
  key: string
  width?: string
  align?: "left" | "right" | "center"
}

export interface DocumentTableRow {
  [key: string]: string | number | null | undefined
}

export interface DocumentTotalsRow {
  label: string
  value: string | number
  isGrandTotal?: boolean
  isDiscount?: boolean
}

export function escapeHtml(s?: string | number | null): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Returns unified CSS stylesheet with design tokens, responsive CSS Grid,
 * table styles, typography, page break rules, and A4/Thermal layouts.
 */
export function getSharedDocumentStyles(paperSize: PaperSize = "A4"): string {
  const isThermal = paperSize === "Thermal"

  return `
    .pdf-document-root {
      --bg: #f8fafc;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #475569;
      --accent: #0e7490;
      --success-bg: #ecfeff;
      --success-border: #a5f3fc;
      margin: 0;
      padding: ${isThermal ? "4px" : "16px"};
      background: #eef2f7;
      color: #0f172a;
      font-family: "Inter", "Segoe UI", Roboto, Arial, sans-serif;
      font-size: ${isThermal ? "11px" : "13px"};
      line-height: 1.4;
      box-sizing: border-box;
      width: 100%;
    }
    .pdf-document-root * {
      box-sizing: border-box;
    }
    .invoice, .document-container {
      width: 100%;
      max-width: ${isThermal ? "300px" : "800px"};
      margin: 0 auto;
      background: #fff;
      border: ${isThermal ? "0" : "1px solid var(--border)"};
      border-radius: ${isThermal ? "0" : "12px"};
      overflow: hidden;
      box-shadow: ${isThermal ? "none" : "0 6px 24px rgba(15, 23, 42, 0.06)"};
    }
    .header {
      display: grid;
      grid-template-columns: ${isThermal ? "1fr" : "1fr auto"};
      gap: 16px;
      padding: ${isThermal ? "12px 14px" : "18px 22px"};
      background: linear-gradient(110deg, #0f4c81 0%, #155e75 60%, #0f766e 100%);
      border-bottom: 1px solid var(--border);
    }
    .header::after {
      content: "";
      display: block;
      grid-column: 1 / -1;
      height: 1px;
      background: rgba(255, 255, 255, 0.35);
      margin-top: 2px;
    }
    .brand {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      min-width: 0;
    }
    .logo-wrap {
      width: ${isThermal ? "40px" : "54px"};
      height: ${isThermal ? "40px" : "54px"};
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      overflow: hidden;
      flex-shrink: 0;
      color: #64748b;
      font-size: 10px;
      text-align: center;
      padding: 4px;
    }
    .logo-wrap img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .brand h1 { margin: 0; font-size: ${isThermal ? "16px" : "20px"}; font-weight: 700; letter-spacing: .2px; color: #ffffff; }
    .brand .meta { color: rgba(255, 255, 255, 0.88); margin-top: 3px; font-size: ${isThermal ? "11px" : "12px"}; }
    .title-box {
      text-align: ${isThermal ? "left" : "right"};
      min-width: ${isThermal ? "0" : "230px"};
    }
    .title-box h2 {
      margin: 0 0 8px;
      color: #ffffff;
      font-size: ${isThermal ? "16px" : "20px"};
      font-weight: 700;
      letter-spacing: .3px;
    }
    .kv {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 10px;
      justify-content: ${isThermal ? "start" : "end"};
      font-size: 12px;
    }
    .kv .k { color: rgba(255, 255, 255, 0.8); }
    .kv .v { font-weight: 600; text-align: ${isThermal ? "left" : "right"}; color: #ffffff; }

    .info-grid {
      display: grid;
      grid-template-columns: ${isThermal ? "1fr" : "1fr 1fr"};
      gap: 12px;
      padding: ${isThermal ? "10px 14px 4px" : "16px 22px 8px"};
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
      padding: 12px;
      min-width: 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .card.full-width {
      grid-column: 1 / -1;
      page-break-inside: auto;
      break-inside: auto;
    }
    .card h3 {
      margin: 0 0 8px;
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .3px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .line {
      margin: 4px 0;
      word-break: break-word;
      overflow-wrap: anywhere;
      line-height: 1.6;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .line b { font-weight: 600; }
    .line span {
      color: var(--muted);
      white-space: pre-wrap;
    }
    .font-bold { font-weight: 700 !important; color: #0f172a !important; }

    .banner-strip {
      margin: ${isThermal ? "8px 14px 0" : "10px 22px 0"};
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 12.5px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .banner-strip.info { background: #ecfeff; border-color: #a5f3fc; color: #0e7490; }
    .banner-strip.warning { background: #fffbeb; border-color: #fde68a; color: #b45309; }
    .banner-strip.success { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }

    .table-wrap {
      padding: ${isThermal ? "8px 14px 0" : "10px 22px 0"};
      overflow: visible;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
      table-layout: fixed;
      box-shadow: none;
      outline: none;
    }
    thead th {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid var(--border);
      font-size: 11.5px;
      font-weight: 600;
      padding: 8px 6px;
      text-align: left;
      white-space: nowrap;
    }

    tbody td {
      border: 1px solid var(--border);
      padding: 8px 6px;
      vertical-align: top;
      font-size: 11.5px;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    tbody tr:nth-child(even) td { background: #fcfdff; }

    .left { text-align: left; }
    .center { text-align: center; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 11px; }
    .product-cell { white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
    .product-name { font-weight: 500; color: #0b1324; }
    .product-sub { font-size: 11px; color: #64748b; margin-top: 2px; }

    .bottom {
      display: grid;
      grid-template-columns: ${isThermal ? "1fr" : "1fr 300px"};
      gap: 14px;
      padding: ${isThermal ? "10px 14px 6px" : "14px 22px 6px"};
      align-items: start;
    }
    .payment-box {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      background: var(--bg);
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .payment-grid {
      display: grid;
      grid-template-columns: ${isThermal ? "1fr" : "1fr 116px"};
      gap: 10px;
      align-items: center;
    }
    .qr {
      width: 106px;
      height: 106px;
      border: 1px dashed #94a3b8;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #64748b;
      font-size: 11px;
      background: #fff;
      padding: 6px;
    }
    .totals {
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .totals .row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 12px;
      border-bottom: 1px solid var(--border);
      font-size: 12.5px;
    }
    .totals .row:last-child { border-bottom: 0; }
    .totals .label { color: var(--muted); }
    .totals .value { text-align: right; font-variant-numeric: tabular-nums; }
    .totals .discount-text { color: #dc2626; }
    .totals .payable {
      background: var(--success-bg);
      border-top: 1px solid var(--success-border);
      font-weight: 700;
      font-size: 14px;
      color: #0f172a;
    }

    .thank-you {
      clear: both;
      margin: ${isThermal ? "10px 14px 0" : "14px 22px 0"};
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #f8fafc;
      color: #1e293b;
      padding: 10px 12px;
      text-align: center;
      font-size: 12.5px;
      font-weight: 500;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .signature {
      clear: both;
      margin: ${isThermal ? "12px 14px 0" : "18px 22px 0"};
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .signature-box {
      width: ${isThermal ? "180px" : "240px"};
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      text-align: center;
      color: #475569;
      font-size: 11.5px;
      font-weight: 600;
    }
    .footer {
      clear: both;
      margin-top: ${isThermal ? "10px" : "14px"};
      border-top: 1px solid var(--border);
      padding: ${isThermal ? "8px 14px 12px" : "10px 22px 14px"};
      color: #64748b;
      font-size: 11.5px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer strong { color: #334155; font-weight: 600; }

    @page { size: ${isThermal ? "80mm auto" : "A4"}; margin: ${isThermal ? "2mm" : "10mm"}; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice, .document-container { max-width: none; box-shadow: none; border: 0; border-radius: 0; }
      thead { display: table-header-group; }
      tr, td, th { page-break-inside: avoid; break-inside: avoid; }
      .table-wrap { overflow: visible; }
    }
  `
}

export interface HeaderProps {
  hospitalSettings?: HospitalPrintSettings
  docTitle: string
  docId: string
  docDate: string
  docTime?: string
  statusBadge?: { label: string; tone?: string }
  customKv?: Array<{ k: string; v: string }>
}

export function renderDocumentHeader(props: HeaderProps): string {
  const settings = props.hospitalSettings || {}

  const rawHospitalName = settings.headerTitle || "Hospital"
  const hospitalName = rawHospitalName.replace(/\bHospital\s+Hospital\b/gi, "Hospital").trim()
  const hospitalSubtitle = settings.headerSubtitle || "Multi-Specialty Healthcare Services"
  const hospitalAddress = settings.address || ""
  const hospitalPhone = settings.phone || ""
  const hospitalEmail = settings.email || ""
  const gstNo = settings.taxRegistrationNo || ""

  const metaParts: string[] = []
  if (hospitalPhone) metaParts.push(`Phone: ${escapeHtml(hospitalPhone)}`)
  if (hospitalEmail) metaParts.push(`Email: ${escapeHtml(hospitalEmail)}`)
  if (gstNo) metaParts.push(`GSTIN: ${escapeHtml(gstNo)}`)

  const customKvHtml = (props.customKv || [])
    .map((kv) => `<div class="k">${escapeHtml(kv.k)}</div><div class="v">${escapeHtml(kv.v)}</div>`)
    .join("")

  return `
    <section class="header">
      <div class="brand">
        <div class="logo-wrap">
          ${
            settings.logoUrl
              ? `<img src="${escapeHtml(settings.logoUrl)}" alt="Logo" />`
              : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0e7490" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>`
          }
        </div>
        <div>
          <h1>${escapeHtml(hospitalName)}</h1>
          ${hospitalSubtitle ? `<div class="meta">${escapeHtml(hospitalSubtitle)}</div>` : ""}
          ${hospitalAddress ? `<div class="meta">${escapeHtml(hospitalAddress)}</div>` : ""}
          ${metaParts.length ? `<div class="meta">${metaParts.join(" · ")}</div>` : ""}
        </div>
      </div>
      <div class="title-box">
        <h2>${escapeHtml(props.docTitle)}</h2>
        <div class="kv">
          <div class="k">Doc ID</div><div class="v">${escapeHtml(props.docId)}</div>
          <div class="k">Date</div><div class="v">${escapeHtml(props.docDate)}</div>
          ${props.docTime ? `<div class="k">Time</div><div class="v">${escapeHtml(props.docTime)}</div>` : ""}
          ${
            props.statusBadge
              ? `<div class="k">Status</div><div class="v">${escapeHtml(props.statusBadge.label)}</div>`
              : ""
          }
          ${customKvHtml}
        </div>
      </div>
    </section>
  `
}

export function renderInfoCards(cards?: DocumentInfoCard[]): string {
  if (!cards || cards.length === 0) return ""

  const validCards = cards
    .map((card) => {
      const validLines = card.lines.filter(
        (line) => line.value !== null && line.value !== undefined && String(line.value).trim() !== ""
      )
      return { ...card, lines: validLines }
    })
    .filter((card) => card.lines.length > 0)

  if (validCards.length === 0) return ""

  return `
    <section class="info-grid">
      ${validCards
        .map(
          (card) => `
          <div class="card ${card.fullWidth ? "full-width" : ""}">
            <h3>${escapeHtml(card.title)}</h3>
            ${card.lines
              .map(
                (line) => `
                <div class="line">
                  <b>${escapeHtml(line.label)}:</b> 
                  <span class="${line.isBold ? "font-bold" : ""}">${escapeHtml(String(line.value))}</span>
                </div>
              `
              )
              .join("")}
          </div>
        `
        )
        .join("")}
    </section>
  `
}

export interface BannerStripProps {
  title?: string
  text: string
  tone?: "info" | "warning" | "success"
}

export function renderBannerStrip(banner?: BannerStripProps): string {
  if (!banner || !banner.text || !banner.text.trim()) return ""

  return `
    <section class="banner-strip ${banner.tone || "info"}">
      ${banner.title ? `<strong>${escapeHtml(banner.title)}:</strong> ` : ""}
      <span>${escapeHtml(banner.text)}</span>
    </section>
  `
}

export interface TableProps {
  columns: DocumentTableColumn[]
  rows: DocumentTableRow[]
}

export function renderDocumentTable(table?: TableProps): string {
  if (!table || !table.rows || table.rows.length === 0) return ""

  const cols = table.columns
  const rows = table.rows

  return `
    <section class="table-wrap">
      <table>
        <thead>
          <tr>
            ${cols
              .map(
                (col) => `
              <th style="${col.width ? `width: ${col.width};` : ""} text-align: ${col.align || "left"};">
                ${escapeHtml(col.header)}
              </th>
            `
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, rIdx) => `
            <tr>
              ${cols
                .map((col, cIdx) => {
                  const val = row[col.key] ?? (col.key === "#" || col.key === "index" ? rIdx + 1 : "—")
                  const alignClass = col.align === "right" ? "num" : col.align === "center" ? "center" : "left"
                  const isFirstCol = cIdx === 0
                  return `
                    <td class="${alignClass} ${isFirstCol ? "product-cell" : ""}">
                      ${escapeHtml(String(val))}
                    </td>
                  `
                })
                .join("")}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `
}

export function renderTotalsBox(totals?: DocumentTotalsRow[]): string {
  if (!totals || totals.length === 0) return ""

  return `
    <div class="totals">
      ${totals
        .map(
          (r) => `
        <div class="row ${r.isGrandTotal ? "payable" : ""}">
          <div class="label">${escapeHtml(r.label)}</div>
          <div class="value ${r.isDiscount ? "discount-text" : ""}">${escapeHtml(String(r.value))}</div>
        </div>
      `
        )
        .join("")}
    </div>
  `
}

export interface AdviceBoxProps {
  title: string
  text: string
}

export function renderAdviceBox(advice?: AdviceBoxProps): string {
  if (!advice || !advice.text || !advice.text.trim()) return ""

  return `
    <section class="thank-you">
      <strong>${escapeHtml(advice.title)}:</strong> ${escapeHtml(advice.text)}
    </section>
  `
}

export interface SignatureBoxProps {
  title: string
  name?: string
  licenseNo?: string
}

export function renderSignatureBox(sig?: SignatureBoxProps): string {
  if (!sig) return ""

  return `
    <section class="signature">
      <div class="signature-box">
        ${sig.name ? `<div>Dr. ${escapeHtml(sig.name)}</div>` : ""}
        ${sig.licenseNo ? `<div style="font-size: 10px; color: #64748b; font-weight: normal;">Reg / Lic No: ${escapeHtml(sig.licenseNo)}</div>` : ""}
        <div>${escapeHtml(sig.title)}</div>
      </div>
    </section>
  `
}

export function renderDocumentFooter(
  hospitalSettings?: HospitalPrintSettings,
  footerNote?: string
): string {
  const settings = hospitalSettings || {}
  const rawHospitalName = settings.headerTitle || "Hospital"
  const hospitalName = rawHospitalName.replace(/\bHospital\s+Hospital\b/gi, "Hospital").trim()
  const footerText =
    footerNote ||
    settings.footerText ||
    `Computer generated document. Issued by ${hospitalName}. All rights reserved.`

  if (!hospitalName && !footerText) {
    return ""
  }

  return `
    <footer class="footer">
      <div><strong>${escapeHtml(hospitalName)}</strong></div>
      <div>${escapeHtml(footerText)}</div>
    </footer>
  `
}
