import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import { isPlatformSuperAdmin } from "@/shared/utils/firebase/serverHospitalQueries"
import { DEFAULT_HOSPITAL_BILLING_SETTINGS } from "@/shared/utils/billingSettings"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"

/**
 * POST /api/admin/hospital-billing-settings/migrate
 * Idempotent backfill of settings.billing defaults for hospitals missing them.
 * Super Admin only. Supports dryRun=true (default).
 */
export async function POST(request: Request) {
  const limit = await applyRateLimit(request, "ADMIN")
  if (limit instanceof Response) return limit

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user || !(await isPlatformSuperAdmin(auth.user.uid))) {
    return NextResponse.json({ error: "Platform Super Admin access required" }, { status: 403 })
  }

  try {
    const initResult = initFirebaseAdmin("hospital billing settings migrate")
    if (!initResult.ok) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = body?.dryRun !== false
    const maxUpdates = Math.min(Math.max(Number(body?.maxUpdates) || 500, 1), 2000)

    const snap = await admin.firestore().collection("hospitals").limit(maxUpdates).get()
    let scanned = 0
    let alreadySet = 0
    let updated = 0
    const sample: string[] = []

    let batch = admin.firestore().batch()
    let batchCount = 0

    for (const doc of snap.docs) {
      scanned += 1
      const data = doc.data() || {}
      if (data?.settings?.billing && typeof data.settings.billing === "object") {
        alreadySet += 1
        continue
      }
      sample.push(doc.id)
      if (!dryRun) {
        batch.update(doc.ref, {
          "settings.billing": DEFAULT_HOSPITAL_BILLING_SETTINGS,
          "settings.billingUpdatedAt": new Date().toISOString(),
          "settings.billingUpdatedBy": auth.user.uid,
          updatedAt: new Date().toISOString(),
        })
        batchCount += 1
        updated += 1
        if (batchCount >= 400) {
          await batch.commit()
          batch = admin.firestore().batch()
          batchCount = 0
        }
      } else {
        updated += 1
      }
    }

    if (!dryRun && batchCount > 0) {
      await batch.commit()
    }

    return NextResponse.json({
      success: true,
      dryRun,
      scanned,
      alreadySet,
      updated,
      sampleHospitalIds: sample.slice(0, 20),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Migration failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
