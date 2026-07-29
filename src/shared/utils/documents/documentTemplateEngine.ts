/**
 * Centralized Document Template Engine
 * Standardized HTML/PDF Layout Pipeline built on top of html2pdf.js
 * Supports Dynamic Multi-Tenant Branding, Conditional Section Hiding, A4 & Thermal Pagination
 */

import type { HospitalPrintSettings } from "@/types/print"
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
