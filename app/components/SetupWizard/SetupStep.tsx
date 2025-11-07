"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ExternalLink, Copy } from "lucide-react";

interface SetupStepProps {
  step: {
    id: string;
    title: string;
    description: string;
    status: string;
    action?: string;
    link?: string;
  };
  copyToClipboard: (text: string) => void;
}

export function SetupStep({ step, copyToClipboard }: SetupStepProps) {
  const getStepIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "checking":
        return (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        );
      default:
        return (
          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
        );
    }
  };

  return (
    <div key={step.id} className="flex items-start gap-3">
      {getStepIcon(step.status)}
      <div className="flex-1">
        <h4 className="font-medium">{step.title}</h4>
        <p className="text-sm text-gray-600 mb-2">{step.description}</p>
        {step.action && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (step.link) {
                  window.open(step.link, "_blank");
                }
              }}
            >
              {step.link ? (
                <>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {step.action}
                </>
              ) : (
                step.action
              )}
            </Button>
            {step.link && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(step.link!)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
