"use client";

import AuthButton from "@/app/components/AuthButton";
import { getToolIcon } from "@/tools";

interface AuthTool {
  toolSlug: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthToolListProps {
  tools: AuthTool[];
  isConfigured: (toolSlug: string) => boolean;
  onAuthenticate: (toolSlug: string) => void;
  onDisconnect: (toolSlug: string) => void;
}

export default function AuthToolList({
  tools,
  isConfigured,
  onAuthenticate,
  onDisconnect,
}: AuthToolListProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {tools.map((tool) => {
        const toolIcon = getToolIcon(tool.toolSlug);
        const formattedName =
          tool.toolSlug.charAt(0).toUpperCase() + tool.toolSlug.slice(1);

        return (
          <AuthButton
            key={tool.toolSlug}
            toolName={formattedName}
            toolSlug={tool.toolSlug}
            toolIcon={toolIcon}
            isAuthenticated={tool.isAuthenticated}
            isConfigured={isConfigured(tool.toolSlug)}
            onAuthenticate={onAuthenticate}
            onDisconnect={onDisconnect}
            isLoading={tool.isLoading}
            error={tool.error}
          />
        );
      })}
    </div>
  );
}
