# Monitoring and Observability

This document covers the comprehensive monitoring solution for the Hyperpage application, including metrics collection, structured logging, and observability dashboards.

## Overview

Hyperpage implements a production-ready monitoring stack that provides real-time visibility into application performance, rate limiting, API usage, and system health. The monitoring infrastructure includes:

- **Metrics Collection**: Prometheus-based metrics with real-time collection
- **Structured Logging**: JSON-formatted logs with Winston for complete traceability
- **Grafana Dashboards**: Visual monitoring interface with automated alerting
- **Rate Limiting Monitor**: Platform-specific API quota tracking
- **Cache Performance**: Memory cache hit/miss ratio analysis

## Metrics System

### Prometheus Integration

Hyperpage uses `prom-client` to expose comprehensive metrics via a dedicated `/api/metrics` endpoint. The system automatically collects metrics from enabled tools and provides real-time monitoring data.

#### Sample Metrics Output

```prometheus
# HELP rate_limit_usage_percent Current rate limit usage percentage per platform (0-100)
# TYPE rate_limit_usage_percent gauge
rate_limit_usage_percent{platform="github"} 15.5

# HELP rate_limit_status Current rate limit status per platform (0=normal, 1=warning, 2=critical, 3=unknown)
# TYPE rate_limit_status gauge
rate_limit_status{platform="github"} 0

# HELP rate_limit_remaining Remaining API calls for rate limits
# TYPE rate_limit_remaining gauge
rate_limit_remaining{platform="github",endpoint="core"} 4848
rate_limit_remaining{platform="github",endpoint="search"} 28

# HELP api_request_duration_seconds Duration of API requests to external platforms
# TYPE api_request_duration_seconds histogram
api_request_duration_seconds_sum{platform="github",endpoint="/repos/hyperpage/issues",status="200"} 1.25
api_request_duration_seconds_count{platform="github",endpoint="/repos/hyperpage/issues",status="200"} 1

# HELP rate_limit_hits_total Total number of rate limit hits encountered
# TYPE rate_limit_hits_total counter
rate_limit_hits_total{platform="github"} 5

# HELP cache_hits_total Total number of cache hits
# TYPE cache_hits_total counter
cache_hits_total 1250

# HELP cache_hit_ratio_percent Cache performance as percentage
# TYPE cache_hit_ratio_percent gauge
cache_hit_ratio_percent 87.3
```

### Available Metrics

#### Rate Limiting Metrics
- `rate_limit_usage_percent`: Current usage percentage per platform
- `rate_limit_status`: Status enum (normal=0, warning=1, critical=2, unknown=3)
- `rate_limit_remaining`: Remaining API calls per endpoint
- `rate_limit_max`: Maximum allowed calls per endpoint
- `rate_limit_hits_total`: Cumulative rate limit violations
- `rate_limit_retries_total`: Total retry attempts per platform

#### API Performance Metrics
- `api_request_duration_seconds`: Request latency histograms
- `api_requests_total`: Total requests by platform, endpoint, and status
- `process_resident_memory_bytes`: Node.js memory usage (default)
- `process_cpu_user_seconds_total`: CPU usage (default)

#### Cache Performance Metrics
- `cache_entries_total`: Current cache size
- `cache_hits_total`: Total cache hits
- `cache_misses_total`: Total cache misses
- `cache_expiries_total`: Expired entries count
- `cache_evictions_total`: Evicted entries count

### Metrics Collection Flow

1. **Automatic Updates**: Metrics update before each `/api/metrics` request
2. **Platform Discovery**: Dynamically discovers enabled tools and their platforms
3. **Error Handling**: Gracefully handles platform failures without breaking metrics
4. **Real-time Data**: Pulls current state from rate limit monitors and cache

## Structured Logging System

### Winston Configuration

Hyperpage uses Winston with JSON structured logging designed for log aggregation systems like ELK stack, Loki, or CloudWatch logs.

#### Logger Configuration
```javascript
const logger = winston.createLogger({
  levels: { error: 0, warn: 1, info: 2, debug: 3 },
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.colorize({ all: true }) // For console development
  ),
  defaultMeta: { service: 'hyperpage' },
  transports: [
    new winston.transports.Console({ /* colored output */ }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.File({ filename: 'logs/exceptions.log' }), // Uncaught exceptions
    new winston.transports.File({ filename: 'logs/rejections.log' }), // Unhandled rejections
  ],
});
```

### Log Output Examples

#### Verified Log Output (Actual Format)

**Console Output** (with ANSI color codes):
```
{"level":"[32minfo[39m","message":"[32mAPI_REQUEST[39m","service":"hyperpage","timestamp":"2025-10-28 16:30:20","platform":"github","endpoint":"/repos/hyperpage/issues","statusCode":200,"duration":850,"rateLimitRemaining":4850,"rateLimitReset":1730132400,"type":"api_request"}
```

