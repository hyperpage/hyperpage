import type { ToolData } from "../tools/tool-types";

/**
 * Converts a date to a human-readable "time ago" string.
 *
 * @param date - The date to convert
 * @returns A string representing how long ago the date was (e.g., "5 minutes ago")
 */
export function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec} seconds ago`;
  if (diffMin < 60) return `${diffMin} minutes ago`;
  if (diffHour < 24) return `${diffHour} hours ago`;
  if (diffDay < 7) return `${diffDay} days ago`;

  return date.toLocaleDateString();
}

/**
 * Finds a timestamp field in a data object by checking common field names
 * @param item - Data object to search for timestamp
 * @returns The timestamp value as a string, or undefined if not found
 */
export const findTimestamp = (
  item: Record<string, unknown>,
): string | undefined => {
  // Common timestamp field names used across different tools
  const timeFields = [
    "updated_at", // GitHub, GitLab
    "created_at", // GitHub, GitLab
    "updated", // Jira
    "created", // Jira
    "created_at", // General
    "updated_at", // General
    "timestamp", // General
    "updatedDate", // Alternative
    "createdDate", // Alternative
  ];

  // Try to find a timestamp field
  for (const field of timeFields) {
    if (item[field] && typeof item[field] === "string") {
      return item[field] as string;
    }
  }

  return undefined;
};

/**
 * Sorts an array of data objects by time (most recent first)
 * @param data - Array of data objects to sort
 * @returns Sorted array with most recent items first
 */
export const sortDataByTime = (data: ToolData[]): ToolData[] => {
  return data.sort((a, b) => {
    const timeA = findTimestamp(a);
    const timeB = findTimestamp(b);

    // If both have timestamps, sort by time (most recent first)
    if (timeA && timeB) {
      const dateA = new Date(timeA).getTime();
      const dateB = new Date(timeB).getTime();
      return dateB - dateA; // Descending order (newest first)
    }

    // If only one has timestamp, prioritize it
    if (timeA) return -1; // a has timestamp, b doesn't → a first
    if (timeB) return 1; // b has timestamp, a doesn't → b first

    // If neither has timestamp, maintain original order
    return 0;
  });
};
