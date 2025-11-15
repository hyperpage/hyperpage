import React from "react";
import { useState, useEffect } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
} from "@/components/ui/table";
import { ToolData } from "@/tools/tool-types";
import RefreshButton from "@/app/components/RefreshButton";
import TableRowComponent from "@/app/components/TableRow";
import PaginationControls from "@/app/components/PaginationControls";

interface WidgetErrorInfo {
  message: string;
  timestamp: number;
}

interface DataTableProps {
  title: string;
  headers: string[];
  data: ToolData[];
  tool: string;
  isLoading?: boolean;
  errorInfo?: WidgetErrorInfo | null;
  onRefresh?: () => void;
}

export default function DataTable({
  title,
  headers,
  data,
  tool,
  isLoading = false,
  errorInfo = null,
  onRefresh,
}: DataTableProps) {
  // tool parameter is reserved for future use (debugging, analytics, etc.)
  void tool;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayItems = data.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {onRefresh && (
            <RefreshButton isLoading={isLoading} onRefresh={onRefresh} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {errorInfo && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Unable to load data</AlertTitle>
            <AlertDescription>
              {errorInfo.message} –{" "}
              <span className="font-mono text-xs">
                {new Date(errorInfo.timestamp).toLocaleTimeString()}
              </span>
            </AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <tr>
              {headers.map((header, index) => (
                <TableHead key={index}>{header}</TableHead>
              ))}
            </tr>
          </TableHeader>
          <TableBody>
            {displayItems.map((row, rowIndex) => (
              <TableRowComponent
                key={rowIndex}
                row={row}
                headers={headers}
                rowIndex={rowIndex}
              />
            ))}
          </TableBody>
        </Table>

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={handlePageChange}
        />
      </CardContent>
    </Card>
  );
}
