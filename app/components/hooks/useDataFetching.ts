import { useState, useEffect, useCallback, useRef } from "react";

export interface UseDataFetchingOptions<T> {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  refreshInterval?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  transform?: (response: unknown) => T;
}

export interface UseDataFetchingReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
  cancel: () => void;
  lastUpdated: Date | null;
}

export function useDataFetching<T = unknown>(
  options: UseDataFetchingOptions<T>,
): UseDataFetchingReturn<T> {
  const {
    url,
    method = "GET",
    headers,
    body,
    refreshInterval,
    enabled = true,
    onSuccess,
    onError,
    transform,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled || !url) return;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      setError(null);

      const requestHeaders = {
        "Content-Type": "application/json",
        ...headers,
      };

      const requestOptions: RequestInit = {
        method,
        headers: requestHeaders,
        signal,
      };

      if (body && method !== "GET") {
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const transformedData = transform ? transform(result) : (result as T);

      setData(transformedData);
      setLastUpdated(new Date());
      onSuccess?.(transformedData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");

      if (error.name !== "AbortError") {
        setError(error);
        onError?.(error);
      }
    } finally {
      setLoading(false);
    }
  }, [url, method, headers, body, enabled, transform, onSuccess, onError]);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval && enabled && url) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshInterval, enabled, url, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [cancel]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    refresh,
    cancel,
    lastUpdated,
  };
}
