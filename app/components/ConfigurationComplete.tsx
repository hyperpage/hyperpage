"use client";

import React from "react";
import { CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ConfigurationCompleteProps {
  checkConfigurationStatus: () => Promise<void>;
}

export default function ConfigurationComplete({
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
