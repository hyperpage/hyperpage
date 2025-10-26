"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  statusTransition?: string; // Add status transition field
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
        return "text-green-600 dark:text-green-400";
      case "red":
        return "text-red-600 dark:text-red-400";
      case "purple":
        return "text-purple-600 dark:text-purple-400";
      case "orange":
        return "text-orange-600 dark:text-orange-400";
      default:
        return "text-primary";
    }
  };

  const getBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "open":
        return "default" as const;
      case "closed":
        return "destructive" as const;
      case "merged":
        return "secondary" as const;
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
            onClick={onRefresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
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
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-muted"></div>
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
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-muted"></div>
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
                  className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 bg-muted group-hover:scale-110 transition-transform duration-200 ${getColorClass(activity.color)}`}
                >
                  <div className="text-lg">{getToolIcon(activity.tool)}</div>
                </div>

                {/* Activity content */}
                <div className="flex-1 pb-6">
                  <Card className="transition-all duration-200">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        {/* Header: Action + Badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant={activity.color === 'red' ? 'destructive' : 'secondary'}>
                              {activity.action}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {activity.time ||
                                formatRelativeTime(activity.timestamp)}
                            </span>
                          </div>
                          <Badge variant="outline">
                            {activity.tool}
                          </Badge>
                        </div>

                        {/* Details */}
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <p className="font-medium">
                              {activity.details}
                            </p>
                            {/* Display ID as hyperlink if available */}
                            {activity.displayId && activity.url && (
                              <a
                                href={activity.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 underline text-sm font-mono ml-4 flex-shrink-0"
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
                                  <span className="text-xs px-2 py-0.5 border rounded bg-muted">
                                    {activity.repository}
                                  </span>
                                </span>
                              )}

                              {/* Branch */}
                              {activity.branch && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Branch:</span>
                                  <span className="text-xs px-2 py-0.5 border rounded bg-muted">
                                    {activity.branch}
                                  </span>
                                </span>
                              )}

                              {/* Commit Count */}
                              {activity.commitCount && activity.commitCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Commits:</span>
                                  <span className="text-xs px-2 py-0.5 border rounded bg-muted">
                                    {activity.commitCount}
                                  </span>
                                </span>
                              )}

                              {/* Status */}
                              {(activity.status || activity.statusTransition) && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Status:</span>
                                  <Badge variant={getBadgeVariant(activity.status || activity.statusTransition || "")}>
                                    {activity.statusTransition || activity.status}
                                  </Badge>
                                </span>
                              )}

                              {/* Assignee */}
                              {activity.assignee &&
                                activity.assignee !== activity.author && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-medium">Assigned:</span>
                                    <span className="text-xs px-2 py-0.5 border rounded bg-muted">
                                      {activity.assignee}
                                    </span>
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
                                        <span
                                          key={index}
                                          className="text-xs px-2 py-0.5 border rounded bg-muted"
                                        >
                                          {label}
                                        </span>
                                      ))}
                                    {activity.labels.length > 3 && (
                                      <span className="text-xs px-2 py-0.5 border rounded bg-muted">
                                        +{activity.labels.length - 3}
                                      </span>
                                    )}
                                  </div>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Author info */}
                          {activity.author && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-foreground text-xs font-medium">
                                {activity.author.charAt(0).toUpperCase()}
                              </div>
                              <span>by {activity.author}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
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
