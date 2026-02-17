import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E7F5FF',
          100: '#B8DCFF',
          200: '#89C3FF',
          300: '#5AABFF',
          400: '#45D1FF',
          500: '#008BF5',
          600: '#0066CC',
          700: '#0052B4',
          800: '#1B4E8C',
          900: '#0A1930',
        },
      },
    },
  },
  plugins: [],
};

export default config;
