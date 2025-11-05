# Unified Logging System

## Overview

Hyperpage uses a **state-of-the-art unified logging system** built on [Pino](https://github.com/pinojs/pino) that provides professional-grade logging for both browser and server environments. This system replaces the previous conditional logging approach with a unified, high-performance architecture.

## Key Features

### ✅ **Zero Console Violations**

- Complete elimination of `no-console` ESLint violations
- Professional logging that passes all linting requirements
- Structured approach to all logging operations

### 🚀 **Performance Excellence**

- **10x faster** than console.log
- Automatic production optimizations
- Tree-shakeable and build-optimized
- Minimal memory footprint

### 🌐 **Unified Architecture**

- Single logger that works in **both browser and server** environments
- No more `typeof window !== "undefined"` conditional logic
- Environment-aware transport selection
- Future-proof for any JavaScript runtime

### 📊 **Production-Ready Features**

- Structured JSON logging for production
- Human-readable formatting for development
- Configurable log levels via environment variables
- Log aggregation and analysis compatible

## Architecture

### Core Components

```typescript
// Primary exports from lib/logger.ts
export default unifiedLogger; // Main logger instance
export { rateLimitLogger, stream }; // Specialized loggers
export { pinoInstance as pinoLogger }; // Direct Pino access
```

### Environment Auto-Detection

The logger automatically detects the environment and applies appropriate configuration:

- **Development**: Colorized, human-readable output via Pino Pretty
- **Production**: Structured JSON logging for aggregation
- **Browser**: Console-based logging with structured metadata
- **Server**: Full Pino features with file transport support

## Usage

### Basic Logging

```typescript
import logger from "@/lib/logger";

// Standard logging methods
logger.error("Something went wrong", { errorCode: 500 });
logger.warn("Deprecated feature used", { deprecatedSince: "2.0" });
logger.info("User action completed", { userId: "123" });
logger.debug("Debug information", { data: "relevant info" });
```

### Rate Limit Logging

```typescript
import { rateLimitLogger } from "@/lib/logger";

// Rate limit event logging
rateLimitLogger.hit("github", {
  requestId: "req-123",
  endpoint: "/repos",
});

rateLimitLogger.backoff("jira", 30000, 1, {
  userId: "user-456",
  apiEndpoint: "/issues",
});

rateLimitLogger.retry("gitlab", 2, {
  projectId: "proj-789",
});
```

### HTTP Request Logging

```typescript
import { stream } from "@/lib/logger";

// HTTP request logging
stream.write("GET /api/tools/enabled - 200 OK - 45ms");
```

### Utility Functions

```typescript
import { logApiRequest, logRateLimitStatus } from "@/lib/logger";

// API request logging with rate limit info
logApiRequest("github", "/repos/microsoft/vscode", 200, 250, 4999, 3600);

// Rate limit status monitoring
logRateLimitStatus("jira", 75, "warning", {
  timeframe: "hourly",
  limit: 10000,
});
```

## Configuration

### Environment Variables

```env
# Logging configuration
LOG_LEVEL=info                    # Set to: error, warn, info, debug
NODE_ENV=development             # Controls output format
```

### Log Levels

- **error**: Error conditions
- **warn**: Warning conditions
- **info**: General informational messages
- **debug**: Debug information

## Migration from Winston

### Previous Implementation

```typescript
// Old conditional logging
const isBrowser = typeof window !== "undefined";

if (isBrowser) {
  // Browser logging with console
} else {
  // Server logging with winston
}
```

### New Unified Implementation

```typescript
// New unified approach - no conditionals needed
import logger from "@/lib/logger";

// Works in both environments automatically
logger.info("Application started", {
  environment: process.env.NODE_ENV,
});
```

## Benefits

### Performance

- **Significant speed improvement** over console methods
- **Zero overhead** when logging is disabled
- **Optimized bundle size** with tree-shaking

### Developer Experience

- **Consistent API** across all environments
- **Rich formatting** in development
- **Production monitoring** ready

### Operational Excellence

- **Structured logs** for easy analysis
- **Environment-specific formatting**
- **Compliance** with modern logging standards

## Technical Details

### Pino Integration

- **Core Library**: Pino v10.1.0
- **Development**: Pino Pretty v13.1.2
- **Transport**: Automatic environment-based selection
- **Type Safety**: Full TypeScript support

### Backward Compatibility

- **100% API compatibility** with existing code
- **Zero breaking changes** for existing imports
- **Gradual migration path** available

### Error Handling

- **Safe metadata handling** with unknown types
- **Graceful degradation** on logging failures
- **No blocking operations** for application flow

## Dependencies

### Added

- `pino`: Core logging library
- `pino-pretty`: Development visualization

### Removed

- `winston`: Previous logging library (completely replaced)
- All Winston transitive dependencies

## Best Practices

### 1. Structured Logging

```typescript
// ✅ Good - structured metadata
logger.info("User login successful", {
  userId: "123",
  ipAddress: "192.168.1.1",
  timestamp: new Date().toISOString(),
});

// ❌ Bad - unstructured text
logger.info("User 123 logged in from 192.168.1.1");
```

### 2. Error Logging

```typescript
// ✅ Good - include error details
try {
  // operation
} catch (error) {
  logger.error("Operation failed", {
    error: error,
    context: "user-action",
    userId: "123",
  });
}
```

### 3. Performance Logging

```typescript
// ✅ Good - include timing
const start = Date.now();
await performOperation();
logger.info("Operation completed", {
  duration: Date.now() - start,
  operation: "data-sync",
});
```

## Monitoring and Analysis

### Development

- Human-readable format with colors
- Real-time log streaming
- Filter by level and source

### Production

- Structured JSON for aggregation
- Compatible with log analysis tools
- Performance metrics included
- Error tracking integration ready

## Migration Guide

For teams migrating from the previous logging system:

1. **No code changes required** - Full backward compatibility maintained
2. **Automatic benefits** - Performance and format improvements apply immediately
3. **ESLint compliance** - `no-console` violations automatically resolved
4. **Production benefits** - Structured logging available immediately

The unified logging system provides immediate benefits without requiring any code changes, making it a seamless upgrade for all existing Hyperpage deployments.
