// SetupWizard.tsx - Refactored using component decomposition
"use client";

import React from "react";
import { useSetupWizard } from "@/app/components/hooks/useSetupWizard";
import { QuickStartGuide } from "./SetupWizard/QuickStartGuide";
import { ToolConfiguration } from "./SetupWizard/ToolConfiguration";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface ConfigurationCompleteProps {
  checkConfigurationStatus: () => Promise<void>;
}

function ConfigurationComplete({
  checkConfigurationStatus,
}: ConfigurationCompleteProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
      <div className="text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-4">🎉 Configuration Complete!</h2>
        <p className="text-gray-600 mb-6 max-w-md">
          Your tools are configured and Hyperpage is ready to use.
        </p>
        <Button onClick={checkConfigurationStatus} size="lg">
          Refresh Status
        </Button>
      </div>
    </div>
  );
}

export default function SetupWizard() {
  const { isConfigured, checkConfigurationStatus } = useSetupWizard();

  if (isConfigured) {
    return (
      <ConfigurationComplete
        checkConfigurationStatus={checkConfigurationStatus}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Welcome to Hyperpage
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Let&apos;s get you set up in just a few simple steps. Follow the
            guide below to start aggregating your development data.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <QuickStartGuide />
          <ToolConfiguration />
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>
            Need help? Check the{" "}
            <a
              href="https://github.com/hyperpage/hyperpage"
              className="text-blue-600 hover:underline"
            >
              documentation
            </a>{" "}
            or{" "}
            <a
              href="https://github.com/hyperpage/hyperpage/issues"
              className="text-blue-600 hover:underline"
            >
              open an issue
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
