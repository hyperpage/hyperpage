"use client";

import { useState, useEffect } from "react";

import Portal from "@/app/components/Portal";
import { ClientSafeTool } from "@/tools/tool-types";
import { PortalEmptyState } from "@/app/components/PortalEmptyState";
import SetupWizard from "@/app/components/SetupWizard";
import logger from "@/lib/logger";

export default function Home() {
  const [enabledTools, setEnabledTools] = useState<ClientSafeTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configReady, setConfigReady] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    async function fetchConfigStatus() {
      try {
        const response = await fetch("/api/config/status");
        if (response.ok) {
          const data = (await response.json()) as {
            coreStatus?: { isReady?: boolean };
            hasReadyTool?: boolean;
          };
          setConfigReady(
            Boolean(data.coreStatus?.isReady) && Boolean(data.hasReadyTool),
          );
        } else {
          setConfigReady(false);
        }
      } catch (error) {
        logger.error("Failed to fetch config status:", error);
        setConfigReady(false);
      } finally {
        setConfigLoading(false);
      }
    }

    fetchConfigStatus();
  }, []);

  useEffect(() => {
    if (!configReady) {
      setEnabledTools([]);
      setIsLoading(false);
      return;
    }

    async function fetchEnabledTools() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/tools/enabled");
        if (response.ok) {
          const data = (await response.json()) as {
            enabledTools?: ClientSafeTool[];
          };
          setEnabledTools(data.enabledTools || []);
        }
      } catch (error) {
        logger.error("Failed to fetch enabled tools:", error);
        // Set empty array on error to prevent infinite loading
        setEnabledTools([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEnabledTools();
  }, [configReady]);

  if (configLoading || (configReady && isLoading)) {
    return <PortalEmptyState />;
  }

  if (!configReady) {
    return (
      <div className="min-h-screen bg-background">
        <SetupWizard />
      </div>
    );
  }

  if (enabledTools.length === 0) {
    return <PortalEmptyState />;
  }

  return <Portal enabledTools={enabledTools} />;
}
