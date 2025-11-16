import { NextRequest, NextResponse } from "next/server";

import logger from "@/lib/logger";
import {
  performanceDashboard,
  PerformanceSnapshot,
} from "@/lib/monitoring/performance-dashboard";

export interface PerformanceMiddlewareOptions {
  /** Whether to log detailed debugging information */
  debug?: boolean;
  /** Endpoints to exclude from monitoring (regex patterns) */
  excludePatterns?: RegExp[];
  /** Whether to include response body size in metrics */
  includeBodySize?: boolean;
  /** Whether to collect detailed stack traces (expensive) */
  detailedStackTraces?: boolean;
}

/**
 * Performance middleware that automatically records API performance metrics
 * and integrates with the enterprise monitoring dashboard
 */
export class PerformanceMiddleware {
  private options: PerformanceMiddlewareOptions;

  constructor(options: Partial<PerformanceMiddlewareOptions> = {}) {
    this.options = {
      debug: false,
      excludePatterns: [],
      includeBodySize: true,
      detailedStackTraces: false,
      ...options,
    };
  }

  /**
   * Middleware function to wrap API responses with performance monitoring
   */
  async recordPerformance(
    request: NextRequest,
    response: NextResponse,
  ): Promise<NextResponse> {
    const url = new URL(request.url);

    // Check if this endpoint should be excluded from monitoring
    if (this.shouldExcludeEndpoint(url.pathname)) {
      return response;
    }

    try {
      // Start performance timing
      const reqStartTime = performance.now();

      // Clone response to measure final size and extract data
      const responseClone = response.clone();
      let responseSizeBytes = 0;
      let compressionRatio: number | undefined;
      let compressionMethod: "gzip" | "br" | "identity" = "identity";

      // Extract response metadata
      if (this.options.includeBodySize) {
        const responseBodyText = await responseClone.text();
        responseSizeBytes = Buffer.byteLength(responseBodyText, "utf8");

        // Recreate response from text since we consumed the original
        response = this.recreateResponseFromText(response, responseBodyText);

        // Check for compression headers
        const contentEncoding = responseClone.headers.get("content-encoding");
        if (contentEncoding) {
          compressionMethod = contentEncoding as "gzip" | "br" | "identity";

          // Extract compression ratio from headers if available
          const compressionRatioHeader = responseClone.headers.get(
            "x-compression-ratio",
          );
          if (compressionRatioHeader) {
            const match = compressionRatioHeader.match(/(\d+\.?\d*)%/);
            if (match) {
              compressionRatio = parseFloat(match[1]);
            }
          }
        }
      }

      const responseTimeMs = performance.now() - reqStartTime;

      // Extract cache status
      let cacheStatus: PerformanceSnapshot["cacheStatus"] = "MISS";
      const cacheStatusHeader = responseClone.headers.get("x-cache-status");
      if (cacheStatusHeader === "HIT") {
        cacheStatus = "HIT";
      } else if (cacheStatusHeader === "BYPASS") {
        cacheStatus = "BYPASS";
      }

      // Create performance snapshot
      const snapshot: Omit<PerformanceSnapshot, "timestamp"> = {
        responseTimeMs,
        responseSizeBytes,
        cacheStatus,
        compressionRatio,
        compressionMethod,
        endpoint: url.pathname,
        method: request.method,
        statusCode: response.status,
      };

      // Record the snapshot
      performanceDashboard.recordSnapshot(snapshot);

      // Debug logging
      if (this.options.debug) {
        logger.debug(`📊 Performance snapshot recorded:`, {
          endpoint: snapshot.endpoint,
          method: snapshot.method,
          status: snapshot.statusCode,
          responseTimeMs: snapshot.responseTimeMs.toFixed(2),
          cacheStatus: snapshot.cacheStatus,
          compressionRatio: snapshot.compressionRatio,
        });
      }

      return response;
    } catch {
      // Don't let performance monitoring break the response
      // Log the error but continue with the response

      if (this.options.debug) {
        // Error logging could be added here if needed
      }

      return response;
    }
  }

  /**
   * Check if an endpoint should be excluded from monitoring
   */
  private shouldExcludeEndpoint(endpoint: string): boolean {
    if (!this.options.excludePatterns) return false;

    return this.options.excludePatterns.some((pattern) =>
      pattern.test(endpoint),
    );
  }

