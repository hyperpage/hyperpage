"use client";

import React from "react";

interface AuthCalloutProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant: "info" | "success";
}

const CALLOUT_STYLES = {
  info: {
    container: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    title: "text-blue-900 dark:text-blue-100",
    body: "text-blue-700 dark:text-blue-300",
  },
  success: {
    container:
      "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
    title: "text-green-900 dark:text-green-100",
    body: "text-green-700 dark:text-green-300",
  },
};

export default function AuthCallout({
  icon,
  title,
  description,
  variant,
}: AuthCalloutProps) {
  const styles = CALLOUT_STYLES[variant];

  return (
    <div
      className={`p-4 border rounded-lg flex items-center space-x-2 ${styles.container}`}
    >
      <div className="w-5 h-5 text-current">{icon}</div>
      <div>
        <h4 className={`font-medium ${styles.title}`}>{title}</h4>
        <p className={`text-sm mt-1 ${styles.body}`}>{description}</p>
      </div>
    </div>
  );
}

