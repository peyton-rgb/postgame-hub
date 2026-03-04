/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Arial", "Helvetica Neue", "Helvetica", "sans-serif"],
      },
      colors: {
        brand: "#D73F09",
        "brand-dark": "#B33407",
      },
      fontSize: {
        "recap-body": ["24px", { lineHeight: "1.4" }],
        "recap-footer": ["18px", { lineHeight: "1.2" }],
        "recap-body-mobile": ["14px", { lineHeight: "1.4" }],
        "recap-footer-mobile": ["11px", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [],
};
