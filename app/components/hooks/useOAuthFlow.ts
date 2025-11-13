"use client";

import { useEffect } from "react";

import logger from "@/lib/logger";

export function useOAuthFlow(
  toolSlugs: string[],
  onAuthSuccess: (tool: string) => void,
) {
  useEffect(() => {
    // Check for OAuth success indicators on page load
    const urlParams = new URLSearchParams(window.location.search);
    const successParam = urlParams.get("success");
    const currentAuthTool = sessionStorage.getItem("currentAuthTool");

    if (successParam && currentAuthTool) {
      // Clear the stored tool since OAuth is complete
      sessionStorage.removeItem("currentAuthTool");

      // Check if this matches our tool
      const toolMatch = toolSlugs.find((tool) => successParam.includes(tool));
      if (toolMatch) {
        logger.info(
          `OAuth success detected for ${toolMatch}, refreshing status...`,
        );
        onAuthSuccess(toolMatch);

        // Clean up URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("success");
        newUrl.searchParams.delete("timestamp");
        window.history.replaceState({}, "", newUrl.toString());
      }
    }
  }, [toolSlugs, onAuthSuccess]);
}
