"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { Search, Bell, RefreshCw, Settings, X } from "lucide-react";
import HyperpageLogo from "./HyperpageLogo";
import ThemeSwitcher from "./ThemeSwitcher";
import { getToolIcon } from "../../tools";
import { ToolIntegration } from "../../tools/tool-types";

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  onGlobalRefresh?: () => void;
}

export default function TopBar({
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
    <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-base-100/80 border-b border-base-200 px-4 py-3 flex items-center h-16">
      <div className="flex items-center space-x-4">
        <Link href="/" className="cursor-pointer">
          <HyperpageLogo />
        </Link>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50 h-4 w-4" />
          <input
            type="text"
            placeholder="Search across all tools..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`input input-bordered w-64 pl-10 ${searchQuery ? "pr-10" : ""}`}
          />
          {searchQuery && (
            <button
              onClick={onClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 text-base-content/60 hover:text-base-content rounded-full hover:bg-base-200 transition-colors flex items-center justify-center"
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
            className="btn btn-ghost btn-square"
            aria-label="Tool Integrations"
            title="Tool Integrations"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Dropdown Content */}
          {isDropdownOpen && (
            <div
              className="dropdown-content bg-base-100 border border-base-200 rounded-box shadow-xl p-4 z-50 w-64"
              onMouseEnter={() => setIsDropdownOpen(true)}
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
              <h3 className="text-sm font-semibold text-base-content mb-3">
                Tool Integrations
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {toolIntegrations.map((tool, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-base-200 hover:bg-base-300 transition-colors"
                    title={tool.name}
                  >
                    <div className="relative">
                      <span className="text-lg">{tool.icon}</span>
                      <div
                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-base-100 ${getStatusColor(tool.status)}`}
                        title={tool.status}
                      />
                    </div>
                    <span className="text-xs text-center mt-1 truncate w-full text-base-content/70">
                      {tool.name}
                    </span>
                  </div>
                ))}
              </div>
              {toolIntegrations.length === 0 && (
                <p className="text-sm text-center text-base-content/60">
                  No tools enabled
                </p>
              )}
            </div>
          )}
        </div>

        <button className="btn btn-ghost btn-square" title="Notifications">
          <Bell className="h-4 w-4" />
        </button>

        <button
          onClick={() => onGlobalRefresh?.()}
          className="btn btn-ghost btn-square"
          aria-label="Refresh all data"
          title="Refresh all data"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        <ThemeSwitcher />
      </div>
    </div>
  );
}
