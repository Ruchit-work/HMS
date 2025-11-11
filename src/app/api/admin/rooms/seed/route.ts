import admin from "firebase-admin"
import { ROOM_TYPES } from "@/constants/roomTypes"
import type { RoomType } from "@/types/patient"

function initAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (privateKey && privateKey.startsWith("\"") && privateKey.endsWith("\"")) {
      privateKey = privateKey.slice(1, -1)
    }
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, "\n")
    }

    if (!projectId || !clientEmail || !privateKey) {
      console.warn("Firebase Admin credentials missing for rooms seed API.")
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
  }
  return true
}

export async function POST() {
  try {
    const ok = initAdmin()
    if (!ok) {
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


