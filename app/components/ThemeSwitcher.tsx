"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon } from "lucide-react";

const themes = [
  { name: "light", label: "Light", icon: Sun },
  { name: "dark", label: "Dark", icon: Moon },
] as const;

type Theme = typeof themes[number]["name"];

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState<Theme>("light");

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") || "light") as Theme;
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (theme: Theme) => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  };

  const switchTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    applyTheme(theme);
  };

  const currentThemeData = themes.find(t => t.name === currentTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Change theme">
          {currentThemeData && <currentThemeData.icon className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((theme) => {
          const IconComponent = theme.icon;
          return (
            <DropdownMenuItem
              key={theme.name}
              onClick={() => switchTheme(theme.name)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <IconComponent className="h-4 w-4" />
              <span>{theme.label}</span>
              {currentTheme === theme.name && (
                <span className="ml-auto">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
