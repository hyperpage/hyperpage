import fs from "fs";
import path from "path";

import { NextRequest, NextResponse } from "next/server";

import { isOAuthConfigured } from "@/lib/oauth-config";
import logger from "@/lib/logger";
import { createErrorResponse } from "@/lib/api/responses";

/**
 * Load environment variables from .env.dev file
 * This ensures OAuth credentials are available for API routes
 */
function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), ".env.dev");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      envContent.split("\n").forEach((line) => {
        line = line.trim();
        if (line && !line.startsWith("#") && line.includes("=")) {
          const [key, ...valueParts] = line.split("=");
          const value = valueParts.join("=");
          // Only set if not already set to avoid overriding runtime values
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
          }
        }
      });
    }
  } catch (error) {
    logger.warn("Could not load .env.dev file", { error });
  }
}

/**
 * Get OAuth configuration status for tools
 * Returns which tools are properly configured for OAuth
 */
export async function GET(_request: NextRequest) {
  try {
    // Load environment variables from .env.dev
    loadEnvFile();

    const tools = ["github", "gitlab", "jira"];
    const configured = {} as Record<string, boolean>;

    // Check each tool's OAuth configuration
    tools.forEach((tool) => {
      configured[tool] = isOAuthConfigured(tool);
    });

    return NextResponse.json({
      success: true,
      configured,
    });
  } catch (error) {
    logger.error("Failed to check OAuth configuration", {
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse({
      status: 500,
      code: "OAUTH_CONFIG_ERROR",
      message: "Failed to check OAuth configuration",
    });
  }
}
