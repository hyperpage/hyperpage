"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useSetupWizard } from "@/app/components/hooks/useSetupWizard";
import { ToolSetupCard } from "./ToolSetupCard";

export function ToolConfiguration() {
  const { tools, copyToClipboard } = useSetupWizard();

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Tool Configuration
        </CardTitle>
        <CardDescription>
          Configure your development tools to start seeing data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {tools.map((tool) => (
          <ToolSetupCard
            key={tool.name}
            tool={tool}
            copyToClipboard={copyToClipboard}
          />
        ))}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro tip:</strong> Start with GitHub for the quickest setup.
            Add other tools later once you see the portal working.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
