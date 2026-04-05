/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'neutralb-600': 'var(--neutralb-600)',
        'textpb-01': 'var(--textpb-01)',
      },
      boxShadow: {
        khqr: '0 0 4px 2px rgba(0, 0, 0, 0.25)',
      },
      borderRadius: {
        khqr: '16px',
      },
    },
  },
  plugins: [],
}
