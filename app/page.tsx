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

  useEffect(() => {
    async function fetchEnabledTools() {
      try {
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
  }, []);

  if (isLoading) {
    return <PortalEmptyState />;
  }

  // If no tools are enabled, show the SetupWizard for onboarding
  if (enabledTools.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SetupWizard />
      </div>
    );
  }

  return <Portal enabledTools={enabledTools} />;
}
