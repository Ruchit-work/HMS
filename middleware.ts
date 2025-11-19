import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Get the hostname for CSP
  const hostname = request.headers.get('host') || ''
  const protocol = request.url.startsWith('https://') ? 'https:' : 'http:'
  const origin = `${protocol}//${hostname}`

  // Content Security Policy (CSP)
  // Allow Firebase, Next.js, and necessary third-party services
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Next.js, unsafe-inline for inline scripts
    "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for inline styles
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // Firebase domains
    "https://*.firebaseio.com",
    "https://*.googleapis.com",
    "https://*.gstatic.com",
    "https://*.firebaseapp.com",
    "wss://*.firebaseio.com",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    // Twilio (if using webhooks)
    "https://*.twilio.com",
    // Groq API (for AI features)
    "https://api.groq.com",
    // Allow connections to same origin
    origin,
    // WebSocket connections for Firebase
    "wss://*.firebaseio.com",
    "wss://*.cloudfunctions.net",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'", // Prevents embedding in iframes (clickjacking protection)
    "upgrade-insecure-requests", // Upgrade HTTP to HTTPS
    "block-all-mixed-content", // Block mixed content
  ].join('; ')

  // Security Headers
  response.headers.set('Content-Security-Policy', cspDirectives)
  
  // Strict Transport Security (HSTS) - Force HTTPS for 1 year
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )

  // X-Frame-Options - Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // X-Content-Type-Options - Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // X-XSS-Protection - Legacy browser XSS protection
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer-Policy - Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions-Policy - Control browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  // Remove X-Powered-By header (security through obscurity)
  response.headers.delete('X-Powered-By')

  return response
}

// Configure which routes to apply middleware to
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}

