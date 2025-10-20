import { useState, useEffect, useCallback, useRef } from "react";

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

interface UseActivityDataReturn {
  activities: ActivityItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshActivities: () => Promise<void>;
  fetchActivities: () => Promise<void>;
}

export function useActivityData(): UseActivityDataReturn {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);

  // Transform API response to component format
  const transformActivity = (item: ApiActivityItem): ActivityItem => ({
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
  });

  // Fetch activities function for initial load
  const fetchActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/tools/activity");

      if (!response.ok) {
        throw new Error("Failed to fetch activity data");
      }

      const data = await response.json();
      const transformedActivities = (data.activity || []).map(transformActivity);
      setActivities(transformedActivities);
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError(err instanceof Error ? err.message : "Failed to load activities");
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh activities function that keeps old data visible during loading
  const refreshActivities = useCallback(async () => {
    // Prevent multiple concurrent refreshes using ref
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;

    try {
      setIsRefreshing(true);
      setError(null);
      const response = await fetch("/api/tools/activity");

      if (!response.ok) {
        throw new Error("Failed to refresh activity data");
      }

      const data = await response.json();
      const transformedActivities = (data.activity || []).map(transformActivity);
      setActivities(transformedActivities);
    } catch (err) {
      console.error("Error refreshing activities:", err);
      setError(
        err instanceof Error ? err.message : "Failed to refresh activities",
      );
      // Don't clear activities on refresh error - keep old data visible
    } finally {
      setIsRefreshing(false);
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    isLoading,
    isRefreshing,
    error,
    refreshActivities,
    fetchActivities,
  };
}
