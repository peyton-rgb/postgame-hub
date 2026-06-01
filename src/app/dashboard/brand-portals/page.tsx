"use client";

// Internal admin screen: pick a brand and open its private brand portal.
// Login-gated by the dashboard middleware like every other /dashboard page.
// Self-contained stopgap — reads only the brands table, adds no columns; will
// eventually fold into the brand-admin. Links use each brand's existing
// portal_token (/portal/{token}); brands without one show "No link yet".

import { useEffect, useMemo, useState } from "react";
import DashboardContent from "@/components/DashboardContent";
import { createBrowserSupabase } from "@/lib/supabase";

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

function brandLogo(b: Brand): string | null {
  return b.logo_primary_url || b.logo_dark_url || b.logo_light_url || b.logo_white_url || null;
}

export default function BrandPortalsPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, name, portal_token, logo_primary_url, logo_dark_url, logo_light_url, logo_white_url, archived")
        .order("name");
      if (cancelled) return;
      setBrands((data as Brand[]) || []);
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
      <h1 className="text-2xl font-bold text-white mb-1">Brand Portals</h1>
      <p className="text-sm text-white/40 mb-6">
        Open a brand&rsquo;s private portal or copy its shareable link.
      </p>

      <input
        type="text"
        placeholder="Search brands…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#D73F09]/50 transition-colors mb-4"
      />

      {brands === null ? (
        <p className="text-sm text-white/30 py-10 text-center">Loading brands…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-white/30 py-10 text-center">
          {brands.length === 0 ? "No brands found." : "No brands match your search."}
        </p>
      ) : (
        <>
          <p className="text-xs text-white/30 mb-3">
            {filtered.length} {filtered.length === 1 ? "brand" : "brands"}
          </p>
          <div className="flex flex-col gap-2">
            {filtered.map((b) => {
              const logo = brandLogo(b);
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-4 bg-[#111] border border-white/[0.06] rounded-xl px-4 py-3 hover:border-white/15 transition-colors"
                >
                  {/* Logo */}
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {logo ? (
                      <img src={logo} alt={b.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-xs font-bold text-white/30">
                        {(b.name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate flex items-center gap-2">
                      {b.name || "Untitled brand"}
                      {b.archived ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-white/30 border border-white/15 rounded px-1.5 py-0.5">
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
                          className="text-xs font-semibold bg-[#D73F09] hover:bg-[#c0380a] text-white rounded-lg px-3 py-2 transition-colors"
                        >
                          View portal
                        </a>
                        <button
                          onClick={() => copyLink(b)}
                          className="text-xs font-semibold border border-white/15 text-white/70 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 transition-colors"
                        >
                          {copiedId === b.id ? "Copied!" : "Copy link"}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-white/30 italic px-3 py-2">No link yet</span>
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
