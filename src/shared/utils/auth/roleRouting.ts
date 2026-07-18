export type UserRole =
  | "patient"
  | "doctor"
  | "admin"
  | "receptionist"
  | "pharmacy"
  | "super_admin"
  | null

export const AUTH_RESOLVE_TIMEOUT_MS = 12_000

const ROLE_COLLECTIONS: Record<Exclude<UserRole, null | "super_admin">, string> = {
  admin: "admins",
  doctor: "doctors",
  patient: "patients",
  receptionist: "receptionists",
  pharmacy: "pharmacists",
}

export function getDashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "admin":
    case "super_admin":
      return "/admin-dashboard"
    case "doctor":
      return "/doctor-dashboard"
    case "receptionist":
      return "/receptionist-dashboard"
    case "patient":
      return "/patient-dashboard"
    case "pharmacy":
      return "/pharmacy"
    default:
      return "/auth/login"
  }
}

export function getLoginPathForRole(role?: Exclude<UserRole, null>): string {
  if (!role) return "/auth/login"
  if (role === "pharmacy") return "/auth/login?role=pharmacy"
  return `/auth/login?role=${role}`
}

export function normalizeUserRole(raw: unknown): UserRole {
  if (raw === "super_admin") return "super_admin"
  if (
    raw === "patient" ||
    raw === "doctor" ||
    raw === "admin" ||
    raw === "receptionist" ||
    raw === "pharmacy"
  ) {
    return raw
  }
  return null
}

export function getRoleCollection(role: Exclude<UserRole, null | "super_admin">): string {
  return ROLE_COLLECTIONS[role]
}

export function isRoleAllowed(
  userRole: UserRole,
  allowedRoles: Exclude<UserRole, null>[]
): boolean {
  if (!userRole) return false
  if (userRole === "super_admin") {
    return allowedRoles.includes("admin") || allowedRoles.includes("super_admin")
  }
  return allowedRoles.includes(userRole as Exclude<UserRole, null>)
}

export function logAuthDev(message: string, detail?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[auth] ${message}`, detail ?? "")
  }
}
