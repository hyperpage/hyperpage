import {
  performanceDashboard,
  AlertEvent,
  AlertType,
  DashboardMetrics,
} from "../monitoring/performance-dashboard";
import { EventEmitter } from "events";
import logger from "../logger";

export interface SlackAlertChannel {
  name: string;
  type: "slack";
  config: SlackConfig;
  enabled: boolean;
}

export interface EmailAlertChannel {
  name: string;
  type: "email";
  config: EmailConfig;
  enabled: boolean;
}

export interface WebhookAlertChannel {
  name: string;
  type: "webhook";
  config: WebhookConfig;
  enabled: boolean;
}

export interface ConsoleAlertChannel {
  name: string;
  type: "console";
  config: Record<string, never>; // Empty config for console
  enabled: boolean;
}

export type AlertChannel =
  | SlackAlertChannel
  | EmailAlertChannel
  | WebhookAlertChannel
  | ConsoleAlertChannel;

export interface EmailConfig {
  to: string;
  from?: string;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  password?: string;
}

export interface SlackConfig {
  webhookUrl: string;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
}

export interface AlertTemplate {
  type: AlertType;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  runbookUrl?: string;
  channels: string[]; // Channel names
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  template: AlertTemplate;
  enabled: boolean;
  throttleMs: number; // Minimum time between alerts of this rule
  lastTriggered?: number;
}

export interface AlertCondition {
  type: "metric" | "threshold" | "composite";
  metric?: string;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  value: number;
  durationMs?: number; // How long condition must be true
  compositeQueries?: AlertCondition[];
}

/**
 * Enterprise Alert Service for automated performance monitoring
 * Supports multiple channels, templates, and intelligent throttling
 */
export class AlertService extends EventEmitter {
  private channels: Map<string, AlertChannel> = new Map();
  private templates: Map<AlertType, AlertTemplate> = new Map();
  private rules: AlertRule[] = [];
  private alertHistory: AlertEvent[] = [];
  private maxHistory = 10000;

  constructor() {
    super();
    this.initializeDefaultTemplates();
    this.initializeDefaultRules();
  }

  /**
   * Register an alert channel
   */
  registerChannel(channel: AlertChannel): void {
    this.channels.set(channel.name, channel);

    switch (channel.type) {
      case "slack":
        if (channel.config.webhookUrl) {
          // Initialize Slack webhook
          this.validateSlackWebhook(channel.config.webhookUrl);
        }
        break;
      case "webhook":
        if (channel.config.url) {
          // Initialize generic webhook
          this.validateWebhook(channel.config.url);
        }
        break;
      case "email":
      case "console":
        // No additional validation needed
        break;
    }
  }

  /**
   * Register an alert template
   */
  registerTemplate(template: AlertTemplate): void {
    this.templates.set(template.type, template);
  }

  /**
   * Register an alert rule
   */
  registerRule(rule: AlertRule): void {
    // Remove existing rule with same ID if any
    this.rules = this.rules.filter((r) => r.id !== rule.id);
    this.rules.push(rule);
  }

  /**
   * Process an alert from the monitoring system
   */
  async processAlert(alertEvent: AlertEvent): Promise<void> {
    // Find matching rule
    const rule = this.rules.find(
      (r) => r.template.type === alertEvent.type && r.enabled,
    );

    if (!rule) {
      logger.warn("ALERT_NO_RULE", {
        alertType: alertEvent.type,
        message: `No rule found for alert type: ${alertEvent.type}`,
      });
      return;
    }

    // Check if rule is throttled
    if (
      rule.lastTriggered &&
      Date.now() - rule.lastTriggered < rule.throttleMs
    ) {
      logger.debug("ALERT_THROTTLED", {
        ruleName: rule.name,
        alertType: alertEvent.type,
        throttleMs: rule.throttleMs,
        timeSinceLast: Date.now() - rule.lastTriggered,
      });
      return;
    }

    // Validate condition if specified
    if (!(await this.evaluateCondition(rule.condition))) {
      return;
    }

    // Update rule timestamp
    rule.lastTriggered = Date.now();

    // Add to history
    this.alertHistory.push(alertEvent);
    if (this.alertHistory.length > this.maxHistory) {
      this.alertHistory.shift();
    }

    // Emit event for internal processing
    this.emit("alert", alertEvent, rule);

    // Send alerts to configured channels
    const template = rule.template;
    await this.sendAlertToChannels(alertEvent, template);
  }

