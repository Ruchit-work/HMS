import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import {
  getBranchIfBelongsToHospital,
  getHospitalCollectionPath,
  getReceptionistDefaultBranch,
  getUserActiveHospitalId,
} from "@/utils/firebase/serverHospitalQueries"

type RouteContext = {
  params: Promise<{ patientId: string }>
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (!auth.user || (auth.user.role !== "receptionist" && auth.user.role !== "admin")) {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  const initResult = initFirebaseAdmin("receptionist-update-patient-branch API")
  if (!initResult.ok) {
    return Response.json({ error: "Server not configured for admin" }, { status: 500 })
  }

  const { patientId: patientDocIdRaw } = await context.params
  const patientDocId = (patientDocIdRaw || "").trim()
  if (!patientDocId) {
    return Response.json({ error: "Missing patientId" }, { status: 400 })
  }

  const hospitalId = await getUserActiveHospitalId(auth.user.uid)
  if (!hospitalId) {
    return Response.json({ error: "No active hospital for current user" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const requestedBranchId = typeof body?.branchId === "string" ? body.branchId.trim() : ""

  let branchId = requestedBranchId
  if (!branchId && auth.user.role === "receptionist") {
    const receptionistBranch = await getReceptionistDefaultBranch(auth.user.uid, "receptionist")
    branchId = receptionistBranch.branchId || ""
  }
  if (!branchId) {
    return Response.json({ error: "branchId is required" }, { status: 400 })
  }

  const branch = await getBranchIfBelongsToHospital(branchId, hospitalId)
  if (!branch) {
    return Response.json({ error: "Selected branch is invalid for current hospital" }, { status: 400 })
  }

  const firestore = admin.firestore()
  const rootRef = firestore.collection("patients").doc(patientDocId)
  const hospitalRef = firestore
    .collection(getHospitalCollectionPath(hospitalId, "patients"))
    .doc(patientDocId)

  const [rootSnap, hospitalSnap] = await Promise.all([rootRef.get(), hospitalRef.get()])
  if (!rootSnap.exists && !hospitalSnap.exists) {
    return Response.json({ error: "Patient not found" }, { status: 404 })
  }

  const nowIso = new Date().toISOString()
  const updates = {
    defaultBranchId: branch.id,
    defaultBranchName: branch.name,
    hospitalId,
    updatedAt: nowIso,
  }

  const seed = (hospitalSnap.exists ? hospitalSnap.data() : rootSnap.data()) || {}
  await Promise.all([
    rootRef.set({ ...updates }, { merge: true }),
    hospitalRef.set({ ...seed, ...updates }, { merge: true }),
  ])

  return Response.json({
    success: true,
    patientId: patientDocId,
    hospitalId,
    branch: { id: branch.id, name: branch.name },
  })
}
