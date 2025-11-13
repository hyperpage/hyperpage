"use client";

import React from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getExampleConfig } from "@/app/components/hooks/useSetupWizard";

interface ConfigurationExampleProps {
  toolName: string;
  copyToClipboard: (text: string) => void;
}

export function ConfigurationExample({
  toolName,
  copyToClipboard,
}: ConfigurationExampleProps) {
  return (
    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="font-medium text-blue-900 mb-2">Configuration Example:</h4>
      <div className="bg-blue-900 text-blue-100 p-2 rounded font-mono text-sm relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(getExampleConfig(toolName))}
          className="absolute top-2 right-2 text-blue-300 hover:text-blue-100"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <pre className="pr-8">{getExampleConfig(toolName)}</pre>
      </div>
    </div>
  );
}
