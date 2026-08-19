// src/app/w9/page.tsx
// ─────────────────────────────────────────────────────────────
// PUBLIC videographer W-9 page. No login, no token — the URL is the whole
// entry. Anyone Postgame pays can be sent here.
//
// Design: the approved dark direction, signed off 19 Aug 2026. It is a visual
// clone of the athlete submit page at /submit/[token] — same black ground
// (#07070A), same translucent cards with orange mono tab headers, same sticky
// mark over the 4px orange rule, same one light screen at the end — with W-9
// content in place of media upload.
//
// This file is the server half: it does nothing but resolve Postgame's marks
// out of the `brands` table and hand them to the form. The marks are never
// typed as literal URLs — they live on the brand row so a rebrand is one
// database edit, not a code change.
// ─────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { createServiceSupabase } from "@/lib/supabase";
import W9Form from "./W9Form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Send us your W-9 · Postgame",
  description: "Upload your signed W-9 so Postgame can pay you.",
  // A tax form is not a page we want indexed or shared into search results.
  robots: { index: false, follow: false },
};

// Postgame's own brand row. The variant names describe the INK, not the
// background they belong on, which is the trap every time:
//   logo_primary_url = white wordmark + orange plus  → the dark pages
//   logo_dark_url    = black wordmark + orange plus  → the light done screen
const POSTGAME_BRAND_ID = "7a0e28e9-d62f-427d-a207-cd22596fcf50";

export default async function W9Page() {
  const supabase = createServiceSupabase();

  const { data, error } = await supabase
    .from("brands")
    .select("logo_primary_url, logo_dark_url")
    .eq("id", POSTGAME_BRAND_ID)
    .single();

  // Destructured on purpose: a swallowed error here renders a page with no
  // mark at all, which looks like a broken deploy rather than a missing row.
  if (error) {
    console.error("[w9] couldn't load Postgame branding", error);
  }

  return (
    <W9Form
      logoPrimaryUrl={data?.logo_primary_url ?? null}
      logoDarkUrl={data?.logo_dark_url ?? null}
    />
  );
}
