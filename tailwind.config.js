/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: [
          '"Source Han Serif SC"',
          '"Noto Serif SC"',
          '"Songti SC"',
          'SimSun',
          'serif',
        ],
        sans: [
          '"PingFang SC"',
          '"Microsoft YaHei"',
          '"Source Han Sans SC"',
          '"Noto Sans SC"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        paper: {
          50: '#faf7f2',
          100: '#f4efe6',
          200: '#e9e1d2',
          300: '#d8ccb6',
        },
        ink: {
          50: '#f3f1ed',
          100: '#dcd7cf',
          200: '#b5aea2',
          300: '#8a8275',
          400: '#5f574b',
          500: '#3d362d',
          600: '#2b2520',
          700: '#1d1915',
          800: '#141110',
        },
        accent: {
          50: '#edf7f6',
          100: '#d2ebe8',
          200: '#a4d7d1',
          300: '#6ebcb4',
          400: '#3d9e95',
          500: '#2d7f78',
          600: '#235f5a',
        },
      },
      typography: {},
    },
  },
  plugins: [],
};
