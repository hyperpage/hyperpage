"use client";

import { Shield, LogOut } from "lucide-react";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface AuthHeaderProps {
  authenticatedCount: number;
  totalCount: number;
  hasAnyErrors: boolean;
  onClearAuth: () => void;
}

export default function AuthHeader({
  authenticatedCount,
  totalCount,
  hasAnyErrors,
  onClearAuth,
}: AuthHeaderProps) {
  return (
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <CardTitle className="text-lg">Tool Authentication</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your development tools to unlock full functionality
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Badge
            variant={hasAnyErrors ? "destructive" : "default"}
            className="text-xs"
          >
            {authenticatedCount}/{totalCount} Connected
            {hasAnyErrors && <AlertTriangle className="w-3 h-3 ml-1" />}
          </Badge>

          {authenticatedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAuth}
              className="text-xs"
            >
              <LogOut className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
  );
}
