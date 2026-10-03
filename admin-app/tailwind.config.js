/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: '#f8fafc',
      },
      boxShadow: {
        ambient: '0 2px 8px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}
