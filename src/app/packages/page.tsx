"use client";

// Editor Asset Packages — staff index (Postgame Liquid Glass dark).
//
// Top-level route in the staff sidebar, like /media-library: it renders the
// unified DashboardSidebar and reads with the cookie-session browser client,
// so RLS is the gate — `authenticated` sees every package, `public` sees
// nothing here. New packages insert a draft row with an unguessable
// share_token; the public grab-and-go page lives at /pkg/[token].

import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";
import { createBrowserSupabase } from "@/lib/supabase";
import { PKG_ORANGE } from "@/lib/packages";
import { slugify } from "@/lib/packages";

type BrandLite = {
  name: string;
  logo_primary_url: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  logo_white_url: string | null;
};

type PackageRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "live";
  share_token: string;
  roster_label: string | null;
  brand_id: string;
  brand: BrandLite | null;
  talentCount: number;
};

function brandLogo(b: BrandLite | null): string | null {
  if (!b) return null;
  return b.logo_primary_url || b.logo_dark_url || b.logo_light_url || b.logo_white_url || null;
}

// 32 hex chars — same shape as the seeded share_token.
function newToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("");
}

const GLASS = {
  background: "rgba(255,255,255,0.055)",
  border: "1px solid rgba(255,255,255,0.10)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
} as const;

const BEBAS = { fontFamily: "var(--font-bebas), 'Bebas Neue', Arial, sans-serif" } as const;

