import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Exclude test-related imports from server bundles during build
    if (process.env.NODE_ENV === 'production') {
      config.externals = config.externals || [];
      config.externals.push('@vitest/coverage-v8');
    }
    return config;
  },
};

export default nextConfig;
