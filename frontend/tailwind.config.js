module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Light: warm beige base
        // Dark: deep navy base
        surface: {
          light: '#f4f1ed',
          card: '#fffcf8',
          dark: '#0a0d14',
          'dark-card': '#0d1117',
        },
      },
      fontSize: {
        'xs': ['13px', { lineHeight: '1.6' }],
        'sm': ['14px', { lineHeight: '1.65' }],
        'base': ['15px', { lineHeight: '1.7' }],
        'lg': ['17px', { lineHeight: '1.6' }],
        'xl': ['19px', { lineHeight: '1.5' }],
        '2xl': ['22px', { lineHeight: '1.4' }],
        '3xl': ['28px', { lineHeight: '1.3' }],
        '4xl': ['34px', { lineHeight: '1.2' }],
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'reveal': 'reveal 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'float': 'float 3s ease-in-out infinite',
        'danger-glow': 'danger-glow 2s ease-in-out infinite',
        'wave': 'wave 1s ease-in-out infinite',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal': {
          from: { opacity: '0', transform: 'translateY(20px) scale(0.99)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'danger-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
          '50%': { boxShadow: '0 0 24px 4px rgba(239,68,68,0.15)' },
        },
        'wave': {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
    },
  },
  plugins: [],
}
