"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GitMerge,
  GitPullRequest,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { getToolIcon } from "../../tools";
import ActivitySkeleton from "./ActivitySkeleton";

interface ActivityItem {
  id: string;
  tool: string;
  action: string;
  details: string;
  author: string;
  timestamp: Date;
  time: string; // formatted like "5m ago"
  color: string;
  url: string;
  displayId: string;
  // Extended metadata fields
  repository?: string;
  branch?: string;
  commitCount?: number;
  status?: string;
  assignee?: string;
  labels?: string[];
  // New rich content fields
  content?: Array<{
    type: 'commit' | 'comment' | 'description' | 'change';
    text: string;
    url?: string;
    displayId?: string;
    author?: string;
    timestamp?: string;
  }>;
  description?: string;
  changes?: Array<{
    field: string;
    from: string;
    to: string;
  }>;
}

// Extended activity response from API
interface ApiActivityItem {
  id: string;
  tool: string;
  toolIcon: string;
  action: string;
  description: string;
  author: string;
  time: string;
  color: string;
  timestamp: string;
  url: string;
  displayId: string;
  // Extended metadata fields
  repository?: string;
  branch?: string;
  commitCount?: number;
  status?: string;
  assignee?: string;
  labels?: string[];
  // New rich content fields
  content?: Array<{
    type: 'commit' | 'comment' | 'description' | 'change';
    text: string;
    url?: string;
    displayId?: string;
    author?: string;
    timestamp?: string;
  }>;
  itemDescription?: string;
  changes?: Array<{
    field: string;
    from: string;
    to: string;
  }>;
}

