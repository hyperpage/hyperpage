import React from "react";

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
import { usePaginatedRows } from "@/app/components/hooks/usePaginatedRows";
import {
  TableLoadingState,
  TableEmptyState,
} from "@/app/components/TablePlaceholders";

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
  const {
    pageItems,
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    setPage,
  } = usePaginatedRows({ data, itemsPerPage: 10 });

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
            {isLoading ? (
              <TableLoadingState columns={headers.length} />
            ) : pageItems.length === 0 ? (
              <TableEmptyState columns={headers.length} />
            ) : (
              pageItems.map((row, rowIndex) => (
                <TableRowComponent
                  key={rowIndex}
                  row={row}
                  headers={headers}
                  rowIndex={rowIndex}
                />
              ))
            )}
          </TableBody>
        </Table>

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}
