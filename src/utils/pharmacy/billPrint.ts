/**
 * Pharmacy bill: modern HTML template + html2pdf.js export.
 */

export interface BillLine {
  name: string
  qty: number
  rate: number
  amount: number
  tax: number
  batchNo?: string
  expiryDate?: string
  discount?: number
  mrp?: number
  gstPercent?: number
}

export interface BillData {
  type: "prescription" | "walk_in"
  patientName: string
  customerPhone?: string
  doctorName?: string
  date: string
  branchName: string
  lines: BillLine[]
  grossTotal: number
  discountAmount?: number
  taxTotal: number
  taxPercent: number
  netTotal: number
  paymentMethod?: "cash" | "upi" | "card" | "credit" | "other" | string
  invoiceNumber?: string
  pharmacyName?: string
  pharmacyAddress?: string
  pharmacyPhone?: string
  gstNumber?: string
  logoUrl?: string
  cgstAmount?: number
  sgstAmount?: number
  qrCodeLabel?: string
  printerId?: string
  printerIds?: string[]
}

declare global {
  interface Window {
    html2pdf?: any
  }
}

const INVOICE_BG = "#f8fafc"
const BORDER = "#e2e8f0"
const TEXT = "#0f172a"
const MUTED = "#475569"

function money(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function normalizeDateTime(raw: string): { date: string; time: string } {
  const dateOnlyMatch = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch
    const safeDate = `${d}-${m}-${y}`
    const nowIst = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    return { date: safeDate, time: nowIst }
  }

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return { date: raw || "-", time: "" }
  }
  const date = d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const time = d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
  return { date, time }
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function sanitizeFilePart(value: string, fallback: string): string {
  const cleaned = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
  return cleaned || fallback
}

function parsePrinterIds(value: string): string[] {
  return String(value || "")
    .split(/[\n,]/g)
    .map((id) => id.trim())
    .filter(Boolean)
}

function getConfiguredPrinterIds(data: BillData): string[] {
  return [
    ...(Array.isArray(data.printerIds) ? data.printerIds : []),
    ...parsePrinterIds(data.printerId || ""),
    ...(typeof window !== "undefined"
      ? [
          ...parsePrinterIds(window.localStorage.getItem("pharmacyPrinterIds") || ""),
          ...parsePrinterIds(window.localStorage.getItem("pharmacyPrinterId") || ""),
          ...parsePrinterIds(window.localStorage.getItem("printerId") || ""),
        ]
      : []),
  ].filter((id, idx, arr) => id && arr.indexOf(id) === idx)
}

function getPrintBridgeUrl(): string {
  if (typeof window === "undefined") return ""
  const fromLocalStorage =
    window.localStorage.getItem("pharmacyPrintBridgeUrl") ||
    window.localStorage.getItem("printBridgeUrl") ||
    ""
  const fromEnv = process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL || ""
  return (fromLocalStorage || fromEnv).trim().replace(/\/+$/, "")
}

async function sendToPrintBridge(
  bridgeUrl: string,
  pdfBlob: Blob,
  fileName: string,
  printerIds: string[],
  data: BillData
): Promise<boolean> {
  if (!bridgeUrl || !printerIds.length) return false
  try {
    const form = new FormData()
    form.append("file", pdfBlob, fileName)
    form.append("fileName", fileName)
    form.append("printerIds", JSON.stringify(printerIds))
    form.append("invoiceType", data.type)
    form.append("invoiceNumber", data.invoiceNumber || "")
    form.append("patientName", data.patientName || "")
    form.append("branchName", data.branchName || "")
    form.append("paymentMethod", data.paymentMethod || "")
    form.append("printedAt", new Date().toISOString())

    const res = await fetch(bridgeUrl, {
      method: "POST",
      body: form,
    })
    if (!res.ok) return false
    return true
  } catch {
    return false
  }
}

