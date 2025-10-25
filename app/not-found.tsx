/* eslint-disable react/no-unescaped-entities */
'use client';

import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 w-full max-w-md shadow-xl">
        <div className="card-body items-center text-center">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="card-title text-2xl">Page Not Found</h2>
          <p className="text-base-content/70">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="card-actions justify-center w-full">
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                onClick={() => window.history.back()}
                className="btn btn-outline flex-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="btn btn-primary flex-1"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