**File Output** (same format with ANSI codes):
```json
{"level":"[33mwarn[39m","message":"[33mRATE_LIMIT_HIT[39m","platform":"github","service":"hyperpage","timestamp":"2025-10-28 16:31:05","type":"rate_limit_hit","data":{"resource":"search","reset":1730132400}}
```

#### Structured Log Features
- **JSON Format**: Every log entry is valid parsable JSON
- **ANSI Colors**: Console output includes color codes, files preserve the same format
- **Service Metadata**: Always includes `"service": "hyperpage"`
- **Timestamp Format**: `YYYY-MM-DD HH:mm:ss` with second precision
- **Event Categorization**: `"type"` field for log aggregation (e.g., `"api_request"`, `"rate_limit_hit"`)
- **Platform Context**: Tool-specific logs include `"platform"` identifier
- **Structured Data**: Event-specific metadata in typed fields

#### Rate Limit Logger Events

**Rate Limit Hit:**
```json
{"data":{"reset":1761669945009,"resource":"search"},"level":"[33mwarn[39m","message":"[33mRATE_LIMIT_HIT[39m","platform":"github","service":"hyperpage","timestamp":"2025-10-28 16:45:45","type":"rate_limit_hit"}
```

**Rate Limit Backoff:**
```json
{"attemptNumber":1,"data":{"limit":30,"remaining":0},"level":"[33mwarn[39m","message":"[33mRATE_LIMIT_BACKOFF[39m","platform":"github","retryAfter":60,"service":"hyperpage","timestamp":"2025-10-28 16:45:45","type":"rate_limit_backoff"}
```

**API Request Tracking:**
```json
{"duration":850,"endpoint":"/repos/hyperpage/issues","level":"[32minfo[39m","message":"[32mAPI_REQUEST[39m","platform":"github","rateLimitRemaining":4850,"rateLimitReset":1761669945011,"service":"hyperpage","statusCode":200,"timestamp":"2025-10-28 16:45:45","type":"api_request"}
```

**Rate Limit Status Monitoring:**
```json
{"endpoint":"search","level":"[32minfo[39m","message":"[32mRATE_LIMIT_STATUS[39m","platform":"github","service":"hyperpage","status":"warning","timestamp":"2025-10-28 16:45:45","type":"rate_limit_status","usagePercent":15.5}
```

### Logger Testing Status

The logger implementation is fully functional and produces well-formatted structured logs as demonstrated by integration testing. However, unit tests have complex mocking requirements due to Winston's module initialization patterns.

#### Testing Approach
- **Integration Tests**: ✅ **PASSES** - Logger successfully imports and generates proper JSON logs
- **Functional Tests**: ✅ **PASSES** - All exported utilities work correctly
- **File Output**: ✅ **VERIFIED** - Logs written to `logs/combined.log` with correct structure
- **Unit Tests**: ⚠️ **COMPLEX MOCKING** - Winston mock timing conflicts cause some test failures

#### Verified Logger Behavior
- Module imports without errors
- All utility functions export correctly (`rateLimitLogger`, `logApiRequest`, `logRateLimitStatus`)
- Produces valid JSON logs with ANSI color codes
- Writes properly formatted logs to files
- Handles multiple log types (rate limiting, API requests, status updates)
- Structured with service metadata, timestamps, and event categorization

### Specialized Loggers

#### RateLimitLogger API

```typescript
// Specialized logging for rate limiting events
rateLimitLogger.hit(platform, rateLimitData);
rateLimitLogger.backoff(platform, retryAfter, attemptNumber, data);
rateLimitLogger.retry(platform, attemptNumber, data);
rateLimitLogger.event(level, platform, message, metadata);
```

#### API Request Logging

```typescript
// Comprehensive API call tracking
logApiRequest(platform, endpoint, statusCode, duration, remaining?, reset?);
```

#### Rate Limit Status Logging

```typescript
// Monitor rate limit threshold changes
logRateLimitStatus(platform, usagePercent, status, metadata?);
```

## Grafana Dashboard

### Dashboard Configuration

Hyperpage provides a comprehensive Grafana dashboard (`grafana/hyperpage-rate-limiting-dashboard.json`) that visualizes all key metrics with:

- **6 Panels**: Rate limiting, API performance, cache metrics, and alerts
- **Platform Filtering**: Dynamic platform selection via query variables
- **Threshold Alerts**: Visual status indicators for critical conditions
- **Time-based Analysis**: Historical trends and rate calculations

### Panel Details

#### 1. Rate Limit Usage by Platform
- **Type**: Gauge panel
- **Metric**: `rate_limit_usage_percent`
- **Thresholds**: Green (≤75%), Yellow (75-85%), Red (≥85%)

