"use client";

import { useMemo, useState, useEffect } from "react";

export interface PaginatedRowsOptions<TData> {
  data: TData[];
  itemsPerPage?: number;
}

export interface PaginatedRowsResult<TData> {
  pageItems: TData[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  setPage: (page: number) => void;
}

export function usePaginatedRows<TData>({
  data,
  itemsPerPage = 10,
}: PaginatedRowsOptions<TData>): PaginatedRowsResult<TData> {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const { totalItems, totalPages, startIndex, endIndex, pageItems } =
    useMemo(() => {
      const totalItems = data.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
      const pageItems = data.slice(startIndex, endIndex);

      return {
        totalItems,
        totalPages,
        startIndex,
        endIndex,
        pageItems,
      };
    }, [data, currentPage, itemsPerPage]);

  const setPage = (page: number) => {
    const normalized = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(normalized);
  };

  return {
    pageItems,
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    setPage,
  };
}
