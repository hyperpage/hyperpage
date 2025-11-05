import pino from 'pino';

// State-of-the-art TypeScript interfaces for unified logging
// Extend LoggerMetadata to handle unknown types (common for error objects)
export type LoggerMetadata = Record<string, unknown> | unknown;
export type LogMetadata = Record<string, unknown>;
export type SafeMetadata = Record<string, unknown>;

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
    metadata?: LogMetadata,
  ) => void;
}

export interface LogStream {
  write: (message: string) => void;
}

export interface SafeLoggerMethods {
  error: (meta: SafeMetadata, msg: string) => void;
  warn: (meta: SafeMetadata, msg: string) => void;
  info: (meta: SafeMetadata, msg: string) => void;
  debug: (meta: SafeMetadata, msg: string) => void;
  fatal: (meta: SafeMetadata, msg: string) => void;
  trace: (meta: SafeMetadata, msg: string) => void;
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
const mergeMetadata = (base: LogMetadata, data?: LoggerMetadata): LogMetadata => {
  if (!data) return base;
  if (typeof data === 'object' && data !== null) {
    return { ...base, ...data as LogMetadata };
  }
  return base;
};

// Create a safe logging wrapper that catches all errors
const createSafeLogger = (logger: pino.Logger): SafeLoggerMethods => {
  const safeLogger: SafeLoggerMethods = {
    error: (meta: SafeMetadata, msg: string) => {
      try {
        logger.error(meta, msg);
      } catch (error) {
        // Log internal logger errors to help with debugging
        try {
          console.error(`[HYPERPAGE ERROR] ${msg}`, meta, 'Internal error:', error);
        } catch {
          // Final fallback if even console logging fails
          console.log(`[CRITICAL] Failed to log error: ${error}`);
        }
      }
    },
    warn: (meta: SafeMetadata, msg: string) => {
      try {
        logger.warn(meta, msg);
      } catch (error) {
        try {
          console.warn(`[HYPERPAGE WARN] ${msg}`, meta, 'Internal error:', error);
        } catch {
          console.log(`[WARNING] Failed to log warning: ${error}`);
        }
      }
    },
    info: (meta: SafeMetadata, msg: string) => {
      try {
        logger.info(meta, msg);
      } catch (error) {
        try {
          console.info(`[HYPERPAGE INFO] ${msg}`, meta, 'Internal error:', error);
        } catch {
          console.log(`[INFO] Failed to log info: ${error}`);
        }
      }
    },
    debug: (meta: SafeMetadata, msg: string) => {
      try {
        logger.debug(meta, msg);
      } catch (error) {
        // Log debug errors but keep them minimal
        console.debug(`[DEBUG] Logger error for "${msg}":`, error);
      }
    },
    fatal: (meta: SafeMetadata, msg: string) => {
      try {
        logger.fatal(meta, msg);
      } catch (error) {
        try {
          console.error(`[HYPERPAGE FATAL] ${msg}`, meta, 'Fatal internal error:', error);
        } catch {
          console.log(`[FATAL] Failed to log fatal error: ${error}`);
        }
      }
    },
    trace: (meta: SafeMetadata, msg: string) => {
      try {
        logger.trace(meta, msg);
      } catch (error) {
        // Log trace errors minimally
        console.debug(`[TRACE] Logger error for "${msg}":`, error);
      }
    },
  };

  return safeLogger;
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
        } as LogMetadata,
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
        } as LogMetadata,
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
        } as LogMetadata,
        data
      ),
      'RATE_LIMIT_RETRY'
    );
  },

  event: (
    level: 'info' | 'warn' | 'error',
    platform: string,
    message: string,
    metadata?: LogMetadata,
  ) => {
    const eventMetadata: LogMetadata = {
      platform,
      message,
      type: 'rate_limit_event',
      ...metadata,
    };
    safePinoInstance[level](eventMetadata, 'RATE_LIMIT_EVENT');
  },
};

// HTTP Stream - for request logging compatibility
const stream: LogStream = {
  write: (message: string) => {
    try {
      safePinoInstance.info({ message: message.trim() } as LogMetadata, 'HTTP');
    } catch (error) {
      // Log the error but still try to write to console as fallback
      console.warn(`[HTTP_STREAM] Failed to log via pino, writing directly:`, error);
      try {
        console.log(message.trim());
      } catch {
        console.log(`[CRITICAL] HTTP stream completely failed: ${error}`);
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
    const requestMetadata: LogMetadata = {
      platform,
      endpoint,
      statusCode,
      duration,
      rateLimitRemaining,
      rateLimitReset,
      type: 'api_request',
    };
    safePinoInstance.info(requestMetadata, 'API_REQUEST');
  } catch (error) {
    // Log the failure but don't throw - this is a utility function
    console.debug(`[LOG_API_REQUEST] Failed to log request for ${platform}:${endpoint}:`, error);
  }
};

// Utility function to log rate limit status changes
export const logRateLimitStatus = (
  platform: string,
  usagePercent: number,
  status: 'normal' | 'warning' | 'critical' | 'unknown',
  metadata?: LogMetadata,
) => {
  try {
    const statusMetadata: LogMetadata = {
      platform,
      usagePercent,
      status,
      type: 'rate_limit_status',
      ...metadata,
    };
    safePinoInstance.info(statusMetadata, 'RATE_LIMIT_STATUS');
  } catch (error) {
    // Log the failure but don't throw - this is a utility function
    console.debug(`[LOG_RATE_LIMIT_STATUS] Failed to log status for ${platform}:`, error);
  }
};

// Unified logger interface that matches existing API
const unifiedLogger: LogLevel = {
  error: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.error((meta as LogMetadata) || {}, message);
    } catch (error) {
      try {
        console.error(message, meta || {}, 'Logger error:', error);
      } catch {
        console.log(`[CRITICAL] Unified logger error handling failed: ${error}`);
      }
    }
  },
  warn: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.warn((meta as LogMetadata) || {}, message);
    } catch (error) {
      try {
        console.warn(message, meta || {}, 'Logger error:', error);
      } catch {
        console.log(`[WARNING] Unified logger warn handling failed: ${error}`);
      }
    }
  },
  info: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.info((meta as LogMetadata) || {}, message);
    } catch (error) {
      try {
        console.info(message, meta || {}, 'Logger error:', error);
      } catch {
        console.log(`[INFO] Unified logger info handling failed: ${error}`);
      }
    }
  },
  debug: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.debug((meta as LogMetadata) || {}, message);
    } catch (error) {
      // Log debug errors but keep them minimal
      console.debug(`[DEBUG] Unified logger debug error for "${message}":`, error);
    }
  },
};

// Export the unified logger - direct API compatibility
export default unifiedLogger;

// Export existing interface objects for backward compatibility
export { rateLimitLogger, stream, safePinoInstance as pinoLogger };
