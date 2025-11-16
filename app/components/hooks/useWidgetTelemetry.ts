"use client";

import { useCallback, useEffect, useState } from "react";

export interface WidgetTelemetryEvent {
  tool: string;
  endpoint: string;
  message: string;
  timestamp: number;
}

interface UseWidgetTelemetryArgs {
  limit?: number;
  refreshKey?: number;
}

export function useWidgetTelemetry({
  limit = 5,
  refreshKey,
}: UseWidgetTelemetryArgs = {}) {
  const [events, setEvents] = useState<WidgetTelemetryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/telemetry/widget-error?limit=${limit}`,
      );
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load telemetry");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry, refreshKey]);

  return {
    events,
    loading,
    error,
    refresh: loadTelemetry,
  };
}
