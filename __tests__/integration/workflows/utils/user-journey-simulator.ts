/**
 * User Journey Simulator for End-to-End Testing
 *
 * Simulates complex user workflows and interactions across multiple tools
 * and authentication providers.
 */

import {
  TEST_CREDENTIALS,
  OAuthTestCredentials,
} from "../../../shared/test-credentials";
import { TestBrowser } from "./test-browser";

export interface OAuthResult {
  success: boolean;
  redirectUrl: string;
  error?: string;
}

export interface ToolConfiguration {
  username?: string;
  repository?: string;
  project?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface DataVerificationResult {
  hasData: boolean;
  dataItems: number;
  lastUpdate: number;
  errors?: string[];
}

export interface MultiToolAggregationResult {
  success: boolean;
  providersData: Array<{
    provider: string;
    hasData: boolean;
    itemCount: number;
  }>;
  errors?: string[];
}

export interface UserPreferences {
  theme: "light" | "dark";
  refreshInterval: number;
  dashboardLayout: "grid" | "list";
}

export interface ToolDataItem {
  id: string;
  title: string;
  created_at: string;
  [key: string]: string | number | boolean;
}

export interface ToolData {
  items: ToolDataItem[];
  lastUpdate: number;
}

export interface OverviewData {
  github: ToolData;
  gitlab: ToolData;
  jira: ToolData;
}

export class UserJourneySimulator {
  private baseUrl: string;
  private browser: TestBrowser;
  private connectedProviders: Set<string> = new Set();
  private userPreferences: UserPreferences = {
    theme: "light",
    refreshInterval: 300000, // 5 minutes
    dashboardLayout: "grid",
  };

  constructor(baseUrl: string, browser: TestBrowser) {
    this.baseUrl = baseUrl;
    this.browser = browser;
  }

