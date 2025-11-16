import React from "react";

interface TableLoadingStateProps {
  columns: number;
  rows?: number;
}

interface TableEmptyStateProps {
  columns: number;
  message?: string;
}

export function TableLoadingState({
  columns,
  rows = 5,
}: TableLoadingStateProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={`loading-${rowIndex}`} className="animate-pulse">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={`loading-${rowIndex}-${colIndex}`} className="py-3">
              <div className="h-4 bg-muted rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function TableEmptyState({
  columns,
  message = "No data available yet.",
}: TableEmptyStateProps) {
  return (
    <tr>
      <td
        className="py-6 text-center text-sm text-muted-foreground"
        colSpan={columns}
      >
        {message}
      </td>
    </tr>
  );
}

