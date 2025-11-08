"use client";

import { Card } from "@/components/ui/card";
import { AuthProvider, useAuth } from "@/app/components/AuthProvider";
import AuthHeader from "@/app/components/AuthHeader";
import AuthContent from "@/app/components/AuthContent";
import SecurityInfo from "@/app/components/SecurityInfo";

function AuthPanelContent() {
  const { tools, authenticate, disconnect, clearAuth, isConfigured } =
    useAuth();

  const authenticatedCount = tools.filter((t) => t.isAuthenticated).length;
  const totalCount = tools.length;
  const hasAnyErrors = tools.some((t) => t.error !== null);

  return (
    <Card className="w-full">
      <AuthHeader
        authenticatedCount={authenticatedCount}
        totalCount={totalCount}
        hasAnyErrors={hasAnyErrors}
        onClearAuth={clearAuth}
      />
      <AuthContent
        tools={tools}
        isConfigured={isConfigured}
        authenticate={authenticate}
        disconnect={disconnect}
        authenticatedCount={authenticatedCount}
      />
      <SecurityInfo />
    </Card>
  );
}

export default function AuthPanel() {
  return (
    <AuthProvider>
      <AuthPanelContent />
    </AuthProvider>
  );
}

// Alternative standalone version that doesn't wrap in provider (for use where AuthProvider is already present)
export function AuthPanelStandalone() {
  return <AuthPanelContent />;
}
