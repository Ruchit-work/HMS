import { NextResponse } from "next/server"
import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import { authenticateRequest, createAuthErrorResponse } from "@/shared/utils/firebase/apiAuth"
import {
  getUserActiveHospitalId,
  isPlatformSuperAdmin,
  resolveAuthorizedHospitalId,
} from "@/shared/utils/firebase/serverHospitalQueries"
import { applyRateLimit } from "@/shared/utils/shared/rateLimit"
import { auditLogger, AUDIT_ACTIONS } from "@/server/auditLogger"
import type { BranchTimings } from "@/types/branch"

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const

function formatTimingSummary(timings?: BranchTimings | null): string {
  if (!timings) return "No schedule"
  if (timings.useHospitalSchedule) return "Inherits hospital schedule"
  return WEEKDAYS.map((day) => {
    const t = timings[day]
    if (!t || t.isOpen === false) return `${day.slice(0, 3)}: Closed`
    let str = `${day.slice(0, 3)}: ${t.start}-${t.end}`
    if (t.breakStart && t.breakEnd) {
      str += ` (Break ${t.breakStart}-${t.breakEnd})`
    }
    return str
  }).join(", ")
}

async function resolveHospitalForRead(
  uid: string,
  role: string,
  requestedHospitalId: string | null
): Promise<string | null> {
  if (role === "super_admin" || (await isPlatformSuperAdmin(uid))) {
    return requestedHospitalId
  }
  if (["admin", "receptionist", "doctor", "patient", "pharmacy"].includes(role)) {
    return resolveAuthorizedHospitalId(
      uid,
      requestedHospitalId || (await getUserActiveHospitalId(uid))
    )
  }
  return null
}

async function resolveHospitalForWrite(
  uid: string,
  role: string,
  requestedHospitalId: string | null
): Promise<string | null> {
  if (role === "super_admin" || (await isPlatformSuperAdmin(uid))) {
    return requestedHospitalId
  }
  if (role !== "admin") return null
  return resolveAuthorizedHospitalId(
    uid,
    requestedHospitalId || (await getUserActiveHospitalId(uid))
  )
}

/**
 * GET /api/admin/working-hours?hospitalId=...
 * Authenticated staff can view hospital & branch schedules
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const url = new URL(request.url)
  const requestedHospitalId = url.searchParams.get("hospitalId")?.trim() || null
  const hospitalId = await resolveHospitalForRead(auth.user.uid, auth.user.role, requestedHospitalId)

  if (!hospitalId) {
    return NextResponse.json({ error: "Hospital access required." }, { status: 403 })
  }

  const initResult = initFirebaseAdmin("working hours GET")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  const db = admin.firestore()
  const hospitalDoc = await db.collection("hospitals").doc(hospitalId).get()
  if (!hospitalDoc.exists) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
  }

  const hospitalData = hospitalDoc.data() || {}
  const hospitalSchedule: BranchTimings | null =
    (hospitalData.settings?.schedule as BranchTimings) ||
    (hospitalData.settings?.workingHours as BranchTimings) ||
    null

  const branchesSnap = await db.collection("branches").where("hospitalId", "==", hospitalId).get()
  const branches = branchesSnap.docs.map((doc) => {
    const data = doc.data()
    const timings = (data.timings as BranchTimings) || null
    const isInheriting = timings?.useHospitalSchedule === true || !timings
    const effectiveSource = isInheriting ? "Hospital Default Schedule" : "Branch Custom Schedule"
    return {
      id: doc.id,
      name: data.name || "Branch",
      location: data.location || "",
      timings,
      effectiveSource,
      isInheriting,
    }
  })

  return NextResponse.json({
    hospitalId,
    hospitalName: hospitalData.name || "",
    hospitalSchedule,
    branches,
  })
}

/**
 * PUT /api/admin/working-hours
 * Modifies hospital default schedule or branch schedule (Admin & Super Admin only)
 */
