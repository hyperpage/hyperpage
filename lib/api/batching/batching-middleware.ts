import { NextRequest, NextResponse } from 'next/server';

// Types for batch requests
export interface BatchRequest {
  /** Unique ID for this specific request */
  id: string;
  /** API path without the base URL (e.g., '/api/tools/github/pull-requests') */
  path: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (for POST/PUT/PATCH) */
  body?: unknown;
  /** Optional timeout for this specific request (ms) */
  timeout?: number;
}

export interface BatchResponse {
  /** Unique ID matching the request */
  id: string;
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body: unknown;
  /** Error details if request failed */
  error?: string;
  /** Duration in milliseconds */
  duration: number;
}

export interface BatchResult {
  /** Array of individual responses */
  responses: BatchResponse[];
  /** Total duration for the entire batch */
  totalDuration: number;
  /** Number of successful requests */
  successCount: number;
  /** Number of failed requests */
  errorCount: number;
  /** Overall batch status */
  hasErrors: boolean;
}

export interface BatchOptions {
  /** Maximum number of requests per batch */
  maxRequests?: number;
  /** Default timeout per request (ms) */
  defaultTimeout?: number;
  /** Maximum total execution time (ms) */
  maxExecutionTime?: number;
  /** Whether to continue processing other requests if one fails */
  continueOnError?: boolean;
  /** Whether to parallelize request execution */
  parallelExecution?: boolean;
}

/**
 * Advanced batching middleware for handling bulk API operations
 * Supports parallel execution, timeouts, and error handling
 */
export class BatchingMiddleware {
  private options: BatchOptions;
  private baseUrl: string;

  constructor(baseUrl: string, options: Partial<BatchOptions> = {}) {
    this.baseUrl = baseUrl;
    this.options = {
      maxRequests: 20,
      defaultTimeout: 30000, // 30 seconds
      maxExecutionTime: 60000, // 60 seconds total
      continueOnError: true,
      parallelExecution: true,
      ...options,
    };
  }

  /**
   * Process a batch request
   */
  async processBatch(
    requests: BatchRequest[],
    request: NextRequest
  ): Promise<NextResponse> {
    const startTime = Date.now();

    // Validate batch request
    const validation = this.validateBatchRequest(requests);
    if (!validation.valid) {
      return NextResponse.json({
        error: validation.error,
        code: 'BATCH_VALIDATION_ERROR'
      }, { status: 400 });
    }

    try {
      // Extract base URL from current request for internal routing
      const currentUrl = new URL(request.url);
      const internalBaseUrl = `${currentUrl.protocol}//${currentUrl.host}`;

      // Execute batch requests
      const batchResult = await this.executeBatch(requests, internalBaseUrl);

      // Add total duration
      batchResult.totalDuration = Date.now() - startTime;

      // Count successes and errors
      batchResult.successCount = batchResult.responses.filter(r => r.status >= 200 && r.status < 400).length;
      batchResult.errorCount = batchResult.responses.filter(r => r.status >= 400).length;
      batchResult.hasErrors = batchResult.errorCount > 0;

      // Return batch result
      return NextResponse.json(batchResult, {
        headers: {
          'X-Batch-Total-Duration': batchResult.totalDuration.toString(),
          'X-Batch-Success-Count': batchResult.successCount.toString(),
          'X-Batch-Error-Count': batchResult.errorCount.toString(),
          'X-Batch-Has-Errors': batchResult.hasErrors.toString(),
        },
      });

    } catch (error) {
      console.error('Batch processing error:', error);
      return NextResponse.json({
        error: 'Batch processing failed',
        code: 'BATCH_EXECUTION_ERROR',
      }, {
        status: 500,
        headers: {
          'X-Batch-Error': 'EXECUTION_FAILED',
          'X-Batch-Total-Duration': (Date.now() - startTime).toString(),
        },
      });
    }
  }

