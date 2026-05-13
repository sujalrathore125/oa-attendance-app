/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delay': 'float 8s ease-in-out 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(3deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        oa: {
          primary:    '#4F46E5',
          secondary:  '#7C3AED',
          accent:     '#06B6D4',
          neutral:    '#1F2937',
          'base-100': '#F9FAFB',
          'base-200': '#F3F4F6',
          'base-300': '#E5E7EB',
          'base-content': '#1F2937',
          info:       '#3B82F6',
          success:    '#10B981',
          warning:    '#F59E0B',
          error:      '#EF4444',
        },
      },
      {
        'oa-dark': {
          primary:    '#6366F1',
          secondary:  '#8B5CF6',
          accent:     '#22D3EE',
          neutral:    '#1E293B',
          'base-100': '#0F172A',
          'base-200': '#1E293B',
          'base-300': '#334155',
          'base-content': '#E2E8F0',
          info:       '#60A5FA',
          success:    '#34D399',
          warning:    '#FBBF24',
          error:      '#F87171',
        },
      },
    ],
    defaultTheme: 'oa-dark',
  },
};
