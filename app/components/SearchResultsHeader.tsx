interface SearchResultsHeaderProps {
  searchQuery: string;
  totalSearchResults: number;
}

export default function SearchResultsHeader({
  searchQuery,
  totalSearchResults,
}: SearchResultsHeaderProps) {
  return (
    <div className="mb-6">
      <p className="text-sm text-muted-foreground">
        Found {totalSearchResults} result
        {totalSearchResults !== 1 ? "s" : ""} for &ldquo;{searchQuery}
        &rdquo;
      </p>
    </div>
  );
}
