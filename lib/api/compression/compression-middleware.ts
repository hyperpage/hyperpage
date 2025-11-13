import zlib from "zlib";

import { NextRequest, NextResponse } from "next/server";

export interface CompressionOptions {
  /** Minimum response size to compress (bytes) */
  minSize?: number;
  /** Compression level (1-9, higher = better compression but slower) */
  level?: number;
  /** Response size threshold to switch from gzip to brotli */
  brotliThreshold?: number;
  /** Whether to include a 'Vary' header for compression */
  includeVaryHeader?: boolean;
}

const defaultOptions: CompressionOptions = {
  minSize: 1024, // Only compress responses larger than 1KB
  level: 6, // Balanced compression speed vs size
  brotliThreshold: 2048, // Use brotli for responses larger than 2KB
  includeVaryHeader: true,
};

/**
 * Advanced compression middleware for API responses
 * Supports gzip, brotli, and automatic algorithm selection
 */
export class CompressionMiddleware {
  private options: CompressionOptions;

  constructor(options: Partial<CompressionOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  /**
   * Apply compression to a NextResponse
   */
  async compress(
    response: NextResponse,
    request: NextRequest,
  ): Promise<NextResponse> {
    // Don't compress non-JSON responses (images, files, etc.)
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return response;
    }

    // Get response body as text
    const responseBody = await response.text();

    // Skip compression for small responses
    if (responseBody.length < (this.options.minSize || 0)) {
      return this.createResponse(response, responseBody, "identity");
    }

    // Get client-supported encodings
    const acceptEncoding = request.headers.get("accept-encoding") || "";
    const supportedEncodings = this.parseAcceptEncoding(acceptEncoding);

    // Choose best compression algorithm
    let compressedBody: Buffer;
    let encoding: string;
    let compressionRatio: number;

    if (
      supportedEncodings.includes("br") &&
      responseBody.length >= (this.options.brotliThreshold || 2048)
    ) {
      // Use Brotli for larger responses if supported
      compressedBody = await this.compressBrotli(responseBody);
      encoding = "br";
      compressionRatio =
        (responseBody.length - compressedBody.length) / responseBody.length;
    } else if (supportedEncodings.includes("gzip")) {
      // Use gzip as fallback
      compressedBody = await this.compressGzip(responseBody);
      encoding = "gzip";
      compressionRatio =
        (responseBody.length - compressedBody.length) / responseBody.length;
    } else {
      // No compression supported
      return this.createResponse(response, responseBody, "identity");
    }

    // Only use compressed response if we achieved meaningful compression (at least 10% reduction)
    if (compressionRatio < 0.1) {
      return this.createResponse(response, responseBody, "identity");
    }

    // Create compressed response
    const compressedResponse = this.createResponse(
      response,
      compressedBody,
      encoding,
    );

    // Add compression metadata headers
    compressedResponse.headers.set("Content-Encoding", encoding);
    compressedResponse.headers.set(
      "X-Compression-Ratio",
      `${Math.round(compressionRatio * 100)}%`,
    );
    compressedResponse.headers.set(
      "X-Uncompressed-Size",
      responseBody.length.toString(),
    );
    compressedResponse.headers.set(
      "X-Compressed-Size",
      compressedBody.length.toString(),
    );

    // Add Vary header to help caches
    if (this.options.includeVaryHeader) {
      compressedResponse.headers.set("Vary", "Accept-Encoding");
    }

    return compressedResponse;
  }

  /**
   * Parse Accept-Encoding header and return supported encodings
   */
  private parseAcceptEncoding(acceptEncoding: string): string[] {
    if (!acceptEncoding) return [];

    const encodings = acceptEncoding
      .split(",")
      .map((enc) => enc.trim().split(";")[0].trim())
      .filter((enc) => enc && enc !== "*" && enc !== "identity");

    // Prioritize brotli, then gzip, deflate
    return encodings.sort((a, b) => {
      const priority = ["br", "gzip", "deflate"];
      return priority.indexOf(a) - priority.indexOf(b);
    });
  }

  /**
   * Compress response body using Brotli
   */
  private async compressBrotli(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.brotliCompress(
        Buffer.from(data),
        {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.level || 6,
          },
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
    });
  }

  /**
   * Compress response body using gzip
   */
  private async compressGzip(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(
        Buffer.from(data),
        {
          level: this.options.level || 6,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
    });
  }

  /**
   * Create response with proper headers and body
   */
  private createResponse(
    originalResponse: NextResponse,
    body: string | Buffer,
    encoding: string,
  ): NextResponse {
    // Clone headers from original response
    const headers = new Headers(originalResponse.headers);

    let responseBody: BodyInit;
    let contentLength: number;

    if (encoding === "identity") {
      responseBody = body as string;
      contentLength =
        typeof body === "string" ? Buffer.from(body).length : body.length;
    } else {
      // Convert Buffer to Uint8Array for NextResponse
      responseBody = new Uint8Array(body as Buffer);
      contentLength = (body as Buffer).length;
      headers.set("Content-Length", contentLength.toString());
    }

    const response = new NextResponse(responseBody, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers,
    });

    return response;
  }

  /**
   * Create middleware function for direct use in API routes
   */
  middleware() {
    return async (response: NextResponse, request: NextRequest) => {
      return this.compress(response, request);
    };
  }

  /**
   * Get compression statistics
   */
  getCompressionStats(): {
    enabled: boolean;
    minSize: number;
    level: number;
    brotliThreshold: number;
    includeVaryHeader: boolean;
  } {
    return {
      enabled: true,
      minSize: this.options.minSize || 1024,
      level: this.options.level || 6,
      brotliThreshold: this.options.brotliThreshold || 2048,
      includeVaryHeader: this.options.includeVaryHeader || true,
    };
  }
}

// Default compression middleware instance
export const defaultCompressionMiddleware = new CompressionMiddleware();

/**
 * Helper function to apply compression to any NextResponse
 */
export async function compressResponse(
  response: NextResponse,
  request: NextRequest,
  options?: Partial<CompressionOptions>,
): Promise<NextResponse> {
  const middleware = options
    ? new CompressionMiddleware(options)
    : defaultCompressionMiddleware;
  return middleware.compress(response, request);
}
