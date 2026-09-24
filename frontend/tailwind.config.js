/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        space:   ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      colors: {
        // Brand — indigo, flattened (no gradients in product chrome)
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Kept so existing `primary-*` usages keep rendering
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },

      // Motion tokens — the built-in CSS easings are too weak to read as deliberate
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      transitionDuration: {
        press: '140ms',
        tooltip: '160ms',
        pop: '200ms',
        panel: '260ms',
      },

      borderRadius: {
        card: '14px',
      },

      boxShadow: {
        // Layered, low-opacity — one shadow reads as a sticker
        xs:    '0 1px 2px rgba(15, 23, 42, 0.04)',
        sm:    '0 1px 2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)',
        md:    '0 2px 4px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.06)',
        lg:    '0 4px 8px rgba(15, 23, 42, 0.05), 0 12px 28px rgba(15, 23, 42, 0.09)',
        pop:   '0 8px 16px rgba(15, 23, 42, 0.07), 0 20px 44px rgba(15, 23, 42, 0.12)',
        ring:  '0 0 0 3px rgba(99, 102, 241, 0.16)',
      },

      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        // A sweep reads as "loading". A pulse reads as "broken".
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms cubic-bezier(0.23, 1, 0.32, 1) both',
        shimmer:   'shimmer 1.3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        // Faster than the default 1s — a quicker spinner makes load feel shorter
        'spin-fast': 'spin 620ms linear infinite',
      },
    },
  },
  plugins: [],
}