export async function PUT(request: Request) {
  const limit = await applyRateLimit(request, "ADMIN")
  if (limit instanceof Response) return limit

  const auth = await authenticateRequest(request)
  if (!auth.success) return createAuthErrorResponse(auth)
  if (!auth.user) return NextResponse.json({ error: "User context missing" }, { status: 403 })

  const initResult = initFirebaseAdmin("working hours PUT")
  if (!initResult.ok) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { targetType, hospitalId: reqHospitalId, branchId, timings } = body

    const hospitalId = await resolveHospitalForWrite(auth.user.uid, auth.user.role, reqHospitalId || null)
    if (!hospitalId) {
      return NextResponse.json(
        { error: "Forbidden: Only Hospital Admin or Super Admin can modify schedules." },
        { status: 403 }
      )
    }

    if (!targetType || !["hospital", "branch"].includes(targetType)) {
      return NextResponse.json({ error: "Invalid targetType. Must be 'hospital' or 'branch'." }, { status: 400 })
    }

    if (!timings || typeof timings !== "object") {
      return NextResponse.json({ error: "Valid timings payload is required." }, { status: 400 })
    }

    const db = admin.firestore()
    const nowIso = new Date().toISOString()

    if (targetType === "hospital") {
      const hospitalRef = db.collection("hospitals").doc(hospitalId)
      const hospitalSnap = await hospitalRef.get()
      if (!hospitalSnap.exists) {
        return NextResponse.json({ error: "Hospital not found" }, { status: 404 })
      }

      const prevData = hospitalSnap.data()
      const previousSchedule =
        (prevData?.settings?.schedule as BranchTimings) ||
        (prevData?.settings?.workingHours as BranchTimings) ||
        null

      await hospitalRef.update({
        "settings.schedule": timings,
        "settings.workingHours": timings,
        "settings.scheduleUpdatedAt": nowIso,
        "settings.scheduleUpdatedBy": auth.user.uid,
        updatedAt: nowIso,
      })

      const prevSummary = formatTimingSummary(previousSchedule)
      const newSummary = formatTimingSummary(timings)

      void auditLogger.logForUser(auth.user, {
        hospitalId,
        module: "Administration",
        entityType: "hospital_schedule",
        entityId: hospitalId,
        action: AUDIT_ACTIONS.WORKING_HOURS_UPDATED,
        summary: `Hospital default schedule updated. Previous: [${prevSummary}] | New: [${newSummary}]`,
        metadata: {
          target: "hospital",
          previous: previousSchedule,
          new: timings,
          changedBy: auth.user.uid,
          changedAt: nowIso,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Hospital schedule updated successfully",
        hospitalId,
        timings,
      })
    } else {
      if (!branchId || typeof branchId !== "string") {
        return NextResponse.json({ error: "branchId is required for branch target." }, { status: 400 })
      }

      const branchRef = db.collection("branches").doc(branchId)
      const branchSnap = await branchRef.get()
      if (!branchSnap.exists) {
        return NextResponse.json({ error: "Branch not found" }, { status: 404 })
      }

      const branchData = branchSnap.data()
      if (branchData?.hospitalId !== hospitalId) {
        return NextResponse.json({ error: "Branch does not belong to the authorized hospital." }, { status: 403 })
      }

      const previousTimings = (branchData?.timings as BranchTimings) || null

      await branchRef.update({
        timings,
        updatedAt: nowIso,
        updatedBy: auth.user.uid,
      })

      const prevSummary = formatTimingSummary(previousTimings)
      const newSummary = formatTimingSummary(timings)
      const branchName = branchData?.name || branchId

      void auditLogger.logForUser(auth.user, {
        hospitalId,
        branchId,
        module: "Administration",
        entityType: "branch_schedule",
        entityId: branchId,
        action: AUDIT_ACTIONS.WORKING_HOURS_UPDATED,
        summary: `Branch schedule updated for '${branchName}'. Previous: [${prevSummary}] | New: [${newSummary}]`,
        metadata: {
          target: "branch",
          branchId,
          branchName,
          previous: previousTimings,
          new: timings,
          changedBy: auth.user.uid,
          changedAt: nowIso,
        },
      })

      return NextResponse.json({
        success: true,
        message: `Branch schedule updated for ${branchName}`,
        branchId,
        timings,
      })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update schedule"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
