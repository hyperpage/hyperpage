import fs from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { getEnvFileName } from "@/lib/config/env-file";
import logger from "@/lib/logger";
import { getAllTools } from "@/tools";
import type { Tool } from "@/tools/tool-types";

const REQUIRED_ENV_VARS = [
  "SESSION_SECRET",
  "JWT_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
];

export async function GET() {
  try {
    const envFileName = getEnvFileName({ scope: "server" });
    const envFilePath = path.join(process.cwd(), envFileName);
    const envFileExists = fs.existsSync(envFilePath);

    const missingVariables = REQUIRED_ENV_VARS.filter(
      (key) => !process.env[key] || process.env[key]?.trim() === "",
    );

    const tools = getAllTools();

    const toolStatuses = tools.map((tool) => {
      const requiredVars = tool.validation?.required ?? [];
      const missingEnv = requiredVars.filter(
        (key) => !process.env[key] || process.env[key]?.trim() === "",
      );

      return {
        name: tool.name,
        slug: tool.slug,
        enabled: tool.enabled === true,
        missingEnv,
      };
    });

    const hasReadyTool = toolStatuses.some(
      (tool) => tool.enabled && tool.missingEnv.length === 0,
    );

    const coreStatus = {
      envFile: envFileName,
      fileExists: envFileExists,
      missingVariables,
      isReady: missingVariables.length === 0,
    };

    return NextResponse.json({
      success: true,
      coreStatus,
      toolStatuses,
      hasReadyTool,
    });
  } catch (error) {
    logger.error("Failed to load config status", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        message: "Failed to determine configuration status",
      },
      { status: 500 },
    );
  }
}
