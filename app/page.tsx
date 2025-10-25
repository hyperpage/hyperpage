"use client";

import { useState, useEffect } from "react";
import Portal from "./components/Portal";
import { Tool } from "../tools/tool-types";
import { PortalEmptyState } from "./components/PortalEmptyState";

export default function Home() {
  const [enabledTools, setEnabledTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchEnabledTools() {
      try {
        const response = await fetch('/api/tools/enabled');
        if (response.ok) {
          const data = await response.json();
          setEnabledTools(data.enabledTools || []);
        }
      } catch (error) {
        console.error('Failed to fetch enabled tools:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEnabledTools();
  }, []);

  if (isLoading) {
    return <PortalEmptyState />;
  }

  return <Portal enabledTools={enabledTools} />;
}
