/**
 * Export pharmacy reports to Excel and PDF/print.
 */
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'

function safeNum(n: number): number {
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0
}

export async function exportToExcel(
  filename: string,
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  rows: Record<string, string | number>[]
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 14 }))
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
  rows.forEach((r) => ws.addRow(r))
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportToPdf(
  title: string,
  columns: string[],
  rows: (string | number)[][],
  filename: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const colW = pageW / columns.length
  let y = 14
  doc.setFontSize(12)
  doc.text(title, 14, y)
  y += 10
  doc.setFontSize(9)
  doc.setFillColor(230, 230, 230)
  doc.rect(14, y, pageW - 28, 8, 'F')
  columns.forEach((col, i) => {
    doc.text(String(col), 14 + i * colW + 2, y + 5.5)
  })
  y += 8
  rows.slice(0, 40).forEach((row) => {
    if (y > 190) {
      doc.addPage()
      y = 14
    }
    row.forEach((cell, i) => {
      doc.text(String(cell ?? '').slice(0, 25), 14 + i * colW + 2, y + 4)
    })
    y += 6
  })
  doc.save(`${filename}.pdf`)
}

export function printReport(printRef: HTMLElement | null, title: string): void {
  if (!printRef) return
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`
    <!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:system-ui,sans-serif;padding:1rem;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;} th{background:#f1f5f9;}</style>
    </head><body><h2>${title}</h2>${printRef.innerHTML}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)
}

export { safeNum }
