/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{jsx,js,html}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1E3A8A', light: '#2B4FB8', dark: '#162C6B' },
        saffron: { DEFAULT: '#F59E0B', light: '#FEF3C7', dark: '#B45309' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
