/**
 * Parse medicine list from Excel, PDF, or (future) image.
 * Returns array of rows for creating/updating medicines and stock.
 */

export interface ParsedMedicineRow {
  name: string
  genericName?: string
  category?: string
  manufacturer?: string
  /** Strength e.g. 500mg, 10mg/ml */
  strength?: string
  /** Barcode / EAN */
  barcode?: string
  purchasePrice?: number
  sellingPrice?: number
  minStockLevel?: number
  quantity?: number
  batchNumber?: string
  /** Batch or catalog expiry (YYYY-MM-DD or parsed) */
  expiryDate?: string
  /** Catalog manufacturing date */
  manufacturingDate?: string
}

const EXCEL_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]
const PDF_MIME = 'application/pdf'
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

export function getFileKind(mime: string, filename: string): 'excel' | 'pdf' | 'image' | 'unknown' {
  const lower = (filename || '').toLowerCase()
  if (EXCEL_MIME.includes(mime) || lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'excel'
  if (mime === PDF_MIME || lower.endsWith('.pdf')) return 'pdf'
  if (IMAGE_MIME.includes(mime) || ['.jpg', '.jpeg', '.png', '.webp'].some((e) => lower.endsWith(e))) return 'image'
  return 'unknown'
}

/** Parse Excel buffer (xlsx/xls) - first sheet, first row = header */
export async function parseExcelBuffer(buffer: Buffer): Promise<ParsedMedicineRow[]> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const rows: ParsedMedicineRow[] = []
  const headerRow = sheet.getRow(1)
  const headers = headerRow.values as (string | number | undefined)[]
  const getCol = (names: string[]): number => {
    const idx = headers.findIndex((h) =>
      h != null && names.some((n) => String(h).toLowerCase().trim().includes(n))
    )
    return idx <= 0 ? -1 : idx
  }
  const nameCol = getCol(['name', 'medicine', 'drug'])
  const genericCol = getCol(['generic'])
  const categoryCol = getCol(['category', 'type'])
  const manufacturerCol = getCol(['manufacturer', 'company', 'maker'])
  const purchaseCol = getCol(['purchase', 'cost', 'buy'])
  const sellingCol = getCol(['selling', 'price', 'mrp', 'sale'])
  const minStockCol = getCol(['min', 'minimum', 'reorder'])
  const qtyCol = getCol(['quantity', 'qty', 'stock', 'qty'])
  const batchCol = getCol(['batch', 'batch no'])
  const expiryCol = getCol(['expiry', 'exp', 'expiry date'])
  // Manufacturing date – "mfg" is safe (not contained in "manufacturer")
  const mfgCol = getCol([
    'mfg date',
    'mfgdate',
    'mfg',
    'manufacturing date',
    'date of manufacture',
    'dom',
    'manuf date',
  ])
  const strengthCol = getCol(['strength', 'potency', 'dose'])
  const barcodeCol = getCol(['barcode', 'ean', 'upc', 'code'])

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i)
    const values = row.values as (string | number | undefined)[]
    const get = (col: number) => (col > 0 && values[col] != null ? String(values[col]).trim() : '')
    const getNum = (col: number) => {
      const v = col > 0 ? values[col] : undefined
      if (v == null) return undefined
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }
    const name = (nameCol > 0 ? get(nameCol) : get(1)) || (values[1] != null ? String(values[1]).trim() : '')
    if (!name) continue

    rows.push({
      name,
      genericName: genericCol > 0 ? get(genericCol) || undefined : undefined,
      category: categoryCol > 0 ? get(categoryCol) || undefined : undefined,
      manufacturer: manufacturerCol > 0 ? get(manufacturerCol) || undefined : undefined,
      strength: strengthCol > 0 ? get(strengthCol) || undefined : undefined,
      barcode: barcodeCol > 0 ? get(barcodeCol) || undefined : undefined,
      purchasePrice: purchaseCol > 0 ? getNum(purchaseCol) : undefined,
      sellingPrice: sellingCol > 0 ? getNum(sellingCol) : undefined,
      minStockLevel: minStockCol > 0 ? getNum(minStockCol) : undefined,
      quantity: qtyCol > 0 ? getNum(qtyCol) : undefined,
      batchNumber: batchCol > 0 ? get(batchCol) || undefined : undefined,
      expiryDate: expiryCol > 0 ? get(expiryCol) || undefined : undefined,
      manufacturingDate: mfgCol > 0 ? get(mfgCol) || undefined : undefined,
    })
  }
  return rows
}

/** Parse PDF text (caller extracts text) into medicine rows */
export function parsePdfText(text: string): ParsedMedicineRow[] {
  const rows: ParsedMedicineRow[] = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  for (const line of lines) {
    const nameMatch = line.match(/^[\d.]*\s*([A-Za-z][A-Za-z0-9\s\-]+?)(?:\s+\d+\s*(?:mg|g|ml|tablet|tab|cap)s?)?(?:\s|$)/i)
    const name = nameMatch ? nameMatch[1].trim() : line.split(/\s{2,}/)[0]?.trim()
    if (!name || name.length < 2) continue

    const qtyMatch = line.match(/(?:qty|quantity|stock|tablets?|caps?)[:\s]*(\d+)/i) || line.match(/\b(\d{2,})\s*(?:tablets?|caps?|strips?)\b/i)
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : undefined
    const priceMatch = line.match(/(?:price|mrp|rs\.?|₹)\s*[\s:]*(\d+(?:\.\d+)?)/i)
    const sellingPrice = priceMatch ? parseFloat(priceMatch[1]) : undefined

    rows.push({
      name,
      quantity: quantity && quantity < 100000 ? quantity : undefined,
      sellingPrice,
    })
  }
  return rows
}
