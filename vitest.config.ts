/// <reference types="vitest" />
import path from "path";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const isCI =
  process.env.CI === "true" ||
  process.env.CI === "1" ||
  process.env.CI === "on" ||
  process.env.CI === "yes";
const typecheckEnabled = isCI || process.env.VITEST_TYPECHECK === "1";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    globals: true,
    hookTimeout: 60000,
    poolOptions: {
      threads: {
        maxThreads: 10,
        minThreads: 1,
      },
    },
    exclude: ["__tests__/e2e/**", "node_modules/**"],
    typecheck: {
      enabled: typecheckEnabled,
      checker: "tsc",
      include: ["**/*.{test,spec}.ts", "**/*.{test,spec}.tsx"],
      exclude: ["node_modules", ".next", "__tests__/e2e"],
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "coverage/",
        "**/*.d.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
        "**/*.config.js",
        "**/*.config.mjs",
        "e2e/",
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
