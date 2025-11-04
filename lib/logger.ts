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

// Simple transport-free logger configuration
const getTransportConfig = () => {
  const config = {
    name: 'hyperpage',
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: 'hyperpage',
    },
  };

  // Remove all transport configurations to avoid worker thread issues
  return config;
};

// Create the unified logger with comprehensive error handling
let pinoInstance: pino.Logger;

try {
  pinoInstance = pino(getTransportConfig());
} catch (error) {
  // Emergency fallback - create logger with minimal configuration
  console.error('Failed to initialize logger with transport config, using emergency fallback:', error);
  pinoInstance = pino({
    name: 'hyperpage',
    level: process.env.LOG_LEVEL || 'info',
    base: {
      service: 'hyperpage',
    },
  });
}

// Helper function to safely merge metadata
const mergeMetadata = (base: Record<string, any>, data?: LoggerMetadata): Record<string, any> => {
  if (!data) return base;
  if (typeof data === 'object' && data !== null) {
    return { ...base, ...data };
  }
  return base;
};

// Create a safe logging wrapper that catches all errors
const createSafeLogger = (logger: pino.Logger): pino.Logger => {
  const safeLogger = {
    error: (meta: Record<string, any>, msg: string) => {
      try {
        logger.error(meta, msg);
      } catch (error) {
        // Silently handle logger errors to avoid cascading failures
        try {
          console.error(`[HYPERPAGE ERROR] ${msg}`, meta);
        } catch {
          // Final fallback
        }
      }
    },
    warn: (meta: Record<string, any>, msg: string) => {
      try {
        logger.warn(meta, msg);
      } catch (error) {
        try {
          console.warn(`[HYPERPAGE WARN] ${msg}`, meta);
        } catch {
          // Final fallback
        }
      }
    },
    info: (meta: Record<string, any>, msg: string) => {
      try {
        logger.info(meta, msg);
      } catch (error) {
        try {
          console.info(`[HYPERPAGE INFO] ${msg}`, meta);
        } catch {
          // Final fallback
        }
      }
    },
    debug: (meta: Record<string, any>, msg: string) => {
      try {
        logger.debug(meta, msg);
      } catch (error) {
        // Silently ignore debug errors to avoid clutter
      }
    },
    fatal: (meta: Record<string, any>, msg: string) => {
      try {
        logger.fatal(meta, msg);
      } catch (error) {
        try {
          console.error(`[HYPERPAGE FATAL] ${msg}`, meta);
        } catch {
          // Final fallback
        }
      }
    },
    trace: (meta: Record<string, any>, msg: string) => {
      try {
        logger.trace(meta, msg);
      } catch (error) {
        // Silently ignore trace errors
      }
    },
  };

  return safeLogger as unknown as pino.Logger;
};

// Use the safe logger wrapper
const safePinoInstance = createSafeLogger(pinoInstance);

// Rate Limit Logger - maintains existing API for backward compatibility
const rateLimitLogger: RateLimitLogger = {
  hit: (platform: string, data: LoggerMetadata) => {
    safePinoInstance.warn(
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
    safePinoInstance.warn(
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
    safePinoInstance.info(
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
    safePinoInstance[level](
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
    try {
      safePinoInstance.info({ message: message.trim() }, 'HTTP');
    } catch (error) {
      // Fallback to console if logger fails
      try {
        console.log(message.trim());
      } catch {
        // Final fallback - do nothing
      }
    }
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
  try {
    safePinoInstance.info({
      platform,
      endpoint,
      statusCode,
      duration,
      rateLimitRemaining,
      rateLimitReset,
      type: 'api_request',
    }, 'API_REQUEST');
  } catch (error) {
    // Silent fallback
  }
};

// Utility function to log rate limit status changes
export const logRateLimitStatus = (
  platform: string,
  usagePercent: number,
  status: 'normal' | 'warning' | 'critical' | 'unknown',
  metadata?: Record<string, any>,
) => {
  try {
    safePinoInstance.info({
      platform,
      usagePercent,
      status,
      type: 'rate_limit_status',
      ...metadata,
    }, 'RATE_LIMIT_STATUS');
  } catch (error) {
    // Silent fallback
  }
};

// Unified logger interface that matches existing API
const unifiedLogger: LogLevel = {
  error: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.error(meta || {}, message);
    } catch (error) {
      try {
        console.error(message, meta || {});
      } catch {
        // Final fallback - do nothing
      }
    }
  },
  warn: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.warn(meta || {}, message);
    } catch (error) {
      try {
        console.warn(message, meta || {});
      } catch {
        // Final fallback - do nothing
      }
    }
  },
  info: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.info(meta || {}, message);
    } catch (error) {
      try {
        console.info(message, meta || {});
      } catch {
        // Final fallback - do nothing
      }
    }
  },
  debug: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.debug(meta || {}, message);
    } catch (error) {
      // Silent fallback for debug
    }
  },
};

// Export the unified logger - direct API compatibility
export default unifiedLogger;

// Export existing interface objects for backward compatibility
export { rateLimitLogger, stream };

// Export Pino logger instance for advanced usage (wrapped in safe logger)
export { safePinoInstance as pinoLogger };
