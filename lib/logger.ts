/* eslint-disable @typescript-eslint/no-explicit-any */

// Detect if we're in a browser environment at module load time
const isBrowser = typeof window !== "undefined";

let logger: any;
let stream: any;
let rateLimitLogger: any;

// Browser-safe fallback logger for client-side usage
/* eslint-disable @typescript-eslint/no-unused-vars */
class BrowserLogger {
  private level: string = "info"; // Default to info level in browser

  private shouldLog(level: string): boolean {
    const levels = ["error", "warn", "info", "debug"];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const formattedMeta = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedMeta}`;
  }

  error(message: string, meta?: any) {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, meta));
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, meta));
    }
  }

  info(message: string, meta?: any) {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, meta));
    }
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, meta));
    }
  }

  // Winston-compatible methods for compatibility
  addColors(_colors: any) {
    // No-op for browser environment
  }

  createLogger(_config: any) {
    return new BrowserLogger();
  }
  exceptions: any = {
    handle: () => {}
  };

  rejections: {
    handle: () => void;
  } = {
    handle: () => {}
  };

  get transports() {
    return [];
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

if (isBrowser) {
  // Browser environment - use browser-safe logger
  logger = new BrowserLogger();

  stream = {
    write: (message: string) => {
      logger.info("HTTP", { message: message.trim() });
    },
  };

  rateLimitLogger = {
    hit: (platform: string, data: any) => {
      logger.warn("RATE_LIMIT_HIT", {
        platform,
        type: "rate_limit_hit",
        data,
      });
    },

    backoff: (
      platform: string,
      retryAfter: number,
      attemptNumber: number,
      data: any,
    ) => {
      logger.warn("RATE_LIMIT_BACKOFF", {
        platform,
        retryAfter,
        attemptNumber,
        type: "rate_limit_backoff",
        data,
      });
    },

    retry: (platform: string, attemptNumber: number, data: any) => {
      logger.info("RATE_LIMIT_RETRY", {
        platform,
        attemptNumber,
        type: "rate_limit_retry",
        data,
      });
    },

    event: (
      level: "info" | "warn" | "error",
      platform: string,
      message: string,
      metadata?: Record<string, any>,
    ) => {
      logger[level]("RATE_LIMIT_EVENT", {
        platform,
        message,
        type: "rate_limit_event",
        ...metadata,
      });
    },
  };
} else {
  // Server environment - safe to import winston
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const winston = require("winston");

  // Define log levels
  const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  // Define colors for different levels
  const logColors = {
    error: "red",
    warn: "yellow",
    info: "green",
    debug: "blue",
  };

  winston.addColors(logColors);

  // Create logger instance with structured JSON output for production
  logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
      // Add timestamp and level
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      // Use JSON format for easy parsing by log aggregation tools
      winston.format.json(),
      // Colorize for console output in development
      winston.format.colorize({ all: true }),
    ),
    defaultMeta: {
      service: "hyperpage",
    },
    transports: [
      // Write to console with colorized output
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
          winston.format.colorize({ all: true }),
        ),
      }),

      // Also write errors to a separate error log file
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),

      // Write all logs to a combined log file
      new winston.transports.File({
        filename: "logs/combined.log",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    ],
  });

  // Handle uncaught exceptions and unhandled rejections
  logger.exceptions.handle(
    new winston.transports.File({
      filename: "logs/exceptions.log",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }),
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: "logs/rejections.log",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }),
  );

  stream = {
    write: (message: string) => {
      logger.info("HTTP", { message: message.trim() });
    },
  };

  rateLimitLogger = {
    hit: (platform: string, data: any) => {
      logger.warn("RATE_LIMIT_HIT", {
        platform,
        type: "rate_limit_hit",
        data,
      });
    },

    backoff: (
      platform: string,
      retryAfter: number,
      attemptNumber: number,
      data: any,
    ) => {
      logger.warn("RATE_LIMIT_BACKOFF", {
        platform,
        retryAfter,
        attemptNumber,
        type: "rate_limit_backoff",
        data,
      });
    },

    retry: (platform: string, attemptNumber: number, data: any) => {
      logger.info("RATE_LIMIT_RETRY", {
        platform,
        attemptNumber,
        type: "rate_limit_retry",
        data,
      });
    },

    event: (
      level: "info" | "warn" | "error",
      platform: string,
      message: string,
      metadata?: Record<string, any>,
    ) => {
      logger[level]("RATE_LIMIT_EVENT", {
        platform,
        message,
        type: "rate_limit_event",
        ...metadata,
      });
    },
  };
}

// Export everything at the top level
export default logger;
export { stream };
export { rateLimitLogger };

// Utility function to log API requests with rate limit status
export const logApiRequest = (
  platform: string,
  endpoint: string,
  statusCode: number,
  duration: number,
  rateLimitRemaining?: number,
  rateLimitReset?: number,
) => {
  logger.info("API_REQUEST", {
    platform,
    endpoint,
    statusCode,
    duration,
    rateLimitRemaining,
    rateLimitReset,
    type: "api_request",
  });
};

// Utility function to log rate limit status changes
export const logRateLimitStatus = (
  platform: string,
  usagePercent: number,
  status: "normal" | "warning" | "critical" | "unknown",
  metadata?: Record<string, any>,
) => {
  logger.info("RATE_LIMIT_STATUS", {
    platform,
    usagePercent,
    status,
    type: "rate_limit_status",
    ...metadata,
  });
};
