// hooks/useOAuthErrorDisplay.ts
import { useMemo } from "react";
import { OAuthError, getErrorDisplayProps } from "@/lib/oauth-errors";

export function useOAuthErrorDisplay(error: OAuthError | null) {
  return useMemo(() => {
    if (!error) return null;
    return getErrorDisplayProps(error);
  }, [error]);
}
