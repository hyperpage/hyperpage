/* eslint-disable @typescript-eslint/no-explicit-any */
import winston from "winston";

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
const logger = winston.createLogger({
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

// Add stream interface for morgan HTTP request logging (if needed later)
const stream = {
  write: (message: string) => {
    logger.info("HTTP", { message: message.trim() });
  },
};

// Special loggers for specific domains
export const rateLimitLogger = {
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

  // Generic rate limiting event
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

export default logger;
export { stream };

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
