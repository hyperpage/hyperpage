// hooks/useSetupWizard.ts
import { useState, useEffect, useCallback } from "react";

import logger from "@/lib/logger";
import type { ClientSafeTool } from "@/tools/tool-types";
import { getEnvFileName } from "@/lib/config/env-file";

const envConfigFileName = getEnvFileName();

interface CoreConfigStatus {
  envFile: string;
  fileExists: boolean;
  missingVariables: string[];
  isReady: boolean;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "checking" | "success" | "error";
  action?: string;
  link?: string;
}

interface ToolEnvStatus {
  name: string;
  slug: string;
  enabled: boolean;
  missingEnv: string[];
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
  coreStatus: CoreConfigStatus | null;
  readyTool: boolean;
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
          action: `Edit ${envConfigFileName} file`,
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
          action: `Edit ${envConfigFileName} file`,
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
          action: `Edit ${envConfigFileName} file`,
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
  const [coreStatus, setCoreStatus] = useState<CoreConfigStatus | null>(null);
  const [readyTool, setReadyTool] = useState(false);

  const checkConfigurationStatus = useCallback(async () => {
    try {
      const [toolsResponse, configResponse] = await Promise.all([
        fetch("/api/tools/enabled"),
        fetch("/api/config/status"),
      ]);

      const toolsData = (await toolsResponse.json()) as {
        enabledTools?: ClientSafeTool[];
      };
      const configData = (await configResponse.json()) as {
        coreStatus?: CoreConfigStatus;
        toolStatuses?: ToolEnvStatus[];
        hasReadyTool?: boolean;
      };

      const enabledTools = toolsData.enabledTools ?? [];
      const enabledSlugs = new Set(
        enabledTools.map((tool) => tool.slug.toLowerCase()),
      );
      const enabledNames = new Set(
        enabledTools.map((tool) => tool.name.toLowerCase()),
      );

      // Update tools based on current configuration
      const toolStatusMap = new Map<string, ToolEnvStatus>(
        (configData.toolStatuses ?? []).flatMap((status) => [
          [status.name.toLowerCase(), status] as [string, ToolEnvStatus],
          [status.slug.toLowerCase(), status] as [string, ToolEnvStatus],
        ]),
      );

      setTools((prevTools) =>
        prevTools.map((tool) => {
          const normalizedName = tool.name.toLowerCase();
          const normalizedSlug = normalizedName.replace(/\s+/g, "-");
          const isEnabled =
            enabledSlugs.has(normalizedName) ||
            enabledSlugs.has(normalizedSlug) ||
            enabledNames.has(normalizedName);
          const envStatus = toolStatusMap.get(normalizedName);
          const envReady =
            envStatus?.enabled && (envStatus?.missingEnv.length ?? 0) === 0;

          return {
            ...tool,
            enabled: Boolean(envReady),
            setupSteps: tool.setupSteps.map((step) => {
              if (step.id === "env-config") {
                let description = step.description;
                if (envStatus && envStatus.missingEnv.length > 0) {
                  description = `Missing variables: ${envStatus.missingEnv.join(", ")}`;
                }

                return {
                  ...step,
                  description,
                  status: envReady
                    ? "success"
                    : envStatus?.enabled
                      ? "error"
                      : "pending",
                };
              }

              return {
                ...step,
                status: envReady || isEnabled ? "success" : "pending",
              };
            }),
          };
        }),
      );

      setCoreStatus(configData.coreStatus ?? null);
      setReadyTool(configData.hasReadyTool ?? false);

      const hasToolConfigured =
        configData.hasReadyTool === true || enabledTools.length > 0;
      setIsConfigured(
        (configData.coreStatus?.isReady ?? false) && hasToolConfigured,
      );
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
    coreStatus,
    readyTool,
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
