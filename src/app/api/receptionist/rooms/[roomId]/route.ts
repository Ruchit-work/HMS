import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

interface Params {
  roomId: string
}

export async function PATCH(req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist-update-room API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { roomId } = await context.params
    const body = await req.json().catch(() => ({}))
    if (!roomId) {
      return Response.json({ error: "Missing roomId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const roomRef = firestore.collection("rooms").doc(roomId)
    const roomSnap = await roomRef.get()
    if (!roomSnap.exists) {
      return Response.json({ error: "Room not found" }, { status: 404 })
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    }
    const customRoomTypeName =
      typeof body?.customRoomTypeName === "string" ? body.customRoomTypeName.trim() : ""
    if (typeof body?.roomType === "string" && body.roomType.trim()) {
      const nextRoomType = body.roomType.trim()
      if (nextRoomType === "custom" && !customRoomTypeName) {
        return Response.json({ error: "Custom room type name is required" }, { status: 400 })
      }
      updates.roomType = nextRoomType
      updates.customRoomTypeName = nextRoomType === "custom" ? customRoomTypeName : null
    }
    if (body?.status === "available" || body?.status === "occupied" || body?.status === "maintenance") {
      updates.status = body.status
    }
    if (body?.ratePerDay !== undefined) {
      const rate = Number(body.ratePerDay)
      if (!Number.isFinite(rate) || rate < 0) {
        return Response.json({ error: "Rate per day must be a valid positive number" }, { status: 400 })
      }
      updates.ratePerDay = rate
    }

    await roomRef.update(updates)
    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to update room" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<Params> }) {
  const auth = await authenticateRequest(req)
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }
  if (auth.user && auth.user.role !== "receptionist" && auth.user.role !== "admin") {
    return Response.json(
      { error: "Access denied. This endpoint requires receptionist or admin role." },
      { status: 403 }
    )
  }

  try {
    const initResult = initFirebaseAdmin("receptionist-archive-room API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { roomId } = await context.params
    if (!roomId) {
      return Response.json({ error: "Missing roomId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const roomRef = firestore.collection("rooms").doc(roomId)
    const roomSnap = await roomRef.get()
    if (!roomSnap.exists) {
      return Response.json({ error: "Room not found" }, { status: 404 })
    }

    const roomData = roomSnap.data() || {}
    if (roomData.status === "occupied") {
      return Response.json({ error: "Cannot archive an occupied room" }, { status: 400 })
    }

    await roomRef.update({
      isArchived: true,
      status: "maintenance",
      updatedAt: new Date().toISOString(),
    })

    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to archive room" }, { status: 500 })
  }
}
