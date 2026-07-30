/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Arial", "Helvetica Neue", "Helvetica", "sans-serif"],
        // Bebas Neue and JetBrains Mono are loaded by next/font in
        // src/app/layout.tsx, which exposes them as CSS variables on <html>.
        // These entries must reference those variables — not the family names —
        // or the utilities resolve to nothing.
        display: ["var(--font-bebas)", "Bebas Neue", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      colors: {
        // <alpha-value> is Tailwind's placeholder for whatever follows the
        // slash in a class, so bg-surface/50 -> rgb(7 7 10 / 0.5). The channel
        // vars live in src/app/globals.css :root.
        // No `orange` key: that would clobber Tailwind's default orange
        // palette, which is in use 8x (bg-orange-700, text-orange-300, ...).
        brand: "rgb(var(--brand-rgb) / <alpha-value>)", // was "#D73F09" — same colour, now alpha-capable
        "brand-dark": "#B33407",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2-rgb) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        glass: "rgb(var(--white-rgb) / <alpha-value>)",
      },
      fontSize: {
        "recap-body": ["24px", { lineHeight: "1.4" }],
        "recap-footer": ["18px", { lineHeight: "1.2" }],
        "recap-body-mobile": ["14px", { lineHeight: "1.4" }],
        "recap-footer-mobile": ["11px", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