  /**
   * Execute individual requests in the batch
   */
  private async executeBatch(
    requests: BatchRequest[],
    internalBaseUrl: string
  ): Promise<BatchResult> {
    const responses: BatchResponse[] = [];
    let hasErrors = false;

    if (this.options.parallelExecution) {
      // Execute requests in parallel
      const promises = requests.map(request =>
        this.executeSingleRequest(request, internalBaseUrl)
      );

      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          responses.push(result.value);
          if (result.value.status >= 400) {
            hasErrors = true;
          }
        } else {
          // Handle rejected promises (network errors, timeouts, etc.)
          const originalRequest = requests[index];
          responses.push(this.createErrorResponse(
            originalRequest.id,
            'Request execution failed',
            result.reason?.message || 'Unknown error',
            0
          ));
          hasErrors = true;
        }
      });
    } else {
      // Execute requests sequentially
      for (const request of requests) {
        try {
          const response = await this.executeSingleRequest(request, internalBaseUrl);
          responses.push(response);
          if (response.status >= 400) {
            hasErrors = true;
            // Stop on first error if configured
            if (!this.options.continueOnError) {
              break;
            }
          }
        } catch (error) {
          const errorResponse = this.createErrorResponse(
            request.id,
            'Request execution failed',
            error instanceof Error ? error.message : 'Unknown error',
            0
          );
          responses.push(errorResponse);
          hasErrors = true;
          if (!this.options.continueOnError) {
            break;
          }
        }
      }
    }

    return {
      responses,
      totalDuration: 0, // Will be set by caller
      successCount: 0,
      errorCount: 0,
      hasErrors,
    };
  }

  /**
   * Execute a single request within the batch
   */
  private async executeSingleRequest(
    request: BatchRequest,
    internalBaseUrl: string
  ): Promise<BatchResponse> {
    const startTime = Date.now();

    try {
      // Build full URL
      const fullUrl = request.path.startsWith('/')
        ? `${internalBaseUrl}${request.path}`
        : `${internalBaseUrl}/${request.path}`;

      // Build request headers
      const headers = new Headers(request.headers);
      headers.set('X-Batch-Request-Id', request.id);
      headers.set('X-Batch-Request', 'true');

      // Create fetch request
      const fetchOptions: RequestInit = {
        method: request.method,
        headers,
        // Add timeout using AbortController
        signal: AbortSignal.timeout(request.timeout || this.options.defaultTimeout || 30000),
      };

      // Add body for applicable methods
      if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body) {
        if (typeof request.body === 'object') {
          fetchOptions.body = JSON.stringify(request.body) as BodyInit;
          headers.set('Content-Type', 'application/json');
        } else {
          fetchOptions.body = request.body as BodyInit;
        }
      }

      // Execute request
      const response = await fetch(fullUrl, fetchOptions);

      // Parse response
      let responseBody: unknown;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      // Convert headers to object
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        id: request.id,
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      console.error(`Batch request ${request.id} failed:`, error);
      return this.createErrorResponse(
        request.id,
        'Request failed',
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * Create an error response for failed requests
   */
  private createErrorResponse(
    requestId: string,
    error: string,
    details: string,
    duration: number
  ): BatchResponse {
    return {
      id: requestId,
      status: 500,
      headers: { 'content-type': 'application/json' },
      body: { error, details },
      error: details,
      duration,
    };
  }

  /**
   * Validate batch request format and constraints
   */
  private validateBatchRequest(requests: BatchRequest[]): { valid: boolean; error?: string } {
    // Check if requests array is provided
    if (!Array.isArray(requests)) {
      return { valid: false, error: 'Requests must be an array' };
    }

    // Check maximum requests
    if (requests.length > (this.options.maxRequests || 20)) {
      return {
        valid: false,
        error: `Maximum ${this.options.maxRequests} requests per batch exceeded`
      };
    }

    // Check minimum requests
    if (requests.length === 0) {
      return { valid: false, error: 'At least one request required' };
    }

    // Validate each request
    for (const request of requests) {
      if (!request.id || typeof request.id !== 'string') {
        return { valid: false, error: 'Each request must have a valid string id' };
      }

      if (!request.path || typeof request.path !== 'string') {
        return { valid: false, error: 'Each request must have a valid string path' };
      }

      if (!request.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
        return { valid: false, error: 'Each request must have a valid HTTP method' };
      }

      // Validate path (prevent external URLs for security)
      if (!request.path.startsWith('/api/') && !request.path.startsWith('/')) {
        return { valid: false, error: 'Request paths must be internal API routes' };
      }
    }

    return { valid: true };
  }

  /**
   * Get batching statistics
   */
  getBatchStats(): {
    enabled: boolean;
    maxRequests: number;
    defaultTimeout: number;
    maxExecutionTime: number;
    continueOnError: boolean;
    parallelExecution: boolean;
  } {
    return {
      enabled: true,
      maxRequests: this.options.maxRequests || 20,
      defaultTimeout: this.options.defaultTimeout || 30000,
      maxExecutionTime: this.options.maxExecutionTime || 60000,
      continueOnError: this.options.continueOnError || true,
      parallelExecution: this.options.parallelExecution || true,
    };
  }
}

// Default batching middleware instance (adjustable via environment)
const defaultBaseUrl = process.env.BASE_URL || 'http://localhost:3000';
export const defaultBatchingMiddleware = new BatchingMiddleware(defaultBaseUrl);

/**
 * Helper function to create a batch request
 */
export function createBatchRequest(
  id: string,
  path: string,
  method: BatchRequest['method'] = 'GET',
  options: Partial<Omit<BatchRequest, 'id' | 'path' | 'method'>> = {}
): BatchRequest {
  return {
    id: id || crypto.randomUUID(),
    path,
    method,
    ...options,
  };
}

/**
 * Type guard to check if a request is a batch request
 */
export function isBatchRequest(body: unknown): body is BatchRequest[] {
  return Array.isArray(body) &&
         body.length > 0 &&
         typeof body[0].id === 'string' &&
         typeof body[0].path === 'string' &&
         typeof body[0].method === 'string';
}
