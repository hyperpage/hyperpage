import React from "react";

interface DashboardSearchResultsProps {
  searchQuery: string;
  totalSearchResults: number;
}

export const DashboardSearchResults = React.memo(function DashboardSearchResults({
  searchQuery,
  totalSearchResults,
}: DashboardSearchResultsProps) {
  if (!searchQuery) return null;

  return (
    <div className="mb-6">
      <p className="text-sm text-muted-foreground">
        Found {totalSearchResults} result
        {totalSearchResults !== 1 ? "s" : ""} for &ldquo;{searchQuery}
        &rdquo;
      </p>
    </div>
  );
});
