"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Brand } from "@/lib/types";

type FilterMode = "all" | "complete" | "partial" | "empty";

const KIT_ITEMS = ["Logo", "Dark", "Light", "Mark", "Font", "Colors", "Guide", "Notes"] as const;

function getKitScore(b: Brand & Record<string, unknown>): number {
  let score = 0;
  if (b.logo_url || b.logo_primary_url) score++;
  if (b.logo_dark_url) score++;
  if (b.logo_light_url) score++;
  if (b.logo_mark_url) score++;
  if (b.font_primary) score++;
  if (b.primary_color) score++;
  const colors = b.brand_colors as { hex: string; name: string }[] | null;
  if (colors && Array.isArray(colors) && colors.length > 0) score++;
  return score;
}

function getKitChecklist(b: Brand & Record<string, unknown>): boolean[] {
  const colors = b.brand_colors as { hex: string; name: string }[] | null;
  return [
    !!(b.logo_url || b.logo_primary_url),
    !!b.logo_dark_url,
    !!b.logo_light_url,
    !!b.logo_mark_url,
    !!b.font_primary,
    !!(b.primary_color),
    !!b.brand_guidelines_url,
    !!b.kit_notes,
  ];
}

function getKitLabel(score: number): { label: string; color: string; bg: string } {
  if (score === 0) return { label: "No Kit", color: "text-gray-500", bg: "bg-gray-800" };
  if (score === 7) return { label: "Complete", color: "text-green-400", bg: "bg-green-900/30" };
  return { label: "Partial", color: "text-yellow-400", bg: "bg-yellow-900/30" };
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function BrandKitList() {
  const router = useRouter();
  const [brands, setBrands] = useState<(Brand & Record<string, unknown>)[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  useEffect(() => {
    loadBrands();
  }, []);

  async function loadBrands() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase
      .from("brands")
      .select("*")
      .eq("archived", false)
      .order("name");

    if (data) {
      // Deduplicate by name (keep first occurrence)
      const seen = new Set<string>();
      const deduped = data.filter((b) => {
        const key = b.name.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setBrands(deduped);
    }
    setLoading(false);
  }

  const filtered = brands.filter((b) => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
    const score = getKitScore(b);
    if (filter === "complete" && score !== 7) return false;
    if (filter === "partial" && (score === 0 || score === 7)) return false;
    if (filter === "empty" && score !== 0) return false;
    return true;
  });

  const totalBrands = brands.length;
  const withKit = brands.filter((b) => getKitScore(b) > 0).length;
  const needKit = totalBrands - withKit;
  const coveragePct = totalBrands > 0 ? Math.round((withKit / totalBrands) * 100) : 0;

  if (loading) {
    return <div className="text-gray-500 py-12 text-center">Loading brands...</div>;
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-6 p-4 bg-[#111] border border-gray-800 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-white">{totalBrands}</span>
          <span className="text-xs text-gray-500 font-bold uppercase">Total Brands</span>
        </div>
        <div className="w-px h-8 bg-gray-800" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-green-400">{withKit}</span>
          <span className="text-xs text-gray-500 font-bold uppercase">Have Kit Data</span>
        </div>
        <div className="w-px h-8 bg-gray-800" />
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-yellow-400">{needKit}</span>
          <span className="text-xs text-gray-500 font-bold uppercase">Need Kits</span>
        </div>
        <div className="w-px h-8 bg-gray-800" />
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs text-gray-500 font-bold uppercase whitespace-nowrap">Coverage</span>
          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D73F09] rounded-full transition-all"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
          <span className="text-sm font-bold text-white">{coveragePct}%</span>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 outline-none focus:border-gray-600 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "complete", "partial", "empty"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors capitalize ${
                filter === f
                  ? "bg-[#D73F09] text-white"
                  : "bg-[#111] border border-gray-800 text-gray-500 hover:text-white hover:border-gray-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600">No brands match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((b) => {
            const score = getKitScore(b);
            const checklist = getKitChecklist(b);
            const kit = getKitLabel(score);
            const colors = (b.brand_colors as { hex: string; name: string }[] | null) || [];
            const allColors = [
              ...(b.primary_color ? [b.primary_color as string] : []),
              ...colors.map((c) => c.hex),
            ].slice(0, 6);

            return (
              <div
                key={b.id}
                onClick={() => router.push(`/dashboard/brands/${b.id}`)}
                className="p-4 bg-[#111] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors cursor-pointer"
              >
                {/* Top row: logo + name + badge */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900 border border-gray-800 flex items-center justify-center">
                    {b.logo_url ? (
                      <img src={b.logo_url as string} alt={b.name} className="w-full h-full object-contain" />
                    ) : (
                      <span
                        className="text-[10px] font-black text-white w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: (b.primary_color as string) || "#D73F09" }}
                      >
                        {getInitials(b.name)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-white truncate">{b.name}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${kit.bg} ${kit.color}`}>
                      {kit.label}
                    </span>
                  </div>
                </div>

                {/* Color dots */}
                {allColors.length > 0 && (
                  <div className="flex gap-1 mb-3">
                    {allColors.map((c, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full border border-white/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}

                {/* 8-item checklist grid */}
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {KIT_ITEMS.map((item, i) => (
                    <div
                      key={item}
                      className={`text-[9px] font-bold text-center py-1 rounded ${
                        checklist[i]
                          ? "bg-green-900/30 text-green-400"
                          : "bg-gray-800/50 text-gray-700"
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D73F09] rounded-full transition-all"
                    style={{ width: `${Math.round((score / 7) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
