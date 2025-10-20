"use client";

import { useState, useEffect } from "react";
import { BarChart3, Activity, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getToolIcon } from "../../tools";
import { ToolIntegration } from "../../tools/tool-types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [toolIntegrations, setToolIntegrations] = useState<ToolIntegration[]>(
    [],
  );

  const menuItems = [
    { id: "overview", label: "Overview", icon: BarChart3, count: null },
    { id: "livefeed", label: "Livefeed", icon: Activity, count: null },
    {
      id: "communication",
      label: "Communication",
      icon: MessageCircle,
      count: 2,
    },
  ];

  // Load tool integrations from API on component mount
  useEffect(() => {
    async function loadIntegrations() {
      try {
        const response = await fetch("/api/tools/enabled");
        if (response.ok) {
          const data = await response.json();
          const integrations: ToolIntegration[] = data.enabledTools.map(
            (tool: { name: string }) => ({
              name: tool.name,
              enabled: true,
              icon: getToolIcon(tool.name),
              status: "connected" as const, // Default status for enabled tools
            }),
          );
          setToolIntegrations(integrations);
        } else {
          console.error("Failed to fetch enabled tools");
        }
      } catch (error) {
        console.error("Error loading tool integrations:", error);
      }
    }

    loadIntegrations();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-teal-600";
      case "connecting":
        return "bg-yellow-500";
      default:
        return "bg-red-500";
    }
  };

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground mb-4">
          Navigation
        </h2>
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.count && (
                <Badge variant="secondary" className="ml-auto">
                  {item.count}
                </Badge>
              )}
            </Button>
          ))}
        </nav>
      </div>

      <div className="flex-1">
        {/* Middle content area can be expanded here if needed */}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex flex-wrap gap-3">
          {toolIntegrations.map((tool, index) => (
            <div
              key={index}
              className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors"
              title={tool.name}
            >
              <span className="text-lg">{tool.icon}</span>
              <div
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-sidebar ${getStatusColor(tool.status)}`}
                title={tool.status}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
