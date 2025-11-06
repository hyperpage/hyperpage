/**
 * Alert Service for handling system alerts and notifications
 */

import logger from "../logger";

export enum AlertType {
  HIGH_RESPONSE_TIME = "HIGH_RESPONSE_TIME",
  HIGH_ERROR_RATE = "HIGH_ERROR_RATE",
  CACHE_LOW_HIT_RATE = "CACHE_LOW_HIT_RATE",
  MEMORY_HIGH_USAGE = "MEMORY_HIGH_USAGE",
  COMPRESSION_LOW_RATIO = "COMPRESSION_LOW_RATIO",
  BATCH_HIGH_LATENCY = "BATCH_HIGH_LATENCY",
  RESOURCE_EXHAUSTION = "RESOURCE_EXHAUSTION",
  CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN",
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: number;
  value: number;
  threshold: number;
  endpoint?: string;
}

export interface AlertService {
  processAlert(alert: Alert): void;
}

/**
 * Simple alert service implementation
 */
class AlertServiceImpl implements AlertService {
  private alerts: Alert[] = [];

  processAlert(alert: Alert): void {
    // Store the alert
    this.alerts.push(alert);

    // Log the alert with appropriate level based on severity
    const alertMetadata = {
      alertId: alert.id,
      alertType: alert.type,
      severity: alert.severity,
      value: alert.value,
      threshold: alert.threshold,
      endpoint: alert.endpoint,
      timestamp: new Date(alert.timestamp).toISOString(),
    };

    switch (alert.severity) {
      case "critical":
        logger.error(`ALERT: ${alert.message}`, alertMetadata);
        break;
      case "warning":
        logger.warn(`ALERT: ${alert.message}`, alertMetadata);
        break;
      case "info":
        logger.info(`ALERT: ${alert.message}`, alertMetadata);
        break;
      default:
        logger.info(`ALERT: ${alert.message}`, alertMetadata);
    }
  }

  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
  }
}

// Export singleton instance
export const alertService = new AlertServiceImpl();

export default alertService;
