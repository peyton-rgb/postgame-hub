"use client";

// Internal admin screen: pick a brand and open its private brand portal.
// Login-gated by the dashboard middleware like every other /dashboard page.
// Self-contained stopgap — reads only the brands table, adds no columns; will
// eventually fold into the brand-admin. Links use each brand's existing
// portal_token (/portal/{token}); brands without one show "No link yet".

import { useEffect, useMemo, useState } from "react";
import DashboardContent from "@/components/DashboardContent";
import { createBrowserSupabase } from "@/lib/supabase";
import {
  BRAND_LOGO_COLUMNS,
  groupLogosByBrand,
  pickBrandLogo,
  resolveBrandLogo,
  type BrandLogoRow,
  type HubTheme,
} from "@/lib/brand-logo";
import { useHubTheme } from "@/lib/use-hub-theme";

type Brand = {
  id: string;
  name: string;
  portal_token: string | null;
  logo_primary_url: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  logo_white_url: string | null;
  archived: boolean | null;
};

// The cell is a 40x40 square on a surface-card tile, so this asks for a mark in
// the tile's own variant and falls back through the chain from there. The legacy
// columns stay underneath for brands with no brand_logos rows.
//
// THE SURFACE FOLLOWS THE ACTIVE THEME, and it has to move in lockstep with the
// card it sits on. Until this page's chrome was migrated, every card here was
// hardcoded dark (bg-[#111]) and this was pinned to "dark" for that reason — a
// logo resolved for light mode would have been dark ink on a black tile. Now the
// tile is bg-surface-card, which follows the theme, so the logo must too. If
// either one is ever pinned again, pin both.
//
// The legacy fallback used to be a hand-rolled chain:
//   logo_primary_url || logo_dark_url || logo_light_url || logo_white_url
// which reached for logo_dark_url — DARK ink — ahead of logo_light_url on a
// dark card, and rendered it invisible. The column name describes the ink, not
// the background. pickBrandLogo() encodes that inversion once and, by design,
// never falls back to the opposite-ink variant at all.
function brandLogo(b: Brand, logos: BrandLogoRow[] | undefined, theme: HubTheme): string | null {
  const resolved = resolveBrandLogo(logos, { surface: theme, prefer: "mark" });
  if (resolved) return resolved.url;
  return pickBrandLogo(b, theme)?.url ?? b.logo_white_url ?? null;
}

export default function BrandPortalsPage() {
  const theme = useHubTheme();
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [logosByBrand, setLogosByBrand] = useState<Map<string, BrandLogoRow[]>>(new Map());
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;
    (async () => {
      // One bulk read alongside the brands query rather than a lookup per row.
      const [{ data }, { data: logoRows }] = await Promise.all([
        supabase
          .from("brands")
          .select("id, name, portal_token, logo_primary_url, logo_dark_url, logo_light_url, logo_white_url, archived")
          .order("name"),
        supabase.from("brand_logos").select(BRAND_LOGO_COLUMNS).limit(5000),
      ]);
      if (cancelled) return;
      setBrands((data as Brand[]) || []);
      setLogosByBrand(groupLogosByBrand((logoRows ?? []) as BrandLogoRow[]));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!brands) return [];
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name?.toLowerCase().includes(q));
  }, [brands, search]);

  const copyLink = (b: Brand) => {
    if (!b.portal_token) return;
    const url = `${window.location.origin}/portal/${b.portal_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(b.id);
    setTimeout(() => setCopiedId((cur) => (cur === b.id ? null : cur)), 1500);
  };

  return (
    <DashboardContent>
      <h1 className="text-2xl font-bold text-ink-1 mb-1">Brand Portals</h1>
      <p className="text-sm text-ink-4 mb-6">
        Open a brand&rsquo;s private portal or copy its shareable link.
      </p>

      <input
        type="text"
        placeholder="Search brands…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-surface-card border border-hairline-soft rounded-lg px-4 py-2.5 text-sm text-ink-1 placeholder:text-ink-4 focus:outline-none focus:border-accent/50 transition-colors mb-4"
      />

      {brands === null ? (
        <p className="text-sm text-ink-4 py-10 text-center">Loading brands…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-4 py-10 text-center">
          {brands.length === 0 ? "No brands found." : "No brands match your search."}
        </p>
      ) : (
        <>
          <p className="text-xs text-ink-4 mb-3">
            {filtered.length} {filtered.length === 1 ? "brand" : "brands"}
          </p>
          <div className="flex flex-col gap-2">
            {filtered.map((b) => {
              const logo = brandLogo(b, logosByBrand.get(b.id), theme);
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-4 bg-surface-card border border-hairline-soft rounded-xl px-4 py-3 hover:border-hairline transition-colors"
                >
                  {/* Logo */}
                  <div className="w-10 h-10 rounded-lg bg-surface-card border border-hairline-soft flex items-center justify-center overflow-hidden shrink-0">
                    {logo ? (
                      <img src={logo} alt={b.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-xs font-bold text-ink-4">
                        {(b.name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink-1 truncate flex items-center gap-2">
                      {b.name || "Untitled brand"}
                      {b.archived ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-ink-4 border border-hairline rounded px-1.5 py-0.5">
                          Archived
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {b.portal_token ? (
                      <>
                        <a
                          href={`/portal/${b.portal_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold bg-accent hover:bg-brand-dark text-white rounded-lg px-3 py-2 transition-colors"
                        >
                          View portal
                        </a>
                        <button
                          onClick={() => copyLink(b)}
                          className="text-xs font-semibold border border-hairline text-ink-3 hover:text-ink-1 hover:bg-surface-card rounded-lg px-3 py-2 transition-colors"
                        >
                          {copiedId === b.id ? "Copied!" : "Copy link"}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-ink-4 italic px-3 py-2">No link yet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DashboardContent>
  );
}
