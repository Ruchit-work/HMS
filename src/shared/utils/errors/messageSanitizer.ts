/**
 * Message Sanitizer Utility
 * Converts technical error messages into user-friendly, concise notifications
 */

const TECHNICAL_TERMS = ["TypeError", "ReferenceError", "undefined", "null", "Cannot read property", 
  "is not defined", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "status code", "statusCode", "stack trace", "at ", "Error:", "Exception:"]

const ERROR_PATTERNS: Array<[string[], string]> = [
  [["network", "fetch", "econnrefused"], "Network error. Please check your internet connection and try again."],
  [["timeout", "etimedout"], "Request timed out. Please try again."],
  [["auth", "unauthorized", "forbidden"], "You don't have permission to perform this action."],
  [["token", "expired"], "Your session has expired. Please log in again."],
  [["firebase", "firestore"], "Database error. Please try again."],
  [["permission"], "You don't have permission to access this data."],
  [["not found"], "The requested information was not found."],
  [["typeerror", "referenceerror", "undefined", "cannot read"], "Something went wrong. Please refresh the page and try again."],
  [["500", "internal server error"], "Server error. Please try again later."],
  [["503", "service unavailable"], "Service temporarily unavailable. Please try again in a moment."],
]

/**
 * Sanitizes error messages to be user-friendly and non-technical
 */
export function sanitizeErrorMessage(error: unknown, defaultMessage: string = "An error occurred. Please try again."): string {
  if (!error) return defaultMessage

  const message = extractMessage(error)
  if (typeof error === "string" && !isTechnicalMessage(message)) return message

  return convertTechnicalToUserFriendly(message, defaultMessage)
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message: unknown }).message)
  if (typeof error === "string") return error
  return ""
}

function isTechnicalMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return TECHNICAL_TERMS.some(term => lower.includes(term.toLowerCase()))
}

function convertTechnicalToUserFriendly(message: string, defaultMessage: string): string {
  const lower = message.toLowerCase()
  
  // Check validation errors first (keep as-is)
  if (lower.includes("required") || lower.includes("missing") || lower.includes("invalid")) {
    return message
  }

  // Pattern matching for error types
  for (const [patterns, friendlyMessage] of ERROR_PATTERNS) {
    if (patterns.some(pattern => lower.includes(pattern))) {
      return friendlyMessage
    }
  }

  // If message is too long or technical, use default
  if (message.length > 150 || isTechnicalMessage(message)) {
    return defaultMessage
  }

  // Clean and format message
  const cleaned = message
    .replace(/^(error|exception|failed):\s*/i, "")
    .trim()
    .replace(/^./, char => char.toUpperCase())

  return cleaned || defaultMessage
}

/**
 * Ensures a message is concise (max length)
 */
export function makeConcise(message: string, maxLength: number = 120): string {
  if (message.length <= maxLength) return message
  return message.substring(0, maxLength - 3) + "..."
}

