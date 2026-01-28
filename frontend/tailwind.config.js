/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#0073e6',
          600: '#005bb3',
        },
        success: {
          500: '#52c41a',
          600: '#389e0d',
        },
        warning: {
          500: '#faad14',
          600: '#d48806',
        },
        danger: {
          500: '#ff4d4f',
          600: '#cf1322',
        },
        neutral: {
          100: '#f0f0f0',
          200: '#d9d9d9',
          300: '#bfbfbf',
          400: '#8c8c8c',
          500: '#595959',
          600: '#262626',
          700: '#141414',
        }
      },
      fontFamily: {
        inter: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}