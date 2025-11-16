import React from "react";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export interface QuickStartStepConfig {
  title: string;
  commands?: string[];
  description?: React.ReactNode;
  note?: React.ReactNode;
}

export const QUICK_START_STEPS: QuickStartStepConfig[] = [
  {
    title: "Clone and install",
    commands: [
      "git clone https://github.com/hyperpage/hyperpage.git",
      "cd hyperpage",
      "npm install",
    ],
  },
  {
    title: "Configure environment",
    commands: ["cp .env.sample .env.dev"],
    description: (
      <p className="text-sm text-gray-600 mt-2">
        Edit <code className="bg-gray-100 px-1 rounded">.env.dev</code> to
        enable your first tool (GitHub recommended)
      </p>
    ),
  },
  {
    title: "Start development server",
    commands: ["npm run dev"],
  },
  {
    title: "Open your portal",
    description: (
      <p className="text-sm text-gray-600 mb-2">
        Visit{" "}
        <a href="http://localhost:3000" className="text-blue-600 hover:underline">
          http://localhost:3000
        </a>{" "}
        to see your data!
      </p>
    ),
    note: (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Make sure to configure at least one tool in your{" "}
          <code>.env.dev</code> file first.
        </AlertDescription>
      </Alert>
    ),
  },
];

