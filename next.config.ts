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
};

export default nextConfig;
