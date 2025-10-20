"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState, useEffect } from "react";

import { Search, Bell, Moon, Sun, RefreshCw, Settings } from "lucide-react";
import HyperpageLogo from "./HyperpageLogo";
import { X } from "lucide-react";
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
    <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50 px-4 py-3 flex items-center h-16">
      <div className="flex items-center space-x-4">
        <Link href="/" className="cursor-pointer">
          <HyperpageLogo isDark={isDark} />
        </Link>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search across all tools..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-64 pl-10 ${searchQuery ? "pr-10" : ""}`}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Integrations Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            onMouseEnter={() => setIsDropdownOpen(true)}
            onMouseLeave={() => setIsDropdownOpen(false)}
            aria-label="Tool Integrations"
            title="Tool Integrations"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Dropdown Content */}
          {isDropdownOpen && (
            <div
              className="absolute top-full right-0 mt-2 w-64 bg-popover border border-border rounded-md shadow-lg p-4 z-50"
              onMouseEnter={() => setIsDropdownOpen(true)}
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Tool Integrations
              </h3>
              <div className="grid grid-cols-4 gap-3">
                {toolIntegrations.map((tool, index) => (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-center p-2 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                    title={tool.name}
                  >
                    <div className="relative">
                      <span className="text-lg">{tool.icon}</span>
                      <div
                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-popover ${getStatusColor(tool.status)}`}
                        title={tool.status}
                      />
                    </div>
                    <span className="text-xs text-center mt-1 truncate w-full text-muted-foreground">
                      {tool.name}
                    </span>
                  </div>
                ))}
              </div>
              {toolIntegrations.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  No tools enabled
                </p>
              )}
            </div>
          )}
        </div>

        <Button variant="outline" size="icon">
          <Bell className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => onGlobalRefresh?.()}
          aria-label="Refresh all data"
          title="Refresh all data"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleDarkMode}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
