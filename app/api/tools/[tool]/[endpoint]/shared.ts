import { NextResponse } from "next/server";
import { getToolByName, Tool } from "../../../../../tools";
import { ToolApi } from "../../../../../tools/tool-types";
import { canExecuteRequest, recordRequestSuccess, recordRequestFailure } from "../../../../../tools/validation";
import { defaultCache, generateCacheKey } from "../../../../../lib/cache/memory-cache";

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

// Handler execution helper with caching support
export async function executeHandler(
  request: Request,
  tool: Tool,
  endpoint: string,
): Promise<NextResponse> {
  // Check circuit breaker before executing
  if (!canExecuteRequest(tool.slug)) {
    console.warn(`Circuit breaker open for tool '${tool.slug}' - blocking request`);
    return NextResponse.json(
      { error: "Service temporarily unavailable", circuitBreaker: "open" },
      { status: 503 },
    );
  }

  // Check for cache bypass headers
  const url = new URL(request.url);
  const cacheControl = request.headers.get('cache-control');
  const skipCache = cacheControl === 'no-cache' ||
                   request.headers.has('x-cache-bypass') ||
                   request.headers.has('pragma') && request.headers.get('pragma') === 'no-cache';

  // Generate cache key from request parameters
  const queryParams = Object.fromEntries(url.searchParams);
  const cacheKey = generateCacheKey(tool.slug, endpoint, queryParams);

  // Check cache first (unless bypass requested)
  if (!skipCache) {
    const cachedData = await defaultCache.get(cacheKey);
    if (cachedData) {
      console.debug(`Cache hit for ${tool.slug}/${endpoint} (${cacheKey})`);
      return NextResponse.json(cachedData, {
        headers: {
          'Cache-Control': 'private, max-age=30', // Brief client-side caching
          'X-Cache-Status': 'HIT',
          'X-Cache-Key': cacheKey,
        },
      });
    }
  }

  console.debug(`Cache miss for ${tool.slug}/${endpoint} (${cacheKey})`);

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

    // Cache successful responses (not bypass and not errors)
    if (!skipCache && data && typeof data === 'object') {
      // Default TTL: 5 minutes for activity endpoints, 10 minutes for others
      const ttlMs = endpoint.includes('activity') ? 300000 : 600000;
      defaultCache.set(cacheKey, data, ttlMs);
      console.debug(`Cached response for ${tool.slug}/${endpoint} (${cacheKey}) with TTL ${ttlMs}ms`);
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=30', // Brief client-side caching
        'X-Cache-Status': skipCache ? 'BYPASS' : 'MISS',
        'X-Cache-Key': cacheKey,
      },
    });
  } catch (error) {
    console.error(`Handler error for ${tool.name}/${endpoint}:`, error);
    recordRequestFailure(tool.slug); // Record handler error as a failure

    // Don't cache error responses - let them go through fresh
    // This ensures rate limit errors can be retried later
    return NextResponse.json(
      { error: "An error occurred while processing the request" },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store', // Never cache errors
          'X-Cache-Status': 'ERROR',
          'X-Cache-Key': cacheKey,
        },
      },
    );
  }
}
