import { useState, useEffect, useCallback } from "react";

import { ToolIntegration } from "@/tools/tool-types";
import { RateLimitStatus } from "@/lib/types/rate-limit";
import { useAuthStatus } from "@/app/components/hooks/useAuthStatus";
import { useMultipleRateLimits } from "@/app/components/hooks/useRateLimit";
import logger from "@/lib/logger";

export interface ToolHealthInfo extends ToolIntegration {
  slug: string;
}

export interface UseToolStatusReturn {
  toolIntegrations: ToolHealthInfo[];
  enabledPlatformSlugs: string[];
  rateLimitStatuses: Map<string, RateLimitStatus>;
  authData: ReturnType<typeof useAuthStatus>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useToolStatus(): UseToolStatusReturn {
  const [toolIntegrations, setToolIntegrations] = useState<ToolHealthInfo[]>(
    [],
  );
  const [enabledPlatformSlugs, setEnabledPlatformSlugs] = useState<string[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const authData = useAuthStatus();
  const { statuses: rateLimitStatuses } = useMultipleRateLimits(
    enabledPlatformSlugs.length > 0 ? enabledPlatformSlugs : ["dummy"],
  );

  const fetchToolIntegrations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/tools/enabled");
      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.status}`);
      }

      const data = await response.json();

      // Transform tool data to ToolHealthInfo format
      const basicIntegrations: ToolHealthInfo[] = data.enabledTools.map(
        (tool: { name: string; slug: string }) => ({
          name: tool.name,
          slug: tool.slug,
          enabled: true,
          icon: tool.name,
          status: "connected" as const,
        }),
      );

      // Extract platform slugs for rate limiting
      const rateLimitEnabledSlugs = data.enabledTools
        .filter((tool: unknown) =>
          (tool as { capabilities?: string[] }).capabilities?.includes(
            "rate-limit",
          ),
        )
        .map((tool: unknown) => (tool as { slug: string }).slug);

      setEnabledPlatformSlugs(rateLimitEnabledSlugs);
      setToolIntegrations(basicIntegrations);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      logger.error("Failed to load tool integrations", { error });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToolIntegrations();
  }, [fetchToolIntegrations]);

  return {
    toolIntegrations,
    enabledPlatformSlugs,
    rateLimitStatuses,
    authData,
    isLoading,
    error,
    refetch: fetchToolIntegrations,
  };
}
