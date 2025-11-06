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
      const dateA = new Date(timeA);
      const dateB = new Date(timeB);

      // Check for invalid dates (NaN from null/undefined timestamps)
      const timeAValid = !isNaN(dateA.getTime());
      const timeBValid = !isNaN(dateB.getTime());

      if (timeAValid && timeBValid) {
        return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
      }

      // If one is invalid, prioritize the valid one
      if (timeAValid) return -1; // a is valid, b is invalid → a first
      if (timeBValid) return 1; // b is valid, a is invalid → b first

      // Both invalid, maintain original order
      return 0;
    }

    // If only one has timestamp, prioritize it
    if (timeA) return -1; // a has timestamp, b doesn't → a first
    if (timeB) return 1; // b has timestamp, a doesn't → b first

    // If neither has timestamp, maintain original order
    return 0;
  });
};

/**
 * Formats a timestamp into a human-readable "time until reset" string.
 *
 * @param timestamp - The timestamp when limits reset (in milliseconds since epoch)
 * @returns A string representing time until reset (e.g., "5 minutes", "2 hours")
 */
export function formatTimeUntilReset(timestamp: number | null): string {
  if (!timestamp) return "unknown time";

  const now = Date.now();
  const diffMs = timestamp - now;

  // If the timestamp is in the past
  if (diffMs <= 0) {
    return "now";
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  return `${diffDay}d`;
}
