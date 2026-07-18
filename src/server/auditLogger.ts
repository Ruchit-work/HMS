import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"
import type { AuthenticatedUser } from "@/shared/utils/firebase/apiAuth"
import type { AuditAction, AuditModule, AuditSource } from "@/shared/types/audit"

export { AUDIT_ACTIONS } from "@/shared/types/audit"

export interface AuditActor {
  id: string
  name: string
  role: string
}

export interface AuditLogInput {
  hospitalId: string
  branchId?: string | null
  module: AuditModule
  entityType: string
  entityId: string
  action: AuditAction
  summary: string
  performedBy: AuditActor
  source: AuditSource
  metadata?: Record<string, unknown>
}

type UserAuditLogInput = Omit<AuditLogInput, "performedBy" | "source"> & {
  source?: AuditSource
}

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "otp",
  "cvv",
  "cardnumber",
  "aadhar",
  "aadhaar",
  "diagnosis",
  "prescription",
  "medicalhistory",
])

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]"
  if (value == null || typeof value === "boolean" || typeof value === "number") return value
  if (typeof value === "string") return value.slice(0, 500)
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeMetadata(item, depth + 1))
  if (typeof value !== "object") return String(value).slice(0, 500)

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 50)
      .map(([key, item]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? "[redacted]" : sanitizeMetadata(item, depth + 1),
      ])
  )
}

function actorName(user: AuthenticatedUser): string {
  const data = user.data && typeof user.data === "object" ? user.data : {}
  const displayName = typeof data.displayName === "string" ? data.displayName.trim() : ""
  const fullName = [data.firstName, data.lastName]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ")
    .trim()
  return displayName || fullName || user.email || user.uid
}

export function auditActorFromUser(user: AuthenticatedUser): AuditActor {
  const role =
    user.data?.isSuperAdmin === true || user.data?.role === "super_admin"
      ? "super_admin"
      : user.role
  return { id: user.uid, name: actorName(user), role }
}

export function auditSourceForRole(role: string): AuditSource {
  switch (role) {
    case "admin":
    case "super_admin":
      return "Admin Dashboard"
    case "doctor":
      return "Doctor Dashboard"
    case "patient":
      return "Patient Portal"
    case "receptionist":
    case "pharmacy":
      return "Reception Dashboard"
    default:
      return "System API"
  }
}

async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    if (!input.hospitalId || !input.entityId || !input.summary) return
    const initResult = initFirebaseAdmin("audit logger")
    if (!initResult.ok) {
      console.error("[audit] Firebase Admin unavailable")
      return
    }

    const createdAt = new Date().toISOString()
    await admin.firestore().collection("audit_logs").add({
      hospitalId: input.hospitalId,
      branchId: input.branchId || null,
      module: input.module,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary.slice(0, 1000),
      performedBy: input.performedBy,
      performedByUserId: input.performedBy.id,
      performedByName: input.performedBy.name,
      performedByRole: input.performedBy.role,
      source: input.source,
      createdAt,
      metadata: sanitizeMetadata(input.metadata || {}),
    })
  } catch (error) {
    console.error("[audit] Failed to write audit log", error)
  }
}

async function writeAuditLogForUser(
  user: AuthenticatedUser | undefined,
  input: UserAuditLogInput
): Promise<void> {
  if (!user) return
  const actor = auditActorFromUser(user)
  await writeAuditLog({
    ...input,
    performedBy: actor,
    source: input.source || auditSourceForRole(actor.role),
  })
}

/**
 * Central audit service. Call without awaiting after the business write succeeds:
 * `void auditLogger.log(event)`. Failures are swallowed and never affect the operation.
 */
export const auditLogger = {
  log: writeAuditLog,
  logForUser: writeAuditLogForUser,
}
