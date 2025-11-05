import { NextResponse, NextRequest } from "next/server";
import { getToolByName, Tool } from "../../../../../tools";
import { ToolApi } from "../../../../../tools/tool-types";
import {
  canExecuteRequest,
  recordRequestSuccess,
  recordRequestFailure,
} from "../../../../../tools/validation";
import { defaultCache } from "../../../../../lib/cache/cache-factory";
import { generateCacheKey } from "../../../../../lib/cache/memory-cache";
import { defaultCompressionMiddleware } from "../../../../../lib/api/compression/compression-middleware";
import { sessionManager } from "../../../../../lib/sessions/session-manager";
import logger from "../../../../../lib/logger";

// Session validation helper with consistent cookie handling
async function validateSession(
  request: NextRequest,
  tool: Tool,
): Promise<NextResponse | null> {
  // Skip session validation in test environment
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  // Check if tool has proper API configuration that should bypass session validation
  const hasApiConfig = hasValidApiConfiguration(tool);

  // Allow tools with valid API configurations to bypass session validation
  // This enables tools like GitLab to use API tokens instead of sessions
  if (hasApiConfig) {
    logger.debug("Tool with API config bypassing session validation", {
      toolName: tool.name,
      toolSlug: tool.slug,
    });
    return null;
  }

  const cookies = request.cookies;

  // Try different possible cookie names - matching auth.ts middleware
  const sessionId =
    cookies.get("hyperpage-session")?.value ||
    cookies.get("sessionId")?.value ||
    cookies.get("session-id")?.value;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Authentication required - no session found" },
      { status: 401 },
    );
  }

  // Check if session actually exists in session manager
  const session = await sessionManager.getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 },
    );
  }

  return null; // Session exists and is valid
}

// Helper to check if a tool has valid API configuration
function hasValidApiConfiguration(tool: Tool): boolean {
  // Check if tool has validation requirements and they pass
  if (tool.validation) {
    const { required = [] } = tool.validation;

    // Check if all required environment variables are set
    for (const envVar of required) {
      const envValue = process.env[envVar];
      if (!envValue || envValue.trim() === "") {
        return false; // Missing required configuration
      }
    }

    // If all required vars are set, this tool can use API auth instead of session
    return true;
  }

  // For tools without explicit validation requirements, check for common patterns
  const toolSlug = tool.slug?.toUpperCase() || tool.name.toUpperCase();
  const tokenVar = `${toolSlug}_TOKEN`;
  const apiUrlVar = `${toolSlug}_WEB_URL`;

  const hasToken =
    !!process.env[tokenVar] && process.env[tokenVar]!.trim() !== "";
  const hasApiUrl =
    !!process.env[apiUrlVar] && process.env[apiUrlVar]!.trim() !== "";

  // Tool has API configuration if it has either token + API URL, or is marked as aggregation tool
  const isAggregationTool =
    tool.capabilities?.includes("aggregate") ||
    tool.capabilities?.includes("combined") ||
    // Check if tool name suggests aggregation (CI/CD, Ticketing, Code Reviews)
    /^(ci[-/ ]?cd|ticketing|code[-/ ]?reviews)$/i.test(tool.name) ||
    /^(ci[-/ ]?cd|ticketing|code[-/ ]?reviews)$/i.test(tool.slug || "");

  return (hasToken && hasApiUrl) || isAggregationTool;
}

// Input validation helper
export function validateInput(
  toolName: string,
  endpoint: string,
): NextResponse | null {
  // Allow alphanumeric, underscores, hyphens, spaces, and URL-encoded characters (%)
  const validInputRegex = /^[a-zA-Z0-9_%\-\s]+$/;

  if (!validInputRegex.test(toolName)) {
    return NextResponse.json({ error: "Invalid tool name" }, { status: 400 });
  }

  if (!validInputRegex.test(endpoint)) {
    return NextResponse.json(
      { error: "Invalid endpoint name" },
      { status: 400 },
    );
  }

  return null; // Valid input
}

// Tool validation helper
export function validateTool(
  toolName: string,
  endpoint: string,
): NextResponse | { tool: Tool; apiConfig: ToolApi } | null {
  // Get tool from registry
  const tool = getToolByName(toolName);

  if (!tool) {
    return NextResponse.json(
      { error: `Tool '${toolName}' not found` },
      { status: 404 },
    );
  }

  if (!tool.enabled) {
    return NextResponse.json(
      { error: `Tool '${toolName}' is not enabled` },
      { status: 403 },
    );
  }

  // Check if tool supports this endpoint
  if (!tool.apis || !tool.apis[endpoint]) {
    return NextResponse.json(
      { error: `Tool '${toolName}' does not support endpoint '${endpoint}'` },
      { status: 404 },
    );
  }

  return { tool, apiConfig: tool.apis[endpoint] };
}

// Helper to map error types to HTTP status codes
function getErrorStatusCode(error: Error): number {
  const message = error.message?.toLowerCase() || "";

  // Input validation errors -> 400
  if (
    message.includes("invalid json") ||
    message.includes("issueids must be a non-empty array") ||
    message.includes("maximum 50 issue ids") ||
    message.includes("maximum 50 issue ids allowed") ||
    (message.includes("issueids") && message.includes("array")) ||
    (message.includes("invalid") && message.includes("parameter"))
  ) {
    return 400;
  }

  // Authentication/authorization errors -> 401/403
  if (
    message.includes("credentials") ||
    message.includes("not configured") ||
    message.includes("access denied") ||
    message.includes("authentication") ||
    message.includes("session")
  ) {
    return 401;
  }

  // Rate limiting -> 429
  if (message.includes("rate limit") || message.includes("rate limited")) {
    return 429;
  }

  // Not found -> 404
  if (message.includes("not found")) {
    return 404;
  }

  // Service unavailable -> 503
  if (
    message.includes("temporarily unavailable") ||
    message.includes("timeout") ||
    message.includes("network")
  ) {
    return 503;
  }

  // Default to 500 for other errors
  return 500;
}

