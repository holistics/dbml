/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        black: '#1c2128',
        dark: '#1e1e1e',
        white: '#eeeeee',
      }
    },
  },
  plugins: [],
}
