"use client";

import { BarChart3, Activity } from "lucide-react";

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
  ];

  return (
    <div className="border-b border-base-200 bg-base-100 backdrop-blur-sm">
      <div className="flex items-center justify-center px-4 h-12">
        <nav className="flex space-x-1 overflow-x-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative px-3 py-2 h-8 rounded-md transition-all flex-shrink-0 ${
                activeTab === item.id
                  ? "bg-base-200 text-base-content"
                  : "text-base-content/80 hover:text-base-content hover:bg-base-200"
              }`}
            >
              <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.count && (
                <span className="ml-2 h-5 px-1.5 text-xs flex-shrink-0 bg-base-300 text-base-content rounded">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