  /**
   * Evaluate alert condition
   */
  private async evaluateCondition(condition: AlertCondition): Promise<boolean> {
    try {
      if (condition.type === "composite" && condition.compositeQueries) {
        // AND logic for composite queries
        for (const subCondition of condition.compositeQueries) {
          if (!(await this.evaluateCondition(subCondition))) {
            return false;
          }
        }
        return true;
      }

      if (condition.type === "metric" && condition.metric) {
        const metrics = performanceDashboard.getDashboardMetrics(
          condition.durationMs || 300000,
        );

        // Extract metric value using dot notation (e.g., "overall.errorRate")
        const value = this.extractMetricValue(metrics, condition.metric);

        if (value === null || value === undefined) {
          return false;
        }

        switch (condition.operator) {
          case "gt":
            return value > condition.value;
          case "lt":
            return value < condition.value;
          case "eq":
            return value === condition.value;
          case "gte":
            return value >= condition.value;
          case "lte":
            return value <= condition.value;
          default:
            return false;
        }
      }

      return false;
    } catch (error) {
      logger.error("ALERT_CONDITION_ERROR", {
        error: error instanceof Error ? error.message : String(error),
        condition,
      });
      return false;
    }
  }

  /**
   * Extract metric value from dashboard metrics object
   */
  private extractMetricValue(
    obj: DashboardMetrics,
    path: string,
  ): number | null {
    try {
      const keys = path.split(".");
      let current: Record<string, unknown> | unknown = obj;

      for (const key of keys) {
        if (current && typeof current === "object" && key in current) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return null;
        }
      }

      return typeof current === "number" ? current : null;
    } catch {
      return null;
    }
  }

  /**
   * Send alert to all configured channels
   */
  private async sendAlertToChannels(
    alert: AlertEvent,
    template: AlertTemplate,
  ): Promise<void> {
    const channels = template.channels
      .map((name) => this.channels.get(name))
      .filter((channel) => channel && channel.enabled);

    const tasks = channels.map(async (channel) => {
      try {
        await this.sendToChannel(channel!, alert, template);
        logger.info("ALERT_SENT", {
          alertType: alert.type,
          severity: alert.severity,
          channel: channel!.name,
          value: alert.value,
          threshold: alert.threshold,
          endpoint: alert.endpoint,
        });
      } catch (error) {
        logger.error("ALERT_SEND_FAILED", {
          alertType: alert.type,
          severity: alert.severity,
          channel: channel!.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(tasks);
  }

  /**
   * Send alert to specific channel
   */
  private async sendToChannel(
    channel: AlertChannel,
    alert: AlertEvent,
    template: AlertTemplate,
  ): Promise<void> {
    const message = this.renderTemplate(template, alert);

    switch (channel.type) {
      case "console":
        console.warn(
          `📢 ALERT [${alert.severity.toUpperCase()}] ${template.title}: ${message}`,
        );
        break;

      case "slack":
        await this.sendSlackAlert(
          channel.config.webhookUrl,
          template,
          alert,
          message,
        );
        break;

      case "webhook":
        await this.sendWebhookAlert(
          channel.config.url,
          template,
          alert,
          message,
        );
        break;

      case "email":
        await this.sendEmailAlert(channel.config, template, alert, message);
        break;

      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _exhaustiveCheck: never = channel; // TypeScript exhaustive check
        console.warn(`Unsupported channel type`);
    }
  }

  /**
   * Render alert message from template
   */
  private renderTemplate(template: AlertTemplate, alert: AlertEvent): string {
    let message = template.message;

    // Replace template variables
    message = message
      .replace("{{value}}", alert.value.toString())
      .replace("{{threshold}}", alert.threshold.toString())
      .replace("{{endpoint}}", alert.endpoint || "unknown")
      .replace("{{severity}}", alert.severity.toUpperCase());

    return message;
  }

  /**
   * Send alert to Slack
   */
  private async sendSlackAlert(
    webhookUrl: string,
    template: AlertTemplate,
    alert: AlertEvent,
    message: string,
  ): Promise<void> {
    const severityEmoji = {
      critical: "🔴",
      warning: "🟡",
      info: "ℹ️",
    };

    const payload = {
      text: `${severityEmoji[alert.severity]} *${template.title}*`,
      attachments: [
        {
          color:
            alert.severity === "critical"
              ? "danger"
              : alert.severity === "warning"
                ? "warning"
                : "good",
          fields: [
            {
              title: "Alert",
              value: message,
              short: false,
            },
            {
              title: "Value",
              value: `${alert.value} (threshold: ${alert.threshold})`,
              short: true,
            },
            {
              title: "Endpoint",
              value: alert.endpoint || "N/A",
              short: true,
            },
          ],
          footer: "Hyperpage Enterprise Monitoring",
          ts: Math.floor(alert.timestamp / 1000),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
  }

  /**
   * Send alert to generic webhook
   */
  private async sendWebhookAlert(
    webhookUrl: string,
    template: AlertTemplate,
    alert: AlertEvent,
    message: string,
  ): Promise<void> {
    const payload = {
      alertType: alert.type,
      severity: alert.severity,
      title: template.title,
      message,
      value: alert.value,
      threshold: alert.threshold,
      endpoint: alert.endpoint,
      timestamp: alert.timestamp,
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  }

  /**
   * Send email alert (placeholder - would integrate with email service)
   */
  private async sendEmailAlert(
    config: EmailConfig,
    template: AlertTemplate,
    alert: AlertEvent,
    message: string,
  ): Promise<void> {
    // Placeholder - implement email sending logic here
    // Could use nodemailer, AWS SES, SendGrid, etc.
    console.log(
      `📧 EMAIL ALERT [${alert.severity.toUpperCase()}] ${template.title}: ${message}`,
    );

    // Log that email would be sent
    console.warn(
      "Email alerting not yet implemented - would send to:",
      config.to,
    );
  }

  /**
   * Validate Slack webhook URL
   */
  private async validateSlackWebhook(url: string): Promise<void> {
    // Basic URL validation - could make a test request in production
    if (!url.startsWith("https://hooks.slack.com/")) {
      throw new Error("Invalid Slack webhook URL format");
    }
  }

  /**
   * Validate generic webhook URL
   */
  private async validateWebhook(url: string): Promise<void> {
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid webhook URL format");
    }
  }

  /**
   * Initialize default alert templates
   */
  private initializeDefaultTemplates(): void {
    const templates: AlertTemplate[] = [
      {
        type: AlertType.HIGH_RESPONSE_TIME,
        severity: "critical",
        title: "High Response Time Alert",
        message:
          "Response time of {{value}}ms exceeded P95 threshold of {{threshold}}ms on endpoint {{endpoint}}",
        runbookUrl: "https://docs.hyperpage.dev/runbooks/high-response-time",
        channels: ["console"], // Default to console only
      },
      {
        type: AlertType.HIGH_ERROR_RATE,
        severity: "warning",
        title: "High Error Rate Alert",
        message:
          "Error rate of {{value}}% exceeded threshold of {{threshold}}%",
        runbookUrl: "https://docs.hyperpage.dev/runbooks/high-error-rate",
        channels: ["console"],
      },
      {
        type: AlertType.CACHE_LOW_HIT_RATE,
        severity: "warning",
        title: "Low Cache Hit Rate Alert",
        message:
          "Cache hit rate of {{value}}% fell below threshold of {{threshold}}%",
        runbookUrl: "https://docs.hyperpage.dev/runbooks/cache-performance",
        channels: ["console"],
      },
      {
        type: AlertType.COMPRESSION_LOW_RATIO,
        severity: "info",
        title: "Low Compression Ratio Alert",
        message:
          "Compression ratio of {{value}}% below threshold of {{threshold}}%",
        runbookUrl:
          "https://docs.hyperpage.dev/runbooks/compression-efficiency",
        channels: ["console"],
      },
      {
        type: AlertType.RESOURCE_EXHAUSTION,
        severity: "critical",
        title: "Resource Exhaustion Alert",
        message: "System resources are exhausted - immediate action required",
        runbookUrl: "https://docs.hyperpage.dev/runbooks/resource-exhaustion",
        channels: ["console"],
      },
    ];

    templates.forEach((template) => this.registerTemplate(template));
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const rules: AlertRule[] = [
      {
        id: "high-response-time-p95",
        name: "High P95 Response Time",
        condition: {
          type: "metric",
          metric: "overall.p95ResponseTime",
          operator: "gt",
          value: 500,
          durationMs: 300000, // 5 minutes
        },
        template: this.templates.get(AlertType.HIGH_RESPONSE_TIME)!,
        enabled: true,
        throttleMs: 300000, // 5 minutes
      },
      {
        id: "high-response-time-p99",
        name: "High P99 Response Time",
        condition: {
          type: "metric",
          metric: "overall.p99ResponseTime",
          operator: "gt",
          value: 2000,
          durationMs: 300000,
        },
        template: {
          ...this.templates.get(AlertType.HIGH_RESPONSE_TIME)!,
          severity: "critical",
        },
        enabled: true,
        throttleMs: 600000, // 10 minutes
      },
      {
        id: "high-error-rate",
        name: "High Error Rate",
        condition: {
          type: "metric",
          metric: "overall.errorRate",
          operator: "gt",
          value: 5.0,
          durationMs: 300000,
        },
        template: this.templates.get(AlertType.HIGH_ERROR_RATE)!,
        enabled: true,
        throttleMs: 300000,
      },
      {
        id: "low-cache-hit-rate",
        name: "Low Cache Hit Rate",
        condition: {
          type: "metric",
          metric: "caching.hitRate",
          operator: "lt",
          value: 70.0,
          durationMs: 600000, // 10 minutes
        },
        template: this.templates.get(AlertType.CACHE_LOW_HIT_RATE)!,
        enabled: true,
        throttleMs: 600000, // 10 minutes
      },
    ];

    rules.forEach((rule) => this.registerRule(rule));
  }

  /**
   * Get alert service statistics
   */
  getStats(): {
    channels: number;
    templates: number;
    rules: number;
    alertHistory: number;
    activeChannels: string[];
  } {
    return {
      channels: this.channels.size,
      templates: this.templates.size,
      rules: this.rules.length,
      alertHistory: this.alertHistory.length,
      activeChannels: Array.from(this.channels.values())
        .filter((c) => c.enabled)
        .map((c) => c.name),
    };
  }

  /**
   * Get recent alert history
   */
  getRecentAlerts(limit: number = 50): AlertEvent[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory.length = 0;
  }
}

// Global alert service instance
export const alertService = new AlertService();

// Register console channel by default
alertService.registerChannel({
  name: "console",
  type: "console",
  config: {},
  enabled: true,
});

// Connect alert service to performance dashboard
performanceDashboard.on("alert", (alertEvent: AlertEvent) => {
  alertService.processAlert(alertEvent).catch((error) =>
    logger.error("ALERT_PROCESSING_FAILED", {
      alertType: alertEvent.type,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
});

/**
 * Helper function to create and register a Slack channel
 */
export function registerSlackChannel(
  name: string,
  webhookUrl: string,
  enabled: boolean = true,
): void {
  alertService.registerChannel({
    name,
    type: "slack",
    config: { webhookUrl },
    enabled,
  });
}

/**
 * Helper function to create and register a webhook channel
 */
export function registerWebhookChannel(
  name: string,
  webhookUrl: string,
  enabled: boolean = true,
): void {
  alertService.registerChannel({
    name,
    type: "webhook",
    config: { url: webhookUrl },
    enabled,
  });
}
