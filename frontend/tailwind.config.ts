import type { Config } from 'tailwindcss'

const config: Config = {
  
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vanish: {
          50:  '#fff5f5',
          100: '#ffe3e3',
          200: '#ffc9c9',
          300: '#ffa8a8',
          400: '#ff6b6b',
          500: '#fa5252',
          600: '#f03e3e',
          700: '#e03131',
          800: '#c92a2a',
          900: '#b02525',
          // Gradient pair for expiring articles
          from: '#f97316',
          to:   '#ef4444',
        },
        verified: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        unverified: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        disputed: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        breaking: {
          DEFAULT: '#dc2626',
          dark: '#991b1b',
          glow: '#ef4444',
        },
      },
      animation: {
        countdown: 'countdown-pulse 1.5s ease-in-out infinite',
        breaking:  'breaking-flash 0.8s ease-in-out infinite',
        'fade-in':  'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'bar-shrink': 'barShrink 1s linear forwards',
      },
      keyframes: {
        'countdown-pulse': {
          '0%, 100%': { opacity: '1',   transform: 'scale(1)' },
          '50%':       { opacity: '0.6', transform: 'scale(1.02)' },
        },
        'breaking-flash': {
          '0%, 100%': { backgroundColor: '#dc2626' },
          '50%':      { backgroundColor: '#ef4444' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        barShrink: {
          from: { width: '100%' },
          to:   { width: '0%' },
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'category-tech':    'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        'category-world':   'linear-gradient(135deg, #10b981, #14b8a6)',
        'category-india':   'linear-gradient(135deg, #f97316, #FF9933)',
        'category-finance': 'linear-gradient(135deg, #22c55e, #eab308)',
        'category-sports':  'linear-gradient(135deg, #f59e0b, #ef4444)',
        'category-health':  'linear-gradient(135deg, #ec4899, #f97316)',
        'category-science': 'linear-gradient(135deg, #6366f1, #22d3ee)',
        'category-default': 'linear-gradient(135deg, #6b7280, #374151)',
      },
      boxShadow: {
        'card-hover': '0 20px 40px -10px rgba(0,0,0,0.2)',
        'card-breaking': '0 0 0 2px #ef4444, 0 20px 40px -10px rgba(239,68,68,0.3)',
      },
    },
  },
  plugins: [],
}

export default config
