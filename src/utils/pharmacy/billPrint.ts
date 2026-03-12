/**
 * Pharmacy bill: generate PDF and open print dialog (auto-print when user confirms).
 */

export interface BillLine {
  name: string
  qty: number
  rate: number
  amount: number
  tax: number
}

export interface BillData {
  type: 'prescription' | 'walk_in'
  patientName: string
  customerPhone?: string
  doctorName?: string
  date: string
  branchName: string
  lines: BillLine[]
  grossTotal: number
  /** Discount amount (₹) applied before tax */
  discountAmount?: number
  taxTotal: number
  taxPercent: number
  netTotal: number
}

function buildBillHTML(data: BillData): string {
  const rows = data.lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)}</td><td class="num">${l.qty}</td><td class="num">${l.rate.toFixed(2)}</td><td class="num">${l.amount.toFixed(2)}</td><td class="num">${l.tax.toFixed(2)}</td></tr>`
    )
    .join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bill</title>
<style>
body { font-family: system-ui, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
h1 { font-size: 1.25rem; margin-bottom: 8px; }
.meta { color: #64748b; font-size: 0.875rem; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
th { background: #f1f5f9; }
.num { text-align: right; }
.totals { margin-top: 16px; text-align: right; font-size: 0.875rem; }
.totals .net { font-weight: bold; font-size: 1rem; margin-top: 4px; }
@media print { body { padding: 0; } }
</style></head><body>
<h1>Pharmacy Bill – ${data.type === 'walk_in' ? 'Walk-in' : 'Prescription'}</h1>
<div class="meta">
  ${escapeHtml(data.patientName)}${data.customerPhone ? ' · ' + escapeHtml(data.customerPhone) : ''}<br>
  ${data.doctorName ? escapeHtml(data.doctorName) + ' · ' : ''}${escapeHtml(data.date)} · ${escapeHtml(data.branchName)}
</div>
<table>
  <thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Rate (₹)</th><th class="num">Amount (₹)</th><th class="num">Tax (₹)</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div>Gross: ₹${data.grossTotal.toFixed(2)}</div>
  ${(data.discountAmount ?? 0) > 0 ? `<div>Discount: ₹${(data.discountAmount ?? 0).toFixed(2)}</div>` : ''}
  <div>Tax (${data.taxPercent}%): ₹${data.taxTotal.toFixed(2)}</div>
  <div class="net">Total: ₹${data.netTotal.toFixed(2)}</div>
</div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}


export function generateBillPDFAndPrint(data: BillData): void {
  if (typeof window === 'undefined') return
  // Download PDF only (no print window / no new tab) so fullscreen is not lost after billing
  generateBillPDF(data)
}

export function generateBillPDF(data: BillData): void {
  if (typeof window === 'undefined') return
  import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 15
    doc.setFontSize(14)
    doc.text('Pharmacy Bill – ' + (data.type === 'walk_in' ? 'Walk-in' : 'Prescription'), 14, y)
    y += 8
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`${data.patientName}${data.customerPhone ? ' · ' + data.customerPhone : ''}`, 14, y)
    y += 5
    doc.text(`${data.doctorName ? data.doctorName + ' · ' : ''}${data.date} · ${data.branchName}`, 14, y)
    y += 10
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    const colW = [70, 15, 22, 28, 25]
    const headers = ['Product', 'Qty', 'Rate', 'Amount', 'Tax']
    headers.forEach((h, i) => {
      const x = 14 + colW.slice(0, i).reduce((a, b) => a + b, 0)
      doc.text(h, x, y)
    })
    y += 6
    data.lines.forEach((l) => {
      doc.text(l.name.substring(0, 32), 14, y)
      doc.text(String(l.qty), 14 + colW[0], y)
      doc.text(l.rate.toFixed(2), 14 + colW[0] + colW[1], y)
      doc.text(l.amount.toFixed(2), 14 + colW[0] + colW[1] + colW[2], y)
      doc.text(l.tax.toFixed(2), 14 + colW[0] + colW[1] + colW[2] + colW[3], y)
      y += 5
    })
    y += 5
    doc.text(`Gross: ₹${data.grossTotal.toFixed(2)}`, 14, y)
    y += 5
    if ((data.discountAmount ?? 0) > 0) {
      doc.text(`Discount: ₹${(data.discountAmount ?? 0).toFixed(2)}`, 14, y)
      y += 5
    }
    doc.text(`Tax (${data.taxPercent}%): ₹${data.taxTotal.toFixed(2)}`, 14, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.text(`Total: ₹${data.netTotal.toFixed(2)}`, 14, y)
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const fileName = `Pharmacy-Bill-${data.type}-${data.date.replace(/\//g, '-')}.pdf`
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}
