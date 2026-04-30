import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

export async function POST(req: Request) {
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
    const initResult = initFirebaseAdmin("receptionist-create-room API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const roomNumber = typeof body?.roomNumber === "string" ? body.roomNumber.trim() : ""
    const roomType = typeof body?.roomType === "string" ? body.roomType.trim() : ""
    const customRoomTypeName =
      typeof body?.customRoomTypeName === "string" ? body.customRoomTypeName.trim() : ""
    const ratePerDay = Number(body?.ratePerDay || 0)
    const status =
      body?.status === "occupied" || body?.status === "maintenance" ? body.status : "available"

    if (!roomNumber) {
      return Response.json({ error: "Room number is required" }, { status: 400 })
    }
    if (!roomType) {
      return Response.json({ error: "Room type is required" }, { status: 400 })
    }
    if (roomType === "custom" && !customRoomTypeName) {
      return Response.json({ error: "Custom room type name is required" }, { status: 400 })
    }
    if (!Number.isFinite(ratePerDay) || ratePerDay < 0) {
      return Response.json({ error: "Rate per day must be a valid positive number" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const existingCandidates = await firestore
      .collection("rooms")
      .where("roomNumber", "==", roomNumber)
      .limit(10)
      .get()
    const hasActiveRoomWithSameNumber = existingCandidates.docs.some((docSnap) => {
      const data = docSnap.data() || {}
      return data.isArchived !== true
    })
    if (hasActiveRoomWithSameNumber) {
      return Response.json({ error: "Room number already exists" }, { status: 409 })
    }

    const nowIso = new Date().toISOString()
    const roomRef = await firestore.collection("rooms").add({
      roomNumber,
      roomType,
      customRoomTypeName: roomType === "custom" ? customRoomTypeName : null,
      ratePerDay,
      status,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    })

    return Response.json({ success: true, roomId: roomRef.id })
  } catch (error: any) {
    return Response.json({ error: error?.message || "Failed to create room" }, { status: 500 })
  }
}
