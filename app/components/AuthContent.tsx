"use client";

import { Shield, CheckCircle } from "lucide-react";

import { CardContent } from "@/components/ui/card";
import AuthCallout from "@/app/components/AuthCallout";
import AuthToolList from "@/app/components/AuthToolList";

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
    <CardContent className="pt-0 space-y-6">
      {authenticatedCount === 0 && (
        <AuthCallout
          variant="info"
          icon={<Shield className="text-blue-600 dark:text-blue-400" />}
          title="Get Started"
          description="Connect your tools to access real-time data synchronization and personalized insights. Authentication is secure and encrypted."
        />
      )}

      <AuthToolList
        tools={tools}
        isConfigured={isConfigured}
        onAuthenticate={authenticate}
        onDisconnect={disconnect}
      />

      {authenticatedCount > 0 && (
        <AuthCallout
          variant="success"
          icon={<CheckCircle className="text-green-600 dark:text-green-400" />}
          title="Authentication Active"
          description="Your tools are connected and ready to provide real-time data. API requests are authenticated and secure."
        />
      )}
    </CardContent>
  );
}
