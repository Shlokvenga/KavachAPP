/** @type {import('tailwindcss').Config} */
// Colours follow the KLE Technological University brand guidebook:
// Deep Red is the primary colour, Nutmeg highlights calls to action, KLE Red is a
// sparing accent only, and the warm neutrals (Ivory, Sand, Quicksand, Slate) carry the UI.
module.exports = {
  content: ['./src/**/*.{jsx,js,html}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#6B170D', light: '#8A2414', dark: '#4A0F08', 50: '#FBF3F1', 100: '#F5E1DC' },
        accent: { DEFAULT: '#BFA682', light: '#E3D9C7', dark: '#8C7552' },
        klered: '#BF383C',
        ivory: '#F7F1EE',
        sand: '#E3D9C7',
        // Warm neutral scale built from Ivory → Quicksand → Slate, replacing Tailwind's cool slate.
        slate: {
          50: '#FAF7F5', 100: '#F3EEEA', 200: '#E6DED8', 300: '#D2C7BF', 400: '#A89A91', 500: '#7F716A',
          600: '#6B5E58', 700: '#544943', 800: '#433B36', 900: '#2A231F', 950: '#1B1411',
        },
      },
      fontFamily: {
        sans: ['Outfit Variable', 'Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Lora Variable', 'Lora', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
