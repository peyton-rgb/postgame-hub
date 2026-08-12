// src/app/dashboard/submission-forms/fonts.ts
// ─────────────────────────────────────────────────────────────
// Anton is required by the approved split-layout design (the big submitted
// figure, and the initials fallback on brand marks) but is NOT loaded by the
// root layout. Scoped here rather than added globally, matching the precedent
// in src/app/portal/[token]/fonts.ts.
// ─────────────────────────────────────────────────────────────

import { Anton } from "next/font/google";

export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