interface LivefeedProps {
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function Livefeed({
  onRefresh,
  isLoading: externalIsLoading = false,
}: LivefeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Combined loading state from both internal and external sources
  const combinedIsLoading = isLoading || externalIsLoading;

  // Fetch activities function for initial load
  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/tools/activity");

      if (!response.ok) {
        throw new Error("Failed to fetch activity data");
      }

      const data = await response.json();

      // Transform API response to component format
      const transformedActivities: ActivityItem[] = (data.activity || []).map(
        (item: ApiActivityItem) => ({
          id: item.id,
          tool: item.tool,
          action: item.action,
          details: item.description,
          author: item.author,
          timestamp: new Date(item.timestamp || new Date()),
          time: item.time,
          color: item.color,
          url: item.url,
          displayId: item.displayId,
          // Extended metadata fields
          repository: item.repository,
          branch: item.branch,
          commitCount: item.commitCount,
          status: item.status,
          assignee: item.assignee,
          labels: item.labels,
          // New rich content fields
          content: item.content,
          description: item.itemDescription,
          changes: item.changes,
        }),
      );



      setActivities(transformedActivities);
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load activities",
      );
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh activities function that keeps old data visible during loading
  const refreshActivities = useCallback(async () => {
    if (isRefreshing) return; // Prevent multiple concurrent refreshes

    try {
      setIsRefreshing(true);
      setError(null);
      const response = await fetch("/api/tools/activity");

      if (!response.ok) {
        throw new Error("Failed to refresh activity data");
      }

      const data = await response.json();

      // Transform API response to component format
      const transformedActivities: ActivityItem[] = (data.activity || []).map(
        (item: ApiActivityItem) => ({
          id: item.id,
          tool: item.tool,
          action: item.action,
          details: item.description,
          author: item.author,
          timestamp: new Date(item.timestamp || new Date()),
          time: item.time,
          color: item.color,
          url: item.url,
          displayId: item.displayId,
          // Extended metadata fields
          repository: item.repository,
          branch: item.branch,
          commitCount: item.commitCount,
          status: item.status,
          assignee: item.assignee,
          labels: item.labels,
          // New rich content fields
          content: item.content,
          description: item.itemDescription,
          changes: item.changes,
        }),
      );

      setActivities(transformedActivities);
    } catch (err) {
      console.error("Error refreshing activities:", err);
      setError(
        err instanceof Error ? err.message : "Failed to refresh activities",
      );
      // Don't clear activities on refresh error - keep old data visible
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  useEffect(() => {
    fetchActivities();
  }, []);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case "green":
        return "text-green-600";
      case "red":
        return "text-red-600";
      case "purple":
        return "text-purple-600";
      case "orange":
        return "text-orange-600";
      default:
        return "text-blue-600";
    }
  };

  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes("merge") || actionLower.includes("closed")) {
      return <GitMerge className="h-4 w-4" />;
    }
    if (
      actionLower.includes("pull") ||
      actionLower.includes("request") ||
      actionLower.includes("pr")
    ) {
      return <GitPullRequest className="h-4 w-4" />;
    }
    if (actionLower.includes("comment") || actionLower.includes("message")) {
      return <MessageSquare className="h-4 w-4" />;
    }
    if (actionLower.includes("fail") || actionLower.includes("error")) {
      return <XCircle className="h-4 w-4" />;
    }
    if (actionLower.includes("success") || actionLower.includes("pass")) {
      return <CheckCircle className="h-4 w-4" />;
    }
    if (actionLower.includes("warning") || actionLower.includes("alert")) {
      return <AlertCircle className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  const getActionBadgeVariant = (color: string) => {
    switch (color) {
      case "green":
        return "secondary" as const;
      case "red":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  // Only show skeletons during initial loading, not during refresh operations
  if (isLoading && !isRefreshing && !externalIsLoading) {
    return (
      <div className="max-w-4xl mx-auto relative">
        {/* Refresh button during initial loading */}
        {onRefresh && (
          <div className="flex justify-end mb-6">
            <Button
              variant="outline"
              size="sm"
              disabled={true}
              title="Refresh activity data"
            >
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </Button>
          </div>
        )}

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <ActivitySkeleton key={i} index={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-red-600">Error loading activity: {error}</p>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="mt-4"
              title="Retry loading activity data"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Quick status indicator */}
      <div className="mb-4 text-xs text-muted-foreground text-center">
        {activities.length} activities loaded • {activities.filter(a => a.content && a.content.length > 0).length} with enhanced content
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <div className="flex justify-end mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refreshActivities();
              onRefresh();
            }}
            disabled={isRefreshing || combinedIsLoading}
            title="Refresh activity data"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      )}

      {/* Timeline container */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>

        {/* Activity items */}
        <div className="space-y-6">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className={`relative flex items-start gap-4 group ${
                index % 4 === 0
                  ? "animate-fade-in-up"
                  : index % 4 === 1
                    ? "animate-fade-in-up-delay-1"
                    : index % 4 === 2
                      ? "animate-fade-in-up-delay-2"
                      : "animate-fade-in-up-delay-3"
              }`}
            >
              {/* Timeline dot with icon */}
              <div
                className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-background bg-muted group-hover:scale-110 transition-transform duration-200 ${getColorClass(activity.color)}`}
              >
                <div className="text-lg">{getToolIcon(activity.tool)}</div>
              </div>

              {/* Activity content */}
              <div className="flex-1 pb-6">
                <Card className="p-6 transition-all duration-200 border-l-4 border-l-transparent group-hover:border-l-primary/20">
                  <div className="space-y-3">
                    {/* Header: Action + Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={getActionBadgeVariant(activity.color)}
                          className="flex items-center gap-1.5"
                        >
                          {getActionIcon(activity.action)}
                          <span className="font-medium capitalize">
                            {activity.action}
                          </span>
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {activity.time ||
                            formatRelativeTime(activity.timestamp)}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activity.tool}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="text-foreground font-medium">
                          {activity.details}
                        </p>
                        {/* Display ID as hyperlink if available */}
                        {activity.displayId && activity.url && (
                          <a
                            href={activity.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-mono text-primary hover:underline ml-4 flex-shrink-0"
                          >
                            {activity.displayId}
                          </a>
                        )}
                      </div>

                      {/* Contextual metadata */}
                      {(activity.repository ||
                        activity.branch ||
                        activity.commitCount ||
                        activity.status ||
                        activity.assignee ||
                        (activity.labels && activity.labels.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {/* Repository */}
                          {activity.repository && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Repo:</span>
                              <Badge
                                variant="outline"
                                className="text-xs px-2 py-0.5"
                              >
                                {activity.repository}
                              </Badge>
                            </span>
                          )}

                          {/* Branch */}
                          {activity.branch && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Branch:</span>
                              <Badge
                                variant="secondary"
                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                              >
                                {activity.branch}
                              </Badge>
                            </span>
                          )}

                          {/* Commit Count */}
                          {activity.commitCount && activity.commitCount > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Commits:</span>
                              <Badge
                                variant="outline"
                                className="text-xs px-2 py-0.5"
                              >
                                {activity.commitCount}
                              </Badge>
                            </span>
                          )}

                          {/* Status */}
                          {activity.status && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Status:</span>
                              <Badge
                                variant={
                                  activity.status.toLowerCase() === "open" ||
                                  activity.status.toLowerCase() === "merged"
                                    ? "default"
                                    : activity.status.toLowerCase() === "closed"
                                      ? "secondary"
                                      : "outline"
                                }
                                className={`text-xs px-2 py-0.5 ${
                                  activity.status.toLowerCase() === "open"
                                    ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700"
                                    : activity.status.toLowerCase() === "closed"
                                      ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700"
                                      : activity.status.toLowerCase() ===
                                          "merged"
                                        ? "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700"
                                        : ""
                                }`}
                              >
                                {activity.status}
                              </Badge>
                            </span>
                          )}

                          {/* Assignee */}
                          {activity.assignee &&
                            activity.assignee !== activity.author && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Assigned:</span>
                                <Badge
                                  variant="outline"
                                  className="text-xs px-2 py-0.5"
                                >
                                  {activity.assignee}
                                </Badge>
                              </span>
                            )}

                          {/* Labels */}
                          {activity.labels && activity.labels.length > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Labels:</span>
                              <div className="flex gap-1">
                                {activity.labels
                                  .slice(0, 3)
                                  .map((label, index) => (
                                    <Badge
                                      key={index}
                                      variant="outline"
                                      className="text-xs px-2 py-0.5"
                                    >
                                      {label}
                                    </Badge>
                                  ))}
                                {activity.labels.length > 3 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-2 py-0.5"
                                  >
                                    +{activity.labels.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Rich content (commits, descriptions, comments) */}
                      {activity.content && activity.content.length > 0 && (
                        <div className="space-y-3 mt-4">
                          {activity.content.slice(0, 3).map((contentItem, contentIndex) => (
                            <div key={contentIndex} className="space-y-2">
                              {contentItem.type === 'commit' && (
                                <div className="bg-muted/30 rounded-lg p-3 border-l-2 border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                      <span className="text-xs">📝</span>
                                    </div>
                                    {contentItem.author && contentItem.author !== activity.author && (
                                      <span>{contentItem.author}</span>
                                    )}
                                  </div>
                                  <div className="flex items-start justify-between">
                                    <p className="text-sm text-foreground font-mono leading-relaxed flex-1">
                                      {contentItem.text}
                                    </p>
                                    {/* Commit displayId as hyperlink if available */}
                                    {contentItem.displayId && contentItem.url && (
                                      <a
                                        href={contentItem.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-mono text-primary hover:underline ml-4 flex-shrink-0"
                                      >
                                        {contentItem.displayId}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}

                              {contentItem.type === 'description' && (
                                <div className="bg-muted/20 rounded-lg p-3 border-l-2 border-green-200 dark:border-green-800">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                      <span className="text-xs">📄</span>
                                    </div>
                                    <span>Description</span>
                                  </div>
                                  <div className="text-sm text-foreground leading-relaxed max-w-none break-words">
                                    {contentItem.text}
                                  </div>
                                </div>
                              )}

                              {contentItem.type === 'comment' && (
                                <div className="bg-muted/25 rounded-lg p-3 border-l-2 border-purple-200 dark:border-purple-800">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                                      <span className="text-xs">💬</span>
                                    </div>
                                    {contentItem.author && (
                                      <span>{contentItem.author}</span>
                                    )}
                                  </div>
                                  <div className="text-sm text-foreground leading-relaxed max-w-none break-words">
                                    {contentItem.text}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {activity.content.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center bg-muted/10 rounded-lg py-2">
                              +{activity.content.length - 3} more items
                            </div>
                          )}
                        </div>
                      )}

                      {/* Author info */}
                      {activity.author && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                            {activity.author.charAt(0).toUpperCase()}
                          </div>
                          <span>by {activity.author}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ))}

          {activities.length === 0 && (
            <div className="text-center py-12 col-span-full">
              <p className="text-muted-foreground">
                No recent activity to display.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Enable tools like GitHub, GitLab, or Jira to see activity here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
