import { alertService } from "@/lib/alerting/alert-service";
import { AlertType } from "@/lib/monitoring/performance-dashboard";

interface WidgetErrorEvent {
  tool: string;
  endpoint: string;
  message: string;
  timestamp: number;
}

interface WidgetErrorAggregate {
  tool: string;
  endpoint: string;
  count: number;
  lastMessage: string;
  lastTimestamp: number;
}

const MAX_EVENTS = 200;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const eventBuffer: WidgetErrorEvent[] = [];
const aggregateMap = new Map<string, WidgetErrorAggregate>();
const lastAlertMap = new Map<string, number>();

function normalizeKey(tool: string, endpoint: string): string {
  return `${tool.toLowerCase()}::${endpoint.toLowerCase()}`;
}

export function recordWidgetError(event: WidgetErrorEvent): void {
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer.shift();
  }

  const key = normalizeKey(event.tool, event.endpoint);
  const existing = aggregateMap.get(key);
  if (!existing) {
    aggregateMap.set(key, {
      tool: event.tool,
      endpoint: event.endpoint,
      count: 1,
      lastMessage: event.message,
      lastTimestamp: event.timestamp,
    });
  } else {
    existing.count += 1;
    if (event.timestamp >= existing.lastTimestamp) {
      existing.lastTimestamp = event.timestamp;
      existing.lastMessage = event.message;
    }
  }

  maybeAlert(event, key);
}

function maybeAlert(event: WidgetErrorEvent, aggregateKey: string) {
  const lastAlert = lastAlertMap.get(aggregateKey) ?? 0;
  if (event.timestamp - lastAlert < ALERT_COOLDOWN_MS) {
    return;
  }
  lastAlertMap.set(aggregateKey, event.timestamp);

  alertService.processAlert({
    id: `widget-${aggregateKey}-${event.timestamp}`,
    type: AlertType.WIDGET_DATA_FAILURE,
    severity: "warning",
    message: `Widget ${event.tool}/${event.endpoint} failed: ${event.message}`,
    timestamp: event.timestamp,
    value: 1,
    threshold: 0,
    endpoint: event.endpoint,
  });
}

export function getWidgetErrorEvents(
  limit: number = MAX_EVENTS,
): WidgetErrorEvent[] {
  return eventBuffer.slice(-limit);
}

export function getWidgetErrorAggregates(): WidgetErrorAggregate[] {
  return Array.from(aggregateMap.values());
}

export function clearWidgetErrorTelemetry(): void {
  eventBuffer.length = 0;
  aggregateMap.clear();
  lastAlertMap.clear();
}