export default function PackagesIndexPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [packages, setPackages] = useState<PackageRow[] | null>(null);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState<"all" | "live" | "draft">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // New-package form
  const [npName, setNpName] = useState("");
  const [npBrand, setNpBrand] = useState("");
  const [npRoster, setNpRoster] = useState<"Names" | "Athletes">("Names");

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("asset_packages")
      .select(
        "id, name, slug, status, share_token, roster_label, brand_id, brand:brands(name, logo_primary_url, logo_dark_url, logo_light_url, logo_white_url)"
      )
      .order("created_at", { ascending: false });
    if (error) {
      setErr(error.message);
      setPackages([]);
      return;
    }
    const rows = (data || []) as any[];

    // Talent counts in one shot, tallied client-side.
    const { data: talentRows, error: tErr } = await supabase
      .from("package_talent")
      .select("package_id");
    if (tErr) setErr(tErr.message);
    const counts = new Map<string, number>();
    for (const r of (talentRows || []) as { package_id: string }[]) {
      counts.set(r.package_id, (counts.get(r.package_id) || 0) + 1);
    }

    setPackages(
      rows.map((r) => ({
        ...r,
        brand: Array.isArray(r.brand) ? r.brand[0] ?? null : r.brand,
        talentCount: counts.get(r.id) || 0,
      })) as PackageRow[]
    );
  }, [supabase]);

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from("brands").select("id, name").order("name");
      setBrands((data as { id: string; name: string }[]) || []);
    })();
  }, [load, supabase]);

  const shown = useMemo(() => {
    if (!packages) return [];
    return filter === "all" ? packages : packages.filter((p) => p.status === filter);
  }, [packages, filter]);

  const copyShare = (p: PackageRow) => {
    const url = `${origin}/pkg/${p.share_token}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(p.id);
    window.setTimeout(() => setCopiedId((c) => (c === p.id ? null : c)), 1600);
  };

  const toggleStatus = async (p: PackageRow) => {
    const next = p.status === "live" ? "draft" : "live";
    setPackages((prev) =>
      (prev || []).map((x) => (x.id === p.id ? { ...x, status: next } : x))
    );
    const { error } = await supabase
      .from("asset_packages")
      .update({ status: next })
      .eq("id", p.id);
    if (error) {
      setErr(error.message);
      load(); // revert to server truth
    }
  };

  const createPackage = async () => {
    setErr(null);
    const name = npName.trim();
    if (!name || !npBrand) {
      setErr("Name and brand are required.");
      return;
    }
    setBusy(true);
    const base = slugify(name) || "package";
    const slug = `${base}-${newToken().slice(0, 6)}`;
    const { error } = await supabase.from("asset_packages").insert({
      name,
      slug,
      brand_id: npBrand,
      roster_label: npRoster,
      status: "draft",
      share_token: newToken(),
      settings: {},
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setShowNew(false);
    setNpName("");
    setNpBrand("");
    setNpRoster("Names");
    load();
  };

  return (
    <div style={{ background: "#07070a", minHeight: "100vh", color: "#FAF8F5" }}>
      <DashboardSidebar />
      <main className="ml-[240px]">
        <div
          style={{
            minHeight: "100vh",
            background:
              "radial-gradient(1200px 700px at 78% -8%, rgba(215,63,9,.16), transparent 60%), radial-gradient(900px 600px at 0% 110%, rgba(215,63,9,.08), transparent 55%), #07070a",
          }}
        >
          <div className="max-w-6xl mx-auto px-8 py-10">
            {/* Header */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 style={{ ...BEBAS, fontSize: "46px", lineHeight: 0.95, letterSpacing: "1px" }}>
                  EDITOR ASSET PACKAGES
                </h1>
                <p className="mt-1 text-sm max-w-[620px]" style={{ color: "#9a9aa2" }}>
                  Grab-and-go kits for videographers &amp; editors — logos, fonts, colors, and
                  searchable name tags. One per campaign, shareable by link.
                </p>
              </div>
              <button
                onClick={() => setShowNew(true)}
                className="rounded-[11px] px-[18px] py-3 text-[13px] font-bold uppercase tracking-[.4px] text-white"
                style={{ background: PKG_ORANGE }}
              >
                + New package
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mt-6 mb-5 flex-wrap">
              {(["all", "live", "draft"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="rounded-[20px] px-[14px] py-[7px] text-xs capitalize"
                  style={
                    filter === f
                      ? {
                          color: "#FAF8F5",
                          border: "1px solid rgba(215,63,9,.5)",
                          background: "rgba(215,63,9,.12)",
                        }
                      : { color: "#9a9aa2", border: "1px solid rgba(255,255,255,.10)", ...GLASS }
                  }
                >
                  {f}
                </button>
              ))}
            </div>

            {err ? (
              <div className="mb-4 text-[13px]" style={{ color: "#ff8a5c" }}>
                {err}
              </div>
            ) : null}

            {/* Grid */}
            {packages === null ? (
              <p className="text-sm" style={{ color: "#9a9aa2" }}>
                Loading…
              </p>
            ) : shown.length === 0 ? (
              <p className="text-sm" style={{ color: "#9a9aa2" }}>
                No packages yet. Create one with “New package”.
              </p>
            ) : (
              <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                {shown.map((p) => {
                  const logo = brandLogo(p.brand);
                  const share = `${origin}/pkg/${p.share_token}`;
                  return (
                    <div
                      key={p.id}
                      className="relative rounded-[18px] p-[18px] overflow-hidden"
                      style={GLASS}
                    >
                      {/* status pill + toggle */}
                      <button
                        onClick={() => toggleStatus(p)}
                        title="Click to toggle live / draft"
                        className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-[.6px] px-[9px] py-1 rounded-[20px]"
                        style={
                          p.status === "live"
                            ? {
                                background: "rgba(46,160,90,.16)",
                                color: "#57d98a",
                                border: "1px solid rgba(46,160,90,.3)",
                              }
                            : {
                                background: "rgba(255,255,255,.06)",
                                color: "#b7b7bf",
                                border: "1px solid rgba(255,255,255,.10)",
                              }
                        }
                      >
                        {p.status}
                      </button>

                      {/* head */}
                      <div className="flex items-center gap-3 mb-[14px] pr-16">
                        <div
                          className="w-[46px] h-[46px] rounded-[11px] flex-none flex items-center justify-center overflow-hidden"
                          style={{ background: "rgba(255,255,255,.9)" }}
                        >
                          {logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={logo}
                              alt={p.brand?.name || "brand"}
                              className="max-w-full max-h-full object-contain p-1"
                            />
                          ) : (
                            <span className="text-[11px] font-bold text-black">
                              {(p.brand?.name || "?").slice(0, 3).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] uppercase tracking-[1px]" style={{ color: "#9a9aa2" }}>
                            {p.brand?.name || "—"}
                          </div>
                          <div style={{ ...BEBAS, fontSize: "26px", lineHeight: 0.95, letterSpacing: ".5px" }}>
                            {p.name}
                          </div>
                        </div>
                      </div>

                      {/* stat */}
                      <div className="flex gap-4 my-[6px] mb-4">
                        <div>
                          <div style={{ ...BEBAS, fontSize: "24px" }}>{p.talentCount}</div>
                          <div className="text-[10px] uppercase tracking-[.7px] mt-[1px]" style={{ color: "#9a9aa2" }}>
                            {p.roster_label || "Names"}
                          </div>
                        </div>
                      </div>

                      {/* share */}
                      <div
                        className="flex items-center gap-2 rounded-[10px] px-[11px] py-[9px] mb-3"
                        style={{ background: "rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.10)" }}
                      >
                        <span
                          className="flex-1 text-[11px] whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ fontFamily: "var(--font-mono), monospace", color: "#c9c9d2" }}
                        >
                          /pkg/{p.share_token}
                        </span>
                        <button
                          onClick={() => copyShare(p)}
                          className="text-[10px] font-bold uppercase tracking-[.5px] whitespace-nowrap"
                          style={{ color: PKG_ORANGE }}
                        >
                          {copiedId === p.id ? "Copied" : "Copy"}
                        </button>
                      </div>

                      {/* actions */}
                      <div className="flex gap-2">
                        <a
                          href={share}
                          target="_blank"
                          rel="noopener"
                          className="flex-1 text-center rounded-[10px] py-[10px] text-[12px] font-bold uppercase tracking-[.4px] text-white"
                          style={{ background: PKG_ORANGE }}
                        >
                          Open
                        </a>
                        <button
                          onClick={() => copyShare(p)}
                          className="flex-1 text-center rounded-[10px] py-[10px] text-[12px] font-bold uppercase tracking-[.4px]"
                          style={{ color: "#FAF8F5", border: "1px solid rgba(255,255,255,.10)", ...GLASS }}
                        >
                          Share
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New package modal */}
      {showNew ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.6)" }}
          onClick={() => setShowNew(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-[18px] p-6"
            style={{ background: "#111116", border: "1px solid rgba(255,255,255,.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ ...BEBAS, fontSize: "28px", letterSpacing: ".5px" }}>NEW PACKAGE</h2>
            <label className="block mt-4 text-[11px] uppercase tracking-[1px]" style={{ color: "#9a9aa2" }}>
              Campaign name
            </label>
            <input
              value={npName}
              onChange={(e) => setNpName(e.target.value)}
              placeholder="e.g. Silver Cleat"
              className="w-full mt-1 rounded-[10px] px-3 py-[10px] text-sm outline-none"
              style={{ background: "#0a0a0e", border: "1px solid rgba(255,255,255,.14)", color: "#FAF8F5" }}
            />
            <label className="block mt-4 text-[11px] uppercase tracking-[1px]" style={{ color: "#9a9aa2" }}>
              Brand
            </label>
            <select
              value={npBrand}
              onChange={(e) => setNpBrand(e.target.value)}
              className="w-full mt-1 rounded-[10px] px-3 py-[10px] text-sm outline-none"
              style={{ background: "#0a0a0e", border: "1px solid rgba(255,255,255,.14)", color: "#FAF8F5" }}
            >
              <option value="">Select a brand…</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <label className="block mt-4 text-[11px] uppercase tracking-[1px]" style={{ color: "#9a9aa2" }}>
              Roster label
            </label>
            <select
              value={npRoster}
              onChange={(e) => setNpRoster(e.target.value as "Names" | "Athletes")}
              className="w-full mt-1 rounded-[10px] px-3 py-[10px] text-sm outline-none"
              style={{ background: "#0a0a0e", border: "1px solid rgba(255,255,255,.14)", color: "#FAF8F5" }}
            >
              <option value="Names">Names</option>
              <option value="Athletes">Athletes</option>
            </select>
            <div className="flex gap-2 mt-6">
              <button
                onClick={createPackage}
                disabled={busy}
                className="flex-1 rounded-[10px] py-[11px] text-[12px] font-bold uppercase tracking-[.4px] text-white disabled:opacity-60"
                style={{ background: PKG_ORANGE }}
              >
                {busy ? "Creating…" : "Create package"}
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="rounded-[10px] px-4 py-[11px] text-[12px] font-bold uppercase tracking-[.4px]"
                style={{ color: "#FAF8F5", border: "1px solid rgba(255,255,255,.12)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
