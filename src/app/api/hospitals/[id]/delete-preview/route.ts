import { NextRequest, NextResponse } from "next/server"
import admin from "firebase-admin"
import { verifyAuthToken } from "@/shared/utils/firebase/apiAuth"

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || ""
  const privateKey = rawPrivateKey
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

const db = admin.firestore()

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hospitalId } = await context.params
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const authData = await verifyAuthToken(token)

    if (!authData) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 })
    }

    // Verify user is super admin
    const userDoc = await db.collection("users").doc(authData.uid).get()
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const userData = userDoc.data()
    if (userData?.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden: Super Admin access required" },
        { status: 403 }
      )
    }

    // Verify hospital exists
    const hospitalRef = db.collection("hospitals").doc(hospitalId)
    const hospitalDoc = await hospitalRef.get()

    if (!hospitalDoc.exists) {
      return NextResponse.json({ success: false, error: "Hospital not found" }, { status: 404 })
    }

    const hospitalData = hospitalDoc.data() || {}

    // Run parallel count queries
    const [
      branchesSnap,
      doctorsSnap,
      receptionistsSnap,
      adminsSnap,
      hospPatientsSnap,
      rootPatientsSnap,
      hospAppointmentsSnap,
      rootAppointmentsSnap,
      hospAdmissionsSnap,
      rootAdmissionsSnap,
      hospBillingSnap,
      rootBillingSnap,
      hospAuditSnap,
      rootAuditSnap,
    ] = await Promise.all([
      db.collection(`hospitals/${hospitalId}/branches`).count().get().catch(() => null),
      db.collection("users").where("hospitalId", "==", hospitalId).where("role", "==", "doctor").count().get().catch(() => null),
      db.collection("users").where("hospitalId", "==", hospitalId).where("role", "==", "receptionist").count().get().catch(() => null),
      db.collection("users").where("hospitalId", "==", hospitalId).where("role", "==", "admin").count().get().catch(() => null),
      db.collection(`hospitals/${hospitalId}/patients`).count().get().catch(() => null),
      db.collection("patients").where("hospitalId", "==", hospitalId).count().get().catch(() => null),
      db.collection(`hospitals/${hospitalId}/appointments`).count().get().catch(() => null),
      db.collection("appointments").where("hospitalId", "==", hospitalId).count().get().catch(() => null),
      db.collection(`hospitals/${hospitalId}/admissions`).count().get().catch(() => null),
      db.collection("admissions").where("hospitalId", "==", hospitalId).count().get().catch(() => null),
      db.collection(`hospitals/${hospitalId}/billing`).count().get().catch(() => null),
      db.collection("billing").where("hospitalId", "==", hospitalId).count().get().catch(() => null),
      db.collection(`hospitals/${hospitalId}/audit_logs`).count().get().catch(() => null),
      db.collection("audit_logs").where("hospitalId", "==", hospitalId).count().get().catch(() => null),
    ])

    const getCount = (snap: any) => (snap ? snap.data().count || 0 : 0)

    const branches = getCount(branchesSnap)
    const doctors = getCount(doctorsSnap)
    const receptionists = getCount(receptionistsSnap)
    const admins = getCount(adminsSnap)
    const patients = Math.max(getCount(hospPatientsSnap), getCount(rootPatientsSnap))
    const appointments = Math.max(getCount(hospAppointmentsSnap), getCount(rootAppointmentsSnap))
    const admissions = Math.max(getCount(hospAdmissionsSnap), getCount(rootAdmissionsSnap))
    const bills = Math.max(getCount(hospBillingSnap), getCount(rootBillingSnap))
    const auditLogs = Math.max(getCount(hospAuditSnap), getCount(rootAuditSnap))

    return NextResponse.json({
      success: true,
      hospital: {
        id: hospitalDoc.id,
        name: hospitalData.name || "Hospital",
        code: hospitalData.code || hospitalDoc.id,
      },
      counts: {
        branches,
        doctors,
        receptionists,
        admins,
        patients,
        appointments,
        admissions,
        bills,
        auditLogs,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load deletion preview" },
      { status: 500 }
    )
  }
}