export function buildBillHTML(data: BillData): string {
  const dt = normalizeDateTime(data.date)
  const hasDiscount = (data.discountAmount ?? 0) > 0
  const hasDoctor = Boolean(data.doctorName && String(data.doctorName).trim())
  const paymentMethod = (data.paymentMethod || "cash").toUpperCase()
  const invoiceNo = data.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`
  const pharmacyName = data.pharmacyName || "Harmony Pharmacy"
  const pharmacyAddress = data.pharmacyAddress || "Hospital Campus, Main Road, India"
  const pharmacyPhone = data.pharmacyPhone || "+91 00000 00000"
  const gstNo = data.gstNumber || "GSTIN: NA"
  const qrLabel = data.qrCodeLabel || "Scan to Pay"
  const cgst = data.cgstAmount ?? data.taxTotal / 2
  const sgst = data.sgstAmount ?? data.taxTotal / 2

  const rows = data.lines
    .map((line, idx) => {
      const mrp = line.mrp ?? line.rate
      const disc = line.discount ?? 0
      const expiry = line.expiryDate ? escapeHtml(line.expiryDate) : "-"
      const batch = line.batchNo ? escapeHtml(line.batchNo) : "-"
      return `
        <tr>
          <td class="left product-cell">
            <div class="product-name">${escapeHtml(line.name || "-")}</div>
            <div class="product-sub">Item ${idx + 1}</div>
          </td>
          <td class="left">${batch}</td>
          <td class="left">${expiry}</td>
          <td class="num">${escapeHtml(String(line.qty || 0))}</td>
          <td class="num">${money(mrp)}</td>
          <td class="num">${money(disc)}</td>
          <td class="num">${money(line.tax || 0)}</td>
          <td class="num amount-cell">${money(line.amount || 0)}</td>
        </tr>
      `
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pharmacy Invoice</title>
  <style>
    :root {
      --bg: ${INVOICE_BG};
      --border: ${BORDER};
      --text: ${TEXT};
      --muted: ${MUTED};
      --accent: #1d4ed8;
      --success-bg: #ecfeff;
      --success-border: #a5f3fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      background: #eef2f7;
      color: var(--text);
      font-family: "Inter", "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
    }
    .invoice {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
    }
    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      padding: 18px 22px;
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
      width: 54px;
      height: 54px;
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
    .brand h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: .2px; color: #ffffff; }
    .brand .meta { color: rgba(255, 255, 255, 0.88); margin-top: 3px; font-size: 12px; }
    .title-box {
      text-align: right;
      min-width: 230px;
    }
    .title-box h2 {
      margin: 0 0 8px;
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: .3px;
    }
    .kv {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 10px;
      justify-content: end;
      font-size: 12px;
    }
    .kv .k { color: rgba(255, 255, 255, 0.8); }
    .kv .v { font-weight: 600; text-align: right; color: #ffffff; }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      padding: 16px 22px 8px;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
      padding: 12px;
      min-width: 0;
    }
    .card h3 {
      margin: 0 0 8px;
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .3px;
    }
    .line { margin: 2px 0; }
    .line b { font-weight: 600; }
    .line span { color: var(--muted); }

    .table-wrap {
      padding: 10px 22px 0;
      overflow: visible;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
    }
    thead th {
      position: sticky;
      top: 0;
      background: #f1f5f9;
      color: #334155;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      font-size: 11.5px;
      font-weight: 600;
      padding: 8px 6px;
      text-align: left;
      white-space: nowrap;
    }
    thead th:first-child { border-left: 1px solid var(--border); border-top-left-radius: 8px; }
    thead th:last-child { border-right: 1px solid var(--border); border-top-right-radius: 8px; }

    tbody td {
      border-bottom: 1px solid var(--border);
      border-left: 1px solid var(--border);
      padding: 8px 6px;
      vertical-align: top;
      font-size: 11.5px;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    tbody tr td:last-child { border-right: 1px solid var(--border); }
    tbody tr:nth-child(even) td { background: #fcfdff; }
    tbody tr:hover td { background: #f8fbff; }

    .left { text-align: left; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 11px; }
    .amount-cell { font-weight: 600; }
    .product-cell { white-space: normal; word-break: break-word; overflow-wrap: anywhere; }
    .product-name { font-weight: 500; color: #0b1324; }
    .product-sub { font-size: 11px; color: #64748b; margin-top: 2px; }

    .bottom {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 14px;
      padding: 14px 22px 6px;
      align-items: start;
    }
    .payment-box {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      background: var(--bg);
    }
    .payment-grid {
      display: grid;
      grid-template-columns: 1fr 116px;
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
    .totals .payable {
      background: var(--success-bg);
      border-top: 1px solid var(--success-border);
      font-weight: 700;
      font-size: 14px;
      color: #0f172a;
    }
    .thank-you {
      margin: 10px 22px 0;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #f8fafc;
      color: #1e293b;
      padding: 10px 12px;
      text-align: center;
      font-size: 12.5px;
      font-weight: 500;
    }
    .signature {
      margin: 10px 22px 0;
      display: flex;
      justify-content: flex-end;
    }
    .signature-box {
      width: 240px;
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      text-align: center;
      color: #475569;
      font-size: 11.5px;
      font-weight: 600;
    }
    .footer {
      margin-top: 10px;
      border-top: 1px solid var(--border);
      padding: 10px 22px 16px;
      color: #64748b;
      font-size: 11.5px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .footer strong { color: #334155; font-weight: 600; }

    @media (max-width: 820px) {
      .header { grid-template-columns: 1fr; }
      .title-box { text-align: left; min-width: 0; }
      .kv { justify-content: start; }
      .kv .v { text-align: left; }
      .info-grid { grid-template-columns: 1fr; }
      .bottom { grid-template-columns: 1fr; }
      .payment-grid { grid-template-columns: 1fr; }
      .qr { width: 96px; height: 96px; }
    }

    @page { size: A4; margin: 10mm; }
    @media print {
      body { background: #fff; padding: 0; }
      .invoice {
        max-width: none;
        box-shadow: none;
        border: 0;
        border-radius: 0;
      }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr, td, th { page-break-inside: avoid; break-inside: avoid; }
      .table-wrap { overflow: visible; }
    }
  </style>
</head>
<body>
  <div class="invoice" id="bill-root">
    <section class="header">
      <div class="brand">
        <div class="logo-wrap">
          ${
            data.logoUrl
              ? `<img src="${escapeHtml(data.logoUrl)}" alt="Logo" />`
              : `<span>Logo</span>`
          }
        </div>
        <div>
          <h1>${escapeHtml(pharmacyName)}</h1>
          <div class="meta">${escapeHtml(pharmacyAddress)}</div>
          <div class="meta">Phone: ${escapeHtml(pharmacyPhone)} · ${escapeHtml(gstNo)}</div>
        </div>
      </div>
      <div class="title-box">
        <h2>Pharmacy Invoice</h2>
        <div class="kv">
          <div class="k">Invoice No</div><div class="v">${escapeHtml(invoiceNo)}</div>
          <div class="k">Date</div><div class="v">${escapeHtml(dt.date)}</div>
          <div class="k">Time</div><div class="v">${escapeHtml(dt.time || "-")}</div>
          <div class="k">Payment</div><div class="v">${escapeHtml(paymentMethod)}</div>
        </div>
      </div>
    </section>

    <section class="info-grid">
      <div class="card">
        <h3>Customer Details</h3>
        <div class="line"><b>Patient Name:</b> <span>${escapeHtml(data.patientName || "-")}</span></div>
        <div class="line"><b>Customer Phone:</b> <span>${escapeHtml(data.customerPhone || "-")}</span></div>
        ${
          hasDoctor
            ? `<div class="line"><b>Doctor Name:</b> <span>${escapeHtml(data.doctorName || "")}</span></div>`
            : ""
        }
      </div>
      <div class="card">
        <h3>Branch & Visit</h3>
        <div class="line"><b>Branch:</b> <span>${escapeHtml(data.branchName || "-")}</span></div>
        <div class="line"><b>Invoice Type:</b> <span>${data.type === "walk_in" ? "Walk-in" : "Prescription"}</span></div>
        <div class="line"><b>Total Items:</b> <span>${escapeHtml(String(data.lines.length))}</span></div>
      </div>
    </section>

    <section class="table-wrap">
      <table>
        <colgroup>
          <col style="width:36%" />
          <col style="width:11%" />
          <col style="width:13%" />
          <col style="width:10%" />
          <col style="width:9%" />
          <col style="width:10%" />
          <col style="width:8%" />
          <col style="width:13%" />
        </colgroup>
        <thead>
          <tr>
            <th class="left">Product Name</th>
            <th class="left">Batch No</th>
            <th class="left">Expiry Date</th>
            <th class="num">Quantity</th>
            <th class="num">MRP</th>
            <th class="num">Discount</th>
            <th class="num">Tax</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>

    <section class="bottom">
      <div class="payment-box">
        <div class="payment-grid">
          <div>
            <div class="line"><b>Payment Method:</b> <span>${escapeHtml(paymentMethod)}</span></div>
            <div class="line"><b>Tax Model:</b> <span>GST ${escapeHtml(String(data.taxPercent))}%</span></div>
            <div class="line"><b>Tax Split:</b> <span>CGST ${money(cgst)} · SGST ${money(sgst)}</span></div>
          </div>
          <div class="qr">${escapeHtml(qrLabel)}<br/>QR</div>
        </div>
      </div>

      <div class="totals">
        <div class="row">
          <span class="label">Gross Total</span>
          <span class="value">${money(data.grossTotal)}</span>
        </div>
        <div class="row">
          <span class="label">Discount</span>
          <span class="value">${money(data.discountAmount ?? 0)}</span>
        </div>
        <div class="row">
          <span class="label">GST (${escapeHtml(String(data.taxPercent))}%)</span>
          <span class="value">${money(data.taxTotal)}</span>
        </div>
        <div class="row">
          <span class="label">CGST</span>
          <span class="value">${money(cgst)}</span>
        </div>
        <div class="row">
          <span class="label">SGST</span>
          <span class="value">${money(sgst)}</span>
        </div>
        <div class="row payable">
          <span>Net Payable Amount</span>
          <span class="value">${money(data.netTotal)}</span>
        </div>
      </div>
    </section>

    <div class="thank-you">Thank you for your purchase. We wish you good health.</div>
    <div class="signature">
      <div class="signature-box">Authorized Signature</div>
    </div>

    <footer class="footer">
      <div><strong>Note:</strong> Goods once sold will not be taken back.</div>
      <div>For queries, contact billing desk within 24 hours.</div>
    </footer>
  </div>
</body>
</html>`
}

