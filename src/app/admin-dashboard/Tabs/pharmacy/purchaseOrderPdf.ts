import jsPDF from 'jspdf'
import type { PharmacyPurchaseOrder } from '@/types/pharmacy'

const PDF_CURRENCY = 'Rs. '

/** Build PO PDF (header, details, items table, total). Returns jsPDF instance. */
function buildPurchaseOrderPDF(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
): jsPDF {
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 20
  let y = 20

  pdf.setFillColor(37, 99, 235)
  const headerHeight = hospitalName || hospitalAddress ? 44 : 32
  pdf.rect(0, 0, pageWidth, headerHeight, 'F')
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Purchase Order', margin, 22)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text((order.orderNumber ?? order.id) + '', pageWidth - margin, 22, { align: 'right' })
  if (hospitalName || hospitalAddress) {
    pdf.setFontSize(9)
    if (hospitalName) pdf.text(hospitalName, margin, 34)
    if (hospitalAddress) pdf.text(hospitalAddress, margin, 40)
  }

  y = headerHeight + 10
  pdf.setTextColor(0, 0, 0)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Supplier', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(supplierName, margin + 45, y)
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.text('Branch', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(branchName, margin + 45, y)
  y += 8
  const orderDate = typeof order.createdAt === 'string' ? order.createdAt : (order.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''
  pdf.setFont('helvetica', 'bold')
  pdf.text('Order date', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(orderDate ? new Date(orderDate).toLocaleDateString() : '—', margin + 45, y)
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.text('Expected delivery', margin, y)
  pdf.setFont('helvetica', 'normal')
  pdf.text(order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString() : '—', margin + 45, y)
  y += 8
  if (order.notes) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('Notes', margin, y)
    pdf.setFont('helvetica', 'normal')
    const noteLines = pdf.splitTextToSize(order.notes, pageWidth - margin - 50)
    pdf.text(noteLines, margin + 45, y)
    y += noteLines.length * 5 + 4
  }
  y += 6

  const colW = [60, 45, 18, 28, 32]
  const headers = ['Medicine', 'Manufacturer', 'Qty', 'Unit price', 'Subtotal']
  pdf.setFillColor(241, 245, 249)
  pdf.rect(margin, y, colW.reduce((a, b) => a + b, 0), 8, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  let x = margin
  headers.forEach((h, i) => {
    pdf.text(h, x + (i < 2 ? 2 : colW[i] - 2), y + 5.5, i >= 2 ? { align: 'right' } : {})
    x += colW[i]
  })
  y += 10

  pdf.setFont('helvetica', 'normal')
  const items = order.items ?? []
  for (let i = 0; i < items.length; i++) {
    const line = items[i]
    const subtotal = (line.quantity ?? 0) * Number(line.unitCost ?? 0)
    if (y > 260) { pdf.addPage(); y = 20 }
    x = margin
    pdf.setFontSize(9)
    const medText = pdf.splitTextToSize(line.medicineName ?? '', colW[0] - 4)
    pdf.text(medText[0], x + 2, y + 4)
    x += colW[0]
    const mfrText = pdf.splitTextToSize((line.manufacturer ?? '—'), colW[1] - 4)
    pdf.text(mfrText[0], x + 2, y + 4)
    x += colW[1]
    pdf.text(String(line.quantity ?? 0), x + colW[2] - 2, y + 4, { align: 'right' })
    x += colW[2]
    pdf.text(PDF_CURRENCY + Number(line.unitCost ?? 0).toFixed(2), x + colW[3] - 2, y + 4, { align: 'right' })
    x += colW[3]
    pdf.text(PDF_CURRENCY + subtotal.toFixed(2), x + colW[4] - 2, y + 4, { align: 'right' })
    y += Math.max(8, medText.length * 5, mfrText.length * 5)
  }
  y += 8
  pdf.setFont('helvetica', 'bold')
  pdf.text('Order total: ' + PDF_CURRENCY + Number(order.totalCost ?? 0).toFixed(2), pageWidth - margin, y, { align: 'right' })

  return pdf
}

/** Generate PO PDF and trigger download */
export function downloadPurchaseOrderPDF(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
) {
  const pdf = buildPurchaseOrderPDF(order, supplierName, branchName, hospitalName, hospitalAddress)
  const raw = (order.orderNumber ?? order.id).replace(/\s/g, '-')
  const filename = raw.toUpperCase().startsWith('PO-') ? `${raw}.pdf` : `PO-${raw}.pdf`
  pdf.save(filename)
}

/** Generate PO PDF and open in new window for printing (no download) */
export function printPurchaseOrderPDF(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
) {
  const pdf = buildPurchaseOrderPDF(order, supplierName, branchName, hospitalName, hospitalAddress)
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank', 'noopener')
  if (w) w.onload = () => { URL.revokeObjectURL(url); w.print() }
  else URL.revokeObjectURL(url)
}
