"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function QuickStartGuide() {
  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚀 Quick Start Guide
        </CardTitle>
        <CardDescription>
          Get Hyperpage running in 4 simple steps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1 */}
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
            1
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Clone and install</h3>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-sm">
              <div>git clone https://github.com/hyperpage/hyperpage.git</div>
              <div>cd hyperpage</div>
              <div>npm install</div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
            2
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Configure environment</h3>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-sm">
              <div>cp .env.local.sample .env.local</div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Edit <code className="bg-gray-100 px-1 rounded">.env.local</code>{" "}
              to enable your first tool (GitHub recommended)
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
            3
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Start development server</h3>
            <div className="bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-sm">
              <div>npm run dev</div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex items-start gap-4 p-4 border rounded-lg">
          <div className="shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
            4
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Open your portal</h3>
            <p className="text-sm text-gray-600 mb-2">
              Visit{" "}
              <a
                href="http://localhost:3000"
                className="text-blue-600 hover:underline"
              >
                http://localhost:3000
              </a>{" "}
              to see your data!
            </p>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Make sure to configure at least one tool in your{" "}
                <code>.env.local</code> file first.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
