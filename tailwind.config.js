/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        capybara: {
          50: '#fdf8f3',
          100: '#f8ede1',
          200: '#f0d9c3',
          300: '#e5be9a',
          400: '#d89f6f',
          500: '#cc844f',
          600: '#be6f43',
          700: '#9e5839',
          800: '#7f4733',
          900: '#673b2c',
          950: '#371c15',
        },
        brand: {
          primary: '#8B4513', // Warm brown
          secondary: '#D2691E', // Chocolate
          accent: '#FFD700', // Gold
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
