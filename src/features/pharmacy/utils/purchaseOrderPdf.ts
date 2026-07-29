/**
 * Pharmacy Purchase Order PDF Generator
 * Built on top of HMS Centralized Document Template Components & Engine (html2pdf.js)
 */

import type { PharmacyPurchaseOrder } from '@/types/pharmacy'
import {
  renderDocumentToPDFDownload,
  renderDocumentToPDFAndOpen,
  type StandardDocumentConfig,
} from '@/shared/utils/documents/documentTemplateEngine'

const PDF_CURRENCY = '₹'

function buildPurchaseOrderConfig(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
): StandardDocumentConfig {
  const rawDate = typeof order.createdAt === 'string'
    ? order.createdAt
    : (order.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? ''

  const orderDate = rawDate ? new Date(rawDate).toLocaleDateString('en-IN') : '—'
  const expectedDate = order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toLocaleDateString('en-IN') : '—'
  const orderNo = String((order.orderNumber ?? order.id) || 'PO')

  const items = order.items ?? []
  const tableRows = items.map((item, idx) => {
    const qty = item.quantity ?? 0
    const unitCost = Number(item.unitCost ?? 0)
    const subtotal = qty * unitCost
    return {
      idx: idx + 1,
      medicine: item.medicineName ?? '—',
      manufacturer: item.manufacturer ?? '—',
      qty: String(qty),
      unitPrice: `${PDF_CURRENCY}${unitCost.toFixed(2)}`,
      subtotal: `${PDF_CURRENCY}${subtotal.toFixed(2)}`,
    }
  })

  return {
    docTitle: 'Pharmacy Purchase Order',
    docId: orderNo,
    docDate: orderDate,
    statusBadge: {
      label: (order.status || 'Pending').toUpperCase(),
      tone: order.status === 'received' ? 'completed' : 'pending',
    },
    hospitalSettings: {
      headerTitle: hospitalName || 'Hospital Pharmacy',
      address: hospitalAddress || undefined,
    },
    infoCards: [
      {
        title: 'Supplier & Delivery Branch',
        lines: [
          { label: 'Supplier Name', value: supplierName, isBold: true },
          { label: 'Branch Name', value: branchName },
        ],
      },
      {
        title: 'Order Details',
        lines: [
          { label: 'Order Date', value: orderDate },
          { label: 'Expected Delivery', value: expectedDate, isBold: true },
          { label: 'Total Items', value: String(items.length) },
        ],
      },
    ],
    bannerStrip: order.notes
      ? {
          title: 'Purchase Order Notes',
          text: order.notes,
          tone: 'info',
        }
      : undefined,
    table: {
      columns: [
        { header: '#', key: 'idx', width: '8%', align: 'center' },
        { header: 'Medicine Name', key: 'medicine', width: '37%' },
        { header: 'Manufacturer', key: 'manufacturer', width: '25%' },
        { header: 'Qty', key: 'qty', width: '10%', align: 'right' },
        { header: 'Unit Price', key: 'unitPrice', width: '10%', align: 'right' },
        { header: 'Subtotal', key: 'subtotal', width: '10%', align: 'right' },
      ],
      rows: tableRows,
    },
    totalsBox: [
      {
        label: 'Grand Order Total',
        value: `${PDF_CURRENCY}${Number(order.totalCost ?? 0).toFixed(2)}`,
        isGrandTotal: true,
      },
    ],
    signatureBox: {
      title: 'Authorized Purchase Signatory',
    },
  }
}

/** Generate PO PDF and trigger download */
export function downloadPurchaseOrderPDF(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
) {
  const config = buildPurchaseOrderConfig(order, supplierName, branchName, hospitalName, hospitalAddress)
  const raw = String(order.orderNumber ?? order.id).replace(/\s/g, '-')
  const filename = raw.toUpperCase().startsWith('PO-') ? `${raw}.pdf` : `PO-${raw}.pdf`
  void renderDocumentToPDFDownload(config, filename)
}

/** Generate PO PDF and open in new window for printing */
export function printPurchaseOrderPDF(
  order: PharmacyPurchaseOrder,
  supplierName: string,
  branchName: string,
  hospitalName?: string,
  hospitalAddress?: string
) {
  const config = buildPurchaseOrderConfig(order, supplierName, branchName, hospitalName, hospitalAddress)
  const raw = String(order.orderNumber ?? order.id).replace(/\s/g, '-')
  const filename = raw.toUpperCase().startsWith('PO-') ? `${raw}.pdf` : `PO-${raw}.pdf`
  void renderDocumentToPDFAndOpen(config, filename)
}
