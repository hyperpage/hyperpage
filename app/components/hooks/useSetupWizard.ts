// hooks/useSetupWizard.ts
import { useState, useEffect, useCallback } from "react";
import logger from "@/lib/logger";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "checking" | "success" | "error";
  action?: string;
  link?: string;
}

interface ToolConfig {
  name: string;
  enabled: boolean;
  required: boolean;
  setupSteps: SetupStep[];
  tokenUrl?: string;
  docsUrl?: string;
}

interface UseSetupWizardReturn {
  tools: ToolConfig[];
  isConfigured: boolean;
  checkConfigurationStatus: () => Promise<void>;
  copyToClipboard: (text: string) => void;
}

export function useSetupWizard(): UseSetupWizardReturn {
  const [tools, setTools] = useState<ToolConfig[]>([
    {
      name: "GitHub",
      enabled: false,
      required: false,
      setupSteps: [
        {
          id: "env-config",
          title: "Configure environment variables",
          description: "Set ENABLE_GITHUB=true and add your token",
          status: "pending",
          action: "Edit .env.local file",
        },
        {
          id: "get-token",
          title: "Get GitHub Personal Access Token",
          description: "Visit GitHub settings to create a new token",
          status: "pending",
          link: "https://github.com/settings/tokens",
          action: "Open GitHub Settings",
        },
      ],
      tokenUrl: "https://github.com/settings/tokens",
      docsUrl:
        "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token",
    },
    {
      name: "GitLab",
      enabled: false,
      required: false,
      setupSteps: [
        {
          id: "env-config",
          title: "Configure environment variables",
          description: "Set ENABLE_GITLAB=true and add your token",
          status: "pending",
          action: "Edit .env.local file",
        },
        {
          id: "get-token",
          title: "Get GitLab Personal Access Token",
          description: "Visit GitLab settings to create a new token",
          status: "pending",
          link: "https://gitlab.com/-/profile/personal_access_tokens",
          action: "Open GitLab Settings",
        },
      ],
      tokenUrl: "https://gitlab.com/-/profile/personal_access_tokens",
      docsUrl:
        "https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html",
    },
    {
      name: "Jira",
      enabled: false,
      required: false,
      setupSteps: [
        {
          id: "env-config",
          title: "Configure environment variables",
          description: "Set ENABLE_JIRA=true and add your credentials",
          status: "pending",
          action: "Edit .env.local file",
        },
        {
          id: "get-token",
          title: "Get Jira API Token",
          description: "Visit Atlassian to create an API token",
          status: "pending",
          link: "https://id.atlassian.com/manage-profile/security/api-tokens",
          action: "Open Atlassian",
        },
      ],
      tokenUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
      docsUrl:
        "https://support.atlassian.com/atlassian-account/docs/managing-api-tokens/",
    },
  ]);
  const [isConfigured, setIsConfigured] = useState(false);

  const checkConfigurationStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/tools/enabled");
      const data = await response.json();

      // Update tools based on current configuration
      setTools((prevTools) =>
        prevTools.map((tool) => ({
          ...tool,
          enabled:
            data.enabledTools?.includes(tool.name.toLowerCase()) || false,
          setupSteps: tool.setupSteps.map((step) => ({
            ...step,
            status: tool.enabled ? "success" : "pending",
          })),
        })),
      );

      const hasEnabledTools = data.enabledTools && data.enabledTools.length > 0;
      setIsConfigured(hasEnabledTools);
    } catch (error) {
      logger.error("Failed to check configuration status", { error });
    }
  }, []);

  useEffect(() => {
    checkConfigurationStatus();
  }, [checkConfigurationStatus]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  return {
    tools,
    isConfigured,
    checkConfigurationStatus,
    copyToClipboard,
  };
}

export function getExampleConfig(toolName: string): string {
  switch (toolName.toLowerCase()) {
    case "github":
      return `ENABLE_GITHUB=true
GITHUB_TOKEN=ghp_your_personal_access_token_here
GITHUB_USERNAME=your_github_username`;
    case "gitlab":
      return `ENABLE_GITLAB=true
GITLAB_WEB_URL=https://gitlab.com
GITLAB_TOKEN=glpat_your_token_here`;
    case "jira":
      return `ENABLE_JIRA=true
JIRA_WEB_URL=https://your-company.atlassian.net
JIRA_EMAIL=your_email@company.com
JIRA_API_TOKEN=your_jira_api_token`;
    default:
      return "";
  }
}
