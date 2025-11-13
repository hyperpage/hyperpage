"use client";

import Link from "next/link";
import { Search, Bell, RefreshCw, X, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HyperpageLogo from "@/app/components/HyperpageLogo";
import ThemeSwitcher from "@/app/components/ThemeSwitcher";
import { AuthPanelStandalone } from "@/app/components/AuthPanel";

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
  return (
    <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border px-4 py-3 flex items-center h-16">
      <div className="flex items-center space-x-4">
        <Link href="/" className="cursor-pointer">
          <HyperpageLogo />
        </Link>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            type="text"
            placeholder="Search across all tools..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 pl-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${searchQuery ? "pr-10" : ""}`}
          />
          {searchQuery && (
            <Button
              onClick={onClearSearch}
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" title="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <Button
          onClick={() => onGlobalRefresh?.()}
          variant="ghost"
          size="icon"
          aria-label="Refresh all data"
          title="Refresh all data"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        <ThemeSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="Authentication"
              aria-label="Authentication settings"
            >
              <Shield className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-96 max-h-[80vh] overflow-y-auto"
          >
            <AuthPanelStandalone />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
