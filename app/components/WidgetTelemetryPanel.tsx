"use client";

import { useState, useEffect, useCallback } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TelemetryEvent = {
  tool: string;
  endpoint: string;
  message: string;
  timestamp: number;
};

interface WidgetTelemetryPanelProps {
  refreshKey: number;
  limit?: number;
}

export default function WidgetTelemetryPanel({
  refreshKey,
  limit = 5,
}: WidgetTelemetryPanelProps) {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
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

  return (
    <Card className="mb-6" id="widget-telemetry-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">
            Recent Widget Failures
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pulled from /api/telemetry/widget-error (last {limit} events)
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loadTelemetry()}
          disabled={loading}
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive mb-3">
            {error}. Check telemetry endpoint permissions.
          </p>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading telemetry…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent widget failures.
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => (
              <div
                key={`${event.tool}-${event.endpoint}-${event.timestamp}-${index}`}
                className="rounded border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {event.tool} / {event.endpoint}
                  </span>
                  <span>
                    {new Date(event.timestamp).toLocaleString(undefined, {
                      hour12: false,
                    })}
                  </span>
                </div>
                <p className="mt-1 font-medium text-foreground">
                  {event.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
