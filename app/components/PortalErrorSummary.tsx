"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import WidgetTelemetryPanel from "@/app/components/WidgetTelemetryPanel";
import { PortalAggregatedError } from "@/app/components/hooks/usePortalOverviewData";

interface PortalErrorSummaryProps {
  aggregatedErrors: PortalAggregatedError[];
  telemetryRefreshKey: number;
}

export default function PortalErrorSummary({
  aggregatedErrors,
  telemetryRefreshKey,
}: PortalErrorSummaryProps) {
  if (aggregatedErrors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTitle>Some tool data failed to load</AlertTitle>
        <AlertDescription className="space-y-2">
          {aggregatedErrors.map(
            ({ toolName, endpoints, message, timestamp }) => (
              <p
                key={`${toolName}-${message}`}
                className="flex flex-col gap-1 text-sm"
              >
                <span className="font-semibold">
                  {toolName}
                  {endpoints.length > 0 && (
                    <span className="font-normal">
                      {" "}
                      ({endpoints.join(", ")})
                    </span>
                  )}
                </span>
                <span>
                  {message} –{" "}
                  <span className="italic text-xs">
                    {new Date(timestamp).toLocaleTimeString()}
                  </span>
                </span>
              </p>
            ),
          )}
        </AlertDescription>
      </Alert>

      <WidgetTelemetryPanel refreshKey={telemetryRefreshKey} limit={5} />
    </div>
  );
}

