"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, Link, AlertCircle } from "lucide-react";

interface StatusBadgeProps {
  isAuthenticated: boolean;
  error?: string | null;
}

export default function StatusBadge({
  isAuthenticated,
  error,
}: StatusBadgeProps) {
  return (
    <div className="flex items-center space-x-2">
      <Badge
        variant={isAuthenticated ? "default" : "outline"}
        className="text-sm"
      >
        {isAuthenticated ? (
          <>
            <CheckCircle className="w-3 h-3 mr-1" />
            Connected
          </>
        ) : (
          <>
            <Link className="w-3 h-3 mr-1" />
            Needs Auth
          </>
        )}
      </Badge>
      {error && <AlertCircle className="w-4 h-4 text-destructive" />}
    </div>
  );
}
