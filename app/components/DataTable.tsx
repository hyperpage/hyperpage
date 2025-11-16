import React from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import PaginationControls from "@/app/components/PaginationControls";
import { usePaginatedRows } from "@/app/components/hooks/usePaginatedRows";
import { ToolData } from "@/tools/tool-types";
import {
  DataTableContent,
  DataTableToolbar,
  WidgetErrorInfo,
} from "@/app/components/data-table/TableContent";

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
        <DataTableToolbar
          title={title}
          isLoading={isLoading}
          onRefresh={onRefresh}
        />
      </CardHeader>
      <CardContent>
        <DataTableContent
          headers={headers}
          pageItems={pageItems}
          isLoading={isLoading}
          errorInfo={errorInfo}
        />
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