async function ensureHtml2PdfLoaded(): Promise<any> {
  if (typeof window === "undefined") return null
  if (window.html2pdf) return window.html2pdf

  try {
    // Prefer local dependency import so PDF works without external CDN/network.
    const mod = await import("html2pdf.js")
    const html2pdf = (mod as any)?.default ?? (mod as any)
    if (typeof html2pdf === "function") {
      window.html2pdf = html2pdf
      return html2pdf
    }
  } catch {
    // Fall through to explicit error below
  }

  throw new Error("Failed to load html2pdf.js")
}

export function generateBillPDFAndPrint(data: BillData): void {
  void generateBillPDF(data)
}

export async function generateBillPDF(data: BillData): Promise<void> {
  if (typeof window === "undefined") return

  const html2pdf = await ensureHtml2PdfLoaded()
  if (!html2pdf) throw new Error("html2pdf.js is not available")

  const wrapper = document.createElement("div")
  wrapper.style.position = "fixed"
  wrapper.style.left = "-100000px"
  wrapper.style.top = "0"
  wrapper.style.width = "210mm"
  wrapper.style.background = "#ffffff"
  wrapper.innerHTML = buildBillHTML(data)
  document.body.appendChild(wrapper)

  const element = wrapper.querySelector("#bill-root") as HTMLElement | null
  if (!element) {
    document.body.removeChild(wrapper)
    throw new Error("Unable to build bill template")
  }

  const customerPart = sanitizeFilePart(data.patientName || "Customer", "Customer")
  const datePart = sanitizeFilePart(String(data.date || ""), String(Date.now()))
  const fileName = `Pharmacy-Bill-${customerPart}-${datePart}.pdf`
  const configuredPrinterIds = getConfiguredPrinterIds(data)

  const shouldAutoPrint = configuredPrinterIds.length > 0
  const printBridgeUrl = getPrintBridgeUrl()
  const options = {
    margin: [6, 6, 6, 6],
    filename: fileName,
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
      avoid: ["tr", "td", ".totals", ".payment-box", ".thank-you"],
      before: ".footer",
    },
  }

  try {
    if (shouldAutoPrint) {
      // Phase 2 path: send PDF to print bridge for silent/direct printing.
      if (printBridgeUrl) {
        const pdfBlob = (await html2pdf().set(options).from(element).outputPdf("blob")) as Blob
        const bridgePrinted = await sendToPrintBridge(
          printBridgeUrl,
          pdfBlob,
          fileName,
          configuredPrinterIds,
          data
        )
        if (bridgePrinted) return
      }

      // Fallback: browser print dialog
      const printWin = window.open("", "_blank")
      if (printWin) {
        printWin.document.open()
        printWin.document.write(buildBillHTML(data))
        printWin.document.close()
        printWin.focus()
        // Auto-print flow for configured printer environments.
        setTimeout(() => {
          printWin.print()
          printWin.close()
        }, 300)
      } else {
        // Popup blocked, fallback to download.
        await html2pdf().set(options).from(element).save()
      }
    } else {
      await html2pdf().set(options).from(element).save()
    }
  } finally {
    document.body.removeChild(wrapper)
  }
}
