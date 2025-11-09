/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,js,ts,jsx,tsx}", "./app/**/*.{ts,tsx}"],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        // New neutral system
        'bg-base': 'var(--bg-base)',
        'bg-surface': 'var(--bg-surface)',
        'bg-raised': 'var(--bg-raised)',
        'text-strong': 'var(--text-strong)',
        'text-muted': 'var(--text-muted)',
        'highlight': 'var(--highlight)',
      },
      boxShadow: {
        'elevation': '0 1px 3px var(--shadow-1), 0 8px 16px var(--shadow-2)',
        'elevation-lg': '0 4px 6px var(--shadow-1), 0 12px 32px var(--shadow-2)',
      },
      backgroundImage: {
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
        'gradient-subtle': 'linear-gradient(to bottom, var(--bg-raised), var(--bg-surface))',
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
