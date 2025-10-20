import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useState, useEffect } from "react";

import { ToolData } from "../../tools/tool-types";

interface DataTableProps {
  title: string;
  headers: string[];
  data: ToolData[];
  tool: string;
  isLoading?: boolean; // Loading state for refresh
  onRefresh?: () => void; // Refresh function
}

export default function DataTable({
  title,
  headers,
  data,
  tool,
  isLoading = false,
  onRefresh,
}: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Show 10 items per page instead of 5

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayItems = data.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset to page 1 when data changes (e.g., due to search filtering)
  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-6 w-6 p-0"
              title="Refresh data"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header, index) => (
                  <TableHead key={index} className="font-medium">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {headers.map((header, colIndex) => {
                    let cellValue =
                      row[header.toLowerCase().replace(/\s+/g, "_")] ||
                      row[header] ||
                      "-";
                    const urlField =
                      row.url ||
                      row.html_url ||
                      row[`${header.toLowerCase().replace(/\s+/g, "_")}_url`];

                    // Special handling for Created column: use created_display if available
                    if (header === "Created" && row.created_display) {
                      cellValue = row.created_display;
                    }

                    // Check if this cell should be rendered as a link
                    // Link cells that have identifiers (ticket numbers, IDs, keys) when URL is available
                    const isLinkableIdentifier =
                      (header === "Ticket" ||
                        header === "ID" ||
                        header.toLowerCase().includes("key")) &&
                      urlField &&
                      urlField !== "#";
                    const displayValue = cellValue;

                    return (
                      <TableCell key={colIndex}>
                        {isLinkableIdentifier ? (
                          <a
                            href={String(urlField)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:text-primary/80 underline decoration-transparent hover:decoration-current transition-colors"
                            title={`Open in ${tool}`}
                          >
                            {displayValue}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          displayValue
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of{" "}
              {totalItems} entries
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() =>
                      handlePageChange(Math.max(1, currentPage - 1))
                    }
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      handlePageChange(Math.min(totalPages, currentPage + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
