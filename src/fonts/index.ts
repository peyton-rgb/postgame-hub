import localFont from "next/font/local";

// Every font the Hub uses, self-hosted.
//
// These used to come from next/font/google, which downloads each font from
// Google during every build. In Nov 2026 Google's font file URLs stopped ending
// in .woff2, Next 14's loader crashes on that ("Cannot read properties of null
// (reading '1')"), and every uncached build failed. The files in ./files are the
// same fonts (latin subset, from the @fontsource npm packages, OFL-licensed), so
// pages render identically and the build never talks to Google.
//
// Variable names are unchanged from the Google setup, so no CSS had to move.

export const bebasNeue = localFont({
  src: [{ path: "./files/bebas-neue-latin-400-normal.woff2", weight: "400", style: "normal" }],
  variable: "--font-bebas",
  display: "swap",
});

// Anton ships one weight only. Campaign titles and stat figures.
export const anton = localFont({
  src: [{ path: "./files/anton-latin-400-normal.woff2", weight: "400", style: "normal" }],
  variable: "--font-anton",
  display: "swap",
});

// Body copy. 700 is the pull-quote cut.
export const arimo = localFont({
  src: [
    { path: "./files/arimo-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/arimo-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-arimo",
  display: "swap",
});

export const jetbrainsMono = localFont({
  src: [
    { path: "./files/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/jetbrains-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

// The athlete app's faces (join flow + opt-in preview).
export const poppins = localFont({
  src: [
    { path: "./files/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./files/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./files/poppins-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const inter = localFont({
  src: [
    { path: "./files/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./files/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./files/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./files/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});
