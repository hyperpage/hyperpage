"use client";

import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import QuickStartStep from "@/app/components/QuickStartStep";
import { QUICK_START_STEPS } from "@/app/components/quick-start-steps";

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
        {QUICK_START_STEPS.map((step, index) => (
          <QuickStartStep
            key={`${step.title}-${index}`}
            stepNumber={index + 1}
            {...step}
          />
        ))}
      </CardContent>
    </Card>
  );
}
