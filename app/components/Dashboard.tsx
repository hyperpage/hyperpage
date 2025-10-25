"use client";

import { useState, useEffect } from "react";
import TopBar from "./TopBar";
import TabNavigation from "./TabNavigation";
import DashboardOverview from "./DashboardOverview";
import Livefeed from "./Livefeed";

import { Tool } from "../../tools/tool-types";
import { useToolQueries } from "./hooks/useToolQueries";
import { useActivities } from "./hooks/useActivities";

interface DashboardProps {
  enabledTools: Omit<Tool, "handlers">[];
}

export default function Dashboard({ enabledTools }: DashboardProps) {
  const [isDark, setIsDark] = useState(false);
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

  useEffect(() => {
    const darkMode = localStorage.getItem("darkMode");
    if (darkMode === "true") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else if (darkMode === "false") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setIsDark(prefersDark);
      if (prefersDark) document.documentElement.classList.add("dark");
    }
  }, []);

  // Initialize polling when component mounts
  useEffect(() => {
    if (enabledTools.length > 0) {
      const cleanup = initializePolling();
      return cleanup;
    }
  }, [enabledTools, initializePolling]);

  const toggleDarkMode = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem("darkMode", newIsDark.toString());
    if (newIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

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
      <DashboardOverview
        enabledTools={enabledTools}
        searchQuery={searchQuery}
        dynamicData={dynamicData}
        loadingStates={loadingStates}
        refreshToolData={refreshToolData}
      />
    );

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        toggleDarkMode={toggleDarkMode}
        isDark={isDark}
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
