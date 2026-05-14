/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          darkest: '#212529',
          dark:    '#18252A',
          teal:    '#004445',
          teal2:   '#004544',
          light:   '#EAF0F0',
          gold:    '#FEB70D',
          surface: '#F2F2F2',
        },
      },
    },
  },
  plugins: [],
};
