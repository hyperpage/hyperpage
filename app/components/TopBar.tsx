"use client";

import Link from "next/link";

import HyperpageLogo from "@/app/components/HyperpageLogo";
import GlobalSearchInput from "@/app/components/GlobalSearchInput";
import TopBarActions from "@/app/components/TopBarActions";

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
        <GlobalSearchInput
          value={searchQuery}
          onChange={onSearchChange}
          onClear={onClearSearch}
        />
      </div>

      <TopBarActions onGlobalRefresh={onGlobalRefresh} />
    </div>
  );
}
