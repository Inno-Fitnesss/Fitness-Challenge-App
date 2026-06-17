/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
      extend: {
        colors: {
          brand: {
            DEFAULT: '#EB5728',
            hover: '#D94B1D',
            light: '#FFF0EB',
          },
          success: '#D2EBAA',
          accent: '#F5CB91',
          neutral: {
            text: '#1F2937',
            secondary: '#6B7280',
            card: '#F8F9FA',
            border: '#E5E7EB',
          },
        },
        borderRadius: {
          '2xl': '16px',
          '3xl': '24px',
        },
        boxShadow: {
          card: '0 4px 24px rgba(0,0,0,0.06)',
          'card-hover': '0 8px 40px rgba(0,0,0,0.10)',
          modal: '0 20px 60px rgba(0,0,0,0.15)',
        },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
        },
      },
    },
    plugins: [],
  };
