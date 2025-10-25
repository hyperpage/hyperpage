/* eslint-disable react/no-unescaped-entities */
'use client';

import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm bg-white dark:bg-gray-800">
        <div className="p-6 text-center">
          <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            404
          </h1>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Page Not Found</h2>
        </div>
        <div className="p-6 pt-0 space-y-4">
          <p className="text-gray-600 dark:text-gray-400 text-center">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4 inline" />
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 transition-colors"
            >
              <Home className="mr-2 h-4 w-4 inline" />
              Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
