/** @type {import('tailwindcss').Config} */
// CAMIQ theme: obsidian background, glass cards, telemetry cyan for primary actions
// (rose pink for female students), coral for emergencies, emerald for safe, amber for
// warnings. Inter text, Sora headings, IBM Plex Mono labels. Sharper corners than before.
// The neutral scale is inverted (slate-50 is darkest, slate-900 is lightest) and the
// light status tints (red-50 … red-200) become translucent glows, so the same class
// names read correctly on a dark UI.
const colors = require('tailwindcss/colors');

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const onDark = (c) => ({
  ...c,
  50: rgba(c[500], 0.08),
  100: rgba(c[500], 0.15),
  200: rgba(c[500], 0.3),
  700: c[300],
  800: c[200],
  900: c[100],
});

module.exports = {
  content: ['./src/**/*.{jsx,js,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#05090d',
        card: 'rgb(var(--card) / <alpha-value>)',
        raise: '#0e1a21',
        line: 'rgb(var(--line) / 0.24)',
        // brand follows the active theme: cyan for Guard/Admin, pink (female) or blue (male) for the student app
        brand: { DEFAULT: 'rgb(var(--brand) / <alpha-value>)', light: 'rgb(var(--brand-light) / <alpha-value>)', dark: 'rgb(var(--brand-dark) / <alpha-value>)', 50: 'rgb(var(--brand) / 0.07)', 100: 'rgb(var(--brand) / 0.14)' },
        accent: { DEFAULT: 'rgb(var(--brand) / <alpha-value>)', light: 'rgb(var(--brand) / 0.2)', dark: 'rgb(var(--brand-light) / <alpha-value>)' },
        coral: '#F43F5E',
        slate: {
          50: '#070d12', 100: '#0e1920', 200: '#17262f', 300: '#22353f', 400: '#4b6370', 500: '#7b929c',
          600: '#9db1b9', 700: '#bccbd1', 800: '#d6e2e6', 900: '#e8f2f4', 950: '#f4f9fa',
        },
        red: onDark(colors.rose),
        emerald: onDark(colors.emerald),
        amber: onDark(colors.amber),
        violet: onDark(colors.violet),
        yellow: onDark(colors.yellow),
        orange: onDark(colors.orange),
        blue: onDark(colors.sky),
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora Variable', 'Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl: '0.5rem', '2xl': '0.75rem', '3xl': '0.875rem' },
    },
  },
  plugins: [],
};
