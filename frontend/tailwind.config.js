/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Ruhige, reduzierte Palette – warmes Grau mit einem gedeckten Salbei-Akzent
        surface: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#141210',
        },
        accent: {
          400: '#7ca982',
          500: '#5f8f68',
          600: '#4c7354',
          700: '#3d5c44',
        },
      },
      maxWidth: {
        content: '48rem',
      },
    },
  },
  plugins: [],
};
