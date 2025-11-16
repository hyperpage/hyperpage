"use client";

import React, { ReactNode } from "react";

interface SetupWizardLayoutProps {
  children: ReactNode;
}

export function SetupWizardLayout({ children }: SetupWizardLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Welcome to Hyperpage
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Let&apos;s get you set up in just a few simple steps. Follow the
            guide below to start aggregating your development data.
          </p>
        </div>

        <div className="space-y-8">{children}</div>

        <div className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>
            Need help? Check the{" "}
            <a
              href="https://github.com/hyperpage/hyperpage"
              className="text-blue-600 hover:underline"
            >
              documentation
            </a>{" "}
            or{" "}
            <a
              href="https://github.com/hyperpage/hyperpage/issues"
              className="text-blue-600 hover:underline"
            >
              open an issue
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
