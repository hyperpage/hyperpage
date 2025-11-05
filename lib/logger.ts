import pino from "pino";

// State-of-the-art TypeScript interfaces for unified logging
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
  retry: (
    platform: string,
    attemptNumber: number,
    data: LoggerMetadata,
  ) => void;
  event: (
    level: "info" | "warn" | "error",
    platform: string,
    message: string,
    metadata?: LogMetadata,
  ) => void;
}

export interface LogStream {
  write: (message: string) => void;
}

// Simple transport-free logger configuration
const getTransportConfig = () => {
  const config = {
    name: "hyperpage",
    level: process.env.LOG_LEVEL || "info",
    base: {
      service: "hyperpage",
    },
  };

  return config;
};

// Create the unified logger
let pinoInstance: pino.Logger;

try {
  pinoInstance = pino(getTransportConfig());
} catch (error) {
  // Emergency fallback - create logger with minimal configuration
  pinoInstance = pino({
    name: "hyperpage",
    level: process.env.LOG_LEVEL || "info",
    base: {
      service: "hyperpage",
    },
  });
  // Log the error using the fallback logger since we can't use the original logger
  pinoInstance.error({ message: "Failed to initialize logger with transport config, using emergency fallback", error });
}

// Helper function to safely merge metadata
const mergeMetadata = (
  base: LogMetadata,
  data?: LoggerMetadata,
): LogMetadata => {
  if (!data) return base;
  if (typeof data === "object" && data !== null) {
    return { ...base, ...(data as LogMetadata) };
  }
  return base;
};

// Create a safe logging wrapper that catches all errors
const createSafeLogger = (logger: pino.Logger) => {
  return {
    error: (msg: string, meta?: SafeMetadata) => {
      try {
        logger.error({ msg, ...meta });
      } catch (err) {
        // Last resort fallback
        pinoInstance.error({ message: `[CRITICAL] Logger error: ${msg}`, meta, error: err });
      }
    },
    warn: (msg: string, meta?: SafeMetadata) => {
      try {
        logger.warn({ msg, ...meta });
      } catch (err) {
        pinoInstance.warn({ message: `[WARNING] Logger error: ${msg}`, meta, error: err });
      }
    },
    info: (msg: string, meta?: SafeMetadata) => {
      try {
        logger.info({ msg, ...meta });
      } catch (err) {
        pinoInstance.info({ message: `[INFO] Logger error: ${msg}`, meta, error: err });
      }
    },
    debug: (msg: string, meta?: SafeMetadata) => {
      try {
        logger.debug({ msg, ...meta });
      } catch (err) {
        // Log debug errors but keep them minimal
        pinoInstance.debug({ message: `[DEBUG] Logger error for "${msg}":`, error: err });
      }
    },
    fatal: (msg: string, meta?: SafeMetadata) => {
      try {
        logger.fatal({ msg, ...meta });
      } catch (err) {
        pinoInstance.error({ message: `[FATAL] Logger error: ${msg}`, meta, error: err });
      }
    },
    trace: (msg: string, meta?: SafeMetadata) => {
      try {
        logger.trace({ msg, ...meta });
      } catch (err) {
        pinoInstance.debug({ message: `[TRACE] Logger error for "${msg}":`, error: err });
      }
    },
  };
};

// Use the safe logger wrapper
const safePinoInstance = createSafeLogger(pinoInstance);

// Rate Limit Logger - maintains existing API for backward compatibility
const rateLimitLogger: RateLimitLogger = {
  hit: (platform: string, data: LoggerMetadata) => {
    safePinoInstance.warn("RATE_LIMIT_HIT", mergeMetadata(
      {
        platform,
        type: "rate_limit_hit",
      } as LogMetadata,
      data,
    ));
  },

  backoff: (
    platform: string,
    retryAfter: number,
    attemptNumber: number,
    data: LoggerMetadata,
  ) => {
    safePinoInstance.warn("RATE_LIMIT_BACKOFF", mergeMetadata(
      {
        platform,
        retryAfter,
        attemptNumber,
        type: "rate_limit_backoff",
      } as LogMetadata,
      data,
    ));
  },

  retry: (platform: string, attemptNumber: number, data: LoggerMetadata) => {
    safePinoInstance.info("RATE_LIMIT_RETRY", mergeMetadata(
      {
        platform,
        attemptNumber,
        type: "rate_limit_retry",
      } as LogMetadata,
      data,
    ));
  },

  event: (
    level: "info" | "warn" | "error",
    platform: string,
    message: string,
    metadata?: LogMetadata,
  ) => {
    const eventMetadata: LogMetadata = {
      platform,
      message,
      type: "rate_limit_event",
      ...metadata,
    };
    safePinoInstance[level]("RATE_LIMIT_EVENT", eventMetadata);
  },
};

// HTTP Stream - for request logging compatibility
const stream: LogStream = {
  write: (message: string) => {
    try {
      safePinoInstance.info("HTTP", { message: message.trim() } as LogMetadata);
    } catch (err) {
      // Fallback to pino logger with error details
      pinoInstance.error({ message: "Stream write error for message: " + message.trim(), error: err });
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
      type: "api_request",
    };
    safePinoInstance.info("API_REQUEST", requestMetadata);
  } catch (error) {
    // Log the failure but don't throw - this is a utility function
    safePinoInstance.debug(
      `[LOG_API_REQUEST] Failed to log request for ${platform}:${endpoint}:`,
      { error },
    );
  }
};

// Utility function to log rate limit status changes
export const logRateLimitStatus = (
  platform: string,
  usagePercent: number,
  status: "normal" | "warning" | "critical" | "unknown",
  metadata?: LogMetadata,
) => {
  try {
    const statusMetadata: LogMetadata = {
      platform,
      usagePercent,
      status,
      type: "rate_limit_status",
      ...metadata,
    };
    safePinoInstance.info("RATE_LIMIT_STATUS", statusMetadata);
  } catch (error) {
    // Log the failure but don't throw - this is a utility function
    safePinoInstance.debug(
      `[LOG_RATE_LIMIT_STATUS] Failed to log status for ${platform}:`,
      { error },
    );
  }
};

// Unified logger interface that matches existing API
const unifiedLogger: LogLevel = {
  error: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.error(message, (meta as LogMetadata) || {});
    } catch (err) {
      // Last resort fallback
      pinoInstance.error({ message: `Unified logger error: ${message}`, meta, error: err });
    }
  },
  warn: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.warn(message, (meta as LogMetadata) || {});
    } catch (err) {
      pinoInstance.warn({ message: `Unified logger warn: ${message}`, meta, error: err });
    }
  },
  info: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.info(message, (meta as LogMetadata) || {});
    } catch (err) {
      pinoInstance.info({ message: `Unified logger info: ${message}`, meta, error: err });
    }
  },
  debug: (message: string, meta?: LoggerMetadata) => {
    try {
      safePinoInstance.debug(message, (meta as LogMetadata) || {});
    } catch (err) {
      pinoInstance.debug({ message: `Unified logger debug: ${message}`, meta, error: err });
    }
  },
};

// Export the unified logger - direct API compatibility
export default unifiedLogger;

// Export existing interface objects for backward compatibility
export { rateLimitLogger, stream, safePinoInstance as pinoLogger };
