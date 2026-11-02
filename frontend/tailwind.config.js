/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--primary-50, #edf5f1)',
          100: 'var(--primary-100, #d9eae2)',
          200: 'var(--primary-200, #b5d5c5)',
          300: 'var(--primary-300, #87bca4)',
          400: 'var(--primary-400, #529a7a)',
          500: 'var(--primary-500, #176b52)',
          600: 'var(--primary-600, #145a46)',
          700: 'var(--primary-700, #104b3a)',
          800: 'var(--primary-800, #0b3c2e)',
          900: 'var(--primary-900, #082f24)',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#eeeeee',
          300: '#e0e0e0',
          400: '#bdbdbd',
          500: '#9e9e9e',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
