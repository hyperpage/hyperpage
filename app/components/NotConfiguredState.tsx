"use client";

import { AlertCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NotConfiguredStateProps {
  toolName: string;
  toolIcon: React.ReactNode;
}

export default function NotConfiguredState({
  toolName,
  toolIcon,
}: NotConfiguredStateProps) {
  return (
    <Card className="p-6 border-dashed border-2 border-muted-foreground/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{toolIcon}</span>
          <div>
            <h3 className="font-semibold text-base">{toolName}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant="secondary" className="text-sm">
                Not Configured
              </Badge>
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        OAuth credentials not provided in environment configuration.
      </div>
    </Card>
  );
}
