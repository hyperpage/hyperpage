"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Activity, MessageCircle } from "lucide-react";

interface TabNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function TabNavigation({
  activeTab,
  setActiveTab,
}: TabNavigationProps) {
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

  return (
    <div className="border-b border-border bg-background/50 backdrop-blur-sm">
      <div className="flex items-center justify-center px-4 h-12">
        <nav className="flex space-x-1 overflow-x-auto">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(item.id)}
              className={`relative px-3 py-2 h-8 rounded-md transition-all flex-shrink-0 ${
                activeTab === item.id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.count && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 px-1.5 text-xs flex-shrink-0"
                >
                  {item.count}
                </Badge>
              )}
            </Button>
          ))}
        </nav>
      </div>
    </div>
  );
}
