interface ActivitySkeletonProps {
  index: number;
}

export default function ActivitySkeleton({ index }: ActivitySkeletonProps) {
  return (
    <div className="relative flex items-start gap-4">
      {/* Timeline dot skeleton */}
      <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-background bg-muted animate-shimmer">
        <div className="w-6 h-6 bg-secondary rounded"></div>
      </div>

      {/* Activity card skeleton */}
      <div className="flex-1 pb-6">
        <div className="bg-card border border-border rounded-lg shadow-md p-6 animate-shimmer">
          <div className="space-y-3">
            {/* Header: Action + Badge skeleton */}
            <div className="flex items-center justify-between">
              <div className="h-6 bg-muted rounded w-24 animate-shimmer"></div>
              <div className="h-4 bg-muted rounded w-16 animate-shimmer"></div>
            </div>

            {/* Details skeleton */}
            <div className="space-y-2">
              <div className="h-5 bg-muted rounded w-3/4 animate-shimmer"></div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-muted rounded-full animate-shimmer"></div>
                <div className="h-4 bg-muted rounded w-20 animate-shimmer"></div>
              </div>
            </div>

            {/* Metadata skeleton (optional, show sometimes for variety) */}
            {index % 2 === 0 && (
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="h-5 bg-muted rounded w-16 animate-shimmer"></div>
                <div className="h-5 bg-muted rounded w-12 animate-shimmer"></div>
                <div className="h-5 bg-muted rounded w-20 animate-shimmer"></div>
              </div>
            )}

            {/* Author info skeleton */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-muted rounded-full animate-shimmer"></div>
              <div className="h-4 bg-muted rounded w-24 animate-shimmer"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
