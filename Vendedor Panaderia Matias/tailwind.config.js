/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        crema: '#f3efe6',
        papel: '#fbf8f2',
        tinta: '#1f1a17',
        cafe: '#5b3924',
        caramelo: '#b77b42',
        borde: '#dccdb7',
        verdeok: '#2f6b47',
        rojoaviso: '#9d3b2f'
      },
      boxShadow: {
        panel: '0 18px 40px rgba(63, 43, 23, 0.08)'
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif']
      }
    }
  },
  plugins: []
};
