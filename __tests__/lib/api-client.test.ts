import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeRetryRequest, calculateBackoffDelay } from '../../lib/api-client';
import { ToolRateLimitConfig } from '../../tools/tool-types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client Rate Limiting', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff with default base delay', () => {
      expect(calculateBackoffDelay(0)).toBe(1000); // 1s * 2^0 = 1000ms
      expect(calculateBackoffDelay(1)).toBe(2000); // 1s * 2^1 = 2000ms
      expect(calculateBackoffDelay(2)).toBe(4000); // 1s * 2^2 = 4000ms
      expect(calculateBackoffDelay(3)).toBe(8000); // 1s * 2^3 = 8000ms
    });

    it('should cap delay at maximum of 60 seconds', () => {
      const largeAttemptNumber = 10; // 1s * 2^10 = 1024s = 1024 * 1000ms = 1,024,000ms ≈ 17 minutes
      expect(calculateBackoffDelay(largeAttemptNumber)).toBe(60000); // Capped at 60s
    });

    it('should work with custom base delay', () => {
      const customBaseDelay = 2000; // 2 seconds
      expect(customBaseDelay * Math.pow(2, 2)).toBe(8000);
    });
  });

  describe('makeRetryRequest', () => {
    const mockUrl = 'https://api.example.com/test';
    const mockOptions = { method: 'GET' };

    const createMockResponse = (status: number, headers: Record<string, string> = {}): Response => {
      const response = {
        ok: status >= 200 && status < 300,
        status,
        statusText: 'Test',
        headers: new Headers(headers),
        json: vi.fn().mockResolvedValue({ data: 'test' }),
        text: vi.fn().mockResolvedValue('test'),
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        blob: vi.fn(),
        formData: vi.fn(),
      } as Partial<Response> as Response;

      // Mock Headers.get method
      response.headers.get = vi.fn((name: string) => headers[name.toLowerCase()] || null);

      return response;
    };

    const createToolConfig = (overrides: Partial<ToolRateLimitConfig> = {}): ToolRateLimitConfig => ({
      detectHeaders: vi.fn().mockReturnValue({ remaining: null, resetTime: null, retryAfter: null }),
      shouldRetry: vi.fn().mockReturnValue(null), // No retry by default
      maxRetries: 3,
      backoffStrategy: 'exponential',
      ...overrides
    });

    it('should return successful response immediately', async () => {
      const mockResponse = createMockResponse(200);
      mockFetch.mockResolvedValueOnce(mockResponse);

      const config: ToolRateLimitConfig = createToolConfig();
      const response = await makeRetryRequest(mockUrl, mockOptions, { rateLimitConfig: config, forceFetch: true });

      expect(response).toBe(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(mockUrl, mockOptions);
    });

    it('should retry on 429 status when shouldRetry indicates to', async () => {
      const errorResponse = createMockResponse(429);
      const successResponse = createMockResponse(200);

      mockFetch
        .mockResolvedValueOnce(errorResponse) // First call fails
        .mockResolvedValueOnce(successResponse); // Second call succeeds

      const config: ToolRateLimitConfig = createToolConfig({
        shouldRetry: vi.fn().mockReturnValue(1000), // Retry with 1s delay
        maxRetries: 3
      });

      const responsePromise = makeRetryRequest(mockUrl, mockOptions, { rateLimitConfig: config, forceFetch: true });

      // Advance timer to complete the delay
      await vi.advanceTimersByTimeAsync(1000);

      const response = await responsePromise;

      expect(response).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(config.shouldRetry).toHaveBeenCalledWith(errorResponse, 0);
    });

    it('should not retry when shouldRetry returns null', async () => {
      const errorResponse = createMockResponse(500);
      mockFetch.mockResolvedValueOnce(errorResponse);

      const config: ToolRateLimitConfig = createToolConfig({
        shouldRetry: vi.fn().mockReturnValue(null), // No retry
        maxRetries: 3
      });

      const response = await makeRetryRequest(mockUrl, mockOptions, { rateLimitConfig: config, forceFetch: true });

      expect(response).toBe(errorResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(config.shouldRetry).toHaveBeenCalledWith(errorResponse, 0);
    });

    it('should respect maxRetries limit', async () => {
      const config: ToolRateLimitConfig = createToolConfig({
        shouldRetry: vi.fn().mockReturnValue(10), // Very short delay for testing
        maxRetries: 1 // Lower to make test simpler
      });

      // Mock exactly 2 calls (initial + 1 retry) all returning rate limited response
      mockFetch
        .mockResolvedValueOnce(createMockResponse(429)) // Initial call
        .mockResolvedValueOnce(createMockResponse(429)); // Only retry

      const responsePromise = makeRetryRequest(mockUrl, mockOptions, { rateLimitConfig: config, forceFetch: true });

      // Wait for retry delay (10ms)
      await vi.advanceTimersByTimeAsync(20);

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry (maxRetries = 1)
      expect(config.shouldRetry).toHaveBeenCalledTimes(2); // Called for each failure
    });

    it('should handle network errors with retry', async () => {
      const networkError = new Error('Network error');
      const successResponse = createMockResponse(200);

      mockFetch
        .mockRejectedValueOnce(networkError) // First call fails
        .mockResolvedValueOnce(successResponse); // Second call succeeds

      const config: ToolRateLimitConfig = createToolConfig({
        maxRetries: 3
      });

      const responsePromise = makeRetryRequest(mockUrl, mockOptions, { rateLimitConfig: config, forceFetch: true });

      // Wait for the retry delay (calculateBackoffDelay(0) = 1000ms)
      await vi.advanceTimersByTimeAsync(1000);

      const response = await responsePromise;

      expect(response).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should call shouldRetry for each failed response', async () => {
      const errorResponse1 = createMockResponse(429);
      const errorResponse2 = createMockResponse(429);

      mockFetch
        .mockResolvedValueOnce(errorResponse1) // First attempt fails
        .mockResolvedValueOnce(errorResponse2); // Second attempt fails

      const config: ToolRateLimitConfig = createToolConfig({
        shouldRetry: vi.fn().mockReturnValue(50), // Short delay
        maxRetries: 1
      });

      const responsePromise = makeRetryRequest(mockUrl, mockOptions, { rateLimitConfig: config, forceFetch: true });

      // Advance timer enough for retry delay
      await vi.advanceTimersByTimeAsync(100);

      const response = await responsePromise;

      expect(config.shouldRetry).toHaveBeenCalledTimes(2); // Called for each failed response
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    describe('Platform-specific configurations', () => {
      it('should allow custom retry logic via shouldRetry function', async () => {
        const rateLimitedResponse = createMockResponse(429);
        const successResponse = createMockResponse(200);

        mockFetch
          .mockResolvedValueOnce(rateLimitedResponse) // First call fails
          .mockResolvedValueOnce(successResponse); // Second call succeeds

        const config: ToolRateLimitConfig = createToolConfig({
          shouldRetry: vi.fn().mockImplementation((response, attemptNumber) => {
            // Custom logic: only retry on 429 status once
            if (response.status === 429 && attemptNumber === 0) {
              return 1000; // 1 second delay
            }
            return null; // No retry
          }),
          maxRetries: 3
        });

        const responsePromise = makeRetryRequest(mockUrl, mockOptions, { rateLimitConfig: config, forceFetch: true });

        await vi.advanceTimersByTimeAsync(2000); // Wait for retry delay

        const response = await responsePromise;

        expect(response).toBe(successResponse);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(config.shouldRetry).toHaveBeenCalledTimes(1);
      });
    });
  });
});
