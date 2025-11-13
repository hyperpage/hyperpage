"use client";

import { useState } from "react";

import { getRequiredScopes } from "@/lib/oauth-config";
import NotConfiguredState from "@/app/components/NotConfiguredState";
import StatusBadge from "@/app/components/StatusBadge";
import ButtonStateHandler from "@/app/components/ButtonStateHandler";
import ErrorDisplay from "@/app/components/ErrorDisplay";
import PermissionDetails from "@/app/components/PermissionDetails";

interface AuthButtonProps {
  toolName: string;
  toolSlug: string;
  toolIcon: React.ReactNode;
  isAuthenticated?: boolean;
  isConfigured?: boolean;
  onAuthenticate?: (toolSlug: string) => void;
  onDisconnect?: (toolSlug: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export default function AuthButton({
  toolName,
  toolSlug,
  toolIcon,
  isAuthenticated = false,
  isConfigured = false,
  onAuthenticate,
  onDisconnect,
  isLoading = false,
  error = null,
}: AuthButtonProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!isConfigured) {
    return <NotConfiguredState toolName={toolName} toolIcon={toolIcon} />;
  }

  return (
    <div className="p-6 border rounded-lg hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{toolIcon}</span>
          <div>
            <h3 className="font-semibold text-base">{toolName}</h3>
            <StatusBadge isAuthenticated={isAuthenticated} error={error} />
          </div>
        </div>
        <ButtonStateHandler
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          onAuthenticate={() => onAuthenticate?.(toolSlug)}
          onDisconnect={() => onDisconnect?.(toolSlug)}
        />
      </div>
      <ErrorDisplay error={error} />
      {!isAuthenticated && (
        <PermissionDetails
          requiredScopes={getRequiredScopes(toolSlug)}
          showDetails={showDetails}
          onToggle={() => setShowDetails(!showDetails)}
        />
      )}
    </div>
  );
}
