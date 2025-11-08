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
      console.warn("Firebase Admin credentials missing for billing records API.")
      return false
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    })
  }
  return true
}

export async function GET() {
  try {
    const ok = initAdmin()
    if (!ok) {
      return Response.json({ error: "Server not configured for admin" }, { status: 500 })
    }

    const firestore = admin.firestore()
    const snapshot = await firestore
      .collection("billing_records")
      .orderBy("generatedAt", "desc")
      .limit(50)
      .get()

    const records = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() || {}
        let patientName = data.patientName || null
        let patientUid = data.patientUid || null
        const patientId = data.patientId || null

        const needsEnrichment =
          !patientName ||
          (typeof patientName === "string" && patientName.trim().toLowerCase() === "unknown")

        if (needsEnrichment) {
          try {
            if (patientUid) {
              const patientDoc = await firestore.collection("patients").doc(String(patientUid)).get()
              if (patientDoc.exists) {
                const patient = patientDoc.data() as any
                const composed = [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim()
                patientName = composed || patient?.fullName || patientName
              }
            } else if (patientId) {
              const querySnap = await firestore
                .collection("patients")
                .where("patientId", "==", patientId)
                .limit(1)
                .get()
              if (!querySnap.empty) {
                const patientDoc = querySnap.docs[0]
                const patient = patientDoc.data() as any
                const composed = [patient?.firstName, patient?.lastName].filter(Boolean).join(" ").trim()
                patientName = composed || patient?.fullName || patientName
                patientUid = patientDoc.id
              }
            }
          } catch (err) {
            console.warn("Failed to enrich billing record patient name", err)
          }
        }

        return {
          id: docSnap.id,
          ...data,
          patientName,
          patientUid,
          paidAtFrontDesk: data?.paidAtFrontDesk ?? false,
          handledBy: data?.handledBy || null,
          settlementMode: data?.settlementMode || null
        }
      })
    )

    return Response.json({ records })
  } catch (error: any) {
    console.error("billing records GET error", error)
    return Response.json(
      { error: error?.message || "Failed to load billing records" },
      { status: 500 }
    )
  }
}


