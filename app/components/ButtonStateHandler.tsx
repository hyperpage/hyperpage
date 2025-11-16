"use client";

import { LogIn, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ButtonStateHandlerProps {
  isAuthenticated: boolean;
  isLoading: boolean;
  onAuthenticate: () => void;
  onDisconnect: () => void;
}

export default function ButtonStateHandler({
  isAuthenticated,
  isLoading,
  onAuthenticate,
  onDisconnect,
}: ButtonStateHandlerProps) {
  return (
    <div className="flex space-x-2">
      {isAuthenticated ? (
        <Button variant="outline" onClick={onDisconnect} disabled={isLoading}>
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin mr-1" />
          ) : (
            <LogOut className="w-3 h-3" />
          )}
        </Button>
      ) : (
        <Button onClick={onAuthenticate} disabled={isLoading}>
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
          ) : (
            <LogIn className="w-3 h-3 mr-1" />
          )}
          Connect
        </Button>
      )}
    </div>
  );
}
