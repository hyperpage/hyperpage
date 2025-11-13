"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

import { TableCell, TableRow } from "@/components/ui/table";
import { ToolData } from "@/tools/tool-types";

interface TableRowProps {
  row: ToolData;
  headers: string[];
  rowIndex: number;
}

export default function TableRowComponent({
  row,
  headers,
  rowIndex,
}: TableRowProps) {
  return (
    <TableRow key={rowIndex}>
      {headers.map((header, colIndex) => {
        let cellValue =
          row[header.toLowerCase().replace(/\s+/g, "_")] || row[header] || "-";
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
                className="text-primary hover:text-primary/80 underline"
              >
                {displayValue}
                <ExternalLink className="w-3 h-3 inline ml-1" />
              </a>
            ) : (
              displayValue
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
