import { NextResponse } from "next/server";
import { isOAuthConfigured } from "@/lib/oauth-config";

/**
 * Get OAuth configuration status for tools
 * Returns which tools are properly configured for OAuth
 */
export async function GET() {
  try {
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
    
    return NextResponse.json(
      { success: false, error: "Failed to check OAuth configuration" },
      { status: 500 },
    );
  }
}
