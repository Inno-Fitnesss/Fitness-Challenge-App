/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF5722',
          hover: '#E64A19',
          light: '#FFF0EB',
        },
        lime: {
          DEFAULT: '#A3E635',
          hover: '#84CC16',
          light: '#ECFCCB',
          pale: '#F7FEE7',
        },
        success: '#D2EBAA',
        accent: '#F5CB91',
        neutral: {
          text: '#1F2937',
          secondary: '#6B7280',
          card: '#F5F5F5',
          border: '#E5E7EB',
          muted: '#9CA3AF',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.10)',
        modal: '0 20px 60px rgba(0, 0, 0, 0.15)',
        sidebar: '1px 0 0 #E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
