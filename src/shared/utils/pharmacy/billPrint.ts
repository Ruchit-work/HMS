/**
 * Pharmacy bill: modern HTML template + html2pdf.js export.
 * Built on top of HMS Centralized Document Template Components & Engine.
 */

import {
  escapeHtml,
  getSharedDocumentStyles,
  renderDocumentHeader,
  renderInfoCards,
  renderDocumentTable,
  renderTotalsBox,
  renderAdviceBox,
  renderSignatureBox,
  renderDocumentFooter,
  type DocumentInfoCard,
  type DocumentTableColumn,
  type DocumentTableRow,
  type DocumentTotalsRow,
} from "@/shared/utils/documents/templateComponents"

import { getHtml2Pdf, getDefaultHtml2PdfOptions, prepareContainerAndAssets } from "@/shared/utils/documents/html2pdfEngine"

interface BillLine {
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

interface BillData {
  type: "prescription" | "walk_in"
  patientName: string
  customerPhone?: string
  doctorName?: string
  date: string
  branchName: string
  lines: BillLine[]
  grossTotal: number
  discountAmount?: number
  /** Paise waived by hospital rounding policy (does not change MRP). */
  roundOffDiscount?: number
  taxTotal: number
  taxPercent: number
  netTotal: number
  paymentMethod?: "cash" | "upi" | "card" | "credit" | "other" | "bank_transfer" | string
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
  const paymentMethod = (data.paymentMethod || "cash").toUpperCase()
  const invoiceNo = data.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`
  const pharmacyName = data.pharmacyName || "Harmony Pharmacy"
  const pharmacyAddress = data.pharmacyAddress || "Hospital Campus, Main Road, India"
  const pharmacyPhone = data.pharmacyPhone || "+91 00000 00000"
  const gstNo = data.gstNumber || "GSTIN: NA"
  const qrLabel = data.qrCodeLabel || "Scan to Pay"
  const cgst = data.cgstAmount ?? data.taxTotal / 2
  const sgst = data.sgstAmount ?? data.taxTotal / 2

  const headerHTML = renderDocumentHeader({
    hospitalSettings: {
      headerTitle: pharmacyName,
      address: pharmacyAddress,
      phone: pharmacyPhone,
      taxRegistrationNo: gstNo,
      logoUrl: data.logoUrl,
    },
    docTitle: "Pharmacy Invoice",
    docId: invoiceNo,
    docDate: dt.date,
    docTime: dt.time || "-",
    customKv: [{ k: "Payment", v: paymentMethod }],
  })

  const infoCards: DocumentInfoCard[] = [
    {
      title: "Customer Details",
      lines: [
        { label: "Patient Name", value: data.patientName || "-", isBold: true },
        { label: "Customer Phone", value: data.customerPhone || "-" },
        { label: "Doctor Name", value: data.doctorName ? `Dr. ${data.doctorName}` : undefined },
      ],
    },
    {
      title: "Branch & Visit",
      lines: [
        { label: "Branch", value: data.branchName || "-", isBold: true },
        { label: "Invoice Type", value: data.type === "walk_in" ? "Walk-in" : "Prescription" },
        { label: "Total Items", value: String(data.lines.length) },
      ],
    },
  ]

  const infoGridHTML = renderInfoCards(infoCards)

  const columns: DocumentTableColumn[] = [
    { header: "Product Name", key: "name", width: "36%" },
    { header: "Batch No", key: "batch", width: "11%" },
    { header: "Expiry Date", key: "expiry", width: "13%" },
    { header: "Quantity", key: "qty", width: "10%", align: "right" },
    { header: "MRP", key: "mrp", width: "9%", align: "right" },
    { header: "Discount", key: "disc", width: "10%", align: "right" },
    { header: "Tax", key: "tax", width: "8%", align: "right" },
    { header: "Amount", key: "amount", width: "13%", align: "right" },
  ]

  const tableRows: DocumentTableRow[] = data.lines.map((line, idx) => ({
    name: `${escapeHtml(line.name || "-")}<div class="product-sub">Item ${idx + 1}</div>`,
    batch: line.batchNo || "-",
    expiry: line.expiryDate || "-",
    qty: String(line.qty || 0),
    mrp: money(line.mrp ?? line.rate),
    disc: money(line.discount ?? 0),
    tax: money(line.tax || 0),
    amount: money(line.amount || 0),
  }))

  const tableHTML = renderDocumentTable({ columns, rows: tableRows })

  const totalsBox: DocumentTotalsRow[] = [
    { label: "Medicine Total", value: money(data.grossTotal) },
    { label: "Discount", value: money(data.discountAmount ?? 0), isDiscount: true },
    { label: "Round Off Discount", value: money(data.roundOffDiscount ?? 0) },
    { label: `GST (${String(data.taxPercent)}%)`, value: money(data.taxTotal) },
    { label: "CGST", value: money(cgst) },
    { label: "SGST", value: money(sgst) },
    { label: "Final Payable Amount", value: money(data.netTotal), isGrandTotal: true },
  ]

  const totalsHTML = renderTotalsBox(totalsBox)

  const paymentBoxHTML = `
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
  `

  const adviceHTML = renderAdviceBox({
    title: "Note",
    text: "Thank you for your purchase. We wish you good health.",
  })

  const signatureHTML = renderSignatureBox({ title: "Authorized Signature" })
  const footerHTML = renderDocumentFooter(
    { headerTitle: pharmacyName },
    "Goods once sold will not be taken back. For queries, contact billing desk within 24 hours."
  )

  const styles = getSharedDocumentStyles("A4")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pharmacy Invoice</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <div class="invoice" id="bill-root">
    ${headerHTML}
    ${infoGridHTML}
    ${tableHTML}
    <section class="bottom">
      ${paymentBoxHTML}
      ${totalsHTML}
    </section>
    ${adviceHTML}
    ${signatureHTML}
    ${footerHTML}
  </div>
</body>
</html>`
}

export function generateBillPDFAndPrint(data: BillData): void {
  void generateBillPDF(data)
}

async function generateBillPDF(data: BillData): Promise<void> {
  if (typeof window === "undefined") return

  const html2pdf = await getHtml2Pdf()
  if (!html2pdf) throw new Error("html2pdf.js is not available")

  const html = buildBillHTML(data)
  const customerPart = sanitizeFilePart(data.patientName || "Customer", "Customer")
  const datePart = sanitizeFilePart(String(data.date || ""), String(Date.now()))
  const fileName = `Pharmacy-Bill-${customerPart}-${datePart}.pdf`
  const configuredPrinterIds = getConfiguredPrinterIds(data)

  const shouldAutoPrint = configuredPrinterIds.length > 0
  const printBridgeUrl = getPrintBridgeUrl()
  const options = getDefaultHtml2PdfOptions(fileName)

  const { wrapper, element } = await prepareContainerAndAssets(html, "210mm")

  try {
    if (shouldAutoPrint) {
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

      const printWin = window.open("", "_blank")
      if (printWin) {
        printWin.document.open()
        printWin.document.write(buildBillHTML(data))
        printWin.document.close()
        printWin.focus()
        setTimeout(() => {
          printWin.print()
          printWin.close()
        }, 300)
      } else {
        await html2pdf().set(options).from(element).save()
      }
    } else {
      await html2pdf().set(options).from(element).save()
    }
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
    }
  }
}
