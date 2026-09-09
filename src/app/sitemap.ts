// ============================================================
// Sitemap.
//
// There was none before this file — not in public/, not as a route — so nothing
// on the site was being offered to a crawler, the ~400 deal pages included.
//
// WHAT IS IN: the public marketing surface, and the three dynamic sets whose
// rows are explicitly published — deals, case studies and campaign recaps —
// plus the client directory.
//
// WHAT IS DELIBERATELY OUT, because a sitemap is a claim that a URL is worth
// indexing:
//   - token-gated deliverables: /deliver, /pkg, /review, /submit, /v
//   - brand- and athlete-facing workflow: /brief, /optin, /campaign-optin,
//     /campaign-instructions, /creator-brief
//   - staff surfaces: /board, /media-library, /packages, /login, /authorize,
//     /reset-password  (robots.ts disallows the dashboard itself)
//   - "/" — it redirects to /dashboard/readiness and is not a public page
//   - the quiz microsites and run-of-show city pages, which are campaign
//     ephemera rather than evergreen marketing
// ============================================================

import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app").replace(/\/$/, "");

/** Evergreen marketing pages, highest value first. */
const STATIC_ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/homepage", priority: 1.0, freq: "weekly" },
  { path: "/deals", priority: 0.9, freq: "daily" },
  { path: "/clients", priority: 0.8, freq: "weekly" },
  { path: "/campaigns", priority: 0.8, freq: "weekly" },
  { path: "/work", priority: 0.7, freq: "weekly" },
  { path: "/case-studies", priority: 0.7, freq: "weekly" },
  { path: "/services/scaled", priority: 0.6, freq: "monthly" },
  { path: "/services/elevated", priority: 0.6, freq: "monthly" },
  { path: "/services/always-on", priority: 0.6, freq: "monthly" },
  { path: "/services/experiential", priority: 0.6, freq: "monthly" },
  { path: "/about/team", priority: 0.5, freq: "monthly" },
  { path: "/press", priority: 0.5, freq: "weekly" },
  { path: "/contact", priority: 0.5, freq: "monthly" },
];

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));

  // A failure here must not take the sitemap down — an incomplete sitemap is
  // recoverable, a 500 on /sitemap.xml is not.
  try {
    const supabase = db();

    // Deals. Archived rows are excluded: they are published:true but retired,
    // and offering them for indexing would be a claim we do not mean.
    const { data: deals } = await supabase
      .from("deals")
      .select("slug, updated_at")
      .eq("published", true)
      .neq("status", "archived");

    for (const d of deals ?? []) {
      if (!d.slug) continue;
      entries.push({
        url: `${BASE}/deals/${d.slug}`,
        lastModified: d.updated_at ? new Date(d.updated_at) : now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }

    const { data: studies } = await supabase
      .from("case_studies").select("slug, updated_at").eq("published", true);
    for (const s of studies ?? []) {
      if (!s.slug) continue;
      entries.push({
        url: `${BASE}/case-studies/${s.slug}`,
        lastModified: s.updated_at ? new Date(s.updated_at) : now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }

    const { data: recaps } = await supabase
      .from("campaign_recaps").select("slug, updated_at").eq("published", true);
    for (const c of recaps ?? []) {
      if (!c.slug) continue;
      entries.push({
        url: `${BASE}/campaign/${c.slug}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }

    const { data: brands } = await supabase
      .from("brands").select("slug, updated_at").eq("archived", false).not("slug", "is", null);
    for (const b of brands ?? []) {
      if (!b.slug) continue;
      entries.push({
        url: `${BASE}/clients/${b.slug}`,
        lastModified: b.updated_at ? new Date(b.updated_at) : now,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  } catch {
    // Static routes still ship.
  }

  return entries;
}
