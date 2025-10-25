"use client";
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
        return "text-success";
      case "red":
        return "text-error";
      case "purple":
        return "text-secondary";
      case "orange":
        return "text-warning";
      default:
        return "text-primary";
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



  return (
    <div className="max-w-4xl mx-auto relative">
      {/* Quick status indicator */}
      <div className="mb-4 text-xs text-base-content/70 text-center">
        {activities.length} activities loaded
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <div className="flex justify-end mb-6">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn btn-outline btn-sm"
            title="Refresh activity data"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && activities.length === 0 && (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-base-300"></div>
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
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-base-300"></div>
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
                  className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-base-100 bg-base-300 group-hover:scale-110 transition-transform duration-200 ${getColorClass(activity.color)}`}
                >
                  <div className="text-lg">{getToolIcon(activity.tool)}</div>
                </div>

                {/* Activity content */}
                <div className="flex-1 pb-6">
                  <div className="card bg-base-100 border border-base-200 shadow-md transition-all duration-200">
                    <div className="card-body">
                      <div className="space-y-3">
                      {/* Header: Action + Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`badge ${activity.color === 'red' ? 'badge-error' : 'badge-neutral'}`}>
                            {getActionIcon(activity.action)}
                            <span className="capitalize">
                              {activity.action}
                            </span>
                          </span>
                          <span className="text-sm text-base-content/70">
                            {activity.time ||
                              formatRelativeTime(activity.timestamp)}
                          </span>
                        </div>
                        <span className="badge badge-outline">
                          {activity.tool}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <p className="text-base-content font-medium">
                            {activity.details}
                          </p>
                          {/* Display ID as hyperlink if available */}
                          {activity.displayId && activity.url && (
                            <a
                              href={activity.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link link-primary text-sm font-mono ml-4 flex-shrink-0"
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
                          <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/70">
                            {/* Repository */}
                            {activity.repository && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Repo:</span>
                                <span className="text-xs px-2 py-0.5 border border-base-200 rounded bg-base-100">
                                  {activity.repository}
                                </span>
                              </span>
                            )}

                            {/* Branch */}
                            {activity.branch && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Branch:</span>
                                <span className="text-xs px-2 py-0.5 border border-base-200 rounded bg-base-100">
                                  {activity.branch}
                                </span>
                              </span>
                            )}

                            {/* Commit Count */}
                            {activity.commitCount && activity.commitCount > 0 && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Commits:</span>
                                <span className="text-xs px-2 py-0.5 border border-base-200 rounded bg-base-100">
                                  {activity.commitCount}
                                </span>
                              </span>
                            )}

                            {/* Status */}
                            {activity.status && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Status:</span>
                                <span className={`badge ${
                                  activity.status.toLowerCase() === "open"
                                    ? "badge-success"
                                    : activity.status.toLowerCase() === "closed"
                                      ? "badge-error"
                                      : activity.status.toLowerCase() === "merged"
                                        ? "badge-primary"
                                        : "badge-neutral"
                                }`}>
                                  {activity.status}
                                </span>
                              </span>
                            )}

                            {/* Assignee */}
                            {activity.assignee &&
                              activity.assignee !== activity.author && (
                                <span className="flex items-center gap-1">
                                  <span className="font-medium">Assigned:</span>
                                  <span className="text-xs px-2 py-0.5 border border-base-200 rounded bg-base-100">
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
                                        className="text-xs px-2 py-0.5 border border-base-200 rounded bg-base-100"
                                      >
                                        {label}
                                      </span>
                                    ))}
                                  {activity.labels.length > 3 && (
                                    <span className="text-xs px-2 py-0.5 border border-base-200 rounded bg-base-100">
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
                          <div className="flex items-center gap-2 text-sm text-base-content/70">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-base-300 text-base-content text-xs font-medium">
                              {activity.author.charAt(0).toUpperCase()}
                            </div>
                            <span>by {activity.author}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {activities.length === 0 && (
              <div className="text-center py-12 col-span-full">
                <p className="text-base-content/70">
                  No recent activity to display.
                </p>
                <p className="text-sm text-base-content/70 mt-2">
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
