import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for Docker containerization
  output: "standalone",

  // Enable response compression for all API routes
  compress: true,

  // Performance optimizations
  poweredByHeader: false,

  // External packages for Node.js compatibility
  serverExternalPackages: ["better-sqlite3", "ioredis"],

  // Disable ESLint during builds for containerization
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Webpack configuration to handle Node.js modules properly
  webpack: (config) => {
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
      "better-sqlite3": "commonjs better-sqlite3",
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

export default nextConfig;
