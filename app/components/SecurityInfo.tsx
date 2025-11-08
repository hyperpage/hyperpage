"use client";

import React from "react";

interface SecurityInfoProps {
  className?: string;
}

export default function SecurityInfo({ className = "" }: SecurityInfoProps) {
  return (
    <div className={`mt-6 pt-4 border-t border-muted ${className}`}>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Security:</strong> All authentication tokens are encrypted
          with AES-256-GCM and never stored in browser storage.
        </p>
        <p>
          <strong>Permissions:</strong> Only the minimum required permissions
          are requested for each tool.
        </p>
        <p>
          <strong>Data Usage:</strong> Your tool credentials are only used for
          Hyperpage functionality and not shared with third parties.
        </p>
      </div>
    </div>
  );
}
