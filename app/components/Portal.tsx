"use client";

import { useState, useEffect } from "react";
import TopBar from "./TopBar";
import TabNavigation from "./TabNavigation";
import PortalOverview from "./PortalOverview";
import Livefeed from "./Livefeed";

import { Tool } from "../../tools/tool-types";
import { useToolQueries } from "./hooks/useToolQueries";
import { useActivities } from "./hooks/useActivities";

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

  const { activities, refetch: refreshActivities, isRefreshing: activityLoading } = useActivities();

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

  const mainContent =
    activeTab === "livefeed" ? (
      <div className="p-8">
        <Livefeed
          activities={activities}
          onRefresh={refreshActivities}
          isLoading={activityLoading}
        />
      </div>
    ) : (
      <PortalOverview
        enabledTools={enabledTools}
        searchQuery={searchQuery}
        dynamicData={dynamicData}
        loadingStates={loadingStates}
        refreshToolData={refreshToolData}
      />
    );

  return (
    <div className="min-h-screen bg-base-100">
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
          <div className="flex-1 overflow-y-auto">{mainContent}</div>
        </div>
      </div>
    </div>
  );
}
