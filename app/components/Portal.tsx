"use client";

import { useState, useEffect } from "react";

import TopBar from "@/app/components/TopBar";
import TabNavigation from "@/app/components/TabNavigation";
import PortalOverview from "@/app/components/PortalOverview";
import { Tool } from "@/tools/tool-types";
import { useToolQueries } from "@/app/components/hooks/useToolQueries";

interface PortalProps {
  enabledTools: Omit<Tool, "handlers">[];
}

export default function Portal({ enabledTools }: PortalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Use custom hooks for data management
  const {
    dynamicData,
    loadingStates,
    refreshToolData,
    refreshAllData,
    initializePolling,
  } = useToolQueries({ enabledTools });

  // Initialize polling when component mounts
  useEffect(() => {
    if (enabledTools.length > 0) {
      const cleanup = initializePolling();
      return cleanup;
    }
  }, [enabledTools, initializePolling]);

  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={clearSearch}
        onGlobalRefresh={refreshAllData}
      />

      {/* Tab Navigation below TopBar */}
      <div className="fixed top-16 left-0 right-0 z-40">
        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Main content area - accounts for TopBar (64px) + TabNavigation (48px) */}
      <div className="fixed top-28 left-0 right-0 bottom-0 flex">
        {/* Full-width Content container */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Scrollable main content */}
          <div className="flex-1 overflow-y-auto">
            <PortalOverview
              enabledTools={enabledTools}
              searchQuery={searchQuery}
              dynamicData={dynamicData}
              loadingStates={loadingStates}
              refreshToolData={refreshToolData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