// Handler execution helper with enhanced error handling
export async function executeHandler(
  request: NextRequest,
  tool: Tool,
  endpoint: string,
): Promise<NextResponse> {
  // Check circuit breaker before executing
  if (!canExecuteRequest(tool.slug)) {
    logger.warn("Circuit breaker open for tool - blocking request", {
      toolSlug: tool.slug,
      toolName: tool.name,
      endpoint,
    });
    return NextResponse.json(
      { error: "Service temporarily unavailable", circuitBreaker: "open" },
      { status: 503 },
    );
  }

  // Validate session exists and is valid
  const sessionValidation = await validateSession(request, tool);
  if (sessionValidation) {
    return sessionValidation;
  }

  // Check for cache bypass headers
  const url = new URL(request.url);
  const cacheControl = request.headers.get("cache-control");
  const skipCache =
    cacheControl === "no-cache" ||
    request.headers.has("x-cache-bypass") ||
    (request.headers.has("pragma") &&
      request.headers.get("pragma") === "no-cache");

  // Generate cache key from request parameters
  const queryParams = Object.fromEntries(url.searchParams);
  const cacheKey = generateCacheKey(tool.slug, endpoint, queryParams);

  // Check cache first (unless bypass requested)
  if (!skipCache) {
    const cachedData = await defaultCache.get(cacheKey);
    if (cachedData) {
      logger.debug("Cache hit for tool endpoint", {
        toolSlug: tool.slug,
        toolName: tool.name,
        endpoint,
        cacheKey,
        cacheStatus: "HIT",
      });
      return NextResponse.json(cachedData, {
        headers: {
          "Cache-Control": "private, max-age=30", // Brief client-side caching
          "X-Cache-Status": "HIT",
          "X-Cache-Key": cacheKey,
        },
      });
    }
  }

  logger.debug("Cache miss for tool endpoint", {
    toolSlug: tool.slug,
    toolName: tool.name,
    endpoint,
    cacheKey,
    cacheStatus: "MISS",
  });

  // Route to tool-specific handler from registry
  const handler = tool.handlers[endpoint];
  if (!handler) {
    recordRequestFailure(tool.slug); // Record handler missing as a failure
    return NextResponse.json(
      {
        error: `Tool '${tool.name}' does not implement endpoint '${endpoint}'`,
      },
      { status: 501 },
    );
  }

  try {
    const data = await handler(request, tool.config || {});
    recordRequestSuccess(tool.slug); // Record successful execution

    // Check if the response is an error object (like { error: "message", status: 400 })
    if (
      data &&
      typeof data === "object" &&
      data.error &&
      typeof data.error === "string"
    ) {
      const errorMessage = data.error || "Unknown error";
      const statusCode =
        typeof data.status === "number"
          ? data.status
          : getErrorStatusCode(new Error(errorMessage));
      return NextResponse.json(data, {
        status: statusCode,
        headers: {
          "Cache-Control": "no-store", // Never cache error responses
          "X-Cache-Status": "ERROR",
          "X-Cache-Key": cacheKey,
        },
      });
    }

    // Cache successful responses (not bypass and not errors)
    if (!skipCache && data && typeof data === "object") {
      // Default TTL: 5 minutes for activity endpoints, 10 minutes for others
      const ttlMs = endpoint.includes("activity") ? 300000 : 600000;
      defaultCache.set(cacheKey, data, ttlMs);
      logger.debug("Cached response for tool endpoint", {
        toolSlug: tool.slug,
        toolName: tool.name,
        endpoint,
        cacheKey,
        cacheStatus: "CACHED",
        ttlMs,
      });
    }

    // Create response with caching headers and rate limit headers for GitHub
    const headers: Record<string, string> = {
      "Cache-Control": "private, max-age=30", // Brief client-side caching
      "X-Cache-Status": skipCache ? "BYPASS" : "MISS",
      "X-Cache-Key": cacheKey,
    };

    // Add rate limit headers for GitHub tool rate-limit endpoint
    if (
      tool.slug === "github" &&
      endpoint === "rate-limit" &&
      data &&
      typeof data === "object" &&
      "headers" in data
    ) {
      // Extract headers returned by the GitHub handler
      const toolHeaders = (data as { headers?: Record<string, string> })
        .headers;
      if (toolHeaders) {
        Object.assign(headers, toolHeaders);
      }
      // Remove headers from the response data
      delete (data as { headers?: Record<string, string> }).headers;
    }

    const response = NextResponse.json(data, { headers });

    // Apply compression based on request capabilities
    return await defaultCompressionMiddleware.compress(response, request);
  } catch (error) {
    recordRequestFailure(tool.slug); // Record handler error as a failure

    const errorMessage =
      error instanceof Error
        ? error.message
        : "An error occurred while processing the request";
    const statusCode = getErrorStatusCode(
      error instanceof Error
        ? error
        : new Error(errorMessage || "Unknown error"),
    );

    // Don't cache error responses - let them go through fresh
    // This ensures rate limit errors can be retried later
    return NextResponse.json(
      { error: errorMessage },
      {
        status: statusCode,
        headers: {
          "Cache-Control": "no-store", // Never cache errors
          "X-Cache-Status": "ERROR",
          "X-Cache-Key": cacheKey,
        },
      },
    );
  }
}
