/**
 * Alert Service for handling system alerts and notifications
 */

import logger from "@/lib/logger";
import { AlertType } from "@/lib/monitoring/performance-dashboard";

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
