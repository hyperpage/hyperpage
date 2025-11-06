import { describe, it, expect } from "vitest";
import {
  alertService,
  AlertType,
} from "../../../../lib/alerting/alert-service";

// Simple test to verify alert processing works correctly
describe("AlertService", () => {
  beforeEach(() => {
    alertService.clearAlerts();
  });

  it("should process critical alerts and store them correctly", () => {
    const criticalAlert = {
      id: "test-critical",
      type: AlertType.HIGH_ERROR_RATE,
      severity: "critical" as const,
      message: "High error rate detected",
      timestamp: Date.now(),
      value: 15.5,
      threshold: 10.0,
      endpoint: "/api/test",
    };

    alertService.processAlert(criticalAlert);
    const storedAlerts = alertService.getAlerts();

    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0]).toMatchObject(criticalAlert);
  });

  it("should process warning alerts and store them correctly", () => {
    const warningAlert = {
      id: "test-warning",
      type: AlertType.HIGH_RESPONSE_TIME,
      severity: "warning" as const,
      message: "High response time detected",
      timestamp: Date.now(),
      value: 2500,
      threshold: 2000,
    };

    alertService.processAlert(warningAlert);
    const storedAlerts = alertService.getAlerts();

    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0]).toMatchObject(warningAlert);
  });

  it("should process info alerts and store them correctly", () => {
    const infoAlert = {
      id: "test-info",
      type: AlertType.CACHE_LOW_HIT_RATE,
      severity: "info" as const,
      message: "Cache hit rate below optimal",
      timestamp: Date.now(),
      value: 75,
      threshold: 80,
    };

    alertService.processAlert(infoAlert);
    const storedAlerts = alertService.getAlerts();

    expect(storedAlerts).toHaveLength(1);
    expect(storedAlerts[0]).toMatchObject(infoAlert);
  });

  it("should store multiple alerts and make them retrievable", () => {
    const alert1 = {
      id: "test-1",
      type: AlertType.MEMORY_HIGH_USAGE,
      severity: "warning" as const,
      message: "Memory usage high",
      timestamp: Date.now(),
      value: 85,
      threshold: 80,
    };

    const alert2 = {
      id: "test-2",
      type: AlertType.CACHE_LOW_HIT_RATE,
      severity: "info" as const,
      message: "Cache hit rate below optimal",
      timestamp: Date.now(),
      value: 75,
      threshold: 80,
    };

    alertService.processAlert(alert1);
    alertService.processAlert(alert2);

    const storedAlerts = alertService.getAlerts();
    expect(storedAlerts).toHaveLength(2);
    expect(storedAlerts[0]).toMatchObject(alert1);
    expect(storedAlerts[1]).toMatchObject(alert2);
  });

  it("should clear all alerts", () => {
    // Add multiple test alerts
    alertService.processAlert({
      id: "test-clear-1",
      type: AlertType.RESOURCE_EXHAUSTION,
      severity: "critical" as const,
      message: "Resource exhaustion",
      timestamp: Date.now(),
      value: 100,
      threshold: 90,
    });

    alertService.processAlert({
      id: "test-clear-2",
      type: AlertType.HIGH_ERROR_RATE,
      severity: "warning" as const,
      message: "High error rate",
      timestamp: Date.now(),
      value: 15,
      threshold: 10,
    });

    // Clear alerts
    alertService.clearAlerts();

    // Verify no alerts remain
    const storedAlerts = alertService.getAlerts();
    expect(storedAlerts).toHaveLength(0);
  });
});
