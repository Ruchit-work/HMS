/**
 * Error Logger Utility
 * Logs errors with context (user id, hospital id, appointment id) while avoiding sensitive data
 */

interface ErrorLogContext {
  userId?: string
  hospitalId?: string
  appointmentId?: string
  patientId?: string
  doctorId?: string
  receptionistId?: string
  adminId?: string
  branchId?: string
  action?: string
  endpoint?: string
  [key: string]: unknown
}

/**
 * Sensitive fields that should NEVER be logged
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'credential',
  'cardNumber',
  'cvv',
  'cvv2',
  'securityCode',
  'ssn',
  'socialSecurity',
  'aadhar',
  'pan',
  'upiId',
  'bankAccount',
  'routingNumber',
  'pin',
  'otp',
  'verificationCode',
  'email', // Can be sensitive in some contexts
  'phone', // Can be sensitive in some contexts
  'address', // Can be sensitive
  'medicalHistory', // HIPAA sensitive
  'diagnosis', // HIPAA sensitive
  'medicine', // HIPAA sensitive
  'notes', // HIPAA sensitive
  'prescription', // HIPAA sensitive
]

/**
 * Sanitizes an object by removing sensitive fields
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    
    // Skip sensitive fields
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]'
      continue
    }
    
    // Recursively sanitize nested structures
    if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        isPlainObject(item) ? sanitizeObject(item as Record<string, unknown>) : item
      )
    } else if (isPlainObject(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)
}

/**
 * Extracts safe error information (no stack traces in production, no sensitive data)
 */
function extractSafeErrorInfo(error: unknown): {
  message: string
  code?: string
  name?: string
  stack?: string
} {
  const isDev = process.env.NODE_ENV === 'development'
  
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      code: (error as { code?: string }).code,
      ...(isDev && { stack: error.stack }),
    }
  }
  
  if (typeof error === 'object' && error !== null) {
    const err = error as { message?: string; code?: string; name?: string; stack?: string }
    return {
      message: err.message || String(error),
      code: err.code,
      name: err.name,
      ...(isDev && { stack: err.stack }),
    }
  }
  
  return { message: String(error) }
}

/**
 * Logs an error with context but without sensitive data
 * 
 * @param error - The error to log
 * @param context - Context information (user id, hospital id, etc.)
 * @param additionalData - Any additional data to log (will be sanitized)
 */
export async function logError(
  error: unknown,
  context: ErrorLogContext = {},
  additionalData?: Record<string, unknown>
): Promise<void> {
  const safeError = extractSafeErrorInfo(error)
  const sanitizedContext = sanitizeObject(context as Record<string, unknown>)
  const sanitizedAdditional = additionalData ? sanitizeObject(additionalData) : undefined
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: {
      message: safeError.message,
      code: safeError.code,
      name: safeError.name,
      ...(safeError.stack && { stack: safeError.stack }),
    },
    context: sanitizedContext,
    ...(sanitizedAdditional && { additional: sanitizedAdditional }),
  }
  
  // Log to console (in production, this should go to a logging service)
  console.error('[API Error]', JSON.stringify(logEntry, null, 2))
  
  // Send to Firestore in production (fire and forget, don't block)
  if (process.env.NODE_ENV === 'production') {
    // Use dynamic import to avoid bundling issues
    import('firebase/firestore')
      .then(({ collection, addDoc, serverTimestamp }) => {
        import('@/firebase/config')
          .then(({ db }) => {
            // Store error in Firestore
            addDoc(collection(db, 'errorLogs'), {
              error: {
                message: safeError.message,
                name: safeError.name,
                code: safeError.code,
                stack: safeError.stack,
              },
              context: sanitizedContext,
              ...(sanitizedAdditional && { additional: sanitizedAdditional }),
              timestamp: serverTimestamp(),
              environment: process.env.NODE_ENV,
              severity: 'error',
              resolved: false,
              // Add fields for easy querying
              userId: context.userId || null,
              hospitalId: context.hospitalId || null,
              appointmentId: context.appointmentId || null,
              endpoint: context.endpoint || null,
              action: context.action || null,
            }).catch((firestoreError) => {
              // If Firestore fails, just log to console (don't break the app)
              console.error('[Firestore Error] Failed to log error to Firestore:', firestoreError)
            })
          })
          .catch((importError) => {
            console.error('[Firestore Error] Failed to import Firestore:', importError)
          })
      })
      .catch((importError) => {
        console.error('[Firestore Error] Failed to import firebase/firestore:', importError)
      })
  }
}

/**
 * Logs an error from an API route with automatic context extraction
 * 
 * @param error - The error to log
 * @param request - The request object (for extracting endpoint info)
 * @param auth - Auth result (for extracting user info)
 * @param context - Additional context
 */
export async function logApiError(
  error: unknown,
  request?: Request,
  auth?: { user?: { uid?: string; role?: string } },
  context?: Partial<ErrorLogContext>
): Promise<void> {
  const endpoint = request?.url ? new URL(request.url).pathname : undefined
  const method = request?.method
  
  const logContext: ErrorLogContext = {
    endpoint,
    method,
    action: context?.action,
    userId: auth?.user?.uid || context?.userId,
    hospitalId: context?.hospitalId,
    appointmentId: context?.appointmentId,
    patientId: context?.patientId,
    doctorId: context?.doctorId,
    receptionistId: context?.receptionistId,
    adminId: context?.adminId,
    branchId: context?.branchId,
  }
  
  await logError(error, logContext)
}

/**
 * Creates a safe error response for API routes
 * Logs the error internally but returns a user-friendly message
 */
export async function createErrorResponse(
  error: unknown,
  request?: Request,
  auth?: { user?: { uid?: string; role?: string } },
  context?: Partial<ErrorLogContext>,
  userMessage?: string
): Promise<Response> {
  // Log the full error with context (don't await to avoid blocking response)
  logApiError(error, request, auth, context).catch((err) => {
    console.error('[Error Logger] Failed to log error:', err)
  })
  
  // Return user-friendly message
  const message = userMessage || getErrorMessage(error)
  
  return Response.json(
    { error: message },
    { status: 500 }
  )
}

/**
 * Extracts a user-friendly error message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for known error patterns
    const message = error.message
    
    if (message === 'SLOT_ALREADY_BOOKED') {
      return 'This time slot has already been booked. Please select another slot.'
    }
    if (message === 'APPOINTMENT_NOT_FOUND') {
      return 'Appointment not found'
    }
    if (message === 'UNAUTHORIZED') {
      return 'You do not have permission to perform this action'
    }
    if (message.includes('permission') || message.includes('Permission')) {
      return 'You do not have permission to perform this action'
    }
    if (message.includes('not found') || message.includes('Not found')) {
      return 'The requested resource was not found'
    }
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please try again.'
    }
    
    // For unknown errors, return generic message
    return 'An error occurred. Please try again.'
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  return 'An error occurred. Please try again.'
}

