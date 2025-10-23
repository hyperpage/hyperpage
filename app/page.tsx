"use client";

import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import { Tool } from "../tools/tool-types";
import { DashboardEmptyState } from "./components/DashboardEmptyState";

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
    return <DashboardEmptyState />;
  }

  return <Dashboard enabledTools={enabledTools} />;
}
