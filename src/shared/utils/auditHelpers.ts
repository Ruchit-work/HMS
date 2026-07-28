import type { AuthenticatedUser } from "@/shared/utils/firebase/apiAuth"

export interface UserAuditMetadata {
  uid: string
  name: string
  role: string
}

function deriveActorName(user: AuthenticatedUser): string {
  const data = user.data && typeof user.data === "object" ? user.data : {}
  const displayName = typeof data.displayName === "string" ? data.displayName.trim() : ""
  const fullName = [data.firstName, data.lastName]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(" ")
    .trim()
  return displayName || fullName || user.email || user.uid
}

/**
 * Extracts structured user audit metadata ({ uid, name, role }) from an AuthenticatedUser.
 */
export function getActorInfo(user: AuthenticatedUser): UserAuditMetadata {
  const role =
    user.data?.isSuperAdmin === true || user.data?.role === "super_admin"
      ? "super_admin"
      : user.role
  return {
    uid: user.uid,
    name: deriveActorName(user),
    role,
  }
}

/**
 * Safely formats user audit metadata for display.
 * Supports legacy strings (e.g. "receptionist") and structured audit objects ({ uid, name, role }).
 */
export function formatAuditUserDisplay(val?: unknown): string {
  if (!val) return "Unknown"
  if (typeof val === "string") return val
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>
    if (typeof obj.name === "string" && obj.name.trim()) {
      return obj.name.trim()
    }
    if (typeof obj.role === "string" && obj.role.trim()) {
      return obj.role.trim()
    }
  }
  return "Unknown"
}
