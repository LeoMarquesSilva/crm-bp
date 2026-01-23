/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#14324f',
          dark: '#101f2e',
        },
        sales: {
          DEFAULT: '#d5b170',
          light: '#e8d4a8',
        },
        post: {
          DEFAULT: '#2d936c',
          light: '#4fb88a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        'xl': '8px',
        '2xl': '12px',
        '3xl': '16px',
        '4xl': '20px',
        '5xl': '24px',
        '6xl': '28px',
      },
      transitionDuration: {
        '280': '280ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
      },
    },
  },
  plugins: [],
}
