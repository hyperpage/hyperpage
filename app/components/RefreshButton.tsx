"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RefreshButtonProps {
  isLoading: boolean;
  onRefresh: () => void;
}

export default function RefreshButton({
  isLoading,
  onRefresh,
}: RefreshButtonProps) {
  return (
    <Button
      onClick={onRefresh}
      disabled={isLoading}
      variant="ghost"
      size="icon"
      title="Refresh data"
    >
      <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
    </Button>
  );
}
