"use client";

import { useState, useEffect } from "react";

const daisyThemes = [
  "light", "dark", "cupertino", "bumblebee", "emerald", "corporate",
  "retro", "cyberpunk", "valentino", "halloween", "garden", "forest",
  "aqua", "lofi", "pastel", "fantasy", "wireframe", "black", "luxury",
  "dracula", "cmyk", "autumn", "business", "acid", "lemonade", "night",
  "coffee", "winter", "dim", "nord", "sunset"
];

const themeLabels = {
  light: "Light", dark: "Dark", cupertino: "Cupertino", bumblebee: "Bumblebee",
  emerald: "Emerald", corporate: "Corporate", retro: "Retro", cyberpunk: "Cyberpunk",
  valentino: "Valentino", halloween: "Halloween", garden: "Garden", forest: "Forest",
  aqua: "Aqua", lofi: "Lo-Fi", pastel: "Pastel", fantasy: "Fantasy",
  wireframe: "Wireframe", black: "Black", luxury: "Luxury", dracula: "Dracula",
  cmyk: "CMYK", autumn: "Autumn", business: "Business", acid: "Acid",
  lemonade: "Lemonade", night: "Night", coffee: "Coffee", winter: "Winter",
  dim: "Dim", nord: "Nord", sunset: "Sunset"
};

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState("light");
  const [isOpen, setIsOpen] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("daisyui-theme") || "light";
    setCurrentTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const switchTheme = (theme: string) => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("daisyui-theme", theme);
    setIsOpen(false);
  };

  return (
    <div className="dropdown dropdown-end">
      <button
        className="btn btn-ghost btn-square"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Theme switcher"
        title="Change theme"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
          />
        </svg>
      </button>

      {isOpen && (
        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-xl"
        >
          {daisyThemes.map((theme) => (
            <li key={theme}>
              <button
                className={`btn btn-sm ${currentTheme === theme ? "btn-active" : ""}`}
                onClick={() => switchTheme(theme)}
              >
                <span
                  className="w-3 h-3 rounded-full mr-2"
                  style={{
                    background: `hsl(var(--${theme === 'light' ? 'primary' : `color-${theme}`}))`,
                  }}
                ></span>
                {themeLabels[theme as keyof typeof themeLabels] || theme}
                {currentTheme === theme && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
