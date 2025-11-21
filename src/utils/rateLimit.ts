/**
 * Rate Limiting Utility
 * Prevents abuse of sensitive API endpoints by limiting requests per time window
 */

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests allowed in the window
  identifier?: string // Optional custom identifier (defaults to IP address)
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  limit: number
}

interface RequestRecord {
  count: number
  resetTime: number
}

// In-memory store (for production, consider using Redis)
const rateLimitStore = new Map<string, RequestRecord>()

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, CLEANUP_INTERVAL)

/**
 * Get identifier for rate limiting
 * Priority: user ID > IP address
 */
function getIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`
  }
  
  // Try to get IP from various headers (for proxy/CDN setups)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim())
    return `ip:${ips[0]}`
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return `ip:${realIp}`
  }
  
  // Fallback to connection remote address (if available)
  // Note: This may not work in all serverless environments
  return `ip:unknown`
}

/**
 * Check rate limit and return result
 */
function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const key = `${identifier}:${config.windowMs}`
  
  let record = rateLimitStore.get(key)
  
  // Create new record if none exists or window has expired
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(key, record)
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: record.resetTime,
      limit: config.maxRequests,
    }
  }
  
  // Increment count if within window
  record.count++
  rateLimitStore.set(key, record)
  
  if (record.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
      limit: config.maxRequests,
    }
  }
  
  return {
    success: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
    limit: config.maxRequests,
  }
}

/**
 * Rate limit middleware
 * Returns rate limit result or error response
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig,
  userId?: string
): Promise<RateLimitResult | Response> {
  const identifier = config.identifier || getIdentifier(request, userId)
  const result = checkRateLimit(identifier, config)
  
  if (!result.success) {
    // Log rate limit violation
    try {
      const { logSecurityEvent } = await import("@/utils/auditLog")
      await logSecurityEvent("rate_limit_exceeded", request, userId, undefined, undefined, undefined, undefined, {
        identifier,
        limit: result.limit,
        windowMs: config.windowMs,
        resetTime: result.resetTime,
      })
    } catch (error) {
      // Don't fail if audit logging fails
      console.error("[Rate Limit] Failed to log audit event:", error)
    }

    const resetSeconds = Math.ceil((result.resetTime - Date.now()) / 1000)
    return Response.json(
      {
        error: 'Too many requests. Please try again later.',
        retryAfter: resetSeconds,
        limit: result.limit,
        windowMs: config.windowMs,
      },
      {
        status: 429,
        headers: {
          'Retry-After': resetSeconds.toString(),
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    )
  }
  
  return result
}

/**
 * Predefined rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Authentication endpoints - very strict (prevent brute force)
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
  },
  
  // OTP endpoints - strict (prevent spam)
  OTP: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 requests per hour
  },
  
  // Payment endpoints - moderate (prevent abuse)
  PAYMENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  },
  
  // Booking endpoints - moderate (prevent spam)
  BOOKING: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
  },
  
  // User creation - strict (prevent account spam)
  USER_CREATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // 5 requests per hour
  },
  
  // Admin endpoints - moderate (prevent privilege abuse)
  ADMIN: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
  
  // General API endpoints - lenient (normal usage)
  GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  
  // Slot checking - moderate (prevent excessive checks)
  SLOT_CHECK: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
}

/**
 * Helper function to apply rate limiting to API routes
 * @example
 * export async function POST(request: Request) {
 *   const rateLimitResult = await rateLimit(request, RATE_LIMITS.AUTH)
 *   if (rateLimitResult instanceof Response) {
 *     return rateLimitResult // Rate limited response
 *   }
 *   // Continue with request handling...
 * }
 */
export async function applyRateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  userId?: string
): Promise<RateLimitResult | Response> {
  return rateLimit(request, RATE_LIMITS[limitType], userId)
}

