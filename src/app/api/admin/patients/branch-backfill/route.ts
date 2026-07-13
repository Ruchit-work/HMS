import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import {
  getBranchIfBelongsToHospital,
  getFirstActiveBranchForHospital,
  getHospitalCollectionPath,
  getReceptionistDefaultBranch,
  getUserActiveHospitalId,
  resolveAuthorizedHospitalId,
} from "@/utils/firebase/serverHospitalQueries"

type TargetBranch = { id: string; name: string }

async function resolveTargetBranch(
  hospitalId: string,
  role: string | undefined,
  userId: string,
  explicitBranchId: string
): Promise<TargetBranch | null> {
  const trimmed = explicitBranchId.trim()
  if (trimmed && role === "admin") {
    const b = await getBranchIfBelongsToHospital(trimmed, hospitalId)
    if (b) return b
  }
  if (role === "receptionist") {
    const rb = await getReceptionistDefaultBranch(userId, "receptionist")
    if (rb.branchId) {
      const b = await getBranchIfBelongsToHospital(rb.branchId, hospitalId)
      if (b) return b
    }
  }
  return getFirstActiveBranchForHospital(hospitalId)
}

/**
 * POST body:
 * - dryRun?: boolean — count / sample only (default true)
 * - hospitalId?: string — admin only; receptionist uses active hospital
 * - targetBranchId?: string — admin only; must belong to hospital
 * - maxUpdates?: number — max patients to assign per request (default 400, max 2000)
 */
export async function POST(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success || !auth.user) {
    return createAuthErrorResponse(auth)
  }
  const role = auth.user.role
  if (role !== "admin" && role !== "receptionist") {
    return Response.json({ error: "Only admin or receptionist can run branch backfill." }, { status: 403 })
  }

  const initResult = initFirebaseAdmin("admin-patient-branch-backfill")
  if (!initResult.ok) {
    return Response.json({ error: "Server not configured for admin" }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const dryRun = body?.dryRun !== false
  const maxUpdates = Math.min(2000, Math.max(1, Number(body?.maxUpdates) || 400))

  const userHospitalId = await getUserActiveHospitalId(auth.user.uid)
  const requestedHospitalId =
    typeof body?.hospitalId === "string" && body.hospitalId.trim() ? body.hospitalId.trim() : null

  const hospitalId = await resolveAuthorizedHospitalId(auth.user.uid, requestedHospitalId || userHospitalId)

  if (role === "receptionist") {
    if (!userHospitalId) {
      return Response.json({ error: "No active hospital for this user." }, { status: 400 })
    }
    if (requestedHospitalId && requestedHospitalId !== userHospitalId) {
      return Response.json({ error: "Receptionists can only backfill their active hospital." }, { status: 403 })
    }
  }

  if (!hospitalId) {
    return Response.json(
      { error: "hospitalId is required (or set active hospital on your account), or access denied for requested hospital." },
      { status: 403 }
    )
  }

  const explicitBranch =
    typeof body?.targetBranchId === "string" && body.targetBranchId.trim() ? body.targetBranchId.trim() : ""

  const target = await resolveTargetBranch(hospitalId, role, auth.user.uid, explicitBranch)
  if (!target) {
    return Response.json(
      { error: "No target branch found. Create an active branch for this hospital or assign the receptionist to a branch." },
      { status: 400 }
    )
  }

  const firestore = admin.firestore()
  const col = firestore.collection(getHospitalCollectionPath(hospitalId, "patients"))
  const pageSize = 200
  const maxScan = 25000
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined
  let scanned = 0
  let updated = 0
  const samples: string[] = []
  const now = new Date().toISOString()
  let batch = firestore.batch()
  let batchOps = 0
  let reachedEnd = false

  const flushBatch = async () => {
    if (!dryRun && batchOps > 0) {
      await batch.commit()
      batch = firestore.batch()
      batchOps = 0
    }
  }

  while (scanned < maxScan && updated < maxUpdates && !reachedEnd) {
    let q: FirebaseFirestore.Query = col.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize)
    if (last) {
      q = q.startAfter(last)
    }
    const snap = await q.get()
    if (snap.empty) {
      reachedEnd = true
      break
    }

    for (const d of snap.docs) {
      if (scanned >= maxScan || updated >= maxUpdates) break
      scanned += 1
      const data = d.data() || {}
      const st = data.status
      if (st !== "active" && st !== "inactive") continue

      const bid = data.defaultBranchId
      if (bid != null && String(bid).trim() !== "") continue

      if (samples.length < 15) {
        samples.push(d.id)
      }

      if (dryRun) {
        updated += 1
        continue
      }

      batch.update(d.ref, {
        defaultBranchId: target.id,
        defaultBranchName: target.name,
        updatedAt: now,
      })
      batch.set(
        firestore.collection("patients").doc(d.id),
        {
          defaultBranchId: target.id,
          defaultBranchName: target.name,
          hospitalId,
          updatedAt: now,
        },
        { merge: true }
      )
      batchOps += 2
      updated += 1

      if (batchOps >= 400) {
        await flushBatch()
      }
    }

    last = snap.docs[snap.docs.length - 1]
    if (snap.size < pageSize) {
      reachedEnd = true
    }
    if (!dryRun && batchOps > 0 && (reachedEnd || updated >= maxUpdates)) {
      await flushBatch()
    }
  }

  if (!dryRun) {
    await flushBatch()
  }

  const wouldAssign = dryRun ? updated : undefined
  const committed = dryRun ? undefined : updated

  return Response.json({
    success: true,
    dryRun,
    hospitalId,
    targetBranch: target,
    scanned,
    wouldAssign,
    updated: committed,
    samplePatientDocIds: samples,
    reachedEnd,
    cappedByMaxUpdates: !reachedEnd && updated >= maxUpdates,
  })
}
