// SetupWizard.tsx - Refactored using component decomposition
"use client";

import React, { useCallback } from "react";

import { useSetupWizard } from "@/app/components/hooks/useSetupWizard";

import { QuickStartGuide } from "./SetupWizard/QuickStartGuide";
import { ToolConfiguration } from "./SetupWizard/ToolConfiguration";
import { ConfigurationComplete } from "./SetupWizard/ConfigurationComplete";
import { SetupWizardLayout } from "./SetupWizard/SetupWizardLayout";

export default function SetupWizard() {
  const { isConfigured, checkConfigurationStatus } = useSetupWizard();
  const handleRefresh = useCallback(async () => {
    await checkConfigurationStatus();
    window.location.href = "/";
  }, [checkConfigurationStatus]);

  if (isConfigured) {
    return <ConfigurationComplete onRefreshStatus={handleRefresh} />;
  }

  return (
    <SetupWizardLayout>
      <QuickStartGuide />
      <ToolConfiguration />
    </SetupWizardLayout>
  );
}
