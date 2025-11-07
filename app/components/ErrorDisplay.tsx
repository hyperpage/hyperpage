"use client";

import { AlertCircle } from "lucide-react";

interface ErrorDisplayProps {
  error: string | null;
}

export default function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
      <div className="flex items-center space-x-2">
        <AlertCircle className="w-4 h-4 text-destructive" />
        <span className="text-sm text-destructive font-medium">
          Authentication Error
        </span>
      </div>
      <p className="text-xs text-destructive/80 mt-1">{error}</p>
    </div>
  );
}
