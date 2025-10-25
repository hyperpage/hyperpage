"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { Search, Bell, Moon, Sun, RefreshCw, Settings, X } from "lucide-react";
import HyperpageLogo from "./HyperpageLogo";
import { getToolIcon } from "../../tools";
import { ToolIntegration } from "../../tools/tool-types";

interface TopBarProps {
  toggleDarkMode: () => void;
  isDark: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onGlobalRefresh?: () => void;
}

export default function TopBar({
  toggleDarkMode,
  isDark,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onGlobalRefresh,
}: TopBarProps) {
  const [toolIntegrations, setToolIntegrations] = useState<ToolIntegration[]>(
    [],
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Load tool integrations from API on component mount
  useEffect(() => {
    async function loadIntegrations() {
      try {
        const response = await fetch("/api/tools/enabled");
        if (response.ok) {
          const data = await response.json();
          const integrations: ToolIntegration[] = data.enabledTools.map(
            (tool: { name: string }) => ({
              name: tool.name,
              enabled: true,
              icon: getToolIcon(tool.name),
              status: "connected" as const, // Default status for enabled tools
            }),
          );
          setToolIntegrations(integrations);
        } else {
          console.error("Failed to fetch enabled tools");
        }
      } catch (error) {
        console.error("Error loading tool integrations:", error);
      }
    }

    loadIntegrations();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-teal-600";
      case "connecting":
        return "bg-yellow-500";
      default:
        return "bg-red-500";
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center h-16">
      <div className="flex items-center space-x-4">
        <Link href="/" className="cursor-pointer">
          <HyperpageLogo isDark={isDark} />
        </Link>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 h-4 w-4" />
          <input
            type="text"
            placeholder="Search across all tools..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-64 pl-10 border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:focus:ring-blue-400 ${searchQuery ? "pr-10" : ""}`}
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Integrations Dropdown */}
        <div className="relative">
          <button
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
            className="h-8 w-8 p-1 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
            aria-label="Tool Integrations"
            title="Tool Integrations"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Dropdown Content */}
          {isDropdownOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-4 z-50"
              onMouseEnter={() => setIsDropdownOpen(true)}
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Tool Integrations
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {toolIntegrations.map((tool, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    title={tool.name}
                  >
                    <div className="relative">
                      <span className="text-lg">{tool.icon}</span>
                      <div
                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(tool.status)}`}
                        title={tool.status}
                      />
                    </div>
                    <span className="text-xs text-center mt-1 truncate w-full text-gray-600 dark:text-gray-400">
                      {tool.name}
                    </span>
                  </div>
                ))}
              </div>
              {toolIntegrations.length === 0 && (
                <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                  No tools enabled
                </p>
              )}
            </div>
          )}
        </div>

        <button className="h-8 w-8 p-1 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors flex items-center justify-center" title="Notifications">
          <Bell className="h-4 w-4" />
        </button>

        <button
          onClick={() => onGlobalRefresh?.()}
          className="h-8 w-8 p-1 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          aria-label="Refresh all data"
          title="Refresh all data"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        <button
          onClick={toggleDarkMode}
          className="h-8 w-8 p-1 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
