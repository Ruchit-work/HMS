import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { getHospitalCollectionPath, getUserActiveHospitalId } from "@/utils/firebase/serverHospitalQueries"

export async function GET(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }
  try {
    const initResult = initFirebaseAdmin("receptionist-get-admission-packages API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    if (!hospitalId) return Response.json({ packages: [] })
    const firestore = admin.firestore()
    const snap = await firestore
      .collection(getHospitalCollectionPath(hospitalId, "admission_packages"))
      .where("isArchived", "!=", true)
      .limit(200)
      .get()
    const packages = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
    return Response.json({ packages })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to fetch packages" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }
  try {
    const initResult = initFirebaseAdmin("receptionist-create-admission-package API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    if (!hospitalId) return Response.json({ error: "No active hospital found" }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const packageName = typeof body?.packageName === "string" ? body.packageName.trim() : ""
    const fixedRate = Number(body?.fixedRate || 0)
    const includedItems = Array.isArray(body?.includedItems)
      ? body.includedItems
          .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : []
    const exclusions = typeof body?.exclusions === "string" ? body.exclusions.trim() : ""
    const notes = typeof body?.notes === "string" ? body.notes.trim() : ""
    const preferredRoomType =
      typeof body?.preferredRoomType === "string" && body.preferredRoomType.trim()
        ? body.preferredRoomType.trim()
        : null

    if (!packageName) return Response.json({ error: "Package name is required" }, { status: 400 })
    if (!Number.isFinite(fixedRate) || fixedRate < 0) {
      return Response.json({ error: "Fixed rate must be a valid positive number" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const existing = await firestore
      .collection(getHospitalCollectionPath(hospitalId, "admission_packages"))
      .where("packageName", "==", packageName)
      .limit(10)
      .get()
    if (existing.docs.some((docSnap) => (docSnap.data() || {}).isArchived !== true)) {
      return Response.json({ error: "Package name already exists" }, { status: 409 })
    }

    const nowIso = new Date().toISOString()
    const ref = await firestore.collection(getHospitalCollectionPath(hospitalId, "admission_packages")).add({
      packageName,
      fixedRate,
      includedItems,
      preferredRoomType,
      exclusions: exclusions || null,
      notes: notes || null,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
      hospitalId,
    })
    return Response.json({ success: true, packageId: ref.id })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to create package" }, { status: 500 })
  }
}
