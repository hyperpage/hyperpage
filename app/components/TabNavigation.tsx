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
              className={`px-6 py-2 rounded-md font-medium transition-colors flex-shrink-0 ${
                activeTab === item.id
                  ? "bg-base-200 text-base-content"
                  : "text-base-content/80 hover:text-base-content hover:bg-base-200/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
