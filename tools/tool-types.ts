import React from "react";

// Tool registry and generic interfaces

export interface TransformedIssue {
  ticket: string;
  id?: string; // Optional display ID for DataTable (added by ticketing aggregator)
  url: string;
  title: string;
  status: string;
  assignee: string;
  tool?: string; // Optional source tool name (added by ticketing aggregator)
  created: string;
  created_display: string;
  type: string;
}

export interface ToolData {
  [key: string]: React.ReactNode | string | number | null | undefined;
}

export interface ToolWidget {
  title: string;
  type: "metric" | "chart" | "table" | "feed";
  data: ToolData[];
  headers?: string[];
  component?: React.ComponentType<ToolWidget>;
  dynamic?: boolean; // Indicates if widget data needs to be loaded dynamically
  refreshInterval?: number; // Auto-refresh interval in milliseconds (e.g., 300000 = 5 minutes)
  displayName?: string; // Optional display name for widgets (replaces default tool name)
  apiEndpoint?: string; // Specifies which API endpoint this widget consumes (for widget-specific data fetching)
}

export interface ToolApiResponse {
  dataKey: string; // The key in the API response that contains the array data
  description: string;
}

export interface ToolApi {
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  parameters?: Record<
    string,
    {
      type: string;
      required: boolean;
      description: string;
    }
  >;
  response?: ToolApiResponse;
}

export interface ToolApiHandler {
  (request: Request, config: ToolConfig): Promise<Record<string, unknown>>;
}

export interface ToolIntegration {
  name: string;
  enabled: boolean;
  icon: React.ReactNode;
  status: "connected" | "connecting" | "error" | "disabled";
}

export interface ToolUI {
  color: string;
  icon: React.ReactNode;
}

export interface ToolValidation {
  required: string[]; // Required environment variable names
  optional: string[]; // Optional environment variable names
  description: string; // Human-readable description of requirements
  urlPatterns?: {
    // Patterns for URL validation
    webUrl?: RegExp;
    apiUrl?: RegExp;
  };
}

export interface ToolConfig {
  apiUrl?: string;
  webUrl?: string;
  headers?: Record<string, string>;
  formatApiUrl?: (webUrl: string) => string; // Tool-owned URL formatter
  getWebUrl?: () => string; // Optional default web URL provider
  [key: string]: unknown;
}

export interface Tool {
  name: string;
  slug: string; // URL-safe identifier for the tool
  enabled: boolean;
  ui: ToolUI;
  widgets: ToolWidget[];
  apis: Record<string, ToolApi>;
  handlers: Record<string, ToolApiHandler>;
  config?: ToolConfig;
  capabilities?: string[]; // Optional list of capabilities this tool provides
  validation?: ToolValidation; // Tool-owned validation requirements
}

export interface ToolRegistry {
  [key: string]: Tool | undefined;
}

// Activity content types
export interface BaseContentItem {
  type: 'commit' | 'comment' | 'description' | 'change';
  text: string;
  author?: string;
  timestamp?: string;
}

export interface CommitContentItem extends BaseContentItem {
  type: 'commit';
  url?: string;
  displayId?: string; // SHA for commits
}

export interface DescriptionContentItem extends BaseContentItem {
  type: 'description';
  url?: string;
  displayId?: string;
}

export interface CommentContentItem extends BaseContentItem {
  type: 'comment';
  url?: string;
  displayId?: string;
}

export interface ChangeContentItem extends BaseContentItem {
  type: 'change';
  url?: string;
  displayId?: string;
}

export type ContentItem = CommitContentItem | DescriptionContentItem | CommentContentItem | ChangeContentItem;
