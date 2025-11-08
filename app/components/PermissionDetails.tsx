"use client";

import { Button } from "@/components/ui/button";

interface PermissionDetailsProps {
  requiredScopes: string[];
  showDetails: boolean;
  onToggle: () => void;
}

export default function PermissionDetails({
  requiredScopes,
  showDetails,
  onToggle,
}: PermissionDetailsProps) {
  if (!showDetails) {
    return (
      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-xs h-auto p-0 hover:bg-transparent"
        >
          View required permissions →
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-muted/50 rounded-md">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Required Permissions</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-auto p-1"
        >
          ×
        </Button>
      </div>
      <ul className="mt-2 space-y-1">
        {requiredScopes.map((scope, index) => (
          <li
            key={index}
            className="text-xs text-muted-foreground flex items-center space-x-2"
          >
            <div className="w-1 h-1 bg-muted-foreground rounded-full" />
            <span>{scope}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
