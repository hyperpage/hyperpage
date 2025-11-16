"use client";

import React from "react";

import { QuickStartStepConfig } from "@/app/components/quick-start-steps";

interface QuickStartStepProps extends QuickStartStepConfig {
  stepNumber: number;
}

export default function QuickStartStep({
  stepNumber,
  title,
  commands = [],
  description,
  note,
}: QuickStartStepProps) {
  return (
    <div className="flex items-start gap-4 p-4 border rounded-lg">
      <div className="shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
        {stepNumber}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold mb-2">{title}</h3>
        {commands.length > 0 && (
          <div className="bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-sm space-y-1">
            {commands.map((command) => (
              <div key={`${title}-${command}`}>{command}</div>
            ))}
          </div>
        )}
        {description}
        {note && <div className="mt-3">{note}</div>}
      </div>
    </div>
  );
}

