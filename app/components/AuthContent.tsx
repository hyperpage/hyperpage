"use client";

import { Shield, CheckCircle } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import AuthButton from "@/app/components/AuthButton";
import { getToolIcon } from "@/tools";

interface Tool {
  toolSlug: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthContentProps {
  tools: Tool[];
  isConfigured: (toolSlug: string) => boolean;
  authenticate: (toolSlug: string) => void;
  disconnect: (toolSlug: string) => void;
  authenticatedCount: number;
}

export default function AuthContent({
  tools,
  isConfigured,
  authenticate,
  disconnect,
  authenticatedCount,
}: AuthContentProps) {
  return (
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
    </CardContent>
  );
}
