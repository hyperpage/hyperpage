/* eslint-disable react/no-unescaped-entities */
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold text-primary mb-2">
            404
          </CardTitle>
          <h2 className="text-xl font-semibold">Page Not Found</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button
              onClick={() => window.location.href = '/'}
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