  /**
   * Complete OAuth flow for a provider
   */
  async completeOAuthFlow(
    provider: string,
    credentials: OAuthTestCredentials = TEST_CREDENTIALS.oauth as OAuthTestCredentials,
  ): Promise<OAuthResult> {
    try {
      // Check for invalid credentials
      if (!credentials.clientId || credentials.clientId.length === 0) {
        return {
          success: false,
          redirectUrl: "",
          error: "Invalid OAuth credentials",
        };
      }

      // Simulate OAuth redirect
      const redirectUrl = `${this.baseUrl}/api/auth/${provider}/callback?code=test-auth-code&state=test-state`;

      // Set authentication state
      this.browser.setSessionData("authenticated", true);
      this.browser.setSessionData(`oauth_${provider}`, credentials);
      this.connectedProviders.add(provider);

      return {
        success: true,
        redirectUrl: redirectUrl,
      };
    } catch (error) {
      return {
        success: false,
        redirectUrl: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Add additional provider to existing session
   */
  async addProvider(
    provider: string,
    credentials: OAuthTestCredentials = TEST_CREDENTIALS.oauth as OAuthTestCredentials,
  ): Promise<OAuthResult> {
    if (!this.browser.getSessionData("authenticated")) {
      return {
        success: false,
        redirectUrl: "",
        error: "Not authenticated",
      };
    }

    try {
      // Add provider to existing session
      this.browser.setSessionData(`oauth_${provider}`, credentials);
      this.connectedProviders.add(provider);

      return {
        success: true,
        redirectUrl: this.baseUrl,
      };
    } catch (error) {
      return {
        success: false,
        redirectUrl: "",
        error:
          error instanceof Error ? error.message : "Failed to add provider",
      };
    }
  }

  /**
   * Enable a tool for the current user
   */
  async enableTool(tool: string): Promise<void> {
    this.browser.setSessionData(`enabled_tool_${tool}`, true);
  }

  /**
   * Configure a tool with specific settings
   */
  async configureTool(tool: string, config: ToolConfiguration): Promise<void> {
    this.browser.setSessionData(`tool_config_${tool}`, config);
  }

  /**
   * Verify tool data availability and quality
   */
  async verifyToolData(tool: string): Promise<DataVerificationResult> {
    const isEnabled = this.browser.getSessionData(`enabled_tool_${tool}`);
    if (!isEnabled) {
      return {
        hasData: false,
        dataItems: 0,
        lastUpdate: 0,
        errors: [`Tool ${tool} is not enabled`],
      };
    }

    // Simulate data loading
    const dataItems = Math.floor(Math.random() * 10); // 0-9 items
    const lastUpdate = Date.now();

    const mockData: ToolData = {
      items: Array.from({ length: dataItems }, (_, i) => ({
        id: `${tool}-item-${i}`,
        title: `${tool} Item ${i}`,
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
      })),
      lastUpdate,
    };

    this.browser.setSessionData(`tool_${tool}_data`, mockData);

    return {
      hasData: dataItems > 0,
      dataItems,
      lastUpdate,
      errors: dataItems === 0 ? [`No data available for ${tool}`] : [],
    };
  }

  /**
   * Get list of connected providers
   */
  async getConnectedProviders(): Promise<string[]> {
    return Array.from(this.connectedProviders);
  }

  /**
   * Verify multi-tool data aggregation
   */
  async verifyMultiToolAggregation(): Promise<MultiToolAggregationResult> {
    const providers = Array.from(this.connectedProviders);
    const providersData = [];

    for (const provider of providers) {
      const result = await this.verifyToolData(provider);
      providersData.push({
        provider,
        hasData: result.hasData,
        itemCount: result.dataItems,
      });
    }

    return {
      success: providersData.length > 0,
      providersData,
      errors: providersData.some((p) => !p.hasData)
        ? ["Some providers have no data"]
        : [],
    };
  }

  /**
   * Set user preferences
   */
  async setUserPreferences(
    preferences: Partial<UserPreferences>,
  ): Promise<void> {
    this.userPreferences = { ...this.userPreferences, ...preferences };
    this.browser.setSessionData("user_preferences", this.userPreferences);
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<UserPreferences> {
    const stored = this.browser.getSessionData(
      "user_preferences",
    ) as UserPreferences | null;
    return stored || this.userPreferences;
  }

  /**
   * Get overview data across all tools
   */
  async getOverviewData(): Promise<OverviewData> {
    const providers = ["github", "gitlab", "jira"];
    const overview: OverviewData = {
      github: { items: [], lastUpdate: 0 },
      gitlab: { items: [], lastUpdate: 0 },
      jira: { items: [], lastUpdate: 0 },
    };

    for (const provider of providers) {
      if (this.connectedProviders.has(provider)) {
        const toolData = this.browser.getSessionData(
          `tool_${provider}_data`,
        ) as ToolData | null;
        if (toolData) {
          overview[provider as keyof OverviewData] = toolData;
        }
      }
    }

    return overview;
  }

  /**
   * Get tool-specific data
   */
  async getToolData(tool: string): Promise<ToolData> {
    const toolData = this.browser.getSessionData(
      `tool_${tool}_data`,
    ) as ToolData | null;
    return toolData || { items: [], lastUpdate: 0 };
  }

  /**
   * Simulate setup wizard interactions
   */
  async completeSetupWizard(
    provider: string,
    credentials: OAuthTestCredentials = TEST_CREDENTIALS.oauth as OAuthTestCredentials,
  ): Promise<boolean> {
    try {
      // Step 1: Provider selection
      this.browser.setSessionData("setup_selected_providers", [provider]);

      // Step 2: OAuth authentication
      const authResult = await this.completeOAuthFlow(provider, credentials);
      if (!authResult.success) {
        return false;
      }

      // Step 3: Configuration
      await this.enableTool(provider);

      // Step 4: Completion
      this.browser.setSessionData("setup_completed", true);
      this.browser.setSessionData(
        "setup_redirect",
        `${this.baseUrl}/dashboard`,
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get setup wizard page
   */
  async getSetupWizard(): Promise<SetupWizardPage> {
    return new SetupWizardPage(this.browser);
  }
}

/**
 * Mock Setup Wizard Page Object
 */
export class SetupWizardPage {
  constructor(private browser: TestBrowser) {}

  async isSetupWizard(): Promise<boolean> {
    return true;
  }

  async selectProviders(providers: string[]): Promise<void> {
    this.browser.setSessionData("setup_selected_providers", providers);
  }

  async continue(): Promise<void> {
    const selectedProviders = this.browser.getSessionData(
      "setup_selected_providers",
    ) as string[] | null;
    if (!selectedProviders || selectedProviders.length === 0) {
      throw new Error("No providers selected");
    }
  }

  async startOAuth(provider: string): Promise<void> {
    this.browser.setSessionData("setup_oauth_started", provider);
  }

  async configureProvider(
    provider: string,
    config: ToolConfiguration,
  ): Promise<void> {
    this.browser.setSessionData(`setup_${provider}_config`, config);
  }

  async completeSetup(): Promise<boolean> {
    this.browser.setSessionData("setup_completed", true);
    return true;
  }
}
