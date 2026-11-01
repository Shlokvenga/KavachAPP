/** @type {import('tailwindcss').Config} */
// Dark "tactical HUD" theme (from the CAMIQ design): obsidian background, telemetry
// cyan for primary actions (pink / blue in the student app by gender), coral for emergencies, emerald for safe, amber for warnings.
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
        card: '#0a1218',
        raise: '#0e1a21',
        line: 'rgba(112, 161, 177, 0.24)',
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
        sans: ['Plus Jakarta Sans Variable', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk Variable', 'Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
