import React from "react";

interface HyperpageLogoProps {
  isDark: boolean;
  className?: string;
}

export default function HyperpageLogo({
  isDark,
  className = "",
}: HyperpageLogoProps) {
  if (isDark) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        width="32"
        height="32"
        role="img"
        aria-labelledby="titleDesc"
        className={className}
      >
        <title id="titleDesc">
          Hyperpage — bold connected network H logo (white version)
        </title>
        {/* Connections */}
        <g stroke="white" strokeWidth="5" strokeLinecap="round" fill="none">
          {/* Left vertical */}
          <path d="M25 20 L25 40 Q25 45 28 50 Q25 55 25 60 L25 80" />
          {/* Right vertical */}
          <path d="M75 25 L75 45 Q75 50 72 55 Q75 60 75 75 L75 85" />
          {/* Middle horizontal (main connector) */}
          <path d="M28 50 Q50 42 72 55" />
        </g>
        {/* Nodes */}
        <g fill="white">
          {/* Left column */}
          <circle cx="25" cy="20" r="4" />
          <circle cx="25" cy="40" r="4" />
          <circle cx="25" cy="60" r="4" />
          <circle cx="25" cy="80" r="4" />
          {/* Right column */}
          <circle cx="75" cy="25" r="4" />
          <circle cx="75" cy="45" r="4" />
          <circle cx="75" cy="60" r="4" />
          <circle cx="75" cy="85" r="4" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width="32"
      height="32"
      role="img"
      aria-labelledby="titleDesc"
      className={className}
    >
      <title id="titleDesc">Hyperpage — bold connected network H logo</title>
      {/* Connections */}
      <g stroke="black" strokeWidth="5" strokeLinecap="round" fill="none">
        {/* Left vertical */}
        <path d="M25 20 L25 40 Q25 45 28 50 Q25 55 25 60 L25 80" />
        {/* Right vertical */}
        <path d="M75 25 L75 45 Q75 50 72 55 Q75 60 75 75 L75 85" />
        {/* Middle horizontal (main connector) */}
        <path d="M28 50 Q50 42 72 55" />
      </g>
      {/* Nodes */}
      <g fill="black">
        {/* Left column */}
        <circle cx="25" cy="20" r="4" />
        <circle cx="25" cy="40" r="4" />
        <circle cx="25" cy="60" r="4" />
        <circle cx="25" cy="80" r="4" />
        {/* Right column */}
        <circle cx="75" cy="25" r="4" />
        <circle cx="75" cy="45" r="4" />
        <circle cx="75" cy="60" r="4" />
        <circle cx="75" cy="85" r="4" />
      </g>
    </svg>
  );
}
