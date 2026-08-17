import { Anton, Arimo } from "next/font/google";

// Anton and Arimo are required by the design system but are NOT loaded by the
// root layout (which carries Bebas Neue, Inter and JetBrains Mono). Loading
// them here scopes them to the portal subtree — the root layout feeds 34 other
// surfaces and is explicitly out of scope for this PR.
//
// Anton is for campaign titles and stat figures only. Arimo is body copy.

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
