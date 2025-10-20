import { NextRequest, NextResponse } from "next/server.js";
import { getEnabledToolsByCapability, Tool } from "../../../../tools";

// Unified activity API endpoint
// Aggregates activity from all enabled tools with activity capability
export async function GET() {
  try {
    // Get all enabled tools that provide activity data
    const activityTools = getEnabledToolsByCapability("activity");

    if (activityTools.length === 0) {
      return NextResponse.json({
        activity: [],
        message: "No tools providing activity data are currently enabled",
      });
    }

    const allActivities: Array<{
      id: string;
      tool: string;
      toolIcon: string;
      action: string;
      description: string;
      author: string;
      time: string;
      color: string;
      timestamp: string;
      url: string;
      displayId: string;
    }> = [];

    // Fetch activity from each enabled tool by calling handlers directly
    for (const tool of activityTools as Tool[]) {
      try {
        // Create a minimal NextRequest object for the handler
        const mockRequest = new NextRequest(
          "http://localhost:3000/api/tools/activity",
          {
            method: "GET",
          },
        );

        // Call the tool's activity handler directly
        const handler = tool.handlers["activity"];
        if (!handler) {
          console.warn(`No activity handler found for ${tool.name}`);
          continue;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: { activity?: any[] } = await handler(
          mockRequest,
          tool.config || {},
        );

        if (result.activity && Array.isArray(result.activity)) {
          // Add tool identification and transform data
          const transformedActivities = result.activity.map(
            (activity: Record<string, unknown>) => {
              // Ensure activity has expected properties
              const validActivity = {
                id: String(activity.id || ""),
                tool: String(activity.tool || tool.name),
                toolIcon: String(activity.toolIcon || tool.name.toLowerCase()),
                action: String(activity.action || ""),
                description: String(activity.description || ""),
                author: String(activity.author || ""),
                time: String(activity.time || ""),
                color: String(activity.color || "blue"),
                timestamp: String(activity.timestamp || ""),
                url: String(activity.url || ""), // Pass through URL for hyperlinks
                displayId: String(activity.displayId || ""), // Pass through display-friendly ID
                // Extended metadata fields
                repository: activity.repository
                  ? String(activity.repository)
                  : undefined,
                branch: activity.branch ? String(activity.branch) : undefined,
                commitCount: activity.commitCount
                  ? Number(activity.commitCount)
                  : undefined,
                status: activity.status ? String(activity.status) : undefined,
                assignee: activity.assignee
                  ? String(activity.assignee)
                  : undefined,
                labels: Array.isArray(activity.labels)
                  ? activity.labels.map(String)
                  : undefined,
              };
              return validActivity;
            },
          );
          allActivities.push(...transformedActivities);
        }
      } catch (error) {
        console.warn(`Failed to fetch activity from ${tool.name}:`, error);
        // Continue with other tools if one fails
      }
    }

    // Sort activities by timestamp (most recent first)
    allActivities.sort((a, b) => {
      const timeA = new Date(a.timestamp || new Date(0));
      const timeB = new Date(b.timestamp || new Date(0));
      return timeB.getTime() - timeA.getTime();
    });

    // Limit to most recent 50 activities to prevent overwhelming the feed
    const limitedActivities = allActivities.slice(0, 50);

    return NextResponse.json({
      activity: limitedActivities,
      sources: activityTools.length,
      message:
        limitedActivities.length === 0 ? "No recent activity found" : undefined,
    });
  } catch (error) {
    console.error("Error fetching activity data:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity data" },
      { status: 500 },
    );
  }
}
