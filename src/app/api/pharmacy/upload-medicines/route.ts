/**
 * POST: Bulk upload medicines (and optional stock) from Excel, PDF, or image.
 * FormData: file (required), branchId (optional).
 * Excel/PDF are parsed; images are accepted but return a message to use Excel/PDF for parsing.
 */

import { NextRequest, NextResponse } from 'next/server'
import { admin, initFirebaseAdmin } from '@/server/firebaseAdmin'
import { authenticateRequest, createAuthErrorResponse } from '@/utils/firebase/apiAuth'
import { getPharmacyAuthContext, getPharmacyCollectionPath, nanoidLike } from '@/utils/pharmacy/serverPharmacy'
import { getFileKind, parseExcelBuffer, parsePdfText, type ParsedMedicineRow } from '@/utils/pharmacy/parseMedicineFile'
import type { MedicineBatch } from '@/types/pharmacy'

function getStockDocId(branchId: string, medicineId: string): string {
  return `${branchId}_${medicineId}`
}

/** Normalize to YYYY-MM-DD or null. Accepts YYYY-MM-DD or DD/MM/YYYY. */
function normalizeDate(v: unknown): string | null {
  if (v == null || typeof v !== 'string') return null
  const s = (v as string).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  return null
}

/** Build an object without undefined values (Firestore rejects undefined). */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseMod = await import('pdf-parse')
  const pdfParse = (pdfParseMod as any).default ?? (pdfParseMod as any)
  const data = typeof pdfParse === 'function' ? await pdfParse(buffer) : await (pdfParse.parse ?? pdfParse)(buffer)
  return (data?.text || '').trim()
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthErrorResponse(auth)

  const init = initFirebaseAdmin('pharmacy/upload-medicines')
  if (!init.ok) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ctxResult = await getPharmacyAuthContext(auth.user, {})
  if (!ctxResult.success) return NextResponse.json({ success: false, error: ctxResult.error }, { status: 403 })

  let file: File
  let branchId: string | null = null
  try {
    const formData = await request.formData()
    file = formData.get('file') as File
    const branchIdVal = formData.get('branchId')
    if (branchIdVal && typeof branchIdVal === 'string') branchId = branchIdVal.trim() || null
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: 'No file or empty file' }, { status: 400 })
  }

  const filename = file.name || ''
  const mime = file.type || ''
  const kind = getFileKind(mime, filename)

  if (kind === 'unknown') {
    return NextResponse.json({
      success: false,
      error: 'Unsupported file type. Use Excel (.xlsx, .xls), PDF, or image (.jpg, .png).',
    }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let rows: ParsedMedicineRow[] = []
  let message: string | undefined

  if (kind === 'excel') {
    try {
      rows = await parseExcelBuffer(buffer)
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse Excel file. Ensure it is .xlsx/.xls with a header row.',
      }, { status: 400 })
    }
  } else if (kind === 'pdf') {
    try {
      const text = await extractPdfText(buffer)
      rows = parsePdfText(text)
    } catch (e) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse PDF. Try uploading an Excel file for best results.',
      }, { status: 400 })
    }
  } else {
    return NextResponse.json({
      success: true,
      message: 'Image upload is supported; automatic parsing is not available yet. Please use an Excel (.xlsx) or PDF file for bulk import, or add medicines manually.',
      created: 0,
      updated: 0,
    })
  }

  if (rows.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No medicine rows found in the file.',
      created: 0,
      updated: 0,
    })
  }

  const hasAnyStock = rows.some((r) => (r.quantity != null ? Number(r.quantity) : 0) > 0)
  if (hasAnyStock && !branchId) {
    return NextResponse.json({
      success: false,
      error: 'Select a branch to add stock to. Please choose a branch from the dropdown above and try again. If your file has no branch column, stock will be added to the selected branch.',
    }, { status: 400 })
  }

  const db = admin.firestore()
  const hospitalId = ctxResult.context.hospitalId
  const medicinesPath = getPharmacyCollectionPath(hospitalId, 'medicines')
  const stockPath = getPharmacyCollectionPath(hospitalId, 'stock')
  const now = new Date().toISOString()

  const firstBranchId: string | null = branchId || null

  const medicinesSnap = await db.collection(medicinesPath).get()
  const nameToId = new Map<string, string>()
  medicinesSnap.docs.forEach((d) => {
    const name = (d.data()?.name as string)?.toLowerCase?.()
    if (name) nameToId.set(name, d.id)
  })

  let created = 0
  let updated = 0
  let skipped = 0
  const skippedReasons: string[] = []

  try {
    for (const [index, row] of rows.entries()) {
      const rowNum = index + 1
      const name = row.name?.trim()
      if (!name) {
        skipped++
        skippedReasons.push(`Row ${rowNum}: Missing medicine name (required)`)
        continue
      }

      const nameKey = name.toLowerCase()
      let medicineId = nameToId.get(nameKey)

      if (!medicineId) {
        medicineId = nanoidLike()
        const docRef = db.collection(medicinesPath).doc(medicineId)
        const mfg = normalizeDate(row.manufacturingDate)
        const exp = normalizeDate(row.expiryDate)
        const payload = omitUndefined({
          hospitalId,
          medicineId,
          name,
          genericName: row.genericName?.trim() ?? '',
          category: row.category?.trim() ?? '',
          manufacturer: row.manufacturer?.trim() ?? '',
          purchasePrice: Number(row.purchasePrice) || 0,
          sellingPrice: Number(row.sellingPrice) || 0,
          minStockLevel: Math.max(0, Number(row.minStockLevel) || 0),
          supplierId: null,
          unit: 'tablets',
          ...(mfg != null && { manufacturingDate: mfg }),
          ...(exp != null && { expiryDate: exp }),
          createdAt: now,
          updatedAt: now,
        })
        await docRef.set(payload)
        nameToId.set(nameKey, medicineId)
        created++
      } else {
        const mfg = normalizeDate(row.manufacturingDate)
        const exp = normalizeDate(row.expiryDate)
        if (mfg != null || exp != null) {
          const docRef = db.collection(medicinesPath).doc(medicineId)
          const updates: Record<string, unknown> = { updatedAt: now }
          if (mfg != null) updates.manufacturingDate = mfg
          if (exp != null) updates.expiryDate = exp
          await docRef.update(updates)
        }
        updated++
      }

      const qty = row.quantity != null ? Number(row.quantity) : 0
      if (firstBranchId && qty > 0) {
        const batch: MedicineBatch = {
          id: nanoidLike(),
          batchNumber: row.batchNumber?.trim() || `BATCH-${medicineId.slice(0, 6)}`,
          expiryDate:
            row.expiryDate?.trim() ||
            new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          quantity: qty,
          receivedAt: now,
        }
        const stockId = getStockDocId(firstBranchId, medicineId)
        const stockRef = db.collection(stockPath).doc(stockId)
        const stockSnap = await stockRef.get()
        const medicineDoc = await db.collection(medicinesPath).doc(medicineId).get()
        const medicineName = (medicineDoc.data()?.name as string) || name

        if (!stockSnap.exists) {
          await stockRef.set({
            hospitalId,
            branchId: firstBranchId,
            medicineId,
            medicineName,
            batches: [batch],
            totalQuantity: batch.quantity,
            updatedAt: now,
          })
        } else {
          const data = stockSnap.data()!
          const batches: MedicineBatch[] = Array.isArray(data.batches) ? [...data.batches, batch] : [batch]
          const totalQuantity = (Number(data.totalQuantity) || 0) + batch.quantity
          await stockRef.update({
            batches,
            totalQuantity,
            medicineName,
            updatedAt: now,
          })
        }
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }

  let resultMessage = message || `Processed ${rows.length} row(s): ${created} new, ${updated} updated.`
  if (skipped > 0) {
    resultMessage += ` ${skipped} row(s) skipped (missing medicine name).`
    if (skippedReasons.length > 0) {
      const show = skippedReasons.slice(0, 5)
      resultMessage += ` ${show.join('; ')}${skippedReasons.length > 5 ? ` … and ${skippedReasons.length - 5} more` : ''}`
    }
  }
  if (firstBranchId && (created > 0 || updated > 0)) resultMessage += ' Stock added to selected branch.'

  return NextResponse.json({
    success: true,
    message: resultMessage,
    created,
    updated,
    skipped,
    skippedReasons: skippedReasons.length > 0 ? skippedReasons : undefined,
  })
}
