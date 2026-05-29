/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kgms: {
          navy: '#111827',
          panel: '#ffffff',
          canvas: '#f6f7f9',
          border: '#e2e8f0',
        },
      },
      boxShadow: {
        workbench: '0 16px 36px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
}
