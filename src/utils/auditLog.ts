/**
 * Audit Logging Utility
 * Tracks all sensitive operations for security, compliance, and debugging
 */

import { admin, initFirebaseAdmin } from "@/server/firebaseAdmin"

export type AuditEventType =
  | "authentication"
  | "authorization"
  | "user_creation"
  | "user_deletion"
  | "user_update"
  | "payment"
  | "refund"
  | "appointment_booking"
  | "appointment_cancellation"
  | "appointment_reschedule"
  | "appointment_completion"
  | "admin_approval"
  | "admin_rejection"
  | "data_access"
  | "data_modification"
  | "rate_limit_exceeded"
  | "security_violation"
  | "other"

export type AuditSeverity = "low" | "medium" | "high" | "critical"

export interface AuditLogEntry {
  id?: string
  timestamp: string
  eventType: AuditEventType
  severity: AuditSeverity
  userId?: string
  userEmail?: string
  userRole?: string
  ipAddress?: string
  userAgent?: string
  action: string
  resource?: string
  resourceId?: string
  success: boolean
  statusCode?: number
  error?: string
  metadata?: Record<string, any>
  requestId?: string
}

/**
 * Get client IP address from request
 */
function getClientIp(request: Request | undefined): string | undefined {
  if (!request) return undefined
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim())
    return ips[0]
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp
  }

  return undefined
}

/**
 * Get user agent from request
 */
function getUserAgent(request: Request | undefined): string | undefined {
  if (!request) return undefined
  return request.headers.get("user-agent") || undefined
}

/**
 * Remove undefined values from an object (Firestore doesn't accept undefined)
 */
function removeUndefinedValues<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      // Recursively clean nested objects
      if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        const cleanedNested = removeUndefinedValues(value)
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key] = cleanedNested
        }
      } else {
        cleaned[key] = value
      }
    }
  }
  return cleaned
}

/**
 * Create audit log entry
 */
export async function logAuditEvent(
  entry: Omit<AuditLogEntry, "timestamp" | "ipAddress" | "userAgent" | "id">,
  request?: Request | undefined
): Promise<void> {
  try {
    const initResult = initFirebaseAdmin("audit-log")
    if (!initResult.ok) {
      console.error("[Audit Log] Failed to initialize Firebase Admin:", initResult.error)
      return
    }

    const now = new Date().toISOString()
    const firestore = admin.firestore()

    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: now,
      ipAddress: request ? getClientIp(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }

    // Remove undefined values before writing to Firestore
    const cleanedEntry = removeUndefinedValues(auditEntry)

    // Add to audit_logs collection
    await firestore.collection("audit_logs").add(cleanedEntry)

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.log("[Audit Log]", JSON.stringify(cleanedEntry, null, 2))
    }
  } catch (error: any) {
    // Don't throw - audit logging failures shouldn't break the application
    console.error("[Audit Log] Failed to write audit log:", error?.message || error)
  }
}

/**
 * Helper functions for common audit events
 */

/**
 * Log authentication events
 */
export async function logAuthEvent(
  eventType: "login_success" | "login_failure" | "otp_sent" | "otp_verified" | "otp_failed" | "token_verified" | "token_invalid" | "logout",
  request: Request | undefined,
  userId?: string,
  userEmail?: string,
  userRole?: string,
  error?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const severity: AuditSeverity =
    eventType.includes("failure") || eventType.includes("invalid") ? "medium" : "low"

  await logAuditEvent(
    {
      eventType: "authentication",
      severity,
      userId,
      userEmail,
      userRole,
      action: eventType,
      success: !eventType.includes("failure") && !eventType.includes("invalid"),
      error,
      metadata,
    },
    request
  )
}

/**
 * Log authorization events
 */
export async function logAuthzEvent(
  eventType: "access_granted" | "access_denied" | "permission_denied",
  request: Request | undefined,
  userId?: string,
  userEmail?: string,
  userRole?: string,
  resource?: string,
  resourceId?: string,
  error?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const severity: AuditSeverity = eventType.includes("denied") ? "high" : "low"

  await logAuditEvent(
    {
      eventType: "authorization",
      severity,
      userId,
      userEmail,
      userRole,
      action: eventType,
      resource,
      resourceId,
      success: eventType === "access_granted",
      error,
      metadata,
    },
    request
  )
}

/**
 * Log user management events
 */
export async function logUserEvent(
  eventType: "user_created" | "user_deleted" | "user_updated",
  request: Request | undefined,
  targetUserId: string,
  targetUserRole: string,
  actorUserId?: string,
  actorEmail?: string,
  actorRole?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const severity: AuditSeverity = eventType === "user_deleted" ? "high" : "medium"

  await logAuditEvent(
    {
      eventType: eventType === "user_created" ? "user_creation" : eventType === "user_deleted" ? "user_deletion" : "user_update",
      severity,
      userId: actorUserId,
      userEmail: actorEmail,
      userRole: actorRole,
      action: eventType,
      resource: targetUserRole,
      resourceId: targetUserId,
      success: true,
      metadata: {
        ...metadata,
        targetUserId,
        targetUserRole,
      },
    },
    request
  )
}