  /**
   * Recreate a NextResponse from a text body (needed after consuming the original body)
   */
  private recreateResponseFromText(
    originalResponse: NextResponse,
    bodyText: string,
  ): NextResponse {
    // Create new headers preserving all original headers
    const headers = new Headers(originalResponse.headers);

    // Remove content-length as it will be recalculated (it's ok if it doesn't match exactly for monitoring)
    headers.delete("content-length");

    return new NextResponse(bodyText, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers,
    });
  }

  /**
   * Create a middleware wrapper for API route handlers
   */
  createPerfWrapper() {
    return async (
      request: NextRequest,
      response: NextResponse,
    ): Promise<NextResponse> => {
      return this.recordPerformance(request, response);
    };
  }

  /**
   * Create Express-style middleware for other frameworks
   */
  createMiddleware() {
    return async (req: unknown, res: unknown, next: () => void) => {
      const startTime = performance.now();

      // Define safe type guards for Express objects
      const isExpressResponse = (
        obj: unknown,
      ): obj is {
        on: (event: string, callback: () => void) => void;
        statusCode?: number;
      } => {
        return (
          typeof obj === "object" &&
          obj !== null &&
          "on" in obj &&
          typeof (obj as { on: unknown }).on === "function"
        );
      };

      const getSafeString = (obj: unknown, property: string): string => {
        return ((obj as Record<string, unknown>)?.[property] as string) || "/";
      };

      // Hook into response finish event
      if (isExpressResponse(res)) {
        res.on("finish", () => {
          try {
            const responseTimeMs = performance.now() - startTime;

            // Create basic snapshot for Express middleware
            const snapshot: Omit<PerformanceSnapshot, "timestamp"> = {
              responseTimeMs,
              responseSizeBytes: 0, // Express doesn't provide easy access to response size
              cacheStatus: "MISS",
              endpoint:
                getSafeString(req, "path") || getSafeString(req, "url") || "/",
              method: getSafeString(req, "method") || "GET",
              statusCode:
                ((res as Record<string, unknown>)?.statusCode as number) || 200,
            };

            performanceDashboard.recordSnapshot(snapshot);

            if (this.options.debug) {
              // Debug logging could be added here if needed
            }
          } catch {
            // Error handling for Express middleware
          }
        });
      }

      next();
    };
  }

  /**
   * Manually record a performance snapshot (for programmatic use)
   */
  recordManualSnapshot(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    responseSizeBytes: number = 0,
    cacheStatus: PerformanceSnapshot["cacheStatus"] = "MISS",
    compressionRatio?: number,
    compressionMethod: "gzip" | "br" | "identity" = "identity",
  ): void {
    const snapshot: Omit<PerformanceSnapshot, "timestamp"> = {
      responseTimeMs,
      responseSizeBytes,
      cacheStatus,
      compressionRatio,
      compressionMethod,
      endpoint,
      method,
      statusCode,
    };

    performanceDashboard.recordSnapshot(snapshot);
  }

  /**
   * Get middleware configuration (for debugging)
   */
  getConfig(): PerformanceMiddlewareOptions {
    return { ...this.options };
  }

  /**
   * Update middleware configuration
   */
  updateConfig(newOptions: Partial<PerformanceMiddlewareOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

// Global performance middleware instance
export const performanceMiddleware = new PerformanceMiddleware({
  debug: process.env.NODE_ENV === "development",
  excludePatterns: [
    /^\/api\/metrics/, // Don't monitor metrics endpoint to avoid recursion
    /^\/api\/health/, // Health checks don't need detailed monitoring
    /^\/_next\//, // Next.js internal routes
    /^\/favicon/, // Static assets
  ],
});

/**
 * Helper function to wrap any response with performance monitoring
 */
export async function withPerformanceMonitoring(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  return performanceMiddleware.recordPerformance(request, response);
}

/**
 * Helper function to manually record performance metrics
 */
export function recordPerformanceSnapshot(
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  responseSizeBytes: number = 0,
  cacheStatus: PerformanceSnapshot["cacheStatus"] = "MISS",
  compressionRatio?: number,
  compressionMethod: "gzip" | "br" | "identity" = "identity",
): void {
  performanceMiddleware.recordManualSnapshot(
    endpoint,
    method,
    statusCode,
    responseTimeMs,
    responseSizeBytes,
    cacheStatus,
    compressionRatio,
    compressionMethod,
  );
}
