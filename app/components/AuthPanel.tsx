"use client";

import { useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Shield, LogOut, CheckCircle, AlertTriangle } from "lucide-react";
import AuthButton from "./AuthButton";
import { AuthProvider, useAuth } from "./AuthProvider";
import { getToolIcon } from "../../tools";

function AuthPanelContent() {
  const { tools, authenticate, disconnect, clearAuth, isConfigured } =
    useAuth();

  // Auto-refresh auth status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      tools.forEach((tool) => {
        if (tool.isAuthenticated) {
          // Could optionally refresh status here
        }
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [tools]);

  const authenticatedCount = tools.filter((t) => t.isAuthenticated).length;
  const totalCount = tools.length;
  const hasAnyErrors = tools.some((t) => t.error !== null);

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <CardTitle className="text-lg">Tool Authentication</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your development tools to unlock full functionality
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Badge
              variant={hasAnyErrors ? "destructive" : "default"}
              className="text-xs"
            >
              {authenticatedCount}/{totalCount} Connected
              {hasAnyErrors && <AlertTriangle className="w-3 h-3 ml-1" />}
            </Badge>

            {authenticatedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAuth}
                className="text-xs"
              >
                <LogOut className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {authenticatedCount === 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  Get Started
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Connect your tools to access full features like real-time data
                  synchronization and personalized insights. Authentication is
                  secure and encrypted.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {tools.map((tool) => {
            const toolIcon = getToolIcon(tool.toolSlug);

            return (
              <AuthButton
                key={tool.toolSlug}
                toolName={
                  tool.toolSlug.charAt(0).toUpperCase() + tool.toolSlug.slice(1)
                }
                toolSlug={tool.toolSlug}
                toolIcon={toolIcon}
                isAuthenticated={tool.isAuthenticated}
                isConfigured={isConfigured(tool.toolSlug)}
                onAuthenticate={authenticate}
                onDisconnect={disconnect}
                isLoading={tool.isLoading}
                error={tool.error}
              />
            );
          })}
        </div>

        {authenticatedCount > 0 && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="font-medium text-green-900 dark:text-green-100">
                  Authentication Active
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your tools are connected and ready to provide real-time data.
                  API requests are authenticated and secure.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-muted">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Security:</strong> All authentication tokens are encrypted
              with AES-256-GCM and never stored in browser storage.
            </p>
            <p>
              <strong>Permissions:</strong> Only the minimum required
              permissions are requested for each tool.
            </p>
            <p>
              <strong>Data Usage:</strong> Your tool credentials are only used
              for Hyperpage functionality and not shared with third parties.
            </p>
          </div>
        </div>
      </CardContent>
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
