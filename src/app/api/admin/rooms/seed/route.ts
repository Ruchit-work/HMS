import admin from "firebase-admin"

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

    const sampleRooms = [
      { roomNumber: "101", roomType: "general", ratePerDay: 1500, status: "available" },
      { roomNumber: "102", roomType: "general", ratePerDay: 1500, status: "available" },
      { roomNumber: "201", roomType: "simple", ratePerDay: 2500, status: "available" },
      { roomNumber: "202", roomType: "simple", ratePerDay: 2500, status: "available" },
      { roomNumber: "301", roomType: "deluxe", ratePerDay: 4000, status: "available" },
      { roomNumber: "302", roomType: "deluxe", ratePerDay: 4000, status: "available" },
      { roomNumber: "401", roomType: "vip", ratePerDay: 6500, status: "available" },
    ]

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


