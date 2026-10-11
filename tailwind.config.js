/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        surface: '#1e293b',
        'surface-hover': '#334155',
        'surface-border': '#334155',
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        accent: {
          500: '#6366f1',
          600: '#4f46e5',
        }
      }
    },
  },
  plugins: [],
}
