import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  compress: true,
  
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
