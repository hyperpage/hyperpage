import type { NextConfig } from "next";
import path from "path";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  // Output standalone for Docker containerization
  output: "standalone",

  // Enable response compression for all API routes
  compress: true,

  // Performance optimizations
  poweredByHeader: false,

  // External packages for Node.js compatibility
  serverExternalPackages: ["ioredis"],

  // Disable ESLint during builds for containerization
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Webpack configuration to handle Node.js modules properly
  webpack: (config) => {
    // Add path aliases for cleaner imports
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.join(__dirname),
      "@/app": path.join(__dirname, "app"),
      "@/lib": path.join(__dirname, "lib"),
      "@/components": path.join(__dirname, "components"),
      "@/tools": path.join(__dirname, "tools"),
      "@/tests": path.join(__dirname, "__tests__"),
    };

    // Exclude server-only packages from client bundle
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // Mark external packages (server-side only)
    config.externals = config.externals || [];
    config.externals.push({
      ioredis: "commonjs ioredis",
    });

    // Ensure fs and path are not bundled for client-side
    config.externals.push({
      fs: "commonjs fs",
      path: "commonjs path",
    });

    return config;
  },
};

// Wrap with bundle analyzer for development analysis
const wrappedConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
  analyzerMode: "static",
})(nextConfig);

export default wrappedConfig;
