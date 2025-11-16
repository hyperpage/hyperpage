"use client";

import React from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface GlobalSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

export default function GlobalSearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search across all tools...",
  className = "",
}: GlobalSearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 pl-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${value ? "pr-10" : ""}`}
      />
      {value && (
        <Button
          onClick={onClear}
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

