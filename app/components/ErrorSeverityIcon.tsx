"use client";

import { AlertTriangle, Info, AlertCircle } from "lucide-react";

interface ErrorSeverityIconProps {
  severity: "error" | "warning" | "info";
}

export function ErrorSeverityIcon({ severity }: ErrorSeverityIconProps) {
  switch (severity) {
    case "error":
      return <AlertCircle className="h-4 w-4" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4" />;
    case "info":
      return <Info className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}
