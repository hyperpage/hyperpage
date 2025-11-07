"use client";

export function getErrorSeverityVariant(
  severity: "error" | "warning" | "info",
) {
  switch (severity) {
    case "error":
      return "destructive";
    case "warning":
      return "default";
    case "info":
      return "default";
    default:
      return "destructive";
  }
}
