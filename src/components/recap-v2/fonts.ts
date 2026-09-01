import { Anton, Arimo } from "next/font/google";

// Anton and Arimo are required by the v2 recap design but are NOT loaded by
// the root layout, which carries Bebas Neue, Inter and JetBrains Mono. Loading
// them here scopes them to the recap subtree rather than adding two families
// to every page in the app. Same pattern, and same reasoning, as
// src/components/portal/fonts.ts.
//
// Anton is the numeral face — stat figures only. Arimo is body copy. Bebas
// Neue (--font-bebas) and JetBrains Mono (--font-mono) come from the root
// layout and need no loading here.

export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

export const arimo = Arimo({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-arimo",
  display: "swap",
});
