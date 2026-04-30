import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { NextRequest } from "next/server"
import { authenticateRequest, createAuthErrorResponse } from "@/utils/firebase/apiAuth"

interface Params {
  admissionId: string
}

export async function POST(req: NextRequest, context: { params: Promise<Params> }) {
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
    const initResult = initFirebaseAdmin("receptionist-transfer-room API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const { admissionId } = await context.params
    if (!admissionId) {
      return Response.json({ error: "Missing admissionId" }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const nextRoomId = typeof body?.roomId === "string" ? body.roomId.trim() : ""
    const notes = typeof body?.notes === "string" ? body.notes.trim() : ""

    if (!nextRoomId) {
      return Response.json({ error: "Missing roomId" }, { status: 400 })
    }

    const firestore = admin.firestore()
    const nowIso = new Date().toISOString()
    const admissionRef = firestore.collection("admissions").doc(admissionId)
    const nextRoomRef = firestore.collection("rooms").doc(nextRoomId)

    const result = await firestore.runTransaction(async (tx) => {
      const admissionSnap = await tx.get(admissionRef)
      if (!admissionSnap.exists) throw new Error("Admission not found")
      const admissionData = admissionSnap.data() || {}
      if (admissionData.status !== "admitted") {
        throw new Error("Only admitted patients can be transferred")
      }

      const currentRoomId = String(admissionData.roomId || "")
      if (!currentRoomId) throw new Error("Current room not found in admission")
      if (currentRoomId === nextRoomId) throw new Error("Patient is already assigned to this room")

      const currentRoomRef = firestore.collection("rooms").doc(currentRoomId)
      const currentRoomSnap = await tx.get(currentRoomRef)
      const nextRoomSnap = await tx.get(nextRoomRef)

      if (!nextRoomSnap.exists) throw new Error("Target room not found")
      const nextRoomData = nextRoomSnap.data() || {}
      if (nextRoomData.status && nextRoomData.status !== "available") {
        throw new Error("Target room is not available")
      }

      const existingRoomStays = Array.isArray(admissionData.roomStays) ? admissionData.roomStays : []
      const normalizedRoomStays = existingRoomStays.map((stay: any) => ({ ...stay }))
      if (normalizedRoomStays.length > 0) {
        const lastIndex = normalizedRoomStays.length - 1
        normalizedRoomStays[lastIndex] = {
          ...normalizedRoomStays[lastIndex],
          toAt: nowIso,
        }
      } else {
        normalizedRoomStays.push({
          roomId: currentRoomId,
          roomNumber: String(admissionData.roomNumber || ""),
          roomType: String(admissionData.roomType || "general"),
          customRoomTypeName: admissionData.customRoomTypeName || null,
          ratePerDay: Number(admissionData.roomRatePerDay || 0),
          fromAt: String(admissionData.checkInAt || nowIso),
          toAt: nowIso,
        })
      }
      normalizedRoomStays.push({
        roomId: nextRoomId,
        roomNumber: String(nextRoomData.roomNumber || ""),
        roomType: String(nextRoomData.roomType || "general"),
        customRoomTypeName: nextRoomData.customRoomTypeName || null,
        ratePerDay: Number(nextRoomData.ratePerDay || 0),
        fromAt: nowIso,
        toAt: null,
      })

      tx.update(admissionRef, {
        roomId: nextRoomId,
        roomNumber: nextRoomData.roomNumber || "",
        roomType: nextRoomData.roomType || "general",
        customRoomTypeName: nextRoomData.customRoomTypeName || null,
        roomRatePerDay: Number(nextRoomData.ratePerDay || 0),
        roomStays: normalizedRoomStays,
        notes: [admissionData.notes || "", notes ? `Room transfer: ${notes}` : ""].filter(Boolean).join("\n"),
        updatedAt: nowIso,
      })

      tx.update(nextRoomRef, {
        status: "occupied",
        updatedAt: nowIso,
      })

      if (currentRoomSnap.exists) {
        tx.update(currentRoomRef, {
          status: "available",
          updatedAt: nowIso,
        })
      }

      return {
        roomId: nextRoomId,
        roomNumber: String(nextRoomData.roomNumber || ""),
        roomType: String(nextRoomData.roomType || "general"),
        customRoomTypeName: nextRoomData.customRoomTypeName || null,
        roomRatePerDay: Number(nextRoomData.ratePerDay || 0),
        roomStays: normalizedRoomStays,
      }
    })

    return Response.json({ success: true, updatedRoom: result })
  } catch (error: any) {
    return Response.json(
      { error: error?.message || "Failed to transfer room" },
      { status: 500 }
    )
  }
}
