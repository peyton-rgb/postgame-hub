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
        // Reads --pg-orange-rgb. The channel var is deliberately not named after
        // the brand: --brand is a per-campaign client colour set at runtime, so
        // nothing in :root should carry that prefix. The Tailwind key stays
        // `brand` — 52 call sites use it.
        brand: "rgb(var(--pg-orange-rgb) / <alpha-value>)", // #D73F09, alpha-capable
        "brand-dark": "#B33407",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2-rgb) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        glass: "rgb(var(--white-rgb) / <alpha-value>)",
        // Fixed-alpha steps for the repo's three dominant white alphas. These
        // deliberately carry no <alpha-value>: the alpha comes from the token,
        // so bg-glass-2 is complete on its own and bg-glass-2/50 will NOT work.
        // For a one-off alpha keep using bg-glass/[0.055].
        // Keys are glass-* (they resolve to colours) but they read the
        // --alpha-* scalars, which are named apart from the --glass-* colour
        // tokens in globals.css so the two can't be confused.
        "glass-1": "rgb(var(--white-rgb) / var(--alpha-1))",
        "glass-2": "rgb(var(--white-rgb) / var(--alpha-2))",
        "glass-3": "rgb(var(--white-rgb) / var(--alpha-3))",
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
