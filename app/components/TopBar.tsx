"use client";

import Link from "next/link";
import { Search, Bell, RefreshCw, X } from "lucide-react";
import HyperpageLogo from "./HyperpageLogo";
import ThemeSwitcher from "./ThemeSwitcher";

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
