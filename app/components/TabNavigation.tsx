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
    <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 backdrop-blur-sm">
      <div className="flex items-center justify-center px-4 h-12">
        <nav className="flex space-x-1 overflow-x-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative px-3 py-2 h-8 rounded-md transition-all flex-shrink-0 ${
                activeTab === item.id
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <item.icon className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.count && (
                <span className="ml-2 h-5 px-1.5 text-xs flex-shrink-0 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded">
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
