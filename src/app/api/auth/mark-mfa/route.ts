import { NextResponse } from "next/server"
import { admin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse, UserRole } from "@/utils/apiAuth"

const STAFF_ROLES: UserRole[] = ["admin", "doctor", "receptionist"]

export async function POST(request: Request) {
  const auth = await authenticateRequest(request, undefined, { skipMfaCheck: true })
  if (!auth.success) {
    return createAuthErrorResponse(auth)
  }

  const user = auth.user
  if (!user || !STAFF_ROLES.includes(user.role)) {
    return NextResponse.json(
      { error: "MFA verification is only required for staff accounts." },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const { authTime } = body

  if (!authTime || typeof authTime !== "string" || !authTime.trim()) {
    return NextResponse.json(
      { error: "authTime is required to finalize MFA verification." },
      { status: 400 }
    )
  }

  try {
    const db = admin.firestore()
    await db
      .collection("mfaSessions")
      .doc(user.uid)
      .set(
        {
          authTime,
          verifiedAt: new Date().toISOString(),
          role: user.role,
        },
        { merge: true }
      )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to complete multi-factor verification." },
      { status: 500 }
    )
  }
}

export const dynamic = "force-dynamic"

