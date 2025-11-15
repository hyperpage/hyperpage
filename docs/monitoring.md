# Monitoring and Performance System

This document describes the monitoring system for tracking performance and system health.

## Overview

The monitoring system provides performance tracking, bottleneck detection, and alerting capabilities. It tracks response times, error rates, cache performance, and system health metrics.

## Implemented Features

### ✅ Real-Time Performance Dashboard

- **Live metrics visualization** with configurable time windows
- **Performance metrics** including response time percentiles
- **Multi-dimensional analysis** (overall, per-endpoint, caching, compression, batching)
- **Prometheus-compatible export** for integration with external monitoring systems
- **Historical trend analysis** with configurable time windows

### ✅ Automated Bottleneck Detection

- **Alerting system** based on configurable performance thresholds
- **Multi-condition evaluation** with metric rules
- **Alert throttling** to prevent notification fatigue
- **Severity-based prioritization** (Critical > Warning > Info)
- **Endpoint-specific details** for troubleshooting

### ✅ Distributed Tracing Capabilities

- **Request-level tracing** with automatic performance snapshot collection
- **End-to-end visibility** across compression, caching, and batching operations
- **Performance attribution** to identify bottleneck locations
- **Transaction correlation** for debugging complex request flows
- **Integration with existing middleware** (compression, caching, authentication)

### ✅ Performance Alerting System

- **Multi-channel alerting** (Console, Slack, Webhook, Email)
- **Template-based notifications** with context and severity indicators
- **Alert lifecycle management** (creation, throttling, resolution)
- **Rule-based conditions** for automated threshold evaluation
- **External integrations** ready for Slack webhooks and other services
- **Widget health coverage** via `AlertType.WIDGET_DATA_FAILURE`

### ✅ Comprehensive Metrics Collection

- **Performance metrics** covering all system components
- **Configurable time windows** for metrics collection
- **JSON and Prometheus formats** for integration flexibility
- **Per-endpoint analytics** with detailed performance breakdowns
- **Alert status tracking** with active and historical alert management

## Architecture Integration

### Performance Dashboard API (`/api/dashboard`)

- **GET /api/dashboard** - Real-time metrics with time window filtering
- **POST /api/dashboard/thresholds** - Dynamic threshold updates
- **DELETE /api/dashboard/reset** - Emergency metrics reset
- **Multiple output formats** (JSON, Prometheus) for integration flexibility

### Alert Service Integration

- **Event-driven alerting** with automatic threshold evaluation
- **Multi-channel notifications** with reliable delivery
- **Alert deduplication** and throttling to prevent noise
- **Contextual alert information** for incident response
- **Widget failure alerts** include tool, endpoint, and last error message with a 5‑minute cooldown per widget

### Performance Middleware

- **Automatic snapshot collection** for every API request
- **Non-blocking performance monitoring** with error handling
- **Compression and caching integration** for complete observability
- **Endpoint filtering** to exclude internal/health endpoints

### Structured Logging Integration

- **Winston-based logging system** with JSON structured output for log aggregation
- **Alert lifecycle logging** with detailed context for all alert events
- **Performance event logging** tracking dashboard access and metric calculations
- **Multi-transport logging** (console, files, external aggregation)
- **Error boundary logging** with stack trace capture and structured metadata

## Performance Thresholds

### Default Configuration

```typescript
const thresholds = {
  maxResponseTimeMs: { p95: 500, p99: 2000 },
  maxErrorRate: 5.0, // 5%
  minCacheHitRate: 70.0, // 70%
  maxMemoryUsage: 85.0, // 85%
  minCompressionRatio: 40.0, // 40%
  maxBatchDurationMs: 10000, // 10 seconds
};
```

### Alert Conditions

- **Critical**: P99 response time > 2000ms, Resource exhaustion
- **Warning**: P95 response time > 500ms, Error rate > 5%, Cache hit rate < 70%
- **Info**: Compression ratio < 40%, Low efficiency indicators

## Monitoring Metrics

### Core Performance Metrics

| Metric                  | Description                   | Unit    |
| ----------------------- | ----------------------------- | ------- |
| `requests_total`        | Total API requests            | count   |
| `response_time_average` | Mean response time            | ms      |
| `response_time_p95`     | 95th percentile response time | ms      |
| `response_time_p99`     | 99th percentile response time | ms      |
| `error_rate`            | Percentage of failed requests | %       |
| `throughput`            | Requests per second           | req/sec |

### Caching Metrics

| Metric             | Description               | Unit  |
| ------------------ | ------------------------- | ----- |
| `cache_hit_rate`   | Cache effectiveness       | %     |
| `cache_size`       | Current cache entries     | count |
| `compression_rate` | Average compression ratio | %     |

### Compression Metrics

| Metric                       | Description                       | Unit  |
| ---------------------------- | --------------------------------- | ----- |
| `compression_requests_total` | Total compressed responses        | count |
| `compression_ratio_average`  | Average compression effectiveness | %     |
| `compression_savings_bytes`  | Total bandwidth saved             | bytes |
| `brotli_usage_percent`       | Brotli adoption rate              | %     |

### Widget Error Telemetry

| Metric                                          | Description                                            | Unit  |
| ----------------------------------------------- | ------------------------------------------------------ | ----- |
| `widget_errors_count{tool,endpoint}`            | Total widget error events per tool/endpoint            | count |
| `widget_error_last_timestamp_ms{tool,endpoint}` | Timestamp of the most recent widget failure (ms epoch) | ms    |

Every widget error also triggers the internal alert pipeline (via `AlertType.WIDGET_DATA_FAILURE`) with a 5‑minute cooldown per tool/endpoint, so Slack/webhook integrations tied to the alert service automatically receive notifications when widgets flap. Sample Slack payload:

```json
{
  "text": "[Warning] Widget GitHub/issues failed: timeout",
  "attachments": [
    {
      "fields": [
        { "title": "Tool", "value": "GitHub", "short": true },
        { "title": "Endpoint", "value": "issues", "short": true },
        { "title": "Last failure", "value": "timeout" },
        { "title": "Timestamp", "value": "2025-11-15T12:52:10Z" }
      ]
    }
  ]
}
```

Sample Prometheus queries:

```promql
# Top noisy widgets over the last 30 minutes
topk(5, rate(widget_errors_count[30m]))

# Tools with stale data (no recovery since last alert)
time() - widget_error_last_timestamp_ms > 300000
```

## Usage Examples

### Real-Time Dashboard Access

```bash
# Get comprehensive metrics
curl "http://localhost:3000/api/dashboard?timeWindow=300000"

# Prometheus format for Grafana
curl "http://localhost:3000/api/dashboard?format=prometheus"
```

### Alert Management

```bash
# Update thresholds
curl -X POST http://localhost:3000/api/dashboard/thresholds \
  -H "Content-Type: application/json" \
  -d '{"maxResponseTimeMs": {"p95": 600, "p99": 2500}}'

# Resolve alert
curl -X POST "http://localhost:3000/api/dashboard?action=resolve-alert" \
  -H "Content-Type: application/json" \
  -d '{"alertId": "alert-uuid"}'
```

### Slack Integration Setup

```typescript
import {
  alertService,
  registerSlackChannel,
} from "./lib/alerting/alert-service";

// Register Slack channel
registerSlackChannel("production-alerts", "https://hooks.slack.com/...");
```

## Alert Templates

### Critical Alerts

- **High Response Time**: Immediate performance degradation requiring attention
- **Resource Exhaustion**: System running out of critical resources
- **Circuit Breaker Open**: Service protection mechanisms activated

### Warning Alerts

- **Elevated Response Times**: Performance trending toward unacceptable levels
- **High Error Rates**: Increased failure rates affecting user experience
- **Cache Performance Issues**: Reduced cache effectiveness impacting response times

### Info Alerts

- **Compression Efficiency**: Opportunities for bandwidth optimization
- **Performance Trends**: Early indicators of potential issues

## Monitoring Dashboard Panels

### Recommended Grafana Panels

1. **Response Time Trends** - P50/P95/P99 over time with alerting thresholds
2. **Error Rate Monitoring** - Error percentage with failure pattern analysis
3. **Cache Performance** - Hit rate trends with cache size and eviction tracking
4. **Compression Analytics** - Bandwidth savings and algorithm effectiveness
5. **Throughput Visualization** - Request volume and processing capacity
6. **Alert Timeline** - Active alerts with severity and resolution tracking
7. **Widget Health & Rate Limits** - Combine `rate(widget_errors_count)` and `widget_error_last_timestamp_ms` with rate-limit gauges (`rate_limit_usage_percent`, `rate_limit_remaining`) so operators can see which widgets are failing and whether the cause is upstream throttling

## Integration Examples

### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: "hyperpage"
    static_configs:
      - targets: ["localhost:3000"]
    metrics_path: "/api/dashboard"
    params:
      format: ["prometheus"]
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Hyperpage Monitoring",
    "panels": [
      {
        "title": "Response Time Percentiles",
        "targets": [
          {
            "expr": "hyperpage_response_time_p95_seconds",
            "legendFormat": "P95"
          }
        ]
      }
    ]
  }
}
```

### Verifying Widget Metrics

```bash
# After triggering a widget failure (or waiting for a natural one), inspect the metrics:
curl http://localhost:3000/api/metrics | grep widget_error

# Example output:
# widget_errors_count{tool="GitHub",endpoint="issues"} 3
# widget_error_last_timestamp_ms{tool="GitHub",endpoint="issues"} 1.763210e+12
```

### Rate Limit Usage Example

```bash
# Pull manual rate limit data
curl http://localhost:3000/api/rate-limit/github | jq

# Example dashboard snippets
curl http://localhost:3000/api/metrics | grep rate_limit_usage_percent
curl http://localhost:3000/api/metrics | grep rate_limit_remaining

# Correlate with widget health:
rate(widget_errors_count[30m]) > 0 and rate_limit_usage_percent{platform="github"} > 75

# ToolStatusRow usage: hover tooltips show GitHub core/search usage from the rate-limit endpoint
# useToolQueries metadata (meta.usagePercent) can be inspected in devtools for each query
```

These metrics drive:

- Tool status tooltips (showing GitHub core/search/GraphQL usage)
- `useToolQueries` adaptive polling (slowing down when `usagePercent` is high)
- Prometheus alerts when `rate_limit_status` reaches warning/critical

## Operations & Maintenance

### Alert Management

- **Alert Review**: Regular review of critical/warning alerts
- **Threshold Tuning**: Adjust thresholds based on application patterns
- **Alert Suppression**: Temporary disabling for maintenance windows
- **Escalation Procedures**: Automated notification routing based on severity

### Performance Baselines

- **Establish Baselines**: Document normal performance ranges
- **Trend Analysis**: Monitor long-term performance trends
- **Capacity Planning**: Use metrics for infrastructure scaling decisions
- **Service Level Monitoring**: Ensure performance meets service requirements

### Troubleshooting Guide

- **High Response Times**: Check database connections, cache performance, external API latency
- **Cache Miss Increase**: Investigate cache invalidation patterns, memory pressure
- **Compression Drop**: Verify algorithm selection, response size patterns
- **Error Rate Spikes**: Review recent deployments, external service status

This monitoring system provides observability for the Hyperpage platform, enabling performance tracking, alerting, and optimization at scale.
