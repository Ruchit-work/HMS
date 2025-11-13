import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { ROOM_TYPES } from "@/constants/roomTypes"
import type { RoomType } from "@/types/patient"

export async function POST() {
  try {
    const initResult = initFirebaseAdmin("rooms-seed API")
    if (!initResult.ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const firestore = admin.firestore()
    const snapshot = await firestore.collection("rooms").limit(1).get()
    if (!snapshot.empty) {
      return Response.json({ success: true, seeded: false, message: "Rooms already exist" })
    }

    const defaultRoomNumbers: Record<RoomType, string[]> = {
      general: ["101", "102"],
      semi_private: ["201", "202"],
      private: ["301"],
      deluxe: ["401"],
      vip: ["501"],
    }

    const sampleRooms = Object.entries(defaultRoomNumbers).flatMap(([type, numbers]) => {
      const roomTypeId = type as RoomType
      const roomDetails = ROOM_TYPES.find((roomType) => roomType.id === roomTypeId)
      return numbers.map((roomNumber) => ({
        roomNumber,
        roomType: roomTypeId,
        ratePerDay: roomDetails?.dailyRate ?? 0,
        status: "available" as const,
      }))
    })

    const batch = firestore.batch()
    const roomsCollection = firestore.collection("rooms")
    const nowIso = new Date().toISOString()

    sampleRooms.forEach((room) => {
      const ref = roomsCollection.doc()
      batch.set(ref, {
        ...room,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    })

    await batch.commit()

    return Response.json({ success: true, seeded: true })
  } catch (error: any) {
    console.error("rooms seed error", error)
    return Response.json(
      { error: error?.message || "Failed to seed rooms" },
      { status: 500 }
    )
  }
}


