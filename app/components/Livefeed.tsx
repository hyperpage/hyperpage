"use client";

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
  time: string;
  color: string;
  url: string;
  displayId: string;
  repository?: string;
  branch?: string;
  commitCount?: number;
  status?: string;
  assignee?: string;
  labels?: string[];
}

interface LivefeedProps {
  activities: ActivityItem[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export default function Livefeed({
  activities = [],
  onRefresh,
  isLoading = false,
}: LivefeedProps) {
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

  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Quick status indicator */}
      <div className="mb-4 text-xs text-muted-foreground text-center">
        {activities.length} activities loaded
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <div className="flex justify-end mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh activity data"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && activities.length === 0 && (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <ActivitySkeleton key={i} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline container */}
      {!isLoading || activities.length > 0 ? (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border"></div>
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
      ) : null}
    </div>
  );
}
