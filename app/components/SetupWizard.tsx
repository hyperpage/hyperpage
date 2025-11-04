"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  AlertCircle,
} from "lucide-react";

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

const initialTools: ToolConfig[] = [
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
];

export default function SetupWizard() {
  const [tools, setTools] = useState<ToolConfig[]>(initialTools);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    checkConfigurationStatus();
  }, []);

  const checkConfigurationStatus = async () => {
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
      
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStepIcon = (status: SetupStep["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "checking":
        return (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        );
      default:
        return (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        );
    }
  };

  const renderQuickStart = () => (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚀 Quick Start Guide
        </CardTitle>
        <CardDescription>
          Get Hyperpage running in 4 simple steps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1 */}
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
            1
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Clone and install</h3>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-sm">
              <div>git clone https://github.com/hyperpage/hyperpage.git</div>
              <div>cd hyperpage</div>
              <div>npm install</div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
            2
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Configure environment</h3>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-sm">
              <div>cp .env.local.sample .env.local</div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Edit <code className="bg-gray-100 px-1 rounded">.env.local</code>{" "}
              to enable your first tool (GitHub recommended)
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
            3
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Start development server</h3>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-sm">
              <div>npm run dev</div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
            4
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Open your portal</h3>
            <p className="text-sm text-gray-600 mb-2">
              Visit{" "}
              <a
                href="http://localhost:3000"
                className="text-blue-600 hover:underline"
              >
                http://localhost:3000
              </a>{" "}
              to see your data!
            </p>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Make sure to configure at least one tool in your{" "}
                <code>.env.local</code> file first.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderToolSetup = () => (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Tool Configuration
        </CardTitle>
        <CardDescription>
          Configure your development tools to start seeing data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {tools.map((tool) => (
          <div key={tool.name} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">{tool.name}</h3>
                <Badge variant={tool.enabled ? "default" : "secondary"}>
                  {tool.enabled ? "Configured" : "Not Configured"}
                </Badge>
              </div>
              {tool.enabled && (
                <CheckCircle className="h-6 w-6 text-green-500" />
              )}
            </div>

            <div className="space-y-3">
              {tool.setupSteps.map((step) => (
                <div key={step.id} className="flex items-start gap-3">
                  {getStepIcon(step.status)}
                  <div className="flex-1">
                    <h4 className="font-medium">{step.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      {step.description}
                    </p>
                    {step.action && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (step.link) {
                              window.open(step.link, "_blank");
                            }
                          }}
                        >
                          {step.link ? (
                            <>
                              <ExternalLink className="h-4 w-4 mr-1" />
                              {step.action}
                            </>
                          ) : (
                            step.action
                          )}
                        </Button>
                        {step.link && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(step.link!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!tool.enabled && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">
                  Configuration Example:
                </h4>
                <div className="bg-blue-900 text-blue-100 p-2 rounded font-mono text-sm relative">
                  <button
                    onClick={() => copyToClipboard(getExampleConfig(tool.name))}
                    className="absolute top-2 right-2 text-blue-300 hover:text-blue-100"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <pre className="pr-8">{getExampleConfig(tool.name)}</pre>
                </div>
              </div>
            )}
          </div>
        ))}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Pro tip:</strong> Start with GitHub for the quickest setup.
            Add other tools later once you see the portal working.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );

  const getExampleConfig = (toolName: string): string => {
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
  };

  if (isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-4">
            🎉 Configuration Complete!
          </h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Your tools are configured and Hyperpage is ready to use.
          </p>
          <Button onClick={checkConfigurationStatus} size="lg">
            Refresh Status
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Welcome to Hyperpage
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Let&amp;apos;s get you set up in just a few simple steps. Follow the
            guide below to start aggregating your development data.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {renderQuickStart()}
          {renderToolSetup()}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>
            Need help? Check the{" "}
            <a
              href="https://github.com/hyperpage/hyperpage"
              className="text-blue-600 hover:underline"
            >
              documentation
            </a>{" "}
            or{" "}
            <a
              href="https://github.com/hyperpage/hyperpage/issues"
              className="text-blue-600 hover:underline"
            >
              open an issue
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
