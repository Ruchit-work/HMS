/**
 * Export pharmacy reports to Excel and PDF/print.
 * Standardized on html2pdf.js for PDF export.
 */
import ExcelJS from 'exceljs'
import {
  renderDocumentToPDFDownload,
  type StandardDocumentConfig,
  type DocumentTableColumn,
  type DocumentTableRow,
} from '@/shared/utils/documents/documentTemplateEngine'

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
  const tableColumns: DocumentTableColumn[] = columns.map((col, idx) => ({
    header: col,
    key: `col_${idx}`,
    align: idx > 1 && typeof rows[0]?.[idx] === 'number' ? 'right' : 'left',
  }))

  const tableRows: DocumentTableRow[] = rows.map((row) => {
    const rowObj: DocumentTableRow = {}
    row.forEach((cell, idx) => {
      rowObj[`col_${idx}`] = cell ?? '—'
    })
    return rowObj
  })

  const config: StandardDocumentConfig = {
    docTitle: title,
    docId: filename.toUpperCase(),
    docDate: new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    table: {
      columns: tableColumns,
      rows: tableRows,
    },
    footerNote: `Pharmacy Report Export: ${title}`,
  }

  void renderDocumentToPDFDownload(config, `${filename}.pdf`)
}
