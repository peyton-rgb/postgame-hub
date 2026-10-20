// ============================================================
// The Postgame mark for the public sign-up pages.
//
// Standing brand rule: the mark is always the real logo FILE from the
// brands table row, never typed as text. Same lookup /admin/layout.tsx
// does, with the static /public copies as a fallback so a database blip
// never leaves a page without a logo.
//
//   onDark  = light-ink mark (logo_light_url)  → dark app screens
//   onLight = dark-ink mark  (logo_dark_url, then logo_primary_url)
//             → the white /desktop download page
// The column name describes the INK, not the background (CLAUDE.md).
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";

export const POSTGAME_BRAND_ID = "7a0e28e9-d62f-427d-a207-cd22596fcf50";

export interface PostgameLogos {
  onDark: string;
  onLight: string;
}

const FALLBACK: PostgameLogos = {
  onDark: "/postgame-logo-white.png",
  onLight: "/postgame-logo-primary.png",
};

export async function getPostgameLogos(): Promise<PostgameLogos> {
  try {
    const supabase = createServiceSupabase();
    const { data } = await supabase
      .from("brands")
      .select("logo_light_url, logo_dark_url, logo_primary_url")
      .eq("id", POSTGAME_BRAND_ID)
      .maybeSingle();
    return {
      onDark: data?.logo_light_url || FALLBACK.onDark,
      onLight: data?.logo_dark_url || data?.logo_primary_url || FALLBACK.onLight,
    };
  } catch {
    return FALLBACK;
  }
}
