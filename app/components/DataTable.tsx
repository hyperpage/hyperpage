import React from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
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
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="h-6 w-6 p-0 border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              title="Refresh data"
            >
              <RefreshCw
                className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          )}
        </div>
      </div>
      <div className="p-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                {headers.map((header, index) => (
                  <th key={index} className="px-4 py-3 text-left font-medium text-gray-900 dark:text-gray-100 border-b">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {displayItems.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                      <td key={colIndex} className="px-4 py-3 text-gray-900 dark:text-gray-100">
                        {isLinkableIdentifier ? (
                          <a
                            href={String(urlField)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                            title={`Open in ${tool}`}
                          >
                            {displayValue}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          displayValue
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of{" "}
              {totalItems} entries
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
