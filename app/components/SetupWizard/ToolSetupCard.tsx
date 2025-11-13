"use client";

import React from "react";
import { CheckCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { ConfigurationExample } from "./ConfigurationExample";
import { SetupStep } from "./SetupStep";

interface ToolSetupCardProps {
  tool: {
    name: string;
    enabled: boolean;
    setupSteps: Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      action?: string;
      link?: string;
    }>;
  };
  copyToClipboard: (text: string) => void;
}

export function ToolSetupCard({ tool, copyToClipboard }: ToolSetupCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">{tool.name}</h3>
          <Badge variant={tool.enabled ? "default" : "secondary"}>
            {tool.enabled ? "Configured" : "Not Configured"}
          </Badge>
        </div>
        {tool.enabled && <CheckCircle className="h-6 w-6 text-green-500" />}
      </div>

      <div className="space-y-3">
        {tool.setupSteps.map((step) => (
          <SetupStep
            key={step.id}
            step={step}
            copyToClipboard={copyToClipboard}
          />
        ))}
      </div>

      {!tool.enabled && (
        <ConfigurationExample
          toolName={tool.name}
          copyToClipboard={copyToClipboard}
        />
      )}
    </div>
  );
}
