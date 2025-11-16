// SetupWizard.tsx - Refactored using component decomposition
"use client";

import React from "react";

import { useSetupWizard } from "@/app/components/hooks/useSetupWizard";

import { QuickStartGuide } from "./SetupWizard/QuickStartGuide";
import { ToolConfiguration } from "./SetupWizard/ToolConfiguration";
import { ConfigurationComplete } from "./SetupWizard/ConfigurationComplete";
import { SetupWizardLayout } from "./SetupWizard/SetupWizardLayout";

export default function SetupWizard() {
  const { isConfigured, checkConfigurationStatus } = useSetupWizard();

  if (isConfigured) {
    return (
      <ConfigurationComplete
        onRefreshStatus={checkConfigurationStatus}
      />
    );
  }

  return (
    <SetupWizardLayout>
      <QuickStartGuide />
      <ToolConfiguration />
    </SetupWizardLayout>
  );
}
