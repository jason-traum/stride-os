import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'var(--font-manrope)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'var(--font-geist-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'DEFAULT': 'var(--shadow-md)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
      },
      colors: {
        // Surface elevation system
        'surface-0': 'var(--surface-0)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        'surface-interactive': 'var(--surface-interactive)',
        'surface-interactive-hover': 'var(--surface-interactive-hover)',

        // Text hierarchy
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-disabled': 'var(--text-disabled)',

        // Borders
        'border-subtle': 'var(--border-subtle)',
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',

        // Accent colors (adapt to dark mode)
        'accent-teal': 'var(--accent-teal)',
        'accent-teal-hover': 'var(--accent-teal-hover)',
        'accent-pink': 'var(--accent-pink)',
        'accent-purple': 'var(--accent-purple)',
        'accent-orange': 'var(--accent-orange)',
        'accent-blue': 'var(--accent-blue)',

        // Semantic colors
        'color-success': 'var(--color-success)',
        'color-warning': 'var(--color-warning)',
        'color-error': 'var(--color-error)',
        'color-info': 'var(--color-info)',

        // Backward compatibility
        bgPrimary: 'var(--bg-primary)',
        bgSecondary: 'var(--bg-secondary)',
        bgTertiary: 'var(--bg-tertiary)',
        bgInteractive: 'var(--bg-interactive)',
        bgInteractiveHover: 'var(--bg-interactive-hover)',
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        textTertiary: 'var(--text-tertiary)',
        borderPrimary: 'var(--border-primary)',
        borderSecondary: 'var(--border-secondary)',
        accentTeal: 'var(--accent-teal)',
        accentPink: 'var(--accent-pink)',
        accentPurple: 'var(--accent-purple)',
        accentOrange: 'var(--accent-orange)',
        accentBlue: 'var(--accent-blue)',
        // Legacy semantic color tokens for compatibility
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border) / <alpha-value>)',
          muted: 'rgb(var(--border-muted) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          subtle: 'rgb(var(--content-subtle) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          muted: 'rgb(var(--accent-muted) / <alpha-value>)',
          subtle: 'rgb(var(--accent-subtle) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
