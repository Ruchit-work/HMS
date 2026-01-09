/**
 * Message Sanitizer Utility
 * Converts technical error messages into user-friendly, concise notifications
 */

/**
 * Sanitizes error messages to be user-friendly and non-technical
 */
export function sanitizeErrorMessage(error: unknown, defaultMessage: string = "An error occurred. Please try again."): string {
  if (!error) return defaultMessage

  // If it's already a user-friendly string, return it
  if (typeof error === "string") {
    // Check if it's already user-friendly (no technical terms)
    if (!isTechnicalMessage(error)) {
      return error
    }
  }

  // Extract message from Error object
  let message = defaultMessage
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === "object" && "message" in error) {
    message = String((error as { message: unknown }).message)
  } else if (typeof error === "string") {
    message = error
  }

  // Convert technical messages to user-friendly ones
  return convertTechnicalToUserFriendly(message, defaultMessage)
}

/**
 * Checks if a message contains technical terms that should be converted
 */
function isTechnicalMessage(message: string): boolean {
  const technicalTerms = [
    "TypeError",
    "ReferenceError",
    "undefined",
    "null",
    "Cannot read property",
    "is not defined",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "status code",
    "statusCode",
    "stack trace",
    "at ",
    "Error:",
    "Exception:",
  ]

  return technicalTerms.some((term) => message.toLowerCase().includes(term.toLowerCase()))
}

/**
 * Converts technical error messages to user-friendly ones
 */
function convertTechnicalToUserFriendly(message: string, defaultMessage: string): string {
  const lowerMessage = message.toLowerCase()

  // Network errors
  if (lowerMessage.includes("network") || lowerMessage.includes("fetch") || lowerMessage.includes("econnrefused")) {
    return "Network error. Please check your internet connection and try again."
  }

  if (lowerMessage.includes("timeout") || lowerMessage.includes("etimedout")) {
    return "Request timed out. Please try again."
  }

  // Authentication errors
  if (lowerMessage.includes("auth") || lowerMessage.includes("unauthorized") || lowerMessage.includes("forbidden")) {
    if (lowerMessage.includes("token") || lowerMessage.includes("expired")) {
      return "Your session has expired. Please log in again."
    }
    return "You don't have permission to perform this action."
  }

  // Validation errors
  if (lowerMessage.includes("required") || lowerMessage.includes("missing") || lowerMessage.includes("invalid")) {
    // Keep validation messages as they are usually user-friendly
    return message
  }

  // Firebase errors
  if (lowerMessage.includes("firebase") || lowerMessage.includes("firestore")) {
    if (lowerMessage.includes("permission")) {
      return "You don't have permission to access this data."
    }
    if (lowerMessage.includes("not found")) {
      return "The requested information was not found."
    }
    return "Database error. Please try again."
  }

  // Generic technical errors
  if (
    lowerMessage.includes("typeerror") ||
    lowerMessage.includes("referenceerror") ||
    lowerMessage.includes("undefined") ||
    lowerMessage.includes("cannot read")
  ) {
    return "Something went wrong. Please refresh the page and try again."
  }

  // Server errors
  if (lowerMessage.includes("500") || lowerMessage.includes("internal server error")) {
    return "Server error. Please try again later."
  }

  if (lowerMessage.includes("503") || lowerMessage.includes("service unavailable")) {
    return "Service temporarily unavailable. Please try again in a moment."
  }

  // If message is too long or technical, use default
  if (message.length > 150 || isTechnicalMessage(message)) {
    return defaultMessage
  }

  // Remove common technical prefixes
  let cleaned = message
    .replace(/^error:\s*/i, "")
    .replace(/^exception:\s*/i, "")
    .replace(/^failed:\s*/i, "")
    .trim()

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }

  return cleaned || defaultMessage
}

/**
 * Ensures a message is concise (max length)
 */
export function makeConcise(message: string, maxLength: number = 120): string {
  if (message.length <= maxLength) return message
  return message.substring(0, maxLength - 3) + "..."
}

