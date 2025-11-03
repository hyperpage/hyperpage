"use client";

import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { LogIn, LogOut, Link, AlertCircle, CheckCircle } from "lucide-react";
import { getRequiredScopes } from "../../lib/oauth-config";

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
  const requiredScopes = getRequiredScopes(toolSlug);

  const handleAuthenticate = () => {
    if (onAuthenticate) {
      onAuthenticate(toolSlug);
    }
  };

  const handleDisconnect = () => {
    if (onDisconnect) {
      onDisconnect(toolSlug);
    }
  };

  if (!isConfigured) {
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

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{toolIcon}</span>
          <div>
            <h3 className="font-semibold text-base">{toolName}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <Badge
                variant={isAuthenticated ? "default" : "outline"}
                className="text-sm"
              >
                {isAuthenticated ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </>
                ) : (
                  <>
                    <Link className="w-3 h-3 mr-1" />
                    Needs Auth
                  </>
                )}
              </Badge>
              {error && <AlertCircle className="w-4 h-4 text-destructive" />}
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          {isAuthenticated ? (
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mr-1" />
              ) : (
                <LogOut className="w-3 h-3" />
              )}
            </Button>
          ) : (
            <Button onClick={handleAuthenticate} disabled={isLoading}>
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
              ) : (
                <LogIn className="w-3 h-3 mr-1" />
              )}
              Connect
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm text-destructive font-medium">
              Authentication Error
            </span>
          </div>
          <p className="text-xs text-destructive/80 mt-1">{error}</p>
        </div>
      )}

      {!isAuthenticated && showDetails && (
        <div className="mt-3 p-3 bg-muted/50 rounded-md">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Required Permissions</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(false)}
              className="h-auto p-1"
            >
              ×
            </Button>
          </div>
          <ul className="mt-2 space-y-1">
            {requiredScopes.map((scope, index) => (
              <li
                key={index}
                className="text-xs text-muted-foreground flex items-center space-x-2"
              >
                <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                <span>{scope}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isAuthenticated && !showDetails && (
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(true)}
            className="text-xs h-auto p-0 hover:bg-transparent"
          >
            View required permissions →
          </Button>
        </div>
      )}
    </Card>
  );
}
