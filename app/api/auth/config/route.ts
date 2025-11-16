import fs from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { isOAuthConfigured } from "@/lib/oauth-config";
import logger from "@/lib/logger";
import { createErrorResponse } from "@/lib/api/responses";
import { getEnvFileName } from "@/lib/config/env-file";

/**
 * Load environment variables from the active env file
 * This ensures OAuth credentials are available for API routes
 */
function loadEnvFile() {
  try {
    const envFileName = getEnvFileName({ scope: "server" });
    const envPath = path.join(process.cwd(), envFileName);
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
    logger.warn("Could not load env file for OAuth config", { error });
  }
}

/**
 * Get OAuth configuration status for tools
 * Returns which tools are properly configured for OAuth
 */
export async function GET() {
  try {
    // Load environment variables from env file
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