#### 2. Rate Limit Usage Trends
- **Type**: Time series
- **Metrics**: Platform-specific usage percentages over time
- **Query**: `rate_limit_usage_percent{platform="$platform"}`

#### 3. Rate Limiting Events
- **Type**: Bar chart
- **Metrics**: Rate limit hits and retry attempts per platform
- **Queries**:
  ```promql
  increase(rate_limit_hits_total{platform="$platform"}[5m])
  increase(rate_limit_retries_total{platform="$platform"}[5m])
  ```

#### 4. API Request Rates
- **Type**: Time series (stacked)
- **Metrics**: Request rates by success/error status
- **Queries**:
  ```promql
  rate(api_requests_total{status!~"5.."}[5m])
  rate(api_requests_total{status=~"5.."}[5m])
  ```

#### 5. Cache Performance
- **Type**: Time series
- **Metric**: Calculated hit ratio percentage
- **Query**: `(cache_hits_total / (cache_hits_total + cache_misses_total)) * 100`

#### 6. Platform Status
- **Type**: Gauge panel
- **Metric**: `rate_limit_status` with value mappings
- **Mapping**: 0=Normal, 1=Warning, 2=Critical, 3=Unknown

### Setup Instructions

1. **Import Dashboard**: Use `grafana/hyperpage-rate-limiting-dashboard.json`
2. **Configure Prometheus**: Set data source to your Prometheus instance
3. **Scraping**: Ensure Prometheus scrapes `/api/metrics` endpoint
4. **Variables**: Configure `prometheus` and `platform` dashboard variables

## Monitoring Best Practices

### Alerting Configuration

#### Critical Alerts
```prometheus
# Rate limit critical (90%+ usage)
ALERT RateLimitCritical
  IF rate_limit_usage_percent{platform=~".+"} >= 90
  FOR 5m
  LABELS { severity = "critical" }
  ANNOTATIONS { summary = "{{$labels.platform}} rate limit critical" }

# API errors spiking
ALERT HighErrorRate
  IF rate(api_requests_total{status=~"5.."}[5m]) / rate(api_requests_total[5m]) > 0.05
  FOR 2m
  LABELS { severity = "warning" }
```

#### Warning Alerts
```prometheus
# Rate limit approaching limits
ALERT RateLimitWarning
  IF rate_limit_usage_percent >= 75
  FOR 10m
  LABELS { severity = "warning" }

# Cache performance degradation
ALERT CacheEfficiencyLow
  IF (cache_hits_total / (cache_hits_total + cache_misses_total)) < 0.3
  FOR 15m
  LABELS { severity = "warning" }
```

### Log Aggregation Setup

#### ELK Stack Configuration
1. **Filebeat**: Configure to read from `logs/combined.log`
2. **Logstash Pipeline**: Parse JSON with `@timestamp` handling
3. **Elasticsearch Index**: Daily indices with mapping for structured fields
4. **Kibana**: Create dashboards using `platform`, `level`, and `type` fields

#### Loki Configuration
```yaml
scrape_configs:
  - job_name: hyperpage-logs
    static_configs:
      - targets: [localhost]
        labels:
          job: hyperpage
    pipeline_stages:
      - json:
          expressions:
            level: level
            message: message
            platform: platform
```

### Performance Optimization

#### Logging Best Practices
- **Structured First**: Use structured fields instead of string concatenation
- **Log Levels**: Set appropriate levels to control verbosity
- **Performance**: Avoid expensive operations in log statements
- **Rate Limiting**: Use `rateLimitLogger` for high-frequency logging

#### Metrics Best Practices
- **Cost Awareness**: Consider metrics cardinality and retention
- **Efficient Queries**: Use appropriate PromQL selectors and ranges
- **Alert Fatigue**: Configure meaningful thresholds to avoid false positives

## Troubleshooting

### Common Issues

#### No Metrics Visible
- Check `/api/metrics` endpoint is accessible
- Verify Prometheus can scrape the target
- Ensure tool environment variables are set correctly

#### Logs Not Rotating
- Check file permissions on `logs/` directory
- Verify disk space availability
- Consider using logrotate for production deployments

#### High Memory Usage
- Monitor `process_resident_memory_bytes` metric
- Check cache size vs. performance tradeoffs
- Review metrics registry size for excessive cardinality

### Debug Steps

1. **Test Logging**: Add temporary debug logs to verify Winston configuration
2. **Verify Metrics**: Use `curl /api/metrics | grep -c "^#"` to confirm Prometheus format
3. **Check Platform Status**: API endpoints should return tool-specific metrics
4. **Grafana Queries**: Test PromQL queries directly in Grafana Explore
