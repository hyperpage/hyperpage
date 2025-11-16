"use client";

import { Bell, RefreshCw, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ThemeSwitcher from "@/app/components/ThemeSwitcher";
import { AuthPanelStandalone } from "@/app/components/AuthPanel";

interface TopBarActionsProps {
  onGlobalRefresh?: () => void;
}

export default function TopBarActions({
  onGlobalRefresh,
}: TopBarActionsProps) {
  return (
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
  );
}

