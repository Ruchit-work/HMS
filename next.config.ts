import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  compress: true,
  
  // Security Headers - Applied to all responses (including static files)
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          // Content Security Policy (CSP) - Prevents XSS attacks
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Next.js
              "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Tailwind
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data:",
              "connect-src 'self' blob: https://*.firebaseio.com https://*.googleapis.com https://*.gstatic.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://speech.googleapis.com https://*.cognitiveservices.azure.com https://*.stt.speech.microsoft.com https://api.groq.com wss://*.firebaseio.com wss://*.cloudfunctions.net",
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'", // Prevents clickjacking
              "upgrade-insecure-requests", // Upgrade HTTP to HTTPS
              "block-all-mixed-content", // Block mixed content
            ].join('; '),
          },
          // Strict Transport Security (HSTS) - Force HTTPS for 1 year
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // X-Frame-Options - Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // X-Content-Type-Options - Prevent MIME sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // X-XSS-Protection - Legacy browser XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer-Policy - Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions-Policy - Control browser features
          // Allow camera and microphone for voice input + patient consent video recording
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Ensure proper TypeScript handling
  typescript: {
    // Don't fail build on TypeScript errors during deployment
    ignoreBuildErrors: false,
  },
  
  // Ensure proper ESLint handling
  eslint: {
    // Don't fail build on ESLint errors during deployment
    ignoreDuringBuilds: false,
  },
  
  // React compiler for better performance
  experimental: {
    optimizePackageImports: ['firebase', 'firebase-admin'],
  },
  
  // Reduce initial bundle size
  output: 'standalone',
  
  // Server-side external packages to handle ES module compatibility
  serverExternalPackages: ['jsdom', 'parse5', 'pdf-parse', 'canvas', 'pdfjs-dist'],
  
  // Webpack configuration to handle jsdom/parse5 ES module compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Mark problematic packages as external to prevent bundling issues
      const originalExternals = config.externals
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals]),
        // Externalize packages that have ES module compatibility issues
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request === 'jsdom' || request === 'parse5' || request === 'pdf-parse' || 
              request === 'canvas' || request === 'pdfjs-dist' ||
              request?.includes('jsdom') || request?.includes('parse5') || 
              request?.includes('pdf-parse') || request?.includes('canvas') || 
              request?.includes('pdfjs-dist')) {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
      
      // Configure resolve to handle module types
      config.resolve = config.resolve || {}
      config.resolve.extensionAlias = {
        '.js': ['.js', '.ts', '.tsx'],
      }
    }
    
    return config
  },
};

export default nextConfig;
