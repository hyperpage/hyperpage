import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
} from "@/components/ui/table";
import TableRowComponent from "@/app/components/TableRow";
import {
  TableEmptyState,
  TableLoadingState,
} from "@/app/components/TablePlaceholders";
import RefreshButton from "@/app/components/RefreshButton";
import { ToolData } from "@/tools/tool-types";

export interface WidgetErrorInfo {
  message: string;
  timestamp: number;
}

interface TableContentProps {
  headers: string[];
  pageItems: ToolData[];
  isLoading: boolean;
  errorInfo: WidgetErrorInfo | null;
}

export function DataTableToolbar({
  title,
  isLoading,
  onRefresh,
}: {
  title: string;
  isLoading: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">{title}</h3>
      {onRefresh && (
        <RefreshButton isLoading={isLoading} onRefresh={onRefresh} />
      )}
    </div>
  );
}

export function DataTableContent({
  headers,
  pageItems,
  isLoading,
  errorInfo,
}: TableContentProps) {
  return (
    <>
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
    </>
  );
}
