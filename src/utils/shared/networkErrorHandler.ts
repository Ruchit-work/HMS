/**
 * Network Error Handler Utility
 * Provides consistent error handling and retry logic for network requests
 */

export interface NetworkError {
  message: string
  isNetworkError: boolean
  isOffline: boolean
  statusCode?: number
  canRetry: boolean
}

/**
 * Detects if an error is a network-related error
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false

  // Check for fetch/network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true
  }

  // Check for offline status
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true
  }

  // Check for specific error codes
  if (typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code
    return (
      code === "network-request-failed" ||
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT" ||
      code === "ENOTFOUND"
    )
  }

  // Check for axios network errors
  if (typeof error === "object" && "isAxiosError" in error) {
    return (error as { isAxiosError: boolean }).isAxiosError
  }

  // Check for response status codes that indicate network issues
  if (typeof error === "object" && "response" in error) {
    const response = (error as { response?: { status?: number } }).response
    const status = response?.status
    return status === 0 || status === 408 || status === 502 || status === 503 || status === 504
  }

  return false
}

/**
 * Extracts a user-friendly error message from various error types
 */
export function getNetworkErrorMessage(error: unknown): NetworkError {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine
  const isNetwork = isNetworkError(error)

  // Offline detection
  if (isOffline) {
    return {
      message: "You are currently offline. Please check your internet connection and try again.",
      isNetworkError: true,
      isOffline: true,
      canRetry: true,
    }
  }

  // Network error detection
  if (isNetwork) {
    return {
      message: "Network error. Please check your internet connection and try again.",
      isNetworkError: true,
      isOffline: false,
      canRetry: true,
    }
  }

  // Firebase Auth network errors
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code
    if (code === "auth/network-request-failed") {
      return {
        message: "Network error. Please check your internet connection and try again.",
        isNetworkError: true,
        isOffline: false,
        canRetry: true,
      }
    }
  }

  // Axios errors
  if (error && typeof error === "object" && "isAxiosError" in error) {
    const axiosError = error as { message?: string; response?: { status?: number } }
    const status = axiosError.response?.status

    if (status === 0 || status === 408) {
      return {
        message: "Request timed out. Please check your connection and try again.",
        isNetworkError: true,
        isOffline: false,
        statusCode: status,
        canRetry: true,
      }
    }

    if (status === 502 || status === 503 || status === 504) {
      return {
        message: "Server is temporarily unavailable. Please try again in a moment.",
        isNetworkError: true,
        isOffline: false,
        statusCode: status,
        canRetry: true,
      }
    }
  }

  // Generic error message extraction
  let message = "An error occurred. Please try again."
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === "string") {
    message = error
  } else if (error && typeof error === "object" && "message" in error) {
    message = String((error as { message: unknown }).message)
  }

  return {
    message,
    isNetworkError: false,
    isOffline: false,
    canRetry: false,
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error
      }

      // Only retry network errors
      if (!isNetworkError(error)) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // This should never be reached, but TypeScript needs it
  if (lastError) {
    throw lastError
  }
  throw new Error("Retry failed with unknown error")
}

/**
 * Wraps a fetch call with network error handling and optional retry
 */
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
  retry: boolean = false
): Promise<Response> {
  const fetchFn = async () => {
    const response = await fetch(url, options)

    if (!response.ok) {
      // Check if it's a network-related status code
      if (response.status === 0 || response.status >= 500) {
        throw new Error(`Network error: ${response.statusText}`)
      }

      // For other errors, try to parse error message
      try {
        const data = await response.json()
        throw new Error(data.error || data.message || `Request failed: ${response.statusText}`)
      } catch {
        throw new Error(`Request failed: ${response.statusText}`)
      }
    }

    return response
  }

  if (retry) {
    return retryWithBackoff(fetchFn)
  }

  return fetchFn()
}

