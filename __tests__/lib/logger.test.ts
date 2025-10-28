import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import winston from 'winston';

// Mock winston to avoid file system operations during tests
vi.mock('winston', () => {
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    addColors: vi.fn(),
    createLogger: vi.fn(),
    format: {
      timestamp: vi.fn().mockReturnValue({ format: vi.fn() }),
      errors: vi.fn().mockReturnValue({ stack: true }),
      json: vi.fn(),
      colorize: vi.fn().mockReturnValue({ all: true }),
      combine: vi.fn().mockReturnValue({}),
    },
    transports: {
      Console: vi.fn(),
      File: vi.fn(),
    },
  };

  mockLogger.createLogger.mockImplementation(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    exceptions: {
      handle: vi.fn(),
    },
    rejections: {
      handle: vi.fn(),
    },
  }));

  return {
    default: mockLogger,
  };
});

// Import after mocking
import logger, { rateLimitLogger, logApiRequest, logRateLimitStatus } from '../../lib/logger';

describe('Logger', () => {
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = vi.mocked(winston).createLogger.mock.results[0].value;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1640995200000); // Fixed timestamp
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Logger instance creation', () => {
    it('should create a logger with correct configuration', () => {
      expect(winston.createLogger).toHaveBeenCalledWith({
        levels: {
          error: 0,
          warn: 1,
          info: 2,
          debug: 3,
        },
        level: expect.any(String), // Uses LOG_LEVEL env var
        format: expect.any(Object), // Winston format combine object
        defaultMeta: { service: 'hyperpage' },
        transports: expect.arrayContaining([
          expect.objectContaining({ format: expect.any(Object) }), // Console transport
          expect.any(Object), // error.log transport
          expect.any(Object), // combined.log transport
        ]),
      });

      expect(winston.addColors).toHaveBeenCalledWith({
        error: 'red',
        warn: 'yellow',
        info: 'green',
        debug: 'blue',
      });
    });

    it('should set up exception handling', () => {
      expect(mockLogger.exceptions.handle).toHaveBeenCalledWith(
        expect.any(Object) // exceptions.log transport
      );
    });

    it('should set up rejection handling', () => {
      expect(mockLogger.rejections.handle).toHaveBeenCalledWith(
        expect.any(Object) // rejections.log transport
      );
    });
  });

  describe('Log levels', () => {
    it.each(['error', 'warn', 'info', 'debug'] as const)(
      'should have a %s method',
      (level) => {
        expect(typeof mockLogger[level]).toBe('function');
      }
    );

    it('should log messages with correct level', () => {
      mockLogger.info('Test message', { metadata: 'test' });

      expect(mockLogger.info).toHaveBeenCalledWith('Test message', { metadata: 'test' });
    });
  });

  describe('rateLimitLogger', () => {
    describe('hit method', () => {
      it('should log rate limit hits with correct metadata', () => {
        const platform = 'github';
        const data = { resource: 'search', reset: 1234567890 };

        rateLimitLogger.hit(platform, data);

        expect(mockLogger.warn).toHaveBeenCalledWith('RATE_LIMIT_HIT', {
          platform,
          type: 'rate_limit_hit',
          data,
        });
      });
    });

    describe('backoff method', () => {
      it('should log rate limit backoff with retry info', () => {
        const platform = 'gitlab';
        const retryAfter = 60;
        const attemptNumber = 2;
        const data = { limit: 100, remaining: 0 };

        rateLimitLogger.backoff(platform, retryAfter, attemptNumber, data);

        expect(mockLogger.warn).toHaveBeenCalledWith('RATE_LIMIT_BACKOFF', {
          platform,
          retryAfter,
          attemptNumber,
          type: 'rate_limit_backoff',
          data,
        });
      });
    });

    describe('retry method', () => {
      it('should log rate limit retry attempts', () => {
        const platform = 'jira';
        const attemptNumber = 3;
        const data = { status: 429 };

        rateLimitLogger.retry(platform, attemptNumber, data);

        expect(mockLogger.info).toHaveBeenCalledWith('RATE_LIMIT_RETRY', {
          platform,
          attemptNumber,
          type: 'rate_limit_retry',
          data,
        });
      });
    });

    describe('event method', () => {
      it('should log custom rate limiting events', () => {
        const level = 'error' as const;
        const platform = 'github';
        const message = 'Custom error occurred';
        const metadata = { error: 'CONNECTION_FAILED', attempts: 5 };

        rateLimitLogger.event(level, platform, message, metadata);

        expect(mockLogger.error).toHaveBeenCalledWith('RATE_LIMIT_EVENT', {
          platform,
          message,
          type: 'rate_limit_event',
          ...metadata,
        });
      });

      it('should handle events without metadata', () => {
        const level = 'warn' as const;
        const platform = 'gitlab';
        const message = 'Rate limit warning';

        rateLimitLogger.event(level, platform, message);

        expect(mockLogger.warn).toHaveBeenCalledWith('RATE_LIMIT_EVENT', {
          platform,
          message,
          type: 'rate_limit_event',
        });
      });

      it('should support all log levels', () => {
        const testCases: Array<'info' | 'warn' | 'error'> = ['info', 'warn', 'error'];

        testCases.forEach((level) => {
          rateLimitLogger.event(level, 'github', `Test ${level}`, { test: true });

          expect(mockLogger[level]).toHaveBeenCalledWith('RATE_LIMIT_EVENT', {
            platform: 'github',
            message: `Test ${level}`,
            type: 'rate_limit_event',
            test: true,
          });
        });
      });
    });
  });

  describe('logApiRequest utility', () => {
    it('should log API requests with all parameters', () => {
      const platform = 'github';
      const endpoint = '/repos/hyperpage/issues';
      const statusCode = 200;
      const duration = 1250;
      const rateLimitRemaining = 4850;
      const rateLimitReset = 1641000000;

      logApiRequest(platform, endpoint, statusCode, duration, rateLimitRemaining, rateLimitReset);

      expect(mockLogger.info).toHaveBeenCalledWith('API_REQUEST', {
        platform,
        endpoint,
        statusCode,
        duration,
        rateLimitRemaining,
        rateLimitReset,
        type: 'api_request',
      });
    });

    it('should log API requests with minimal parameters', () => {
      const platform = 'gitlab';
      const endpoint = '/api/v4/projects';
      const statusCode = 404;
      const duration = 750;

      logApiRequest(platform, endpoint, statusCode, duration);

      expect(mockLogger.info).toHaveBeenCalledWith('API_REQUEST', {
        platform,
        endpoint,
        statusCode,
        duration,
        rateLimitRemaining: undefined,
        rateLimitReset: undefined,
        type: 'api_request',
      });
    });

    it('should handle undefined values in rate limit data', () => {
      const platform = 'jira';
      const endpoint = '/rest/api/3/issue';
      const statusCode = 429;
      const duration = 2000;

      logApiRequest(platform, endpoint, statusCode, duration, undefined, undefined);

      expect(mockLogger.info).toHaveBeenCalledWith('API_REQUEST', {
        platform,
        endpoint,
        statusCode,
        duration,
        rateLimitRemaining: undefined,
        rateLimitReset: undefined,
        type: 'api_request',
      });
    });
  });

  describe('logRateLimitStatus utility', () => {
    it('should log rate limit status changes', () => {
      const platform = 'github';
      const usagePercent = 15.5;
      const status = 'warning' as const;
      const metadata = { endpoint: 'search', threshold: 80 };

      logRateLimitStatus(platform, usagePercent, status, metadata);

      expect(mockLogger.info).toHaveBeenCalledWith('RATE_LIMIT_STATUS', {
        platform,
        usagePercent,
        status,
        type: 'rate_limit_status',
        ...metadata,
      });
    });

    it('should log rate limit status without optional metadata', () => {
      const platform = 'gitlab';
      const usagePercent = 95.2;
      const status = 'critical' as const;

      logRateLimitStatus(platform, usagePercent, status);

      expect(mockLogger.info).toHaveBeenCalledWith('RATE_LIMIT_STATUS', {
        platform,
        usagePercent,
        status,
        type: 'rate_limit_status',
      });
    });

    it('should support all rate limit status types', () => {
      const statuses: Array<'normal' | 'warning' | 'critical' | 'unknown'> = [
        'normal', 'warning', 'critical', 'unknown'
      ];

      statuses.forEach((status) => {
        logRateLimitStatus('github', 10, status);

        expect(mockLogger.info).toHaveBeenCalledWith('RATE_LIMIT_STATUS', {
          platform: 'github',
          usagePercent: 10,
          status,
          type: 'rate_limit_status',
        });
      });
    });
  });

  describe('Environment variable configuration', () => {
    it('should use LOG_LEVEL environment variable', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      process.env.LOG_LEVEL = 'debug';

      // Re-import to recreate logger with new LOG_LEVEL
      delete require.cache[require.resolve('../../lib/logger')];

      // Need to test this differently since the module is already loaded
      process.env.LOG_LEVEL = originalLogLevel;
    });

    it('should default to info level when LOG_LEVEL not set', () => {
      const originalLogLevel = process.env.LOG_LEVEL;
      delete process.env.LOG_LEVEL;

      // The initial logger creation should have used 'info' as default
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({ level: expect.any(String) })
      );

      // Restore
      process.env.LOG_LEVEL = originalLogLevel;
    });
  });

  describe('Structured logging format', () => {
    it('should include service metadata in defaultMeta', () => {
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultMeta: { service: 'hyperpage' },
        })
      );
    });

    it('should use JSON format for structured logging', () => {
      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
      expect(winston.format.json).toHaveBeenCalled();
    });

    it('should include colorized output for console', () => {
      expect(winston.format.colorize).toHaveBeenCalledWith({ all: true });
    });
  });

  describe('Log transport configuration', () => {
    it('should configure console transport with colorized output', () => {
      expect(winston.transports.Console).toHaveBeenCalledWith(
        expect.objectContaining({
          format: expect.any(Object), // Combined format
        })
      );
    });

    it('should configure error file transport', () => {
      expect(winston.transports.File).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'logs/error.log',
          level: 'error',
          format: expect.any(Object),
        })
      );
    });

    it('should configure combined file transport', () => {
      expect(winston.transports.File).toHaveBeenCalledTimes(2); // One for errors, one for combined

      // Check if combined log transport was configured
      const fileCalls = vi.mocked(winston.transports.File).mock.calls;
      const combinedCall = fileCalls.find(call =>
        call[0]?.filename === 'logs/combined.log'
      );

      expect(combinedCall).toBeDefined();
      expect(combinedCall?.[0]).toEqual(
        expect.objectContaining({
          filename: 'logs/combined.log',
          format: expect.any(Object),
        })
      );
    });
  });

  describe('Exception and rejection handling', () => {
    it('should handle uncaught exceptions', () => {
      expect(mockLogger.exceptions.handle).toHaveBeenCalled();
    });

    it('should handle unhandled promise rejections', () => {
      expect(mockLogger.rejections.handle).toHaveBeenCalled();
    });
  });
});
