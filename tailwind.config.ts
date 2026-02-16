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
        brand: [
          'var(--font-syne)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        serif: [
          'var(--font-playfair)',
          'ui-serif',
          'Georgia',
          'Cambria',
          'serif',
        ],
      },
      fontSize: {
        // Semantic type scale (extends Tailwind defaults)
        'metric': ['1.75rem', { lineHeight: '2rem', letterSpacing: '-0.03em' }],
        'page-title': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        'section': ['0.8125rem', { lineHeight: '1.25rem', letterSpacing: '0.02em' }],
        'caption': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
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

        // Dream palette
        dream: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#7c6cf0',
          600: '#6c5ce7',
          700: '#5b4dc7',
          800: '#4c3fb0',
          900: '#3b2f8c',
          950: '#1e1654',
        },

        // Brand accent (adapts to dark mode via CSS variables)
        'accent-brand': 'var(--accent-brand)',
        'accent-brand-hover': 'var(--accent-brand-hover)',
        'accent-dream': 'var(--accent-dream)',
        'accent-glow': 'var(--accent-glow)',
        'accent-warm': 'var(--accent-warm)',
        'accent-pink': 'var(--accent-pink)',
        'accent-purple': 'var(--accent-purple)',
        'accent-orange': 'var(--accent-orange)',
        'accent-blue': 'var(--accent-blue)',

        // Backward compat aliases for accent-teal → accent-brand
        'accent-teal': 'var(--accent-brand)',
        'accent-teal-hover': 'var(--accent-brand-hover)',

        // Semantic colors
        'color-success': 'var(--color-success)',
        'color-warning': 'var(--color-warning)',
        'color-error': 'var(--color-error)',
        'color-info': 'var(--color-info)',

        // Backward compatibility (camelCase aliases)
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
        accentTeal: 'var(--accent-brand)',
        accentBrand: 'var(--accent-brand)',
        accentPink: 'var(--accent-pink)',
        accentPurple: 'var(--accent-purple)',
        accentOrange: 'var(--accent-orange)',
        accentBlue: 'var(--accent-blue)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shake: 'shake 0.5s ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;
