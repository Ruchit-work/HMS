import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"
import { getHospitalCollectionPath, getUserActiveHospitalId } from "@/utils/firebase/serverHospitalQueries"

interface Params {
  packageId: string
}

export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }
  try {
    const initResult = initFirebaseAdmin("receptionist-update-admission-package API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    const { packageId } = await context.params
    if (!packageId) return Response.json({ error: "Missing packageId" }, { status: 400 })
    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    if (!hospitalId) return Response.json({ error: "No active hospital found" }, { status: 400 })
    const body = await req.json().catch(() => ({}))

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (typeof body?.packageName === "string" && body.packageName.trim()) updates.packageName = body.packageName.trim()
    if (body?.fixedRate !== undefined) {
      const fixedRate = Number(body.fixedRate)
      if (!Number.isFinite(fixedRate) || fixedRate < 0) {
        return Response.json({ error: "Fixed rate must be a valid positive number" }, { status: 400 })
      }
      updates.fixedRate = fixedRate
    }
    if (Array.isArray(body?.includedItems)) {
      updates.includedItems = body.includedItems
        .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    }
    if (body?.exclusions !== undefined) {
      updates.exclusions = typeof body.exclusions === "string" && body.exclusions.trim() ? body.exclusions.trim() : null
    }
    if (body?.notes !== undefined) {
      updates.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null
    }
    if (body?.preferredRoomType !== undefined) {
      updates.preferredRoomType =
        typeof body.preferredRoomType === "string" && body.preferredRoomType.trim()
          ? body.preferredRoomType.trim()
          : null
    }

    const ref = admin.firestore().collection(getHospitalCollectionPath(hospitalId, "admission_packages")).doc(packageId)
    await ref.update(updates)
    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to update package" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }
  try {
    const initResult = initFirebaseAdmin("receptionist-archive-admission-package API")
    if (!initResult.ok) return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    const { packageId } = await context.params
    if (!packageId) return Response.json({ error: "Missing packageId" }, { status: 400 })
    const hospitalId = await getUserActiveHospitalId(auth.user!.uid)
    if (!hospitalId) return Response.json({ error: "No active hospital found" }, { status: 400 })
    const ref = admin.firestore().collection(getHospitalCollectionPath(hospitalId, "admission_packages")).doc(packageId)
    await ref.update({ isArchived: true, updatedAt: new Date().toISOString() })
    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to archive package" }, { status: 500 })
  }
}
