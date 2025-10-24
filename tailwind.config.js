/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    // Keep your font setup
    fontFamily: {
      sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
    },
    extend: {
      colors: {
        // Base colors - your current OKLCH values
        background: 'oklch(1 0 0)',
        foreground: 'oklch(0.095 0 0)',

        // Card system
        card: 'oklch(1 0 0)',
        'card-foreground': 'oklch(0.095 0 0)',

        // Popover system
        popover: 'oklch(1 0 0)',
        'popover-foreground': 'oklch(0.095 0 0)',

        // Primary system
        primary: 'oklch(0.55 0.15 180)',
        'primary-foreground': 'oklch(0.985 0 0)',
        'primary-hover': 'oklch(0.6 0.18 180)',
        'primary-active': 'oklch(0.5 0.12 180)',

        // Secondary system
        secondary: 'oklch(0.97 0 0)',
        'secondary-foreground': 'oklch(0.205 0 0)',
        'secondary-hover': 'oklch(0.94 0 0)',
        'secondary-active': 'oklch(0.9 0 0)',

        // Neutral scale
        muted: 'oklch(0.97 0 0)',
        'muted-foreground': 'oklch(0.708 0 0)',

        // Accent system
        accent: 'oklch(0.97 0 0)',
        'accent-foreground': 'oklch(0.205 0 0)',
        'accent-hover': 'oklch(0.94 0 0)',
        'accent-active': 'oklch(0.92 0 0)',

        // Border system
        border: 'oklch(0.9 0.005 264)',

        // Input system
        input: 'oklch(0.97 0 0)',
        'input-hover': 'oklch(0.94 0 0)',
        'input-focus': 'oklch(1 0 0)',

        // Ring system
        ring: 'oklch(0.55 0.15 180)',

        // State colors
        destructive: 'oklch(0.577 0.245 27.325)',
        'destructive-foreground': 'oklch(0.985 0 0)',
        'destructive-hover': 'oklch(0.627 0.22 27.325)',
        'destructive-active': 'oklch(0.52 0.21 27.325)',

        success: 'oklch(0.627 0.224 142.5)',
        'success-foreground': 'oklch(0.985 0 0)',
        'success-hover': 'oklch(0.67 0.2 142.5)',
        'success-active': 'oklch(0.58 0.19 142.5)',

        warning: 'oklch(0.827 0.199 85.873)',
        'warning-foreground': 'oklch(0.205 0 0)',
        'warning-hover': 'oklch(0.77 0.18 85.873)',
        'warning-active': 'oklch(0.72 0.16 85.873)',

        info: 'oklch(0.579 0.158 241.966)',
        'info-foreground': 'oklch(0.985 0 0)',
        'info-hover': 'oklch(0.63 0.14 241.966)',
        'info-active': 'oklch(0.55 0.12 241.966)',

        // Chart colors
        'chart-1': 'oklch(0.646 0.222 41.116)',
        'chart-2': 'oklch(0.6 0.118 184.704)',
        'chart-3': 'oklch(0.398 0.07 227.392)',
        'chart-4': 'oklch(0.828 0.189 84.429)',
        'chart-5': 'oklch(0.769 0.188 70.08)',

        // Sidebar system
        sidebar: 'oklch(0.985 0 0)',
        'sidebar-foreground': 'oklch(0.095 0 0)',
        'sidebar-primary': 'oklch(0.55 0.15 180)',
        'sidebar-primary-foreground': 'oklch(0.985 0 0)',
        'sidebar-accent': 'oklch(0.97 0 0)',
        'sidebar-accent-foreground': 'oklch(0.205 0 0)',
        'sidebar-border': 'oklch(0.9 0.005 264)',
        'sidebar-ring': 'oklch(0.55 0.15 180)',
      },
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      animation: {
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'fade-in-up-delay-1': 'fadeInUp 0.6s ease-out 0.1s forwards',
        'fade-in-up-delay-2': 'fadeInUp 0.6s ease-out 0.2s forwards',
        'fade-in-up-delay-3': 'fadeInUp 0.6s ease-out 0.3s forwards',
        'fade-out': 'fadeOut 0.3s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
      },
    },
    dark: {
      // Dark theme colors
      background: 'oklch(0.145 0 0)',
      foreground: 'oklch(0.985 0 0)',
      card: 'oklch(0.205 0 0)',
      'card-foreground': 'oklch(0.985 0 0)',
      popover: 'oklch(0.205 0 0)',
      'popover-foreground': 'oklch(0.985 0 0)',
      primary: 'oklch(0.65 0.18 180)',
      'primary-foreground': 'oklch(0.205 0 0)',
      'primary-hover': 'oklch(0.7 0.2 180)',
      'primary-active': 'oklch(0.6 0.15 180)',
      secondary: 'oklch(0.269 0 0)',
      'secondary-foreground': 'oklch(0.985 0 0)',
      'secondary-hover': 'oklch(0.32 0 0)',
      'secondary-active': 'oklch(0.29 0 0)',
      muted: 'oklch(0.269 0 0)',
      'muted-foreground': 'oklch(0.708 0 0)',
      accent: 'oklch(0.269 0 0)',
      'accent-foreground': 'oklch(0.985 0 0)',
      'accent-hover': 'oklch(0.32 0 0)',
      'accent-active': 'oklch(0.29 0 0)',
      border: 'oklch(0.32 0.005 264)',
      input: 'oklch(0.269 0 0)',
      'input-hover': 'oklch(0.32 0 0)',
      'input-focus': 'oklch(0.205 0 0)',
      ring: 'oklch(0.55 0.15 180)',
      destructive: 'oklch(0.704 0.191 22.216)',
      'destructive-foreground': 'oklch(0.985 0 0)',
      'destructive-hover': 'oklch(0.75 0.18 22.216)',
      'destructive-active': 'oklch(0.68 0.17 22.216)',
      success: 'oklch(0.627 0.224 142.5)',
      'success-foreground': 'oklch(0.145 0 0)',
      'success-hover': 'oklch(0.67 0.2 142.5)',
      'success-active': 'oklch(0.58 0.19 142.5)',
      warning: 'oklch(0.827 0.199 85.873)',
      'warning-foreground': 'oklch(0.145 0 0)',
      'warning-hover': 'oklch(0.77 0.18 85.873)',
      'warning-active': 'oklch(0.72 0.16 85.873)',
      info: 'oklch(0.579 0.158 241.966)',
      'info-foreground': 'oklch(0.145 0 0)',
      'info-hover': 'oklch(0.63 0.14 241.966)',
      'info-active': 'oklch(0.55 0.12 241.966)',
      'chart-1': 'oklch(0.488 0.243 264.376)',
      'chart-2': 'oklch(0.696 0.17 162.48)',
      'chart-3': 'oklch(0.769 0.188 70.08)',
      'chart-4': 'oklch(0.627 0.265 303.9)',
      'chart-5': 'oklch(0.645 0.246 16.439)',
      sidebar: 'oklch(0.205 0 0)',
      'sidebar-foreground': 'oklch(0.985 0 0)',
      'sidebar-primary': 'oklch(0.488 0.243 264.376)',
      'sidebar-primary-foreground': 'oklch(0.985 0 0)',
      'sidebar-accent': 'oklch(0.269 0 0)',
      'sidebar-accent-foreground': 'oklch(0.985 0 0)',
      'sidebar-border': 'oklch(0.32 0.005 264)',
      'sidebar-ring': 'oklch(0.55 0.15 180)',
    }
  },
  plugins: [],
}
