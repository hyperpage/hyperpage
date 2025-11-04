"use client";

import { useState, useEffect } from "react";
import Portal from "./components/Portal";
import { Tool } from "../tools/tool-types";
import { PortalEmptyState } from "./components/PortalEmptyState";
import SetupWizard from "./components/SetupWizard";

export default function Home() {
  const [enabledTools, setEnabledTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchEnabledTools() {
      try {
        const response = await fetch("/api/tools/enabled");
        if (response.ok) {
          const data = await response.json();
          setEnabledTools(data.enabledTools || []);
        }
      } catch (error) {
        console.error("Failed to fetch enabled tools:", error);
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