/**
 * Log payment events
 */
export async function logPaymentEvent(
  eventType: "payment_processed" | "payment_failed" | "refund_processed" | "refund_failed",
  request: Request | undefined,
  userId?: string,
  userEmail?: string,
  userRole?: string,
  amount?: number,
  paymentMethod?: string,
  transactionId?: string,
  resourceId?: string,
  error?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const severity: AuditSeverity = eventType.includes("failed") ? "high" : "medium"
  const eventTypeEnum: AuditEventType = eventType.includes("refund") ? "refund" : "payment"

  await logAuditEvent(
    {
      eventType: eventTypeEnum,
      severity,
      userId,
      userEmail,
      userRole,
      action: eventType,
      resource: "payment",
      resourceId: transactionId || resourceId,
      success: !eventType.includes("failed"),
      error,
      metadata: {
        ...metadata,
        amount,
        paymentMethod,
        transactionId,
      },
    },
    request
  )
}

/**
 * Log appointment events
 */
export async function logAppointmentEvent(
  eventType: "appointment_booked" | "appointment_cancelled" | "appointment_rescheduled" | "appointment_completed" | "appointment_failed",
  request: Request | undefined,
  userId?: string,
  userEmail?: string,
  userRole?: string,
  appointmentId?: string,
  doctorId?: string,
  patientId?: string,
  error?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const severity: AuditSeverity = eventType.includes("failed") ? "medium" : "low"
  const eventTypeEnum: AuditEventType =
    eventType === "appointment_booked"
      ? "appointment_booking"
      : eventType === "appointment_cancelled"
      ? "appointment_cancellation"
      : eventType === "appointment_rescheduled"
      ? "appointment_reschedule"
      : eventType === "appointment_completed"
      ? "appointment_completion"
      : "other"

  await logAuditEvent(
    {
      eventType: eventTypeEnum,
      severity,
      userId,
      userEmail,
      userRole,
      action: eventType,
      resource: "appointment",
      resourceId: appointmentId,
      success: !eventType.includes("failed"),
      error,
      metadata: {
        ...metadata,
        doctorId,
        patientId,
      },
    },
    request
  )
}

/**
 * Log admin actions
 */
export async function logAdminEvent(
  eventType: "admin_approval" | "admin_rejection" | "admin_modification",
  request: Request | undefined,
  adminUserId: string,
  adminEmail?: string,
  action?: string,
  resource?: string,
  resourceId?: string,
  targetUserId?: string,
  approved?: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  const severity: AuditSeverity = eventType === "admin_rejection" ? "high" : "medium"

  await logAuditEvent(
    {
      eventType: approved ? "admin_approval" : "admin_rejection",
      severity,
      userId: adminUserId,
      userEmail: adminEmail,
      userRole: "admin",
      action: action || eventType,
      resource: resource || "unknown",
      resourceId,
      success: approved !== false,
      metadata: {
        ...metadata,
        targetUserId,
        approved,
      },
    },
    request
  )
}

/**
 * Log security violations
 */
export async function logSecurityEvent(
  eventType: "rate_limit_exceeded" | "unauthorized_access" | "invalid_token" | "suspicious_activity",
  request: Request | undefined,
  userId?: string,
  userEmail?: string,
  userRole?: string,
  resource?: string,
  error?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const severity: AuditSeverity = eventType === "suspicious_activity" ? "critical" : "high"

  await logAuditEvent(
    {
      eventType: "security_violation",
      severity,
      userId,
      userEmail,
      userRole,
      action: eventType,
      resource,
      success: false,
      error,
      metadata,
    },
    request
  )
}

/**
 * Log data access events
 */
export async function logDataAccessEvent(
  resource: string,
  resourceId: string,
  request: Request | undefined,
  userId?: string,
  userEmail?: string,
  userRole?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent(
    {
      eventType: "data_access",
      severity: "low",
      userId,
      userEmail,
      userRole,
      action: "data_accessed",
      resource,
      resourceId,
      success: true,
      metadata,
    },
    request
  )
}

/**
 * Log data modification events
 */
export async function logDataModificationEvent(
  resource: string,
  resourceId: string,
  request: Request | undefined,
  userId?: string,
  userEmail?: string,
  userRole?: string,
  changes?: Record<string, any>,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent(
    {
      eventType: "data_modification",
      severity: "medium",
      userId,
      userEmail,
      userRole,
      action: "data_modified",
      resource,
      resourceId,
      success: true,
      metadata: {
        ...metadata,
        changes,
      },
    },
    request
  )
}

