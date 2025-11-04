import pino from 'pino';

// State-of-the-art TypeScript interfaces for unified logging
// Extend LoggerMetadata to handle unknown types (common for error objects)
export type LoggerMetadata = Record<string, any> | unknown;

export interface LogLevel {
  error: (message: string, meta?: LoggerMetadata) => void;
  warn: (message: string, meta?: LoggerMetadata) => void;
  info: (message: string, meta?: LoggerMetadata) => void;
  debug: (message: string, meta?: LoggerMetadata) => void;
}

export interface RateLimitLogger {
  hit: (platform: string, data: LoggerMetadata) => void;
  backoff: (
    platform: string,
    retryAfter: number,
    attemptNumber: number,
    data: LoggerMetadata,
  ) => void;
  retry: (platform: string, attemptNumber: number, data: LoggerMetadata) => void;
  event: (
    level: 'info' | 'warn' | 'error',
    platform: string,
    message: string,
    metadata?: Record<string, any>,
  ) => void;
}

export interface LogStream {
  write: (message: string) => void;
}

// Unified transport configuration - automatically detects environment
const getTransportConfig = () => {
  const config = {
    name: 'hyperpage',
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: 'hyperpage',
    },
  };

  // Development environment - enhanced readability
  if (process.env.NODE_ENV === 'development') {
    return {
      ...config,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'YYYY-MM-DD HH:mm:ss',
          ignore: 'pid,hostname',
        },
      },
    };
  }

  return config;
};

// Create the unified logger - works in both browser and server environments
const pinoInstance = pino(getTransportConfig());

// Helper function to safely merge metadata
const mergeMetadata = (base: Record<string, any>, data?: LoggerMetadata): Record<string, any> => {
  if (!data) return base;
  if (typeof data === 'object' && data !== null) {
    return { ...base, ...data };
  }
  return base;
};

// Rate Limit Logger - maintains existing API for backward compatibility
const rateLimitLogger: RateLimitLogger = {
  hit: (platform: string, data: LoggerMetadata) => {
    pinoInstance.warn(
      mergeMetadata(
        { 
          platform, 
          type: 'rate_limit_hit'
        },
        data
      ),
      'RATE_LIMIT_HIT'
    );
  },

  backoff: (
    platform: string,
    retryAfter: number,
    attemptNumber: number,
    data: LoggerMetadata,
  ) => {
    pinoInstance.warn(
      mergeMetadata(
        {
          platform,
          retryAfter,
          attemptNumber,
          type: 'rate_limit_backoff',
        },
        data
      ),
      'RATE_LIMIT_BACKOFF'
    );
  },

  retry: (platform: string, attemptNumber: number, data: LoggerMetadata) => {
    pinoInstance.info(
      mergeMetadata(
        {
          platform,
          attemptNumber,
          type: 'rate_limit_retry',
        },
        data
      ),
      'RATE_LIMIT_RETRY'
    );
  },

  event: (
    level: 'info' | 'warn' | 'error',
    platform: string,
    message: string,
    metadata?: Record<string, any>,
  ) => {
    pinoInstance[level](
      {
        platform,
        message,
        type: 'rate_limit_event',
        ...metadata,
      },
      'RATE_LIMIT_EVENT'
    );
  },
};

// HTTP Stream - for request logging compatibility
const stream: LogStream = {
  write: (message: string) => {
    pinoInstance.info({ message: message.trim() }, 'HTTP');
  },
};

// Utility function to log API requests with rate limit status
export const logApiRequest = (
  platform: string,
  endpoint: string,
  statusCode: number,
  duration: number,
  rateLimitRemaining?: number,
  rateLimitReset?: number,
) => {
  pinoInstance.info({
    platform,
    endpoint,
    statusCode,
    duration,
    rateLimitRemaining,
    rateLimitReset,
    type: 'api_request',
  }, 'API_REQUEST');
};

// Utility function to log rate limit status changes
export const logRateLimitStatus = (
  platform: string,
  usagePercent: number,
  status: 'normal' | 'warning' | 'critical' | 'unknown',
  metadata?: Record<string, any>,
) => {
  pinoInstance.info({
    platform,
    usagePercent,
    status,
    type: 'rate_limit_status',
    ...metadata,
  }, 'RATE_LIMIT_STATUS');
};

// Unified logger interface that matches existing API
const unifiedLogger: LogLevel = {
  error: (message: string, meta?: LoggerMetadata) => {
    pinoInstance.error(meta || {}, message);
  },
  warn: (message: string, meta?: LoggerMetadata) => {
    pinoInstance.warn(meta || {}, message);
  },
  info: (message: string, meta?: LoggerMetadata) => {
    pinoInstance.info(meta || {}, message);
  },
  debug: (message: string, meta?: LoggerMetadata) => {
    pinoInstance.debug(meta || {}, message);
  },
};

// Export the unified logger - direct API compatibility
export default unifiedLogger;

// Export existing interface objects for backward compatibility
export { rateLimitLogger, stream };

// Export Pino logger instance for advanced usage
export { pinoInstance as pinoLogger };
