import { AlertTriangle, Info, AlertCircle } from "lucide-react";

export function getSeverityIcon(severity: "error" | "warning" | "info") {
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

export function getSeverityVariant(severity: "error" | "warning" | "info") {
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
