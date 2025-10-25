"use client";

import { useQuery } from "@tanstack/react-query";

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
  repository?: string;
  branch?: string;
  commitCount?: number;
  status?: string;
  assignee?: string;
  labels?: string[];
}

// Fetch function for activity data
const fetchActivities = async (): Promise<ActivityItem[]> => {
  const response = await fetch("/api/tools/activity");

  if (!response.ok) {
    throw new Error("Failed to fetch activity data");
  }

  const data = await response.json();

  // Transform API response to component format
  return (data.activity || []).map((item: ApiActivityItem): ActivityItem => ({
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
    repository: item.repository,
    branch: item.branch,
    commitCount: item.commitCount,
    status: item.status,
    assignee: item.assignee,
    labels: item.labels,
  }));
};

interface UseActivitiesReturn {
  activities: ActivityItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refetch: () => Promise<import("@tanstack/react-query").QueryObserverResult<ActivityItem[], Error>>;
}

// React Query-based activity data hook
export function useActivities(): UseActivitiesReturn {
  const {
    data: activities = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["activities"],
    queryFn: fetchActivities,
    // Poll every 15 seconds (matches your current interval)
    refetchInterval: 15 * 1000,
    // Keep data fresh for activity feed use case
    staleTime: 10 * 1000, // 10 seconds
    // Continue polling in background
    refetchIntervalInBackground: true,
  });

  return {
    activities,
    isLoading,
    isRefreshing: isRefetching,
    error: error ? (error as Error).message : null,
    refetch,
  };
}
